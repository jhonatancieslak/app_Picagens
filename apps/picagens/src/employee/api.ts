// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Cliente da API do colaborador (/api/v1/mobile, doc 43 §3). Mesmas regras da PWA no servidor.
import { EMPLOYEE_API_URL } from '../config';
import { createClient, createFormClient } from '../http';
import type { LicenseState } from '../kiosk/api';

export type PunchType = 'entrada' | 'saida' | 'pausa_inicio' | 'pausa_fim';

export interface Me {
  /** foto_versao muda quando a foto de perfil muda (servidor 2.3.0); null = sem foto. */
  colaborador: { id: string; nome: string; foto_versao?: number | null };
  empresa: { slug: string; nome: string };
  local: string | null;
  versao_minima: string;
  /** Versão mais recente publicada e o link do APK (servidor ≥ 05/10/2026); a app mostra "Nova versão disponível". */
  versao_atual?: string;
  url_atualizacao?: string;
  licenca: { estado: LicenseState; ate: string | null };
  opcoes: { localizacao_obrigatoria: boolean; bloqueio_fora_do_local: boolean; so_na_rede_da_empresa: boolean; lembretes_picagem?: boolean };
}

/** Empresa encontrada pelo código de 6 algarismos (doc 49): confirma-se antes de pedir NIF e PIN. */
export interface Company {
  codigo: string;
  nome: string;
  logo_url: string | null;
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
  mensagens_nao_lidas?: number;
}

export interface PlaceCheck {
  dentro: boolean | null;
  distancia?: number;
  raio?: number;
  local?: string;
  local_morada?: string | null;
  local_lat?: number;
  local_lon?: number;
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
  /** Android: posição de uma app de GPS falso (Location.mocked). O servidor marca-a e recusa-a com bloqueio. */
  simulado?: boolean;
}

export interface MonthRecords {
  ano: number;
  mes: number;
  mes_nome: string;
  mes_anterior: { ano: number; mes: number };
  mes_seguinte: { ano: number; mes: number };
  horas_mes: string;
  dias: { data: string; horas: string; completo: boolean; picagens: DayPunch[] }[];
  /** Períodos fechados por confirmar (visto do trabalhador, registo ACT). `alterado` = mudou depois do último visto. */
  vistos_pendentes: Visto[];
  declaracao_visto: string;
}

export interface Visto {
  inicio: string;
  fim: string;
  hash: string;
  minutos: number;
  estado: 'por_confirmar' | 'alterado';
  dias?: { data: string; minutos: number; periodos: string[]; observacoes: string[] }[];
}

export type RequestState = 'pendente' | 'aprovada' | 'rejeitada';

export interface Requests {
  ferias: { id: string; data_inicio: string; data_fim: string; estado: RequestState; tipo_ferias_id: string | null; data_inicio_aprovada: string | null; data_fim_aprovada: string | null }[];
  baixas: { id: string; data_inicio: string; data_fim: string | null; estado: RequestState; motivo_rejeicao: string | null }[];
  tipos_ferias: { id: string; nome: string }[];
}

export interface Documents {
  documentos: { id: string; titulo: string; tipo: string; tipo_nome: string; ficheiro: string; valido_ate: string | null; validade: { estado: string | null; dias: number | null }; criado_em: string | null }[];
  contratos_por_assinar: { id: string; titulo: string; criado_em: string | null }[];
}

export interface Contract {
  id: string;
  titulo: string;
  estado: string;
  corpo: string;
  codigo_verificacao: string | null;
  empresa_assinante: string | null;
  empresa_assinou_em: string | null;
  colaborador_assinou_em: string | null;
  documento_id: string | null;
}

export interface Message {
  id: string;
  titulo: string;
  texto: string;
  de: string;
  data: string;
  lida: boolean;
}

export interface CorrectionPayload {
  picagem_id?: string;
  tipo: PunchType;
  /** Hora local no formato do servidor: AAAA-MM-DDTHH:MM. */
  data_hora: string;
  motivo: string;
}

