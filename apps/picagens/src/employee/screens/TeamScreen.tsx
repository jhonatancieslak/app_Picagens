// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// "Equipa" (2.4.0, doc 62, protótipo v7): separador só para chefes de equipa, o mesmo da PWA. Pede o PIN antes de
// mostrar dados de outras pessoas (prova válida 12 h, só em memória); depois Hoje · Faltas · Pedidos · Mapa.
// O chefe vê presença e faltas, nunca saldos, horas, fotos ou GPS; propõe correções e dá parecer, o RH decide.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import {
  MemberState, MissingType, OpinionSense, TeamMap, TeamMissing, TeamRef, TeamRequests, TeamToday, teamApi,
} from '../api';
import { Button, Card, Chip, ChipTone, ErrorText, Field, Header, Muted, NumPad, OtpCells, Row, ToastMessage, applyKey } from '../ui';

const PIN_LENGTH = 4;
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const REASONS = ['Esqueceu-se de picar', 'Telemóvel sem bateria ou sem rede', 'Tablet do local avariado', 'Outro'];
const NOTE_MAX = 500;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TYPE_LABEL: Record<MissingType, string> = { entrada: 'Entrada', saida: 'Saída' };

const STATE: Record<MemberState, { tone: ChipTone; label: string }> = {
  a_trabalhar: { tone: 'ok', label: 'A trabalhar' },
  saiu: { tone: 'neutral', label: 'Saiu' },
  em_falta_entrada: { tone: 'warn', label: 'Sem entrada' },
  em_falta_saida: { tone: 'warn', label: 'Sem saída' },
  correcao_pendente: { tone: 'action', label: 'Correção no RH' },
  ausente: { tone: 'hol', label: 'Ausente' },
  folga: { tone: 'neutral', label: 'Folga' },
  por_comecar: { tone: 'neutral', label: 'Ainda não começou' },
};

const CORRECTION_STATE: Record<string, { tone: ChipTone; label: string }> = {
  pendente: { tone: 'action', label: 'À espera do RH' },
  aprovada: { tone: 'ok', label: 'Aprovada' },
  rejeitada: { tone: 'danger', label: 'Rejeitada' },
};

/** Cores do mapa (protótipo v7): picou verde, falta âmbar, correção azul, férias/baixa roxo, feriado/folga cinza. */
const MAP_CELL: Record<string, { bg: string; fg: string }> = {
  P: { bg: colors.okSoft, fg: colors.ok },
  X: { bg: colors.warnSoft, fg: colors.warnInk },
  C: { bg: colors.actionSoft, fg: colors.action },
  F: { bg: colors.holSoft, fg: colors.hol },
  B: { bg: colors.holSoft, fg: colors.hol },
  H: { bg: '#EEF1F5', fg: colors.ink3 },
  '-': { bg: '#EEF1F5', fg: colors.ink3 },
};
const MAP_LEGEND: [string, string][] = [['P', 'picou'], ['X', 'falta'], ['C', 'correção'], ['F', 'férias'], ['B', 'baixa'], ['H', 'feriado'], ['-', 'folga']];

type Tab = 'today' | 'missing' | 'requests' | 'map';
const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Hoje' }, { key: 'missing', label: 'Faltas' }, { key: 'requests', label: 'Pedidos' }, { key: 'map', label: 'Mapa' },
];

interface Missing { id: string; nome: string; data: string; tipo: MissingType; hora: string }

export interface TeamPin { token: string; until: number }

const datePt = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Hora sugerida para a correção: início (entrada) ou fim (saída) do horário "09:00–18:00". */
const scheduleTime = (horario: string | null, tipo: MissingType) => (horario ? horario.split('–')[tipo === 'entrada' ? 0 : 1] ?? '' : '');
const errorText = (exc: unknown) => (exc instanceof NetworkError ? 'Sem rede. Puxe para atualizar quando houver ligação.' : exc instanceof ApiError ? exc.message : 'Não foi possível carregar.');
const needsPin = (exc: unknown) => exc instanceof ApiError && exc.status === 401 && exc.data.pin_necessario === true;

export function TeamScreen({ token, teams, pin, onPin, onAuthError, toast }: {
  token: string;
  teams: TeamRef[];
  pin: TeamPin | null;
  onPin: (pin: TeamPin | null) => void;
  onAuthError: (error: unknown) => boolean;
  toast: (message: ToastMessage) => void;
}) {
  const valid = pin && pin.until > Date.now() ? pin.token : null;
  if (!valid) return <PinGate token={token} onPin={onPin} onAuthError={onAuthError} />;
  return <TeamBody token={token} pinToken={valid} teams={teams} onPinExpired={() => onPin(null)} onAuthError={onAuthError} toast={toast} />;
}

