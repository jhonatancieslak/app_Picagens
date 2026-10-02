// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// "Registos": picagens do mês, dia a dia, com as horas. Só leitura nesta versão; correções, visto do
// período e pedidos continuam na PWA até chegarem à app (doc 48 §2).
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { MonthRecords, employeeApi } from '../api';
import { Card, Chip, Muted, Title } from '../ui';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const dayLabel = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return `${WEEKDAYS[date.getDay()]}, ${day}/${String(month).padStart(2, '0')}`;
};

interface Props {
  token: string;
  onAuthError: (error: unknown) => boolean;
}

export function RecordsScreen({ token, onAuthError }: Props) {
  const insets = useSafeAreaInsets();
  const today = new Date();
  const [month, setMonth] = useState({ ano: today.getFullYear(), mes: today.getMonth() + 1 });
  const [data, setData] = useState<MonthRecords | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await employeeApi.records(token, month.ano, month.mes));
    } catch (exc) {
      if (onAuthError(exc)) return;
      setError(exc instanceof NetworkError ? 'Sem rede. Os registos aparecem quando houver ligação.' : exc instanceof ApiError ? exc.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, [token, month, onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  const isCurrentMonth = month.ano === today.getFullYear() && month.mes === today.getMonth() + 1;
  const days = [...(data?.dias ?? [])].reverse();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 18, paddingTop: insets.top + 16, paddingBottom: 120, gap: 14 }}
      refreshControl={<RefreshControl refreshing={loading && Boolean(data)} onRefresh={load} colors={[colors.action]} />}
    >
      <Title>Registos</Title>
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <MonthArrow label="‹" accessibilityLabel="Mês anterior" onPress={() => data && setMonth(data.mes_anterior)} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, textTransform: 'capitalize' }}>{data?.mes_nome ?? '…'}</Text>
          <MonthArrow label="›" accessibilityLabel="Mês seguinte" disabled={isCurrentMonth} onPress={() => data && setMonth(data.mes_seguinte)} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.ink3 }}>Horas do mês</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.ink }}>{data?.horas_mes ?? '—'}</Text>
        </View>
      </Card>

      {error ? <Muted>{error}</Muted> : null}
      {loading && !data ? <ActivityIndicator color={colors.action} /> : null}
      {data && !days.length ? <Muted>Sem picagens neste mês.</Muted> : null}

      {days.length ? (
        <Card style={{ padding: 0 }}>
          {days.map((day, index) => (
            <View key={day.data} style={{ padding: 14, gap: 6, borderTopWidth: index ? 1 : 0, borderColor: colors.line }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{dayLabel(day.data)}</Text>
                {day.completo ? (
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{day.horas}</Text>
                ) : (
                  <Chip tone="warn" label="Sem saída" />
                )}
              </View>
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.ink2 }}>
                {day.picagens.map((punch) => `${punch.rotulo} ${punch.hora}${punch.fora_do_local ? ' (fora do local)' : ''}${punch.correcao_pendente ? ' · correção pedida' : ''}`).join('  ·  ')}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function MonthArrow({ label, accessibilityLabel, onPress, disabled }: { label: string; accessibilityLabel: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} disabled={disabled} hitSlop={10}
      style={{ width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}
