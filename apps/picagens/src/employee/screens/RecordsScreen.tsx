// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// "Registos" (protótipo v6): semana atual com o total e uma barra por dia (cheia = 8 h, âmbar = dia sem saída),
// depois os dias do mês com as horas ou o que falta corrigir. Mês anterior/seguinte em baixo. Tocar num dia abre o
// pedido de correção (2.3.0: na 2.2.0 o "Corrigir" não fazia nada, doc 53 §3); o gestor aprova no painel.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { ApiError, NetworkError } from '../../http';
import { ListaSkeleton } from '../../components/Skeleton';
import { colors, fonts } from '../../theme';
import { MonthRecords, PunchType, Visto, employeeApi } from '../api';
import { Avatar, AvatarPhoto, Button, Card, ErrorText, Field, Header, Muted } from '../ui';
import { formatHours, parseHours } from './TodayScreen';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DAY_MS = 86_400_000;

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromIso = (text: string) => {
  const [year, month, day] = text.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const dayLabel = (text: string) => {
  const date = fromIso(text);
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

/** Segunda-feira da semana e número da semana ISO. */
function weekOf(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
  const thursday = new Date(monday.getTime() + 3 * DAY_MS);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const number = 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return { monday, number };
}

type Day = MonthRecords['dias'][number];

const CORRECTION_TYPES: { value: PunchType; label: string }[] = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
  { value: 'pausa_inicio', label: 'Pausa' },
  { value: 'pausa_fim', label: 'Fim pausa' },
];
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Pedido de correção de um dia: tipo, hora certa e motivo (o gestor aprova em Picagens › Pedidos de correção). */
function CorrectionCard({ token, day, onClose, onSent, onAuthError }: { token: string; day: Day; onClose: () => void; onSent: (message: string) => void; onAuthError: (error: unknown) => boolean }) {
  const [type, setType] = useState<PunchType>(day.completo ? 'entrada' : 'saida');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    const match = TIME_RE.exec(time.trim());
    if (!match) return setError('Escreva a hora certa no formato 18:00.');
    if (!reason.trim()) return setError('Diga o motivo (ex.: esqueci-me de picar a saída).');
    setSending(true);
    setError('');
    try {
      const hora = `${match[1].padStart(2, '0')}:${match[2]}`;
      const result = await employeeApi.requestCorrection(token, { tipo: type, data_hora: `${day.data}T${hora}`, motivo: reason.trim() });
      onSent(result.mensagem);
    } catch (exc) {
      if (!onAuthError(exc)) setError(exc instanceof ApiError ? exc.message : exc instanceof NetworkError ? 'Sem rede. Tente quando tiver ligação.' : 'Tente de novo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Card style={{ padding: 14, gap: 10, borderColor: colors.band }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>Pedir correção · {dayLabel(day.data)}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CORRECTION_TYPES.map(({ value, label }) => (
          <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: type === value }} onPress={() => setType(value)}
            style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, justifyContent: 'center', borderColor: type === value ? colors.band : colors.line, backgroundColor: type === value ? colors.bandSoft : colors.surface }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: type === value ? colors.band : colors.ink2 }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Hora certa" value={time} onChangeText={setTime} placeholder="18:00" keyboardType="numbers-and-punctuation" maxLength={5} />
      <Field label="Motivo" value={reason} onChangeText={setReason} placeholder="Ex.: esqueci-me de picar a saída" maxLength={300} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button primary tone="verde" title={sending ? 'A enviar…' : 'Enviar pedido'} busy={sending} onPress={send} />
      <Button ghost tone="faixa" title="Cancelar" onPress={onClose} />
    </Card>
  );
}

const WEEKDAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEKDAYS_LONG_MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WORKING_DAYS = 5;

/** Registos, semana (artboard p2311-registos, aprovado 24/11): semana anterior/seguinte, total contra as horas previstas
 * e um dia por linha com entrada e saída. Dias sem saída pedem a correção ali mesmo. Os vistos por confirmar ficam no topo. */