function PinGate({ token, onPin, onAuthError }: { token: string; onPin: (pin: TeamPin) => void; onAuthError: (error: unknown) => boolean }) {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = useCallback(async (code: string) => {
    setBusy(true);
    setError('');
    try {
      const result = await teamApi.confirmPin(token, code);
      onPin({ token: result.token, until: Date.now() + result.validade_horas * 3_600_000 });
    } catch (exc) {
      setValue('');
      if (!onAuthError(exc)) setError(exc instanceof ApiError && exc.status === 403 ? 'PIN errado. Tente de novo.' : errorText(exc));
    } finally {
      setBusy(false);
    }
  }, [token, onPin, onAuthError]);

  const press = (key: string) => {
    if (busy) return;
    const next = applyKey(value, key, PIN_LENGTH);
    setValue(next);
    if (next.length === PIN_LENGTH && key !== '⌫') confirm(next);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 110, gap: 14 }}>
      <Header subtitle="Chefe de equipa" title="Equipa" />
      <Muted size={15}>Aqui vê dados de outras pessoas. Confirme o seu PIN (o mesmo do tablet da obra). Pedimos de novo a cada 12 horas.</Muted>
      <OtpCells value={'•'.repeat(value.length)} length={PIN_LENGTH} />
      {busy ? <ActivityIndicator color={colors.action} /> : <ErrorText>{error}</ErrorText>}
      <NumPad onKey={press} />
    </ScrollView>
  );
}

