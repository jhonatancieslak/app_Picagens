// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Picagens feitas no telemóvel sem rede. Guardam a hora do toque (offline_em) e a posição desse momento;
// o servidor aceita-as até 48 h depois. Cada uma leva o id do colaborador: se outra pessoa entrar no mesmo
// telemóvel, o servidor recusa (409) em vez de gravar em nome errado.
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';

import { ApiError, NetworkError } from '../http';
import { PunchPayload, employeeApi } from './api';

interface QueuedPunch extends PunchPayload {
  id: string;
}

const indexFile = new File(Paths.document, 'fila_colaborador.json');
let flushing = false;

function readQueue(): QueuedPunch[] {
  try {
    return indexFile.exists ? JSON.parse(indexFile.textSync()) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedPunch[]) {
  if (!indexFile.exists) indexFile.create();
  indexFile.write(JSON.stringify(items));
}

/** `tappedAt`: hora do toque no botão (não a de quando a leitura da posição acabou). */
export function enqueueEmployeePunch(payload: PunchPayload, tappedAt: string = new Date().toISOString()) {
  writeQueue([...readQueue(), { ...payload, id: Crypto.randomUUID(), offline_em: tappedAt }]);
}

export const pendingEmployeePunches = () => readQueue().length;

/** Envia por ordem. Pára no primeiro erro de rede ou de sessão; recusadas pelo servidor saem da fila
 *  e são devolvidas para o ecrã avisar (a pessoa pode pedir correção). */
export async function flushEmployeeQueue(token: string): Promise<{ sent: number; refused: string[] }> {
  const result = { sent: 0, refused: [] as string[] };
  if (flushing) return result;
  flushing = true;
  try {
    for (const item of readQueue()) {
      const { id, ...payload } = item;
      try {
        await employeeApi.punch(token, payload);
        result.sent += 1;
      } catch (error) {
        if (error instanceof NetworkError) break;
        if (error instanceof ApiError && [401, 426, 429].includes(error.status)) break;
        result.refused.push(error instanceof ApiError ? error.message : 'Picagem recusada.');
      }
      writeQueue(readQueue().filter((queued) => queued.id !== id));
    }
  } finally {
    flushing = false;
  }
  return result;
}

export function clearEmployeeQueue() {
  writeQueue([]);
}