const request = createClient(EMPLOYEE_API_URL);
const sendForm = createFormClient(EMPLOYEE_API_URL);

export const employeeApi = {
  activate: (empresa: string, token: string) => request<Session>('POST', '/sessao/ativar', { empresa, token }),
  company: (codigo: string) => request<Company>('POST', '/empresa', { codigo }),
  login: (codigo: string, nif: string, pin: string) => request<Session>('POST', '/sessao/entrar', { codigo, nif, pin }),
  renew: (token: string) => request<Session>('POST', '/sessao/renovar', {}, token),
  dashboard: (token: string) => request<Dashboard>('GET', '/painel', undefined, token),
  checkPlace: (token: string, lat: number, lon: number) => request<PlaceCheck>('POST', '/verificar-local', { lat, lon }, token),
  punch: (token: string, payload: PunchPayload) => request<{ tipo: PunchType; hora: string }>('POST', '/picar', payload, token),
  records: (token: string, ano: number, mes: number) => request<MonthRecords>('GET', `/registos?ano=${ano}&mes=${mes}`, undefined, token),
  confirmVisto: (token: string, visto: Visto) =>
    request<{ mensagem: string }>('POST', '/registos/visto', { inicio: visto.inicio, fim: visto.fim, hash: visto.hash, confirmo: true }, token),
  requests: (token: string) => request<Requests>('GET', '/pedidos', undefined, token),
  requestVacation: (token: string, data_inicio: string, data_fim: string, tipo_ferias_id?: string) =>
    request<{ id: string; mensagem: string }>('POST', '/pedidos/ferias', { data_inicio, data_fim, tipo_ferias_id }, token),
  requestSickLeave: (token: string, form: FormData) => sendForm<{ id: string; mensagem: string }>('/pedidos/baixa', form, token),
  documents: (token: string) => request<Documents>('GET', '/documentos', undefined, token),
  documentUrl: (id: string) => `${EMPLOYEE_API_URL}/documentos/${encodeURIComponent(id)}`,
  contract: (token: string, id: string) => request<Contract & { ok: boolean }>('GET', `/contratos/${encodeURIComponent(id)}`, undefined, token),
  contractCode: (token: string, id: string) => request<{ mensagem: string }>('POST', `/contratos/${encodeURIComponent(id)}/codigo`, {}, token),
  signContract: (token: string, id: string, nome: string, codigo: string) =>
    request<{ mensagem: string }>('POST', `/contratos/${encodeURIComponent(id)}/assinar`, { nome, codigo, li_e_aceito: true }, token),
  requestCorrection: (token: string, payload: CorrectionPayload) =>
    request<{ id: string; mensagem: string }>('POST', '/registos/correcao', payload, token),
  messages: (token: string) => request<{ nao_lidas: number; mensagens: Message[] }>('GET', '/mensagens', undefined, token),
  readMessage: (token: string, id: string) => request<{ ok: boolean }>('POST', `/mensagens/${encodeURIComponent(id)}/lida`, {}, token),
  profilePhotoUrl: (version: number) => `${EMPLOYEE_API_URL}/perfil/foto?v=${version}`,
  uploadProfilePhoto: (token: string, foto: string) => request<{ foto_versao: number }>('POST', '/perfil/foto', { foto }, token),
  deleteProfilePhoto: (token: string) => request<{ ok: boolean }>('DELETE', '/perfil/foto', undefined, token),
  setReminders: (token: string, ativo: boolean) => request<{ lembretes_picagem: boolean }>('POST', '/perfil/lembretes', { ativo }, token),
  registerPush: (token: string, pushToken: string, plataforma: 'android' | 'ios') =>
    request<{ ok: boolean }>('POST', '/notificacoes/registar', { token: pushToken, plataforma }, token),
  unregisterPush: (token: string, pushToken: string) => request<{ ok: boolean }>('POST', '/notificacoes/remover', { token: pushToken }, token),
};
