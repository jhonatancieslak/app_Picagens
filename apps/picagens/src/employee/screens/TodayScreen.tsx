// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// "Hoje": saudação, cartão do dia com o anel de horas à volta do botão de picar, picagens de hoje e o
// cartão do local (dentro/fora do raio, distância, precisão do GPS). A posição só é lida neste ecrã e
// no toque de picar. O servidor decide o tipo (entrada/saída) e repete todas as regras (doc 43 §3).
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { EntryIcon, ExitIcon, LocationIcon } from '../../components/icons';
import { Logo } from '../../components/ui';
import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { Dashboard, Me, PlaceCheck, PunchPayload, employeeApi } from '../api';
import { FIX_ERROR_MESSAGES, Fix, readPosition } from '../location';
import { enqueueEmployeePunch } from '../queue';
import { Avatar, Card, Chip, ChipTone, Muted } from '../ui';

const RING_SIZE = 172;
const RING_RADIUS = 78;
const RING_STROKE = 10;
const RING_INSET = 18;
const WORKDAY_MINUTES = 8 * 60;

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const shortDate = (date: Date) => `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;

const greeting = (hour: number) => (hour >= 6 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 20 ? 'Boa tarde' : 'Boa noite');

/** "7h30" (formato do servidor) → minutos. */
export const parseHours = (text: string) => {
  const match = /^(\d+)h(\d{2})$/.exec(text ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
};

export const formatHours = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}`;

type Feedback = { tone: 'ok' | 'warn' | 'danger'; text: string } | null;

interface Props {
  token: string;
  me: Me;
  dashboard: Dashboard | null;
  online: boolean;
  pending: number;
  onRefresh: () => Promise<void>;
  onProfile: () => void;
  onQueued: () => void;
  onAuthError: (error: unknown) => boolean;
}

