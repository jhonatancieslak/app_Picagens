// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Cliente da API do colaborador (/api/v1/mobile, doc 43 §3). Mesmas regras da PWA no servidor.
import { EMPLOYEE_API_URL, UPLOAD_TIMEOUT_MS } from '../config';
import { createClient } from '../http';
import type { LicenseState } from '../kiosk/api';

export type PunchType = 'entrada' | 'saida' | 'pausa_inicio' | 'pausa_fim';

export interface Me {
  /** true enquanto o colaborador não aceitou a versão atual dos termos (servidor: /eu). */
  termos_pendentes?: boolean;
  /** foto_versao muda quando a foto de perfil muda (servidor 2.3.0); null = sem foto. */
  colaborador: { id: string; nome: string; foto_versao?: number | null };
  empresa: { slug: string; nome: string };
  local: string | null;
  /** Chefe de equipa (servidor 14/10, doc 62): null para quem não chefia; com equipas aparece o separador Equipa. */
  chefe?: { equipas: TeamRef[] } | null;
  versao_minima: string;
  /** Versão mais recente publicada e o link do APK (servidor ≥ 05/10/2026); a app mostra "Nova versão disponível". */
  versao_atual?: string;
  url_atualizacao?: string;
  licenca: { estado: LicenseState; ate: string | null };
  /** ver_pin (servidor 20/10): a empresa tem tablet ou PC de picagem ativo → cartão «PIN de picagem» em Hoje. */
  opcoes: { localizacao_obrigatoria: boolean; bloqueio_fora_do_local: boolean; so_na_rede_da_empresa: boolean; lembretes_picagem?: boolean; ver_pin?: boolean };
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

/** «Esqueci-me do PIN» (servidor 20/10): o 1.º passo responde igual exista ou não o NIF (não revela quem trabalha lá). */
export interface PinCodeRequest {
  token: string;
  mensagem: string;
  validade_minutos: number;
}

/** 2.º passo certo: sessão nova + o PIN novo, a mostrar uma vez (nunca guardar). */
export interface PinReset extends Session {
  pin: string;
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
  /** UUID gerado no toque: o mesmo no envio direto e no reenvio da fila, para o servidor não gravar duas vezes. */
  chave?: string;
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

/** Baixa médica (2.3.1+): foto do certificado em base64 no JSON (o multipart falhava no Android antes de sair). */
export interface SickLeaveBody {
  data_inicio: string;
  data_fim?: string;
  motivo?: string;
  documento: string;
  documento_nome: string;
}

// ── Chefe de equipa (doc 62, 2.4.0): só presença e faltas da equipa, nunca saldos, horas, fotos ou GPS ──

export interface TeamRef {
  id: string;
  nome: string;
  local: string | null;
}

export type MemberState = 'a_trabalhar' | 'saiu' | 'em_falta_entrada' | 'em_falta_saida' | 'correcao_pendente' | 'ausente' | 'folga' | 'por_comecar';

export interface TeamToday {
  equipa: TeamRef;
  equipas: TeamRef[];
  resumo: { a_trabalhar: number; em_falta: number; ausentes: number };
  membros: { id: string; nome: string; iniciais: string; estado: MemberState; hora: string | null; horario: string | null; motivo: string | null }[];
}

export type MissingType = 'entrada' | 'saida';

export interface TeamMissing {
  equipa: TeamRef;
  dias: number;
  faltas: { colaborador_id: string; nome: string; iniciais: string; data: string; tipo: MissingType; horario: string }[];
}

export type OpinionSense = 'favoravel' | 'desfavoravel';

export interface TeamRequests {
  equipa: TeamRef;
  pedidos: {
    tipo: 'ferias' | 'baixa'; id: string; colaborador_id: string; nome: string; iniciais: string;
    data_inicio: string | null; data_fim: string | null; tipo_ferias: string | null;
    parecer: { sentido: OpinionSense; nota: string | null } | null;
  }[];
  correcoes: { id: string; colaborador_id: string; nome: string; iniciais: string; data: string; tipo: MissingType; hora: string; estado: RequestState }[];
}

/** Códigos por dia: P picou · X falta · C correção · F férias · B baixa · H feriado · - folga · null = ainda não. */
export interface TeamMap {
  equipa: TeamRef;
  ano: number;
  mes: number;
  num_dias: number;
  membros: { id: string; nome: string; iniciais: string; dias: (string | null)[]; faltas: number }[];
}

/** Picagens de um dia por membro (separador «Picagens», 2.7.0, canvas 45): hora e tipo, sem GPS nem foto. */
export interface TeamPunches {
  equipa: TeamRef;
  dias: number;
  data: string;
  datas: string[];
  membros: {
    colaborador_id: string; nome: string; iniciais: string;
    picagens: { id: string; tipo: string; hora: string; pendente: boolean; corrigida: boolean }[];
    faltas: { tipo: MissingType; horario: string }[];
  }[];
}

/** Picagem em falta: colaborador_id + data; hora errada / tipo trocado numa picagem que existe: picagem_id. */
export interface TeamCorrection {
  colaborador_id?: string;
  data?: string;
  picagem_id?: string;
  tipo: MissingType;
  hora: string;
  motivo: string;
  nota?: string;
}

const request = createClient(EMPLOYEE_API_URL);

/** Cabeçalho com a prova do PIN do separador Equipa (válida 12 h, /equipa/confirmar-pin). */
const teamHeaders = (pinToken: string) => ({ 'X-Equipa-Token': pinToken });
const teamQuery = (equipa?: string | null, extra = '') => {
  const params = [equipa ? `equipa=${encodeURIComponent(equipa)}` : '', extra].filter(Boolean).join('&');
  return params ? `?${params}` : '';
};

export const employeeApi = {
  activate: (empresa: string, token: string) => request<Session>('POST', '/sessao/ativar', { empresa, token }),
  company: (codigo: string) => request<Company>('POST', '/empresa', { codigo }),
  login: (codigo: string, nif: string, pin: string) => request<Session>('POST', '/sessao/entrar', { codigo, nif, pin }),
  renew: (token: string) => request<Session>('POST', '/sessao/renovar', {}, token),
  acceptTerms: (token: string, versao: string) => request<{ ok: boolean }>('POST', '/termos/aceitar', { versao }, token),
  pinRequestCode: (codigo: string, nif: string) => request<PinCodeRequest>('POST', '/pin/pedir-codigo', { codigo, nif }),
  pinConfirm: (codigo: string, token: string, codigo_email: string) => request<PinReset>('POST', '/pin/confirmar', { codigo, token, codigo_email }),
  newPin: (token: string) => request<{ pin: string; restantes_hoje: number }>('POST', '/eu/pin', {}, token),
  dashboard: (token: string) => request<Dashboard>('GET', '/painel', undefined, token),
  checkPlace: (token: string, lat: number, lon: number) => request<PlaceCheck>('POST', '/verificar-local', { lat, lon }, token),
  punch: (token: string, payload: PunchPayload) => request<{ tipo: PunchType; hora: string }>('POST', '/picar', payload, token),
  records: (token: string, ano: number, mes: number) => request<MonthRecords>('GET', `/registos?ano=${ano}&mes=${mes}`, undefined, token),
  confirmVisto: (token: string, visto: Visto) =>
    request<{ mensagem: string }>('POST', '/registos/visto', { inicio: visto.inicio, fim: visto.fim, hash: visto.hash, confirmo: true }, token),
  requests: (token: string) => request<Requests>('GET', '/pedidos', undefined, token),
  requestVacation: (token: string, data_inicio: string, data_fim: string, tipo_ferias_id?: string) =>
    request<{ id: string; mensagem: string }>('POST', '/pedidos/ferias', { data_inicio, data_fim, tipo_ferias_id }, token),
  requestSickLeave: (token: string, body: SickLeaveBody) => request<{ id: string; mensagem: string }>('POST', '/pedidos/baixa', body, token, UPLOAD_TIMEOUT_MS),
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
  readAllMessages: (token: string) => request<{ marcadas: number }>('POST', '/mensagens/lidas', {}, token),
  deleteMessage: (token: string, id: string) => request<{ ok: boolean }>('DELETE', `/mensagens/${encodeURIComponent(id)}`, undefined, token),
  profilePhoto: (token: string, version: number) => request<{ foto: string }>('GET', `/perfil/foto?formato=base64&v=${version}`, undefined, token),
  uploadProfilePhoto: (token: string, foto: string) => request<{ foto_versao: number }>('POST', '/perfil/foto', { foto }, token),
  deleteProfilePhoto: (token: string) => request<{ ok: boolean }>('DELETE', '/perfil/foto', undefined, token),
  setReminders: (token: string, ativo: boolean) => request<{ lembretes_picagem: boolean }>('POST', '/perfil/lembretes', { ativo }, token),
  registerPush: (token: string, pushToken: string, plataforma: 'android' | 'ios') =>
    request<{ ok: boolean }>('POST', '/notificacoes/registar', { token: pushToken, plataforma }, token),
  unregisterPush: (token: string, pushToken: string) => request<{ ok: boolean }>('POST', '/notificacoes/remover', { token: pushToken }, token),
};

/** Alerta de horário da equipa de hoje (doc 226): atraso ou saída antecipada, com a tolerância da empresa. */
export interface TeamAlert { colaborador_id: string; nome: string; tipo: 'atraso' | 'saida_antecipada'; previsto: string; real: string; minutos: number }
/** Pedido de correção de um colaborador da equipa que o chefe autorizado pode decidir (doc 229, decisão 7). */
export interface TeamCollaboratorCorrection { id: string; colaborador_id: string; nome: string; tipo: string; data_hora: string; motivo: string }

export const teamApi = {
  alerts: (token: string, pinToken: string, equipa?: string | null) =>
    request<{ alertas: TeamAlert[] }>('GET', `/equipa/alertas${teamQuery(equipa)}`, undefined, token, undefined, teamHeaders(pinToken)),
  decisions: (token: string, pinToken: string, equipa?: string | null) =>
    request<{ correcoes_colaborador: TeamCollaboratorCorrection[] }>('GET', `/equipa/pedidos${teamQuery(equipa)}`, undefined, token, undefined, teamHeaders(pinToken)),
  decideCorrection: (token: string, pinToken: string, id: string, aprovar: boolean, nota?: string) =>
    request<{ ok: boolean; mensagem: string }>('POST', `/equipa/correcoes/${id}/decidir`, { aprovar, nota }, token, undefined, teamHeaders(pinToken)),
  confirmPin: (token: string, pin: string) => request<{ token: string; validade_horas: number }>('POST', '/equipa/confirmar-pin', { pin }, token),
  today: (token: string, pinToken: string, equipa?: string | null) =>
    request<TeamToday>('GET', `/equipa/hoje${teamQuery(equipa)}`, undefined, token, undefined, teamHeaders(pinToken)),
  missing: (token: string, pinToken: string, equipa?: string | null) =>
    request<TeamMissing>('GET', `/equipa/faltas${teamQuery(equipa)}`, undefined, token, undefined, teamHeaders(pinToken)),
  requests: (token: string, pinToken: string, equipa?: string | null) =>
    request<TeamRequests>('GET', `/equipa/pedidos${teamQuery(equipa)}`, undefined, token, undefined, teamHeaders(pinToken)),
  map: (token: string, pinToken: string, equipa: string | null, ano?: number, mes?: number) =>
    request<TeamMap>('GET', `/equipa/mapa${teamQuery(equipa, ano && mes ? `ano=${ano}&mes=${mes}` : '')}`, undefined, token, undefined, teamHeaders(pinToken)),
  punches: (token: string, pinToken: string, equipa?: string | null, data?: string | null) =>
    request<TeamPunches>('GET', `/equipa/picagens${teamQuery(equipa, data ? `data=${encodeURIComponent(data)}` : '')}`, undefined, token, undefined, teamHeaders(pinToken)),
  propose: (token: string, pinToken: string, body: TeamCorrection) =>
    request<{ id: string; mensagem: string }>('POST', '/equipa/correcoes', body, token, undefined, teamHeaders(pinToken)),
  opinion: (token: string, pinToken: string, tipo: 'ferias' | 'baixa', id: string, sentido: OpinionSense) =>
    request<{ mensagem: string }>('POST', `/equipa/pedidos/${tipo}/${encodeURIComponent(id)}/parecer`, { sentido }, token, undefined, teamHeaders(pinToken)),
};