export function RecordsScreen({ token, name, photo, onProfile, weeklyMinutes, onSignMonth, onAuthError }: {
  token: string; name: string; photo: AvatarPhoto | null; onProfile: () => void; weeklyMinutes: number | null;
  /** Abre «Confirmar registos» com o quadro de assinatura do mês (doc 249). */
  onSignMonth: () => void; onAuthError: (error: unknown) => boolean;
}) {
  const today = new Date();
  const [offset, setOffset] = useState(0);
  const monday = new Date(weekOf(today).monday.getTime() + offset * 7 * DAY_MS);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  const [data, setData] = useState<MonthRecords | null>(null);
  const [daysByDate, setDaysByDate] = useState<Record<string, Day>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState('');
  const [correcting, setCorrecting] = useState<string | null>(null);
  const mondayKey = iso(monday);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // A semana pode começar num mês e acabar noutro: pede os (um ou dois) meses que a cobrem.
      const start = fromIso(mondayKey);
      const end = new Date(start.getTime() + 6 * DAY_MS);
      const months = [{ ano: start.getFullYear(), mes: start.getMonth() + 1 }];
      if (end.getMonth() !== start.getMonth()) months.push({ ano: end.getFullYear(), mes: end.getMonth() + 1 });
      const loaded = await Promise.all(months.map((m) => employeeApi.records(token, m.ano, m.mes)));
      const map: Record<string, Day> = {};
      loaded.forEach((source) => source.dias.forEach((day) => { map[day.data] = day; }));
      setDaysByDate(map);
      setData(loaded[loaded.length - 1]);
    } catch (exc) {
      if (onAuthError(exc)) return;
      setError(exc instanceof NetworkError ? 'Sem rede. Os registos aparecem quando houver ligação.' : exc instanceof ApiError ? exc.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, [token, mondayKey, onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  const todayKey = iso(today);
  const hasWeekend = [5, 6].some((index) => daysByDate[iso(new Date(monday.getTime() + index * DAY_MS))]?.picagens.length);
  const rows = Array.from({ length: hasWeekend ? 7 : WORKING_DAYS }, (_, index) => {
    const date = new Date(monday.getTime() + index * DAY_MS);
    const key = iso(date);
    const day = daysByDate[key];
    const entry = day?.picagens.find((p) => p.tipo === 'entrada')?.hora;
    const exit = [...(day?.picagens ?? [])].reverse().find((p) => p.tipo === 'saida')?.hora;
    return { key, date, day, entry, exit, minutes: day ? parseHours(day.horas) : 0, isToday: key === todayKey, future: key > todayKey };
  });
  const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  const progress = weeklyMinutes ? Math.min(totalMinutes / weeklyMinutes, 1) : 0;
  const human = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  const rangeText = `${monday.getDate()}${monday.getMonth() !== sunday.getMonth() ? ` de ${WEEKDAYS_LONG_MONTHS[monday.getMonth()]}` : ''} a ${sunday.getDate()} de ${WEEKDAYS_LONG_MONTHS[sunday.getMonth()]}`;
  const isCurrentWeek = offset === 0;

  return (
    <View style={{ flex: 1 }}>
      <Header
        variante="faixaLogo"
        title="Registos"
        subtitle="As suas horas desta semana"
        right={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.surface }}>{name.split(/\s+/)[0]}</Text>
            <Avatar name={name} count={0} onPress={onProfile} photo={photo} size={36} />
          </View>
        )}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 12 }}
        refreshControl={<RefreshControl refreshing={loading && Boolean(data)} onRefresh={load} colors={[colors.band]} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <WeekArrow label="‹" accessibilityLabel="Semana anterior" onPress={() => { setCorrecting(null); setOffset(offset - 1); }} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{rangeText}</Text>
          <WeekArrow label="›" accessibilityLabel="Semana seguinte" disabled={isCurrentWeek} onPress={() => { setCorrecting(null); setOffset(offset + 1); }} />
        </View>

        {done ? (
          <View style={{ backgroundColor: colors.okSoft, borderRadius: 14, padding: 12 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ok }}>{done}</Text>
          </View>
        ) : null}
        {(data?.vistos_pendentes ?? []).map((visto) => (
          <VistoCard key={`${visto.inicio}-${visto.fim}`} token={token} visto={visto} declaration={data!.declaracao_visto} onAuthError={onAuthError} onSignMonth={onSignMonth}
            onConfirmed={(text) => { setDone(text); load(); }} />
        ))}

        <View accessibilityLabel="Resumo da semana" style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 16, elevation: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 22, color: colors.ink, fontVariant: ['tabular-nums'] }}>{human(totalMinutes)}</Text>
            {weeklyMinutes ? <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink2 }}>de {human(weeklyMinutes).replace(/ 00$/, '')} previstas</Text> : null}
          </View>
          {weeklyMinutes ? (
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.skeleton, marginTop: 12, overflow: 'hidden' }}>
              <View style={{ height: 8, width: `${Math.round(progress * 100)}%`, borderRadius: 4, backgroundColor: colors.band }} />
            </View>
          ) : null}
        </View>

        {error ? <ErrorText>{error}</ErrorText> : null}
        {loading && !data ? <ListaSkeleton /> : null}

        {data || Object.keys(daysByDate).length ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 4, paddingHorizontal: 16, elevation: 2 }}>
            {rows.map((row, index) => {
              const incomplete = Boolean(row.day && !row.day.completo && !row.isToday);
              const weekday = WEEKDAYS_FULL[row.date.getDay()];
              const dateText = `${row.date.getDate()} ${MONTHS[row.date.getMonth()]}${row.isToday ? ' · hoje' : ''}`;
              const hoursText = row.day && row.day.picagens.length
                ? `${row.entry ?? '--:--'} entrada · ${row.exit ?? (row.isToday ? 'a trabalhar' : 'sem saída')}${row.exit ? ' saída' : ''}`
                : row.future ? 'Ainda não começou' : 'Sem picagens';
              if (correcting === row.key && row.day) {
                return (
                  <View key={row.key} style={{ paddingVertical: 8 }}>
                    <CorrectionCard token={token} day={row.day} onClose={() => setCorrecting(null)} onAuthError={onAuthError}
                      onSent={(message) => { setCorrecting(null); setDone(message); load(); }} />
                  </View>
                );
              }
              return (
                <View key={row.key} style={{ paddingVertical: 8, borderBottomWidth: index === rows.length - 1 ? 0 : 1, borderBottomColor: colors.line, backgroundColor: index % 2 ? colors.zebra : 'transparent', marginHorizontal: index % 2 ? -16 : 0, paddingHorizontal: index % 2 ? 16 : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: row.future ? colors.ink3 : colors.ink }}>{weekday}</Text>
                      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 2 }}>{dateText}</Text>
                    </View>
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: row.future ? colors.ink3 : colors.ink, fontVariant: ['tabular-nums'] }}>{row.minutes ? human(row.minutes) : '—'}</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink2, marginTop: 4, fontVariant: ['tabular-nums'] }}>{hoursText}</Text>
                  {incomplete ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.warnInk }}>Dia sem saída</Text>
                      <Pressable accessibilityRole="button" onPress={() => { setDone(''); setCorrecting(row.key); }} hitSlop={6} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 8 }}>
                        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ok }}>Pedir correção</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.ink2 }}>
          Uma entrada sem saída fica a aguardar a correção. Peça-a no próprio dia para as horas ficarem certas.
        </Text>
      </ScrollView>
    </View>
  );
}

