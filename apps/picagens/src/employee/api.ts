// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Cliente da API do colaborador (/api/v1/mobile, doc 43 §3). Mesmas regras da PWA no servidor.
import { EMPLOYEE_API_URL } from '../config';
import { createClient } from '../http';
import type { LicenseState } from '../kiosk/api';

export type PunchType = 'entrada' | 'saida' | 'pausa_inicio' | 'pausa_fim';

export interface Me {
  colaborador: { id: string; nome: string };
  empresa: { slug: string; nome: string };
  local: string | null;
  versao_minima: string;
  licenca: { estado: LicenseState; ate: string | null };
  opcoes: { localizacao_obrigatoria: boolean; bloqueio_fora_do_local: boolean; so_na_rede_da_empresa: boolean };
}

export interface Session extends Me {
  token: string;
  validade_dias: number;
}

export interface Notice {
  tipo: 'saida_em_falta' | 'visto' | 'contrato';
  acao: 'correcao' | 'registos' | 'contrato';
  titulo: string;
  detalhe: string;
  data?: string;
  id?: string;
}

export interface DayPunch {
  id?: string;
  tipo: PunchType;
  rotulo: string;
  hora: string;
  fora_do_local: boolean;
  offline: boolean;
  correcao_pendente?: boolean;
}

export interface Dashboard {
  proximo_tipo: PunchType;
  horas_hoje: string;
  data: string;
  vistos_por_confirmar: number;
  avisos: Notice[];
  avisos_total: number;
  picagens_hoje: DayPunch[];
}

export interface PlaceCheck {
  dentro: boolean | null;
  distancia?: number;
  raio?: number;
  local?: string;
  bloqueio: boolean;
  mensagem?: string;
}

export interface PunchPayload {
  lat?: number;
  lon?: number;
  precisao?: number;
  loc_idade_ms?: number;
  offline_em?: string;
  colaborador_id?: string;
}

export interface MonthRecords {
  ano: number;
  mes: number;
  mes_nome: string;
  mes_anterior: { ano: number; mes: number };
  mes_seguinte: { ano: number; mes: number };
  horas_mes: string;
  dias: { data: string; horas: string; completo: boolean; picagens: DayPunch[] }[];
}

const request = createClient(EMPLOYEE_API_URL);

export const employeeApi = {
  activate: (empresa: string, token: string) => request<Session>('POST', '/sessao/ativar', { empresa, token }),
  login: (empresa: string, nif: string, pin: string) => request<Session>('POST', '/sessao/entrar', { empresa, nif, pin }),
  renew: (token: string) => request<Session>('POST', '/sessao/renovar', {}, token),
  dashboard: (token: string) => request<Dashboard>('GET', '/painel', undefined, token),
  checkPlace: (token: string, lat: number, lon: number) => request<PlaceCheck>('POST', '/verificar-local', { lat, lon }, token),
  punch: (token: string, payload: PunchPayload) => request<{ tipo: PunchType; hora: string }>('POST', '/picar', payload, token),
  records: (token: string, ano: number, mes: number) => request<MonthRecords>('GET', `/registos?ano=${ano}&mes=${mes}`, undefined, token),
};
