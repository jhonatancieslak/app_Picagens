// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Fila de picagens feitas sem rede. Cada picagem guarda a hora do toque (offline_em); o servidor
// aceita-as até 48 h depois. O PIN fica no armazenamento seguro (Keystore), nunca no ficheiro.
// Sem fotos desde 18/11/2026 (doc 166): as picagens antigas com foto ainda na fila seguem sem ela, e os
// ficheiros de foto antigos são apagados quando a picagem sai da fila.
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { OFFLINE_MAX_HOURS } from '../config';
import { ApiError, NetworkError, api } from './api';

interface QueuedPunch {
  id: string;
  offlineAt: string;
}

export interface QueueStatus {
  pending: number;
  rejected: number;
}

const queueDir = new Directory(Paths.document, 'fila');
const indexFile = new File(Paths.document, 'fila.json');
const pinKey = (id: string) => `fila_pin_${id}`;
const PHOTO_KEY = 'fila_foto_chave';
/** Ficheiros de foto das versões antigas: só se apagam ao sair da fila. */
const photoFile = (id: string) => new File(queueDir, `${id}.enc`);
const legacyPhotoFile = (id: string) => new File(queueDir, `${id}.b64`);
const MAX_AGE_MS = OFFLINE_MAX_HOURS * 60 * 60 * 1000;

let rejectedSinceStart = 0;
let flushing = false;

function readIndex(): QueuedPunch[] {
  try {
    return indexFile.exists ? JSON.parse(indexFile.textSync()) : [];
  } catch {
    return [];
  }
}

function writeIndex(items: QueuedPunch[]) {
  if (!indexFile.exists) indexFile.create();
  indexFile.write(JSON.stringify(items));
}

async function forget(item: QueuedPunch) {
  await SecureStore.deleteItemAsync(pinKey(item.id));
  [photoFile(item.id), legacyPhotoFile(item.id)].forEach((file) => {
    if (file.exists) file.delete();
  });
}

/** Tira da fila (e apaga PIN) o que já passou do prazo que o servidor aceita. */
async function dropExpired(): Promise<number> {
  const now = Date.now();
  const items = readIndex();
  const expired = items.filter((item) => now - new Date(item.offlineAt).getTime() > MAX_AGE_MS);
  for (const item of expired) await forget(item);
  if (expired.length) writeIndex(items.filter((item) => !expired.includes(item)));
  return expired.length;
}

/** No arranque do tablet: mesmo sem rede, nada fica guardado além do prazo. */
export const purgeExpiredQueue = dropExpired;

export async function enqueuePunch(pin: string): Promise<void> {
  await dropExpired();
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(pinKey(id), pin);
  writeIndex([...readIndex(), { id, offlineAt: new Date().toISOString() }]);
}

export function queueStatus(): QueueStatus {
  return { pending: readIndex().length, rejected: rejectedSinceStart };
}

/** Envia por ordem. Pára ao primeiro erro de rede; picagens recusadas pelo servidor (PIN errado,
 *  fora de prazo) saem da fila e contam como recusadas para o admin ver. */
export async function flushQueue(token: string): Promise<QueueStatus> {
  if (flushing) return queueStatus();
  flushing = true;
  try {
    rejectedSinceStart += await dropExpired();
    for (const item of readIndex()) {
      const pin = await SecureStore.getItemAsync(pinKey(item.id));
      try {
        if (pin) await api.punch(token, { pin, offline_em: item.offlineAt });
      } catch (error) {
        if (error instanceof NetworkError) break;
        if (error instanceof ApiError && [401, 426, 429].includes(error.status)) break;
        rejectedSinceStart += 1;
      }
      await forget(item);
      writeIndex(readIndex().filter((queued) => queued.id !== item.id));
    }
  } finally {
    flushing = false;
  }
  return queueStatus();
}

/** Tablet desligado da empresa: nada pode ficar guardado (nem a chave antiga das fotos). */
export async function clearQueue() {
  for (const item of readIndex()) await forget(item);
  writeIndex([]);
  await SecureStore.deleteItemAsync(PHOTO_KEY);
}