function WeekArrow({ label, accessibilityLabel, onPress, disabled }: { label: string; accessibilityLabel: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} disabled={disabled} hitSlop={6}
      style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: colors.band }}>{label}</Text>
    </Pressable>
  );
}

const shortDate = (text: string) => {
  const [, month, day] = text.split('-').map(Number);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
};

/** Confirmação das horas de um período fechado (visto do trabalhador, guardado para o registo ACT). Mostra os dias
 * como a PWA; o servidor só aceita se o registo ainda for o que o colaborador viu (hash). */
function VistoCard({ token, visto, declaration, onConfirmed, onAuthError, onSignMonth }: {
  onSignMonth: () => void;
  token: string; visto: Visto; declaration: string; onConfirmed: (text: string) => void; onAuthError: (error: unknown) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const period = visto.inicio === visto.fim ? shortDate(visto.inicio) : `${shortDate(visto.inicio)}–${shortDate(visto.fim)}`;

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const result = await employeeApi.confirmVisto(token, visto);
      onConfirmed(result.mensagem);
    } catch (exc) {
      if (!onAuthError(exc)) setError(exc instanceof NetworkError ? 'Sem rede. Tente quando houver ligação.' : exc instanceof ApiError ? exc.message : 'Não foi possível confirmar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 4, borderLeftColor: colors.band, borderRadius: 18, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>Confirmar horas {period}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink2 }}>Visto do trabalhador, guardado no registo de tempos (ACT)</Text>
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.ink }}>{formatHours(visto.minutos)}</Text>
      </View>
      {visto.estado === 'alterado' ? (
        <View style={{ backgroundColor: colors.warnSoft, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.warn }}>O registo mudou depois do seu último visto (ex.: correção aprovada). Reveja e confirme de novo.</Text>
        </View>
      ) : null}
      {visto.assinatura_obrigatoria ? (
        <Button primary tone="verde" title="Assinar o mês" onPress={onSignMonth} />
      ) : !open ? (
        <Button primary tone="verde" title="Rever e confirmar" onPress={() => setOpen(true)} />
      ) : (
        <>
          {(visto.dias ?? []).map((day) => (
            <View key={day.data} style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 6 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink }}>{dayLabel(day.data)}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink2 }}>
                {day.periodos.join(', ') || 'Sem picagens'}{day.observacoes.length ? ` · ${day.observacoes.join('; ')}` : ''}
              </Text>
            </View>
          ))}
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => setChecked(!checked)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 4 }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: checked ? colors.band : colors.line, backgroundColor: checked ? colors.band : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {checked ? <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: 13 }}>✓</Text> : null}
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink }}>{declaration}</Text>
          </Pressable>
          <Muted size={12}>Se algo estiver errado, não confirme: peça a correção ao gestor (ou em "Pedir registo em falta" na página da empresa).</Muted>
          <ErrorText>{error}</ErrorText>
          <Button primary tone="verde" title={busy ? 'A confirmar…' : 'Confirmar'} busy={busy} disabled={!checked} onPress={confirm} />
        </>
      )}
    </View>
  );
}
