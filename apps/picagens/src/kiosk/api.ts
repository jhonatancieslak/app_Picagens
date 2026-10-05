// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Cliente da API do quiosque (/api/quiosque/v1). Erros: ver ../http.ts.
import { KIOSK_API_URL } from '../config';
import { ApiError, NetworkError, appVersion, createClient } from '../http';

export { ApiError, NetworkError };

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
  /** Versão mais recente e link do APK (servidor ≥ 05/10/2026): o admin do tablet mostra "Nova versão disponível". */
  versao_atual?: string;
  url_atualizacao?: string;
}

export interface KeyCheck {
  empresa: string;
  tablet: string;
  local: string | null;
  acessos: { em_uso: number; limite: number | null };
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

const request = createClient(KIOSK_API_URL);

export const api = {
  activate: (chave: string, modelo: string) =>
    request<{ token: string; empresa: string; tablet: string }>('POST', '/ativar', { chave, modelo, versao: appVersion }),
  /** Só lê: empresa, local e nome do tablet antes de gastar a chave (doc 49 §9). */
  verify: (chave: string) => request<KeyCheck>('POST', '/ativar/verificar', { chave }),
  config: (token: string) => request<KioskConfig>('GET', '/config', undefined, token),
  punch: (token: string, payload: PunchRequest) => request<PunchResult>('POST', '/picar', payload, token),
  adminLogin: (token: string, pinAdmin: string) =>
    request<{ admin_token: string; validade_minutos: number }>('POST', '/admin/entrar', { pin_admin: pinAdmin }, token),
};
