// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Cliente da API do quiosque (/api/quiosque/v1). Sem rede → NetworkError (a picagem vai para a fila);
// resposta de erro do servidor → ApiError com o código HTTP e a mensagem já em português.
import * as Application from 'expo-application';

import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';

export type LicenseState = 'ativa' | 'a_terminar' | 'em_atraso' | 'suspensa';

export interface KioskConfig {
  empresa: string;
  tablet: string;
  local: string | null;
  cor: string;
  logo_url: string;
  foto: { retencao_dias: number; lado_maximo_px: number };
  fuso: string;
  agora: string;
  licenca: { estado: LicenseState; ate: string | null };
  versao_minima: string;
}

export interface PunchResult {
  nome: string;
  tipo: string;
  rotulo: string;
  hora: string;
  offline: boolean;
  foto: boolean;
}

export interface PunchRequest {
  pin: string;
  foto?: string | null;
  offline_em?: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class NetworkError extends Error {}

export const appVersion = Application.nativeApplicationVersion ?? '1.0.0';

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, token?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
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
}

export const api = {
  activate: (chave: string, modelo: string) =>
    request<{ token: string; empresa: string; tablet: string }>('POST', '/ativar', { chave, modelo, versao: appVersion }),
  config: (token: string) => request<KioskConfig>('GET', '/config', undefined, token),
  punch: (token: string, payload: PunchRequest) => request<PunchResult>('POST', '/picar', payload, token),
  adminLogin: (token: string, pinAdmin: string) =>
    request<{ admin_token: string; validade_minutos: number }>('POST', '/admin/entrar', { pin_admin: pinAdmin }, token),
};
