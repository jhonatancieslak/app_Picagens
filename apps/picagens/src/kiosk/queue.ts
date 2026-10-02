// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Fila de picagens feitas sem rede. Cada picagem guarda a hora do toque (offline_em); o servidor
// aceita-as até 48 h depois. O PIN fica no armazenamento seguro (Keystore), nunca no ficheiro; a foto
// fica num ficheiro privado da app e é apagada assim que a picagem é enviada ou recusada.
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { ApiError, NetworkError, api } from './api';

interface QueuedPunch {
  id: string;
  offlineAt: string;
  hasPhoto: boolean;
}

export interface QueueStatus {
  pending: number;
  rejected: number;
}

const queueDir = new Directory(Paths.document, 'fila');
const indexFile = new File(Paths.document, 'fila.json');
const pinKey = (id: string) => `fila_pin_${id}`;
const photoFile = (id: string) => new File(queueDir, `${id}.b64`);

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
  const file = photoFile(item.id);
  if (file.exists) file.delete();
}

export async function enqueuePunch(pin: string, photoBase64: string | null): Promise<void> {
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(pinKey(id), pin);
  if (photoBase64) {
    if (!queueDir.exists) queueDir.create();
    const file = photoFile(id);
    file.create();
    file.write(photoBase64);
  }
  writeIndex([...readIndex(), { id, offlineAt: new Date().toISOString(), hasPhoto: Boolean(photoBase64) }]);
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
    for (const item of readIndex()) {
      const pin = await SecureStore.getItemAsync(pinKey(item.id));
      const file = photoFile(item.id);
      const foto = item.hasPhoto && file.exists ? await file.text() : null;
      try {
        if (pin) await api.punch(token, { pin, foto, offline_em: item.offlineAt });
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

/** Tablet desligado da empresa: nada pode ficar guardado. */
export async function clearQueue() {
  for (const item of readIndex()) await forget(item);
  writeIndex([]);
}