export function TodayScreen({ token, me, dashboard, online, pending, onRefresh, onProfile, onQueued, onAuthError }: Props) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<'' | 'locating' | 'sending'>('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [place, setPlace] = useState<PlaceCheck | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [placeError, setPlaceError] = useState('');

  const locate = useCallback(async () => {
    setPlaceError('');
    const result = await readPosition();
    if ('error' in result) {
      setPlaceError(FIX_ERROR_MESSAGES[result.error]);
      return null;
    }
    setFix(result.fix);
    if (online) {
      try {
        setPlace(await employeeApi.checkPlace(token, result.fix.lat, result.fix.lon));
      } catch (error) {
        onAuthError(error);
      }
    }
    return result.fix;
  }, [online, token, onAuthError]);

  useEffect(() => {
    locate();
  }, [locate]);

  const next = dashboard?.proximo_tipo ?? 'entrada';
  const isExit = next === 'saida';
  const suspended = me.licenca?.estado === 'suspensa';
  const minutes = parseHours(dashboard?.horas_hoje ?? '0h00');
  const progress = Math.min(minutes / WORKDAY_MINUTES, 1);
  const circumference = 2 * Math.PI * RING_RADIUS;
  const punches = dashboard?.picagens_hoje ?? [];
  const dayClosed = punches.length > 0 && !isExit;
  const now = new Date();
  const firstName = me.colaborador.nome.split(/\s+/)[0];
  const mood = isExit ? 'Bom trabalho.' : dayClosed ? 'Dia terminado. Bom descanso.' : 'Bem-vindo(a).';
  const status: { tone: ChipTone; label: string } = !online
    ? { tone: 'warn', label: 'Sem rede · guarda' }
    : isExit ? { tone: 'ok', label: 'Em serviço' } : { tone: 'neutral', label: 'Fora de serviço' };

  async function punch() {
    setFeedback(null);
    setBusy('locating');
    const position = await readPosition();
    let payload: PunchPayload = {};
    if ('fix' in position) {
      const taken = position.fix;
      setFix(taken);
      payload = { lat: taken.lat, lon: taken.lon, precisao: Math.round(taken.accuracy), loc_idade_ms: Math.max(0, Date.now() - taken.takenAt) };
    } else if (me.opcoes.localizacao_obrigatoria) {
      setBusy('');
      setFeedback({ tone: 'danger', text: FIX_ERROR_MESSAGES[position.error] });
      return;
    }
    payload.colaborador_id = me.colaborador.id;
    const label = isExit ? 'Saída' : 'Entrada';

    if (!online) {
      enqueueEmployeePunch(payload);
      onQueued();
      setBusy('');
      setFeedback({ tone: 'warn', text: `${label} guardada às ${clock(new Date())}. Sem rede: é enviada sozinha quando houver ligação.` });
      return;
    }
    setBusy('sending');
    try {
      const result = await employeeApi.punch(token, payload);
      setFeedback({ tone: 'ok', text: `${result.tipo === 'saida' ? 'Saída' : 'Entrada'} registada às ${result.hora}.` });
      await onRefresh();
    } catch (error) {
      if (error instanceof NetworkError) {
        enqueueEmployeePunch(payload);
        onQueued();
        setFeedback({ tone: 'warn', text: `${label} guardada às ${clock(new Date())}. Sem rede: é enviada sozinha quando houver ligação.` });
      } else if (!onAuthError(error)) {
        setFeedback({ tone: 'danger', text: error instanceof ApiError ? error.message : 'Não foi possível registar. Tente de novo.' });
      }
    } finally {
      setBusy('');
    }
  }

  async function refresh() {
    setRefreshing(true);
    await Promise.all([onRefresh(), locate()]);
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 18, paddingTop: insets.top + 16, paddingBottom: 120, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.action]} />}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Logo height={34} />
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink2 }}>
            {shortDate(now)}{me.local ? ` · ${me.local}` : ''}
          </Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.ink, letterSpacing: -0.5 }}>Hoje</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink2 }}>
            {greeting(now.getHours())}, <Text style={{ fontFamily: fonts.bodyBold, color: colors.ink }}>{firstName}</Text>. {mood}
          </Text>
        </View>
        <Avatar name={me.colaborador.nome} count={dashboard?.avisos_total ?? 0} onPress={onProfile} />
      </View>

      {suspended ? (
        <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }}>
          <Text style={{ fontFamily: fonts.bodyBold, color: colors.danger, fontSize: 15 }}>Picagem indisponível</Text>
          <Muted>A picagem da sua empresa está suspensa. Fale com o seu responsável.</Muted>
        </Card>
      ) : null}

      <Card style={{ gap: 14, borderRadius: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: RING_SIZE, height: RING_SIZE }}>
            <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} style={{ transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" stroke={colors.line} strokeWidth={RING_STROKE} />
              <Circle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" stroke={colors.ok} strokeWidth={RING_STROKE}
                strokeLinecap="round" strokeDasharray={`${circumference}`} strokeDashoffset={circumference * (1 - progress)}
              />
            </Svg>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isExit ? 'Picar saída' : 'Picar entrada'}
              accessibilityState={{ busy: Boolean(busy), disabled: suspended }}
              disabled={Boolean(busy) || suspended || !dashboard}
              onPress={punch}
              style={({ pressed }) => ({
                position: 'absolute', top: RING_INSET, left: RING_INSET, right: RING_INSET, bottom: RING_INSET,
                borderRadius: RING_SIZE, alignItems: 'center', justifyContent: 'center', gap: 4,
                backgroundColor: isExit ? colors.ink : colors.action,
                opacity: suspended || !dashboard ? 0.45 : pressed || busy ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              {isExit ? <ExitIcon size={34} color="#fff" /> : <EntryIcon size={34} color="#fff" />}
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: '#fff', letterSpacing: 0.3 }}>
                {busy === 'locating' ? 'GPS…' : busy === 'sending' ? 'A ENVIAR…' : isExit ? 'SAÍDA' : 'ENTRADA'}
              </Text>
            </Pressable>
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.ink3 }}>Trabalhado hoje</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.ink }}>{formatHours(minutes)}</Text>
              {dayClosed ? <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink2 }}>dia fechado</Text> : null}
            </View>
            <Chip tone={status.tone} label={status.label} />
            {pending ? <Chip tone="warn" label={`${pending} por enviar`} /> : null}
          </View>
        </View>

        {feedback ? (
          <View accessibilityRole="alert" style={{ borderRadius: 14, padding: 12, backgroundColor: { ok: colors.okSoft, warn: colors.warnSoft, danger: colors.dangerSoft }[feedback.tone] }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: { ok: colors.ok, warn: colors.warn, danger: colors.danger }[feedback.tone] }}>{feedback.text}</Text>
          </View>
        ) : null}

        <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.line, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {punches.map((item, index) => (
            <View key={`${item.hora}-${index}`} style={{ minWidth: 72, alignItems: 'center', gap: 2 }}>
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.ink3 }}>{item.rotulo}</Text>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: item.fora_do_local ? colors.warn : colors.ink }}>{item.hora}</Text>
            </View>
          ))}
          <View style={{ minWidth: 72, alignItems: 'center', gap: 2 }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.action }}>{isExit ? 'Saída' : 'Entrada'}</Text>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.action }}>a seguir</Text>
          </View>
        </View>
      </Card>

      <PlaceCard place={place} fix={fix} error={placeError} online={online} onRetry={locate} />
    </ScrollView>
  );
}

const clock = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const distanceLabel = (meters: number) => (meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.', ',')} km` : `${meters} m`);

function PlaceCard({ place, fix, error, online, onRetry }: { place: PlaceCheck | null; fix: Fix | null; error: string; online: boolean; onRetry: () => void }) {
  let chip: { tone: ChipTone; label: string } = { tone: 'neutral', label: 'A obter posição…' };
  if (error) chip = { tone: 'danger', label: 'Sem posição' };
  else if (place?.dentro === true) chip = { tone: 'ok', label: 'Dentro do local' };
  else if (place?.dentro === false) chip = { tone: place.bloqueio ? 'danger' : 'warn', label: 'Fora do local' };
  else if (fix && !online) chip = { tone: 'neutral', label: 'Posição obtida' };

  const details = [
    place?.distancia !== undefined ? `está a ${distanceLabel(place.distancia)}` : null,
    place?.raio !== undefined ? `raio ${place.raio} m` : null,
    fix ? `GPS ±${Math.round(fix.accuracy)} m` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center' }}>
          <LocationIcon size={24} color={colors.action} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{place?.local ?? 'Local de trabalho'}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink2 }}>{error || place?.mensagem || details || 'A confirmar a sua posição'}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Chip tone={chip.tone} label={chip.label} />
        <Text accessibilityRole="button" onPress={onRetry} style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.action, padding: 6 }}>Atualizar posição</Text>
      </View>
      {place?.dentro === false && place.bloqueio ? (
        <Muted size={13}>A sua empresa só aceita picagens dentro do local. Aproxime-se da obra e tente de novo.</Muted>
      ) : null}
    </Card>
  );
}
