// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// "Registos" (protótipo v6): semana atual com o total e uma barra por dia (cheia = 8 h, âmbar = dia sem saída),
// depois os dias do mês com as horas ou o que falta corrigir. Mês anterior/seguinte em baixo.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { MonthRecords, employeeApi } from '../api';
import { Card, Chip, Header, Muted, Row, Section } from '../ui';
import { formatHours, parseHours } from './TodayScreen';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEK_LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WORKDAY_MINUTES = 8 * 60;
const BAR_MAX_PX = 60;
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

export function RecordsScreen({ token, onAuthError }: { token: string; onAuthError: (error: unknown) => boolean }) {
  const insets = useSafeAreaInsets();
  const today = new Date();
  const { monday, number } = weekOf(today);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  const [month, setMonth] = useState({ ano: today.getFullYear(), mes: today.getMonth() + 1 });
  const [data, setData] = useState<MonthRecords | null>(null);
  const [weekDays, setWeekDays] = useState<Record<string, Day>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const current = await employeeApi.records(token, month.ano, month.mes);
      setData(current);
      // A semana atual pode começar no mês anterior.
      const sources = [current];
      if (monday.getMonth() !== today.getMonth()) sources.push(await employeeApi.records(token, monday.getFullYear(), monday.getMonth() + 1));
      const map: Record<string, Day> = {};
      sources.forEach((source) => source.dias.forEach((day) => { map[day.data] = day; }));
      setWeekDays((previous) => (month.ano === today.getFullYear() && month.mes === today.getMonth() + 1 ? map : { ...previous }));
    } catch (exc) {
      if (onAuthError(exc)) return;
      setError(exc instanceof NetworkError ? 'Sem rede. Os registos aparecem quando houver ligação.' : exc instanceof ApiError ? exc.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, month, onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.getTime() + index * DAY_MS);
    const day = weekDays[iso(date)];
    const minutes = day ? parseHours(day.horas) : 0;
    return { letter: WEEK_LETTERS[index], minutes, incomplete: Boolean(day && !day.completo && iso(date) !== iso(today)), future: date > today };
  });
  const weekMinutes = week.reduce((sum, day) => sum + day.minutes, 0);
  const incomplete = week.filter((day) => day.incomplete).length;
  const isCurrentMonth = month.ano === today.getFullYear() && month.mes === today.getMonth() + 1;
  const days = [...(data?.dias ?? [])].reverse();
  const range = `${monday.getDate()} ${MONTHS[monday.getMonth()]} – ${sunday.getDate()} ${MONTHS[sunday.getMonth()]}`;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 110, gap: 12 }}
      refreshControl={<RefreshControl refreshing={loading && Boolean(data)} onRefresh={load} colors={[colors.action]} />}
    >
      <Header subtitle={`Semana ${number} · ${range}`} title="Registos" />

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 14, paddingHorizontal: 14 }}>
          <View>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.ink3, letterSpacing: 0.7, textTransform: 'uppercase' }}>Esta semana</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 27, color: colors.ink }}>
              {Math.floor(weekMinutes / 60)}h<Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink3 }}> {String(weekMinutes % 60).padStart(2, '0')}</Text>
            </Text>
          </View>
          {incomplete ? <Chip tone="warn" label={`${incomplete} dia${incomplete > 1 ? 's' : ''} incompleto${incomplete > 1 ? 's' : ''}`} /> : <Chip tone="ok" label="Tudo certo" />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 92, paddingHorizontal: 14, paddingTop: 12 }}>
          {week.map((day, index) => {
            const ratio = Math.min(day.minutes / WORKDAY_MINUTES, 1);
            const color = day.incomplete ? colors.warn : ratio >= 0.95 ? colors.action : colors.actionSoft;
            return (
              <View key={index} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View style={{ width: '100%', height: Math.max(ratio * BAR_MAX_PX, 4), borderRadius: 6, backgroundColor: color, opacity: day.future ? 0.5 : 1 }} />
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.ink3 }}>{day.letter}</Text>
              </View>
            );
          })}
        </View>
        <View style={{ height: 12 }} />
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <MonthArrow label="‹" accessibilityLabel="Mês anterior" onPress={() => data && setMonth(data.mes_anterior)} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.ink }}>{data?.mes_nome ?? '…'}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.ink3 }}>{data ? `${data.horas_mes} no mês` : ' '}</Text>
        </View>
        <MonthArrow label="›" accessibilityLabel="Mês seguinte" disabled={isCurrentMonth} onPress={() => data && setMonth(data.mes_seguinte)} />
      </View>

      <Section title="Dias" right={`${days.length} com picagens`} />
      {error ? <Muted>{error}</Muted> : null}
      {loading && !data ? <ActivityIndicator color={colors.action} /> : null}
      {data && !days.length ? <Muted>Sem picagens neste mês.</Muted> : null}

      {days.length ? (
        <Card>
          {days.map((day, index) => {
            const first = day.picagens[0]?.hora;
            const last = day.picagens[day.picagens.length - 1];
            const isToday = day.data === iso(today);
            const subtitle = !day.completo
              ? `${first ?? '--:--'} → ${isToday ? 'em curso' : 'sem saída'}`
              : `${first ?? '--:--'} → ${last?.hora ?? '--:--'}${day.picagens.some((p) => p.fora_do_local) ? ' · fora do local' : ''}${day.picagens.some((p) => p.correcao_pendente) ? ' · correção pedida' : ''}`;
            return (
              <Row
                key={day.data}
                first={index === 0}
                title={dayLabel(day.data)}
                subtitle={subtitle}
                right={isToday && !day.completo ? <Chip tone="action" label="Hoje" />
                  : !day.completo ? <Chip tone="warn" label="Corrigir" />
                  : <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink }}>{formatHours(parseHours(day.horas))}</Text>}
              />
            );
          })}
        </Card>
      ) : null}
      {days.some((day) => !day.completo && day.data !== iso(today)) ? (
        <Muted size={12.5}>Dias sem saída: peça a correção ao gestor ou na página da empresa.</Muted>
      ) : null}
    </ScrollView>
  );
}

function MonthArrow({ label, accessibilityLabel, onPress, disabled }: { label: string; accessibilityLabel: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} disabled={disabled} hitSlop={10}
      style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}
