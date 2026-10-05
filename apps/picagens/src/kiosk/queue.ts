// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Fila de picagens feitas sem rede. Cada picagem guarda a hora do toque (offline_em); o servidor
// aceita-as até 48 h depois. O PIN fica no armazenamento seguro (Keystore), nunca no ficheiro. A foto fica
// num ficheiro privado da app **cifrado com AES-256-GCM** (chave gerada no tablet e guardada no Keystore) e é
// apagada assim que a picagem é enviada ou recusada, ou ao fim de 48 h (o servidor já não a aceitaria).
import * as Crypto from 'expo-crypto';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { OFFLINE_MAX_HOURS } from '../config';
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
const PHOTO_KEY = 'fila_foto_chave';
const photoFile = (id: string) => new File(queueDir, `${id}.enc`);
/** Fila da 2.1.0 (foto em base64 sem cifra): ainda se lê e apaga, para não perder picagens na atualização. */
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

async function photoKey(): Promise<AESEncryptionKey> {
  const saved = await SecureStore.getItemAsync(PHOTO_KEY);
  if (saved) return AESEncryptionKey.import(saved, 'base64');
  const key = await AESEncryptionKey.generate(256);
  await SecureStore.setItemAsync(PHOTO_KEY, await key.encoded('base64'));
  return key;
}

async function readPhoto(item: QueuedPunch): Promise<string | null> {
  if (!item.hasPhoto) return null;
  const sealed = photoFile(item.id);
  if (sealed.exists) {
    try {
      return await aesDecryptAsync(AESSealedData.fromCombined(await sealed.text()), await photoKey(), { output: 'base64' });
    } catch {
      return null; // chave perdida (tablet reposto): a picagem segue sem foto e fica marcada para o gestor rever
    }
  }
  const legacy = legacyPhotoFile(item.id);
  return legacy.exists ? legacy.text() : null;
}

async function forget(item: QueuedPunch) {
  await SecureStore.deleteItemAsync(pinKey(item.id));
  [photoFile(item.id), legacyPhotoFile(item.id)].forEach((file) => {
    if (file.exists) file.delete();
  });
}

/** Tira da fila (e apaga PIN e foto) o que já passou do prazo que o servidor aceita. */
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

export async function enqueuePunch(pin: string, photoBase64: string | null): Promise<void> {
  await dropExpired();
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(pinKey(id), pin);
  let hasPhoto = false;
  if (photoBase64) {
    try {
      const sealed = await aesEncryptAsync(photoBase64, await photoKey());
      if (!queueDir.exists) queueDir.create();
      const file = photoFile(id);
      file.create();
      file.write(await sealed.combined('base64'));
      hasPhoto = true;
    } catch {
      hasPhoto = false; // sem cifra não se guarda a foto em claro: a picagem segue sem foto
    }
  }
  writeIndex([...readIndex(), { id, offlineAt: new Date().toISOString(), hasPhoto }]);
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
      const foto = await readPhoto(item);
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

/** Tablet desligado da empresa: nada pode ficar guardado (nem a chave das fotos). */
export async function clearQueue() {
  for (const item of readIndex()) await forget(item);
  writeIndex([]);
  await SecureStore.deleteItemAsync(PHOTO_KEY);
}
