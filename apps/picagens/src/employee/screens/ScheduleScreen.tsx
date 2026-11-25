// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// «Meu horário» (artboard V4HorarioSaldo, doc 252/253): a semana do próprio colaborador, segunda a domingo, dentro de Registos
// (seletor «Registos | Horário»). Só leitura: o horário vem do que o RH definiu no painel (horário fixo, escala ou semana da loja),
// com férias aprovadas, baixas e feriados. Não diz se o dia foi cumprido: isso são os Registos.
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { RegistosSkeleton } from '../../components/Skeleton';
import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { ScheduleDay, ScheduleWeek, employeeApi } from '../api';
import { ErrorText, Muted } from '../ui';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const parts = (text: string) => text.slice(0, 10).split('-').map(Number);
const dateOf = (text: string) => {
  const [year, month, day] = parts(text);
  return new Date(year, month - 1, day);
};

/** «23 a 29 de novembro» (ou «30 de novembro a 6 de dezembro» quando a semana muda de mês). */
export function weekRangeText(start: string, end: string): string {
  const a = dateOf(start);
  const b = dateOf(end);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} a ${b.getDate()} de ${MONTHS_LONG[b.getMonth()]}`
    : `${a.getDate()} de ${MONTHS_LONG[a.getMonth()]} a ${b.getDate()} de ${MONTHS_LONG[b.getMonth()]}`;
}

/** O que mostrar à direita de cada dia e o texto de apoio por baixo. */
export function scheduleDayText(day: ScheduleDay): { value: string; sub: string; muted: boolean } {
  const holiday = day.feriado ? `Feriado · ${day.feriado}` : '';
  const pending = day.ferias_pedido ? 'Pedido de férias por decidir' : '';
  if (day.tipo === 'trabalho') {
    const hours = day.minutos ? `${Math.floor(day.minutos / 60)} h${day.minutos % 60 ? ` ${String(day.minutos % 60).padStart(2, '0')}` : ''}` : '';
    const pause = day.pausa_inicio && day.pausa_fim ? `pausa ${day.pausa_inicio}–${day.pausa_fim}` : '';
    return { value: `${day.inicio}–${day.fim}`, sub: [day.local, hours, pause, holiday, pending].filter(Boolean).join(' · '), muted: false };
  }
  const value = day.tipo === 'ferias' ? 'Férias' : day.tipo === 'baixa' ? 'Baixa' : day.tipo === 'feriado' ? 'Feriado' : day.tipo === 'folga' ? 'Folga' : 'Sem horário';
  return { value, sub: [day.tipo === 'feriado' ? (day.feriado ?? '') : holiday, pending].filter(Boolean).join(' · '), muted: day.tipo === 'folga' || day.tipo === 'feriado' || day.tipo === 'sem_horario' };
}

const errorMessage = (exc: unknown) => (exc instanceof NetworkError ? 'Sem rede. O horário aparece quando houver ligação.' : exc instanceof ApiError ? exc.message : 'Não foi possível carregar.');

/** Seletor «Registos | Horário» (os dois ecrãs vivem em Registos). */
export function SectionSwitch({ section, onChange }: { section: 'registos' | 'horario'; onChange: (section: 'registos' | 'horario') => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors.skeleton, borderRadius: 12, padding: 3 }}>
      {([['registos', 'Registos'], ['horario', 'Horário']] as const).map(([value, label]) => {
        const on = section === value;
        return (
          <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(value)}
            style={{ flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.surface : 'transparent', borderWidth: on ? 1 : 0, borderColor: colors.line }}>
            <Text style={{ fontFamily: on ? fonts.bodyBold : fonts.bodyMedium, fontSize: 15, color: on ? colors.ink : colors.ink2 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ScheduleBody({ token, switcher, onAuthError }: { token: string; switcher: ReactNode; onAuthError: (error: unknown) => boolean }) {
  const [week, setWeek] = useState<ScheduleWeek | null>(null);
  const [target, setTarget] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setWeek((await employeeApi.schedule(token, target)).semana);
    } catch (exc) {
      if (onAuthError(exc)) return;
      // Semana fora do intervalo que o servidor mostra: fica na que estava, com o aviso.
      setError(errorMessage(exc));
      if (exc instanceof ApiError && exc.status === 400) setTarget(week?.inicio);
    } finally {
      setLoading(false);
    }
  }, [token, target, onAuthError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 12 }}
      refreshControl={<RefreshControl refreshing={loading && Boolean(week)} onRefresh={load} colors={[colors.band]} />}
    >
      {switcher}

      {week ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Semana anterior" onPress={() => setTarget(week.anterior)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 24, color: colors.band }}>‹</Text>
          </Pressable>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{weekRangeText(week.inicio, week.fim)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Semana seguinte" onPress={() => setTarget(week.seguinte)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 24, color: colors.band }}>›</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}
      {loading && !week ? <RegistosSkeleton /> : null}

      {week ? (
        <>
          <View accessibilityLabel={`Horas previstas nesta semana: ${Math.floor(week.minutos_planeados / 60)} horas`} style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 16, elevation: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink2 }}>Horas previstas</Text>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 22, color: colors.ink, fontVariant: ['tabular-nums'] }}>
              {Math.floor(week.minutos_planeados / 60)} h{week.minutos_planeados % 60 ? ` ${String(week.minutos_planeados % 60).padStart(2, '0')}` : ''}
            </Text>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 4, paddingHorizontal: 16, elevation: 2 }}>
            {week.dias.map((day, index) => {
              const date = dateOf(day.data);
              const text = scheduleDayText(day);
              return (
                <View
                  key={day.data}
                  accessibilityLabel={`${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS_LONG[date.getMonth()]}: ${text.value}${text.sub ? `, ${text.sub}` : ''}${day.hoje ? ', hoje' : ''}`}
                  style={{ paddingVertical: 10, borderBottomWidth: index === week.dias.length - 1 ? 0 : 1, borderBottomColor: colors.line, backgroundColor: day.hoje ? colors.actionSoft : 'transparent', marginHorizontal: day.hoje ? -16 : 0, paddingHorizontal: day.hoje ? 16 : 0 }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <View style={{ minWidth: 92 }}>
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: day.passado ? colors.ink3 : colors.ink }}>{WEEKDAYS[date.getDay()]}</Text>
                      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 2 }}>{date.getDate()} {MONTHS[date.getMonth()]}{day.hoje ? ' · hoje' : ''}</Text>
                    </View>
                    <Text style={{ flex: 1, textAlign: 'right', fontFamily: fonts.bodyBold, fontSize: 16, color: text.muted || day.passado ? colors.ink3 : colors.ink, fontVariant: ['tabular-nums'] }}>{text.value}</Text>
                  </View>
                  {text.sub ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink2, marginTop: 4, textAlign: 'right' }}>{text.sub}</Text> : null}
                </View>
              );
            })}
          </View>
          <Muted size={13}>Só leitura. Para trocar um dia, fale com o RH. O horário vem do que o RH definiu; férias aprovadas, baixas e feriados aparecem no dia.</Muted>
        </>
      ) : null}
    </ScrollView>
  );
}