function TeamBody({ token, pinToken, teams, onPinExpired, onAuthError, toast }: {
  token: string;
  pinToken: string;
  teams: TeamRef[];
  onPinExpired: () => void;
  onAuthError: (error: unknown) => boolean;
  toast: (message: ToastMessage) => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('today');
  const [team, setTeam] = useState<string | null>(teams[0]?.id ?? null);
  const [today, setToday] = useState<TeamToday | null>(null);
  const [missing, setMissing] = useState<TeamMissing | null>(null);
  const [requests, setRequests] = useState<TeamRequests | null>(null);
  const [map, setMap] = useState<TeamMap | null>(null);
  const [month, setMonth] = useState<{ ano: number; mes: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fix, setFix] = useState<Missing | null>(null);

  /** 401 com pin_necessario = prova do PIN caducada (volta ao pedido de PIN); outro 401/426 = sessão. */
  const fail = useCallback((exc: unknown) => {
    if (needsPin(exc)) { onPinExpired(); return; }
    if (!onAuthError(exc)) setError(errorText(exc));
  }, [onPinExpired, onAuthError]);

  // Contadores das abas (Faltas e Pedidos sem parecer) logo à entrada, como na PWA.
  const loadCounts = useCallback(async () => {
    try {
      const [m, r] = await Promise.all([teamApi.missing(token, pinToken, team), teamApi.requests(token, pinToken, team)]);
      setMissing(m);
      setRequests(r);
    } catch (exc) {
      fail(exc);
    }
  }, [token, pinToken, team, fail]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'today') setToday(await teamApi.today(token, pinToken, team));
      if (tab === 'missing') setMissing(await teamApi.missing(token, pinToken, team));
      if (tab === 'requests') setRequests(await teamApi.requests(token, pinToken, team));
      if (tab === 'map') {
        const data = await teamApi.map(token, pinToken, team, month?.ano, month?.mes);
        setMap(data);
      }
    } catch (exc) {
      fail(exc);
    } finally {
      setLoading(false);
    }
  }, [tab, token, pinToken, team, month, fail]);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { load(); }, [load]);

  const changeMonth = (delta: number) => {
    if (!map) return;
    let mes = map.mes + delta;
    let ano = map.ano;
    if (mes < 1) { mes = 12; ano -= 1; }
    if (mes > 12) { mes = 1; ano += 1; }
    setMonth({ ano, mes });
  };

  const giveOpinion = async (tipo: 'ferias' | 'baixa', id: string, sentido: OpinionSense) => {
    try {
      const result = await teamApi.opinion(token, pinToken, tipo, id, sentido);
      toast({ tone: 'ok', title: 'Parecer enviado', text: result.mensagem });
    } catch (exc) {
      if (needsPin(exc)) { onPinExpired(); return; }
      if (!onAuthError(exc)) toast({ tone: 'err', title: 'Não foi enviado', text: errorText(exc) });
    }
    load();
  };

  const missingCount = missing?.faltas.length ?? 0;
  const opinionCount = requests?.pedidos.filter((p) => !p.parecer).length ?? 0;
  const current = teams.find((t) => t.id === team) ?? teams[0];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 110, gap: 12 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { load(); loadCounts(); }} />}
      >
        <Header subtitle={current?.local ? `Chefe de equipa · ${current.local}` : 'Chefe de equipa'} title={current?.nome ?? 'Equipa'} />

        {teams.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {teams.map((t) => (
              <Pill key={t.id} label={t.local ? `${t.nome} · ${t.local}` : t.nome} active={t.id === team} onPress={() => { setTeam(t.id); setMonth(null); }} />
            ))}
          </ScrollView>
        ) : null}

        <View style={{ flexDirection: 'row', backgroundColor: '#EEF1F5', borderRadius: 14, padding: 4, gap: 4 }} accessibilityRole="tablist">
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            const count = key === 'missing' ? missingCount : key === 'requests' ? opinionCount : 0;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={count ? `${label}, ${count}` : label}
                onPress={() => setTab(key)}
                style={{ flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, backgroundColor: active ? colors.surface : 'transparent' }}
              >
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: active ? colors.ink : colors.ink2 }}>{label}</Text>
                {count ? (
                  <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10.5, color: '#fff' }}>{count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {error ? <Card style={{ padding: 14 }}><ErrorText>{error}</ErrorText></Card> : null}

        {tab === 'today' && today ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Stat value={today.resumo.a_trabalhar} label="A trabalhar" bg={colors.okSoft} fg={colors.ok} />
              <Stat value={today.resumo.em_falta} label="Em falta" bg={colors.warnSoft} fg={colors.warnInk} />
              <Stat value={today.resumo.ausentes} label="Ausentes" bg={colors.holSoft} fg={colors.hol} />
            </View>
            <Card>
              {today.membros.length ? today.membros.map((m, index) => {
                const missingType: MissingType | null = m.estado === 'em_falta_entrada' ? 'entrada' : m.estado === 'em_falta_saida' ? 'saida' : null;
                const sub = m.estado === 'ausente' ? m.motivo ?? ''
                  : m.hora ? `${m.estado === 'saiu' ? 'Saiu às' : 'Desde'} ${m.hora}`
                  : m.horario ? `Horário ${m.horario}` : 'Sem horário hoje';
                return (
                  <Row
                    key={m.id}
                    first={index === 0}
                    left={<Initials text={m.iniciais} />}
                    title={m.nome}
                    subtitle={sub}
                    right={missingType
                      ? <FixButton onPress={() => setFix({ id: m.id, nome: m.nome, data: todayIso(), tipo: missingType, hora: scheduleTime(m.horario, missingType) })} />
                      : <Chip tone={STATE[m.estado]?.tone ?? 'neutral'} label={STATE[m.estado]?.label ?? m.estado} />}
                  />
                );
              }) : <Empty text="Ainda não há ninguém nesta equipa. O RH adiciona membros no painel." />}
            </Card>
            <Muted size={12.5} center>Só aparece quem é da sua equipa. Saldos e horas ficam com o RH.</Muted>
          </>
        ) : null}

        {tab === 'missing' && missing ? (
          <Card>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, paddingHorizontal: 14, paddingTop: 14 }}>
              Picagens em falta · últimos {missing.dias} dias
            </Text>
            {missing.faltas.length ? missing.faltas.map((f, index) => (
              <Row
                key={`${f.colaborador_id}-${f.data}-${f.tipo}`}
                first={index === 0}
                left={<Initials text={f.iniciais} />}
                title={f.nome}
                subtitle={`${datePt(f.data)} · ${TYPE_LABEL[f.tipo]} em falta (horário ${f.horario})`}
                right={<FixButton onPress={() => setFix({ id: f.colaborador_id, nome: f.nome, data: f.data, tipo: f.tipo, hora: f.horario })} />}
              />
            )) : <Empty text="Sem picagens em falta. Bom trabalho de equipa." />}
          </Card>
        ) : null}

        {tab === 'requests' && requests ? (
          <>
            <Card style={{ padding: 14, gap: 12 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }}>Férias e baixas para parecer</Text>
              {requests.pedidos.length ? requests.pedidos.map((p, index) => {
                const sense = p.parecer?.sentido;
                const dates = `${datePt(p.data_inicio)}${p.data_fim ? ` a ${datePt(p.data_fim)}` : ' (sem data de fim)'}`;
                return (
                  <View key={`${p.tipo}-${p.id}`} style={{ gap: 8, paddingTop: index ? 12 : 0, borderTopWidth: index ? 1 : 0, borderColor: colors.line }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink }}>{p.nome}</Text>
                      <Chip tone={p.tipo === 'ferias' ? 'hol' : 'neutral'} label={p.tipo === 'ferias' ? 'Férias' : 'Baixa'} />
                    </View>
                    <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink2 }}>{dates}{p.tipo_ferias ? ` · ${p.tipo_ferias}` : ''}</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <SenseButton label="Favorável" chosen={sense === 'favoravel'} good onPress={() => giveOpinion(p.tipo, p.id, 'favoravel')} />
                      <SenseButton label="Desfavorável" chosen={sense === 'desfavoravel'} onPress={() => giveOpinion(p.tipo, p.id, 'desfavoravel')} />
                    </View>
                    {sense ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.ink3 }}>Parecer enviado. A decisão final é do RH.</Text> : null}
                  </View>
                );
              }) : <Muted size={13.5}>Sem pedidos pendentes nesta equipa.</Muted>}
            </Card>
            <Card>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, paddingHorizontal: 14, paddingTop: 14 }}>Correções que propôs</Text>
              {requests.correcoes.length ? requests.correcoes.map((c, index) => {
                const state = CORRECTION_STATE[c.estado] ?? { tone: 'neutral' as ChipTone, label: c.estado };
                return (
                  <Row
                    key={c.id}
                    first={index === 0}
                    left={<Initials text={c.iniciais} />}
                    title={c.nome}
                    subtitle={`${datePt(c.data)} · ${TYPE_LABEL[c.tipo] ?? c.tipo} às ${c.hora}`}
                    right={<Chip tone={state.tone} label={state.label} />}
                  />
                );
              }) : <Empty text="Ainda não propôs correções." />}
            </Card>
          </>
        ) : null}

        {tab === 'map' && map ? (
          <Card style={{ paddingVertical: 12, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 }}>
              <MonthArrow label="Mês anterior" text="‹" onPress={() => changeMonth(-1)} />
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{MONTHS[map.mes - 1]} {map.ano}</Text>
              <MonthArrow label="Mês seguinte" text="›" onPress={() => changeMonth(1)} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingHorizontal: 12 }}>
              <View style={{ gap: 3 }}>
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  <View style={{ width: 64 }} />
                  {Array.from({ length: map.num_dias }, (_, i) => (
                    <Text key={i} style={{ width: 22, textAlign: 'center', fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.ink3 }}>{i + 1}</Text>
                  ))}
                </View>
                {map.membros.map((m) => (
                  <View key={m.id} style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
                    <Text numberOfLines={1} style={{ width: 64, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink }}>{m.nome.split(' ')[0]}</Text>
                    {m.dias.map((code, i) => {
                      const cell = code ? MAP_CELL[code] : null;
                      const day = `${map.ano}-${String(map.mes).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                      return (
                        <Pressable
                          key={i}
                          disabled={code !== 'X'}
                          accessibilityRole={code === 'X' ? 'button' : undefined}
                          accessibilityLabel={code === 'X' ? `Falta de ${m.nome} a ${datePt(day)}` : undefined}
                          onPress={() => setTab('missing')}
                          style={{ width: 22, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: cell?.bg ?? 'transparent' }}
                        >
                          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10.5, color: cell?.fg ?? colors.ink3 }}>{code === '-' ? '–' : code ?? ''}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 14 }}>
              {MAP_LEGEND.map(([code, label]) => (
                <View key={code} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: MAP_CELL[code].bg, borderWidth: 1, borderColor: MAP_CELL[code].fg }} />
                  <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.ink2 }}>{label}</Text>
                </View>
              ))}
            </View>
            <Muted size={12} center>Deslize na horizontal. Toque num X para ver as faltas e corrigir (últimos 7 dias).</Muted>
          </Card>
        ) : null}

        {loading && !today && !missing && !requests && !map ? <ActivityIndicator color={colors.action} /> : null}
      </ScrollView>

      <FixSheet
        fix={fix}
        onClose={() => setFix(null)}
        onSend={async (body) => {
          const result = await teamApi.propose(token, pinToken, body);
          setFix(null);
          toast({ tone: 'ok', title: 'Enviado ao RH', text: `${result.mensagem} ${fix?.nome.split(' ')[0] ?? ''} também é avisado(a).` });
          load();
          loadCounts();
        }}
        onPinExpired={onPinExpired}
        onAuthError={onAuthError}
      />
    </View>
  );
}

/** Janela de baixo "Corrigir picagem" (protótipo v7): hora, motivo e nota; vai para o RH, que decide. */
function FixSheet({ fix, onClose, onSend, onPinExpired, onAuthError }: {
  fix: Missing | null;
  onClose: () => void;
  onSend: (body: { colaborador_id: string; data: string; tipo: MissingType; hora: string; motivo: string; nota?: string }) => Promise<void>;
  onPinExpired: () => void;
  onAuthError: (error: unknown) => boolean;
}) {
  const insets = useSafeAreaInsets();
  const [time, setTime] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!fix) return;
    setTime(fix.hora);
    setReason(REASONS[0]);
    setNote('');
    setError('');
  }, [fix]);

  const send = async () => {
    if (!fix) return;
    if (!TIME_RE.test(time)) { setError('Escreva a hora assim: 09:05.'); return; }
    setBusy(true);
    setError('');
    try {
      await onSend({ colaborador_id: fix.id, data: fix.data, tipo: fix.tipo, hora: time, motivo: reason, nota: note.trim() || undefined });
    } catch (exc) {
      if (needsPin(exc)) { onClose(); onPinExpired(); return; }
      if (!onAuthError(exc)) setError(exc instanceof ApiError ? exc.message : errorText(exc));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={Boolean(fix)} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,.45)' }}>
        <Pressable accessibilityLabel="Fechar" style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: insets.bottom + 18, gap: 12 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.ink }}>Corrigir picagem de {fix?.nome}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink2 }}>{fix ? `${datePt(fix.data)} · ${TYPE_LABEL[fix.tipo]} em falta` : ''}</Text>
          <Field label="Hora" value={time} onChangeText={(text) => setTime(text.replace(/[^\d:]/g, '').slice(0, 5))} keyboardType="numbers-and-punctuation" placeholder="09:05" maxLength={5} />
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink2 }}>Motivo</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {REASONS.map((r) => <Pill key={r} label={r} active={reason === r} onPress={() => setReason(r)} />)}
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink2 }}>Nota (opcional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={NOTE_MAX}
              multiline
              placeholder="Ex.: entrou comigo às 09:05"
              placeholderTextColor={colors.ink3}
              accessibilityLabel="Nota (opcional)"
              style={{ minHeight: 64, borderRadius: 12, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink, textAlignVertical: 'top' }}
            />
          </View>
          <ErrorText>{error}</ErrorText>
          <Muted size={12.5}>Vai para o RH, que decide. A picagem original nunca é alterada.</Muted>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button ghost title="Cancelar" onPress={onClose} /></View>
            <View style={{ flex: 1 }}><Button primary title="Enviar ao RH" busy={busy} onPress={send} /></View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Stat({ value, label, bg, fg }: { value: number; label: string; bg: string; fg: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 14, padding: 10, alignItems: 'center', backgroundColor: bg }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 26, color: fg }}>{value}</Text>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11.5, color: fg }}>{label}</Text>
    </View>
  );
}

function Initials({ text }: { text: string }) {
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.action }}>{text}</Text>
    </View>
  );
}

function FixButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ minHeight: 36, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: colors.warnSoft, paddingHorizontal: 12, opacity: pressed ? 0.8 : 1 })}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.warnInk }}>Corrigir</Text>
    </Pressable>
  );
}

function SenseButton({ label, chosen, good, onPress }: { label: string; chosen: boolean; good?: boolean; onPress: () => void }) {
  const fg = chosen ? (good ? colors.ok : colors.danger) : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: chosen }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
        borderColor: chosen ? fg : colors.line, backgroundColor: chosen ? (good ? colors.okSoft : colors.dangerSoft) : colors.surface,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13.5, color: fg }}>{label}</Text>
    </Pressable>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{ minHeight: 36, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 12, borderWidth: 1, borderColor: active ? colors.action : colors.line, backgroundColor: active ? colors.action : colors.surface }}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12.5, color: active ? '#fff' : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

function MonthArrow({ label, text, onPress }: { label: string; text: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={{ width: 44, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 22, color: colors.action }}>{text}</Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: colors.ink2, padding: 14 }}>{text}</Text>;
}
