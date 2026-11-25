// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Ecrãs que se abrem a partir de uma notificação (artboard p2311-notificacoes, n.º 3 a 5, aprovado 24/11): ler a mensagem do
// RH, «Saída em falta» → «Pedir correção» (vai direto ao pedido, com o dia já escolhido) e «Confirmar registos» (semanas e
// total). Substituem a caixa de mensagens e o cartão de correção antigos (cores antigas).
import { ReactNode, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import ResultSheet, { ResultadoPicar } from '../../components/ResultSheet';
import { Bloco } from '../../components/Skeleton';
import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { Message, MonthRecords, Visto, employeeApi } from '../api';
import { BarraRodape, Button, ErrorText, Field, Header, Muted } from '../ui';

const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DAY_MS = 86_400_000;
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const fromIso = (text: string) => {
  const [year, month, day] = text.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};
const cap = (text: string) => text[0].toUpperCase() + text.slice(1);
const longDay = (iso: string) => {
  const date = fromIso(iso);
  return `${cap(WEEKDAYS[date.getDay()])}, ${date.getDate()} de ${MONTHS_LONG[date.getMonth()]}`;
};
const errorText = (exc: unknown) => (exc instanceof NetworkError ? 'Sem rede. Tente quando houver ligação.' : exc instanceof ApiError ? exc.message : 'Não foi possível concluir. Tente de novo.');
const human = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;

interface Common {
  token: string;
  /** Nome e avatar à direita da faixa (como nos outros ecrãs). */
  avatar: ReactNode;
  onBack: () => void;
  onAuthError: (error: unknown) => boolean;
}

function Screen({ title, avatar, onBack, footer, children }: { title: string; avatar: ReactNode; onBack: () => void; footer: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <Header variante="faixaLogo" title={title} subtitle="" onVoltar={onBack} right={avatar} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 18, gap: 14 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      <BarraRodape>{footer}</BarraRodape>
    </View>
  );
}

const card = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 16, gap: 6 } as const;

/** Mensagem do RH: abre e fica lida (passa a «Anteriores»). */
export function MessageView({ token, id, avatar, onBack, onRead, onAuthError }: Common & { id: string; onRead: () => void }) {
  const [message, setMessage] = useState<Message | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const found = (await employeeApi.messages(token)).mensagens.find((m) => m.id === id);
        if (!active) return;
        if (!found) { setError('Esta mensagem já não existe.'); return; }
        setMessage(found);
        if (!found.lida) { await employeeApi.readMessage(token, id); onRead(); }
      } catch (exc) {
        if (active && !onAuthError(exc)) setError(errorText(exc));
      }
    })();
    return () => { active = false; };
  }, [token, id, onRead, onAuthError]);

  return (
    <Screen title="Mensagem do RH" avatar={avatar} onBack={onBack} footer={<Button ghost tone="faixa" title="Voltar" onPress={onBack} />}>
      {!message && !error ? <><Bloco style={{ height: 70, borderRadius: 14 }} /><Bloco style={{ height: 14, width: '90%' }} /><Bloco style={{ height: 14, width: '70%' }} /></> : null}
      {message ? (
        <>
          <View style={card}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>{message.titulo}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink3 }}>{message.de} · {message.data}</Text>
          </View>
          <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.ink2 }}>{message.texto}</Text>
        </>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

/** «Saída em falta»: o dia e a entrada que há; «Pedir correção» abre logo o pedido (hora certa e motivo). */
export function MissingExitView({ token, date, avatar, onBack, onSent, onAuthError }: Common & { date: string; onSent: () => void }) {
  const [entry, setEntry] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<ResultadoPicar | null>(null);

  useEffect(() => {
    const day = fromIso(date);
    employeeApi.records(token, day.getFullYear(), day.getMonth() + 1)
      .then((month) => setEntry(month.dias.find((d) => d.data === date)?.picagens.find((p) => p.tipo === 'entrada')?.hora ?? null))
      .catch((exc) => { if (!onAuthError(exc)) setError(errorText(exc)); });
  }, [token, date, onAuthError]);

  async function send() {
    const match = TIME_RE.exec(time.trim());
    if (!match) return setError('Escreva a hora certa no formato 18:00.');
    if (!reason.trim()) return setError('Diga o motivo (ex.: esqueci-me de picar a saída).');
    setBusy(true);
    setError('');
    try {
      await employeeApi.requestCorrection(token, { tipo: 'saida', data_hora: `${date}T${match[1].padStart(2, '0')}:${match[2]}`, motivo: reason.trim() });
      setSent({ tone: 'ok', title: 'Pedido enviado', text: 'A chefia de equipa ou o RH decide e avisamo-lo.', botao: 'Continuar' });
    } catch (exc) {
      if (!onAuthError(exc)) setError(errorText(exc));
    } finally {
      setBusy(false);
    }
  }

  const sheet = <ResultSheet resultado={sent} onClose={() => { setSent(null); onSent(); }} />;
  if (!asking) {
    return (
      <>
        <Screen title="Saída em falta" avatar={avatar} onBack={onBack}
          footer={<><Button primary tone="verde" title="Pedir correção" onPress={() => setAsking(true)} /><Button ghost tone="faixa" title="Voltar" onPress={onBack} /></>}>
          <View style={card}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>{longDay(date)}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink3 }}>{entry ? `Entrada ${entry} · ` : ''}sem saída registada</Text>
          </View>
          <Muted size={13}>Peça a correção com a hora certa. A chefia de equipa ou o RH recebe o pedido e decide.</Muted>
          <ErrorText>{error}</ErrorText>
        </Screen>
        {sheet}
      </>
    );
  }
  return (
    <>
      <Screen title="Pedir correção" avatar={avatar} onBack={() => setAsking(false)}
        footer={<><Button primary tone="verde" title={busy ? 'A enviar…' : 'Enviar pedido'} busy={busy} onPress={send} /><Button ghost tone="faixa" title="Cancelar" onPress={() => setAsking(false)} /></>}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink2 }}>Saída de {longDay(date).toLowerCase()}</Text>
        <Field label="Hora certa da saída" value={time} onChangeText={setTime} placeholder="18:00" keyboardType="numbers-and-punctuation" maxLength={5} />
        <Field label="Motivo (obrigatório)" value={reason} onChangeText={setReason} placeholder="Ex.: esqueci-me de picar" maxLength={300} />
        <Muted size={13}>O pedido fica registado com o seu nome e a hora. Quem decide é a chefia ou o RH.</Muted>
        <ErrorText>{error}</ErrorText>
      </Screen>
      {sheet}
    </>
  );
}

