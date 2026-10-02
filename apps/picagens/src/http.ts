// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Pedidos JSON às APIs do Picagens (quiosque e colaborador). Sem rede → NetworkError (a picagem vai para a
// fila); resposta de erro do servidor → ApiError com o código HTTP e a mensagem já em português.
import * as Application from 'expo-application';

import { REQUEST_TIMEOUT_MS } from './config';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class NetworkError extends Error {}

export const appVersion = Application.nativeApplicationVersion ?? '0.0.0';

export function createClient(baseUrl: string) {
  return async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, token?: string | null): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-App-Versao': appVersion,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new NetworkError('Sem ligação ao servidor.');
    } finally {
      clearTimeout(timer);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new ApiError(response.status, data.erro || 'Não foi possível concluir o pedido.');
    }
    return data as T;
  };
}