interface Week { label: string; days: number; minutes: number }

/** Dias do visto agrupados por semana (segunda a domingo), como no artboard: «Semana de 5 a 9 out · 5 dias · 39 h 10». */
function weeksOf(visto: Visto): Week[] {
  const groups = new Map<string, { first: Date; last: Date; days: number; minutes: number }>();
  (visto.dias ?? []).forEach((day) => {
    const date = fromIso(day.data);
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const group = groups.get(key) ?? { first: date, last: date, days: 0, minutes: 0 };
    group.first = date < group.first ? date : group.first;
    group.last = date > group.last ? date : group.last;
    group.days += 1;
    group.minutes += day.minutos;
    groups.set(key, group);
  });
  return [...groups.values()].sort((a, b) => a.first.getTime() - b.first.getTime()).map((g) => ({
    label: `Semana de ${g.first.getDate()}${g.first.getMonth() !== g.last.getMonth() ? ` ${MONTHS[g.first.getMonth()]}` : ''} a ${g.last.getDate()} ${MONTHS[g.last.getMonth()]}`,
    days: g.days, minutes: g.minutes,
  }));
}

/** «Confirmar registos»: semanas e total; «Confirmo que estão certos» é o visto do trabalhador (guardado para o registo ACT). */
export function ConfirmRecordsView({ token, avatar, onBack, onDone, onCorrection, onAuthError }: Common & { onDone: () => void; onCorrection: () => void }) {
  const [visto, setVisto] = useState<Visto | null | undefined>(undefined);
  const [declaration, setDeclaration] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<ResultadoPicar | null>(null);

  useEffect(() => {
    const now = new Date();
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    Promise.all([employeeApi.records(token, now.getFullYear(), now.getMonth() + 1), employeeApi.records(token, previous.getFullYear(), previous.getMonth() + 1)])
      .then((months: MonthRecords[]) => {
        const first = months.flatMap((m) => m.vistos_pendentes)[0] ?? null;
        setVisto(first);
        setDeclaration(months[0].declaracao_visto);
      })
      .catch((exc) => { if (!onAuthError(exc)) { setVisto(null); setError(errorText(exc)); } });
  }, [token, onAuthError]);

  async function confirm() {
    if (!visto) return;
    setBusy(true);
    setError('');
    try {
      const result = await employeeApi.confirmVisto(token, visto);
      setSent({ tone: 'ok', title: 'Registos confirmados', text: result.mensagem, botao: 'Continuar' });
    } catch (exc) {
      if (!onAuthError(exc)) setError(errorText(exc));
    } finally {
      setBusy(false);
    }
  }

  const weeks = visto ? weeksOf(visto) : [];
  const monthName = visto ? MONTHS_LONG[fromIso(visto.inicio).getMonth()] : '';
  return (
    <>
      <Screen title={visto ? `Registos de ${monthName}` : 'Confirmar registos'} avatar={avatar} onBack={onBack}
        footer={visto ? (
          <>
            <Button primary tone="verde" title={busy ? 'A confirmar…' : 'Confirmo que estão certos'} busy={busy} onPress={confirm} />
            <Button ghost tone="faixa" title="Pedir correção" onPress={onCorrection} />
          </>
        ) : <Button ghost tone="faixa" title="Voltar" onPress={onBack} />}>
        {visto === undefined ? <><Bloco style={{ height: 14, width: '90%' }} /><Bloco style={{ height: 52 }} /><Bloco style={{ height: 52 }} /></> : null}
        {visto === null && !error ? <Muted size={14}>Não há registos por confirmar.</Muted> : null}
        {visto ? (
          <>
            {visto.estado === 'alterado' ? <Muted size={13}>O registo mudou depois do seu último visto (ex.: correção aprovada). Reveja e confirme de novo.</Muted> : null}
            <Muted size={13}>Confirme que as suas horas estão certas. Pode pedir correção de qualquer dia.</Muted>
            <View style={{ borderTopWidth: 1, borderTopColor: colors.line }}>
              {weeks.map((week) => (
                <View key={week.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                  <View>
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{week.label}</Text>
                    <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink3 }}>{week.days} {week.days === 1 ? 'dia' : 'dias'}</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] }}>{human(week.minutes)}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>Total</Text>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] }}>{human(visto.minutos)}</Text>
              </View>
            </View>
            {declaration ? <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.ink2 }}>{declaration}</Text> : null}
          </>
        ) : null}
        <ErrorText>{error}</ErrorText>
      </Screen>
      <ResultSheet resultado={sent} onClose={() => { setSent(null); onDone(); }} />
    </>
  );
}
