// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// "Hoje" (protótipo v6): logótipo, data · local, saudação e avatar com avisos; cartão do dia com o anel de horas
// à volta do botão de picar, linha das picagens e o mapa centrado na sua posição (raio da obra, distância, morada).
// A posição só é lida com este ecrã aberto (atualiza-se a cada ~20 s) e no toque de picar, nunca em segundo plano.
// 2.3.0 (doc 49 §14, doc 52): longe da obra com bloqueio o botão avisa antes do toque; vibra ao registar; GPS falso
// segue marcado para o servidor; sino das mensagens; aviso urgente no topo. O servidor decide o tipo (doc 43 §3).
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Animated, Easing, Image, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { BellIcon, CloudSavedIcon, EntryDoorIcon, ExitDoorIcon, KeyIcon, OkIcon, PinIcon, RecenterIcon } from '../../components/icons';
import { Logo } from '../../components/ui';
import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { Dashboard, DayPunch, Me, Notice, PlaceCheck, PunchPayload, employeeApi } from '../api';
import { FIX_ERROR_MESSAGES, Fix, addressOf, readPosition, watchPosition } from '../location';
import { enqueueEmployeePunch } from '../queue';
import { Avatar, AvatarPhoto, Button, Chip, ChipTone, Header } from '../ui';

const RING_SIZE = 172;
const RING_RADIUS = 78;
const RING_STROKE = 10;
const RING_INSET = 18;
const WORKDAY_MINUTES = 8 * 60;
const PUNCH_FEEDBACK_MS = 1100;
const TIMELINE_SLOTS = 4;
/** Volta a perguntar ao servidor se está no local quando se moveu isto (ou passou este tempo). */
const RECHECK_METERS = 15;
const RECHECK_MS = 60 * 1000;
const ADDRESS_METERS = 30;

const metersBetween = (a: Fix, b: Fix) => {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.hypot(x, y) * 6_371_000;
};

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

const clock = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const distanceLabel = (meters: number) => (meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.', ',')} km` : `${meters} m`);

const LABELS: Record<string, string> = { entrada: 'Entrada', saida: 'Saída', pausa_inicio: 'Pausa', pausa_fim: 'Fim pausa' };

/** Linha do dia: as picagens feitas, a próxima ("a seguir") e espaços vazios até 4. */
function timeline(punches: DayPunch[], next: string) {
  const done = punches.slice(-(TIMELINE_SLOTS - 1)).map((p) => ({ label: LABELS[p.tipo] ?? p.rotulo, time: p.hora, state: 'done' as const, warn: p.fora_do_local }));
  const slots: { label: string; time: string; state: 'done' | 'next' | 'empty'; warn?: boolean }[] = [...done, { label: LABELS[next] ?? 'Entrada', time: 'a seguir', state: 'next' }];
  let type = next;
  while (slots.length < TIMELINE_SLOTS) {
    type = type === 'saida' ? 'entrada' : 'saida';
    slots.push({ label: LABELS[type], time: '--:--', state: 'empty' });
  }
  return slots;
}

type PunchState = 'idle' | 'locating' | 'sending' | 'done' | 'queued';

interface Props {
  token: string;
  me: Me;
  dashboard: Dashboard | null;
  online: boolean;
  pending: number;
  notices: number;
  /** Primeiro aviso urgente (saída em falta, horas por confirmar, contrato): mostrado no topo. */
  urgent: Notice | null;
  onNotice: (notice: Notice) => void;
  unreadMessages: number;
  onMessages: () => void;
  photo: AvatarPhoto | null;
  onRefresh: () => Promise<void>;
  onProfile: () => void;
  onQueued: () => void;
  onAuthError: (error: unknown) => boolean;
  /** «Ver o meu PIN» (2.5.0): só aparece com `me.opcoes.ver_pin` (a empresa tem tablet ou PC de picagem). */
  onPin: () => void;
  toast: (message: { tone: 'ok' | 'queued' | 'err'; title: string; text?: string; icon?: React.ReactNode }) => void;
}

export function TodayScreen({ token, me, dashboard, online, pending, notices, urgent, onNotice, unreadMessages, onMessages, photo, onRefresh, onProfile, onQueued, onAuthError, onPin, toast }: Props) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState<PunchState>('idle');
  const [place, setPlace] = useState<PlaceCheck | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [fixError, setFixError] = useState<'' | 'denied' | 'disabled' | 'unavailable'>('');
  const [address, setAddress] = useState<string | null>(null);
  const lastCheck = useRef<{ fix: Fix; at: number } | null>(null);
  const lastAddress = useRef<Fix | null>(null);

  /** Nova posição: mapa, morada (se andou ADDRESS_METERS) e, se andou ou passou tempo, "está no local?". */
  const applyFix = useCallback(async (next: Fix, force = false) => {
    setFixError('');
    setFix(next);
    if (!lastAddress.current || metersBetween(lastAddress.current, next) > ADDRESS_METERS) {
      lastAddress.current = next;
      addressOf(next).then(setAddress);
    }
    const previous = lastCheck.current;
    if (!online || (!force && previous && metersBetween(previous.fix, next) < RECHECK_METERS && Date.now() - previous.at < RECHECK_MS)) return;
    lastCheck.current = { fix: next, at: Date.now() };
    try {
      setPlace(await employeeApi.checkPlace(token, next.lat, next.lon));
    } catch (error) {
      onAuthError(error);
    }
  }, [online, token, onAuthError]);

  const locate = useCallback(async () => {
    const result = await readPosition();
    if ('error' in result) {
      setFixError(result.error);
      return null;
    }
    await applyFix(result.fix, true);
    return result.fix;
  }, [applyFix]);

  useEffect(() => {
    locate();
  }, [locate]);

  // Só com a app aberta neste ecrã: segue a posição; em segundo plano para (AppState) e nunca corre.
  useEffect(() => {
    let stop: () => void = () => undefined;
    let active = true;
    const start = async () => {
      stop();
      stop = await watchPosition((next) => active && applyFix(next));
    };
    start();
    const subscription = AppState.addEventListener('change', (appState) => (appState === 'active' ? start() : stop()));
    return () => {
      active = false;
      stop();
      subscription.remove();
    };
  }, [applyFix]);

  // Cada picagem na fila ainda não está no «Hoje» do servidor: um número ímpar delas troca entrada/saída.
  const lastKnown = dashboard?.proximo_tipo ?? 'entrada';
  const next = pending % 2 ? (lastKnown === 'saida' ? 'entrada' : 'saida') : lastKnown;
  const isExit = next === 'saida';
  const minutes = parseHours(dashboard?.horas_hoje ?? '0h00');
  const progress = Math.min(minutes / WORKDAY_MINUTES, 1);
  const circumference = 2 * Math.PI * RING_RADIUS;
  const punches = dashboard?.picagens_hoje ?? [];
  const dayClosed = punches.length > 0 && !isExit;
  const now = new Date();
  const firstNames = me.colaborador.nome.split(/\s+/).slice(0, 2).join(' ');
  const mood = isExit ? 'Bom trabalho até à saída.' : dayClosed ? 'Dia terminado. Bom descanso.' : 'Bem-vindo(a).';
  const status: { tone: ChipTone; label: string } = !online
    ? { tone: 'warn', label: 'Sem rede · guarda' }
    : isExit ? { tone: 'ok', label: 'Em serviço' } : { tone: 'action', label: 'Fora de serviço' };
  const left = WORKDAY_MINUTES - minutes;

  function finish(kind: 'done' | 'queued') {
    setState(kind);
    setTimeout(() => setState('idle'), PUNCH_FEEDBACK_MS);
  }

  const blocked = place?.dentro === false && place.bloqueio;

  async function punch() {
    if (state !== 'idle') return;
    if (blocked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast({ tone: 'err', icon: <PinIcon size={26} color="#fff" />, title: `Está a ${distanceLabel(place?.distancia ?? 0)} do local`, text: 'A empresa só aceita picagens dentro do local. Aproxime-se e tente de novo.' });
      return;
    }
    setState('locating');
    const position = await readPosition();
    let payload: PunchPayload = {};
    if ('fix' in position) {
      const taken = position.fix;
      setFix(taken);
      setFixError('');
      payload = { lat: taken.lat, lon: taken.lon, precisao: Math.round(taken.accuracy), loc_idade_ms: Math.max(0, Date.now() - taken.takenAt), simulado: taken.mocked };
    } else if (me.opcoes.localizacao_obrigatoria) {
      setState('idle');
      setFixError(position.error);
      toast({ tone: 'err', icon: <PinIcon size={26} color="#fff" />, title: 'Ligue a localização para picar', text: FIX_ERROR_MESSAGES[position.error] });
      return;
    }
    payload.colaborador_id = me.colaborador.id;
    const label = LABELS[next] ?? 'Picagem';

    const queue = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      enqueueEmployeePunch(payload);
      onQueued();
      finish('queued');
      toast({ tone: 'queued', icon: <CloudSavedIcon size={26} color="#fff" />, title: `${label} guardada às ${clock(new Date())}`, text: 'Envia sozinha quando houver rede.' });
    };

    if (!online) return queue();
    setState('sending');
    try {
      const result = await employeeApi.punch(token, payload);
      finish('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const where = place?.dentro === true ? `Dentro do local${fix ? ` · ±${Math.round(fix.accuracy)} m` : ''}` : place?.dentro === false ? 'Fora do local' : undefined;
      toast({ tone: 'ok', icon: <OkIcon size={26} color="#fff" />, title: `${LABELS[result.tipo] ?? 'Picagem'} registada às ${result.hora}`, text: where });
      await onRefresh();
    } catch (error) {
      if (error instanceof NetworkError) return queue();
      setState('idle');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (!onAuthError(error)) {
        toast({ tone: 'err', icon: <PinIcon size={26} color="#fff" />, title: 'Picagem não registada', text: error instanceof ApiError ? error.message : 'Tente de novo.' });
      }
    }
  }

  async function refresh() {
    setRefreshing(true);
    await Promise.all([onRefresh(), locate()]);
    setRefreshing(false);
  }

  if (me.licenca?.estado === 'suspensa') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        <Logo height={36} />
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginTop: 8 }}>Picagem indisponível</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.ink2, textAlign: 'center' }}>O acesso da sua empresa ao Picagens está suspenso. As suas picagens anteriores estão guardadas. Fale com o responsável da empresa.</Text>
      </View>
    );
  }

  const buttonColor = state === 'done' ? colors.ok : state === 'queued' ? colors.warn : blocked ? colors.ink3 : isExit ? colors.ink : colors.action;
  const buttonIcon = state === 'done' ? <OkIcon size={34} color="#fff" /> : state === 'queued' ? <CloudSavedIcon size={34} color="#fff" /> : blocked && state === 'idle' ? <PinIcon size={34} color="#fff" /> : isExit ? <ExitDoorIcon size={34} color="#fff" /> : <EntryDoorIcon size={34} color="#fff" />;
  const buttonText = { idle: blocked ? 'Longe' : LABELS[next] ?? 'Picar', locating: 'GPS…', sending: 'A enviar…', done: 'Feito', queued: 'Guardada' }[state];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 110, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.action]} />}
    >
      <Header
        wordmark
        subtitle={`${shortDate(now)}${me.local ? ` · ${me.local}` : ''}`}
        title="Hoje"
        greeting={<>{greeting(now.getHours())}, <Text style={{ fontFamily: fonts.bodyBold, color: colors.ink }}>{firstNames}</Text>. {mood}</>}
        right={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={unreadMessages ? `Mensagens, ${unreadMessages} por ler` : 'Mensagens'} onPress={onMessages} hitSlop={8}
              style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.94 : 1 }] })}>
              <BellIcon size={20} color={colors.ink2} />
              {unreadMessages ? (
                <View style={{ position: 'absolute', top: -4, right: -5, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.action, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10, color: '#fff' }}>{unreadMessages}</Text>
                </View>
              ) : null}
            </Pressable>
            <Avatar name={me.colaborador.nome} count={notices} onPress={onProfile} photo={photo} />
          </View>
        )}
      />

      {urgent ? (
        <Pressable accessibilityRole="button" onPress={() => onNotice(urgent)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, padding: 12, borderRadius: 16, backgroundColor: urgent.tipo === 'saida_em_falta' ? colors.warnSoft : colors.actionSoft, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: urgent.tipo === 'saida_em_falta' ? colors.warnInk : colors.action }}>{urgent.titulo}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: urgent.tipo === 'saida_em_falta' ? colors.warnInk : colors.action }}>{urgent.detalhe}</Text>
          </View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: urgent.tipo === 'saida_em_falta' ? colors.warnInk : colors.action }}>
            {urgent.acao === 'contrato' ? 'Assinar ›' : urgent.acao === 'correcao' ? 'Corrigir ›' : 'Ver ›'}
          </Text>
        </Pressable>
      ) : null}

      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 24, padding: 16, gap: 14 }}>
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
              accessibilityLabel={`Picar ${(LABELS[next] ?? '').toLowerCase()}`}
              accessibilityState={{ busy: state !== 'idle', disabled: online && !dashboard }}
              disabled={state !== 'idle' || (online && !dashboard)}
              onPress={punch}
              style={({ pressed }) => ({
                position: 'absolute', top: RING_INSET, left: RING_INSET, right: RING_INSET, bottom: RING_INSET,
                borderRadius: RING_SIZE, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: buttonColor,
                opacity: online && !dashboard ? 0.45 : 1, transform: [{ scale: pressed ? 0.96 : 1 }],
                shadowColor: colors.action, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 6,
              })}
            >
              {buttonIcon}
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: '#fff', letterSpacing: 0.3, textTransform: 'uppercase' }}>{buttonText}</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.ink3, letterSpacing: 0.7, textTransform: 'uppercase' }}>Trabalhado</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 27, color: colors.ink, letterSpacing: -0.5 }}>
                {Math.floor(minutes / 60)}h<Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink3 }}> {String(minutes % 60).padStart(2, '0')}</Text>
              </Text>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: dayClosed || left > 0 ? colors.ink3 : colors.ok, marginTop: 2 }}>
                {dayClosed ? 'dia fechado' : left > 0 ? `faltam ${Math.floor(left / 60)}h${String(left % 60).padStart(2, '0')}` : 'dia completo'}
              </Text>
            </View>
            <Chip tone={blocked ? 'danger' : status.tone} label={blocked ? `A ${distanceLabel(place?.distancia ?? 0)} da obra` : status.label} />
            {pending ? <Chip tone="warn" label={`${pending} por enviar`} /> : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.line, paddingTop: 12 }}>
          {timeline(punches, next).map((slot, index) => (
            <View key={index} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: slot.state === 'next' ? colors.action : colors.ink3 }}>{slot.label}</Text>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: slot.state === 'next' ? 13 : 15, color: slot.state === 'next' ? colors.action : slot.state === 'empty' ? colors.ink3 : slot.warn ? colors.warn : colors.ink }}>{slot.time}</Text>
            </View>
          ))}
        </View>
      </View>

      {me.opcoes.ver_pin ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center' }}>
            <KeyIcon size={22} color={colors.action} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>PIN de picagem</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink2 }}>Para picar no tablet ou no computador da empresa.</Text>
          </View>
          <Button ghost title="Ver o meu PIN" onPress={onPin} />
        </View>
      ) : null}

      {fixError === 'denied' || fixError === 'disabled' ? (
        <View style={{ gap: 10, padding: 16, borderRadius: 18, backgroundColor: colors.warnSoft }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <PinIcon size={20} color={colors.warn} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.warn }}>Localização desligada</Text>
          </View>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink2 }}>
            {me.opcoes.localizacao_obrigatoria ? 'A sua empresa pede a localização para picar.' : 'Sem localização, o gestor não vê se estava no local.'} Só é lida no momento em que toca em Picar.
          </Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              title="Ligar localização"
              onPress={async () => {
                const permission = await Location.requestForegroundPermissionsAsync();
                if (!permission.granted && !permission.canAskAgain) Linking.openSettings();
                else locate();
              }}
            />
          </View>
        </View>
      ) : (
        <PlaceMap place={place} fix={fix} address={address} error={fixError ? FIX_ERROR_MESSAGES[fixError] : ''} onRecenter={locate} />
      )}
    </ScrollView>
  );
}

const MAP_HEIGHT = 196;
const TILE_PX = 256;
const MAP_TILES_URL = 'https://picagens.pt/mapa';
const METERS_PER_PIXEL_Z0 = 156_543.033_92;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
const MIN_VIEW_METERS = 60;
const EDGE_PX = 14;

/** Pixel no mapa-múndi (Web Mercator) ao zoom z. */
function worldPixel(lat: number, lon: number, zoom: number) {
  const scale = TILE_PX * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return { x: ((lon + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}

/** Mapa real: mosaicos do OpenStreetMap através da cache de picagens.pt/mapa, **centrado na sua posição** (ponto a
 * pulsar, 2.3.0) com a obra e o raio à escala; o zoom ajusta-se para caberem os dois. Sem posição, centra na obra. */
function PlaceMap({ place, fix, address: currentAddress, error, onRecenter }: { place: PlaceCheck | null; fix: Fix | null; address: string | null; error: string; onRecenter: () => void }) {
  const [width, setWidth] = useState(340);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const radiusMeters = place?.raio ?? 0;
  const site = place?.local_lat !== undefined && place?.local_lon !== undefined ? { lat: place.local_lat, lon: place.local_lon } : null;
  const center = fix ? { lat: fix.lat, lon: fix.lon } : site;
  let zoom = MAX_ZOOM - 1;
  let tiles: { key: string; uri: string; left: number; top: number }[] = [];
  let user: { x: number; y: number } | null = null;
  let radiusPx = 0;
  let sitePx: { x: number; y: number } | null = null;
  if (center) {
    const centerPx0 = worldPixel(center.lat, center.lon, 0);
    const userDistance = site && fix ? Math.hypot(
      (worldPixel(fix.lat, fix.lon, 0).x - centerPx0.x) * METERS_PER_PIXEL_Z0 * Math.cos((center.lat * Math.PI) / 180),
      (worldPixel(fix.lat, fix.lon, 0).y - centerPx0.y) * METERS_PER_PIXEL_Z0 * Math.cos((center.lat * Math.PI) / 180),
    ) : 0;
    const halfPx = Math.min(width, MAP_HEIGHT) / 2 - EDGE_PX;
    const needed = Math.max(radiusMeters * 1.3, userDistance * 1.15, MIN_VIEW_METERS);
    const metersPerPixel = (z: number) => (METERS_PER_PIXEL_Z0 * Math.cos((center.lat * Math.PI) / 180)) / 2 ** z;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(Math.log2((METERS_PER_PIXEL_Z0 * Math.cos((center.lat * Math.PI) / 180) * halfPx) / needed))));
    const c = worldPixel(center.lat, center.lon, zoom);
    const left = c.x - width / 2;
    const top = c.y - MAP_HEIGHT / 2;
    const count = 2 ** zoom;
    for (let x = Math.floor(left / TILE_PX); x <= Math.floor((left + width) / TILE_PX); x += 1) {
      for (let y = Math.floor(top / TILE_PX); y <= Math.floor((top + MAP_HEIGHT) / TILE_PX); y += 1) {
        if (y < 0 || y >= count) continue;
        const wrapped = ((x % count) + count) % count;
        tiles.push({ key: `${zoom}/${x}/${y}`, uri: `${MAP_TILES_URL}/${zoom}/${wrapped}/${y}.png`, left: x * TILE_PX - left, top: y * TILE_PX - top });
      }
    }
    if (site) {
      const s = worldPixel(site.lat, site.lon, zoom);
      sitePx = {
        x: Math.min(Math.max(s.x - left, EDGE_PX), width - EDGE_PX),
        y: Math.min(Math.max(s.y - top, EDGE_PX), MAP_HEIGHT - EDGE_PX),
      };
      radiusPx = Math.max(radiusMeters / metersPerPixel(zoom), 6);
    }
    if (fix) {
      const u = worldPixel(fix.lat, fix.lon, zoom);
      user = {
        x: Math.min(Math.max(u.x - left, EDGE_PX), width - EDGE_PX),
        y: Math.min(Math.max(u.y - top, EDGE_PX), MAP_HEIGHT - EDGE_PX),
      };
    }
  } else {
    tiles = [];
  }

  const chip: { tone: ChipTone; label: string } = error ? { tone: 'danger', label: 'Sem posição' }
    : place?.dentro === true ? { tone: 'ok', label: 'Dentro do local' }
    : place?.dentro === false ? { tone: place.bloqueio ? 'danger' : 'warn', label: 'Fora do local' }
    : { tone: 'neutral', label: fix ? 'Posição obtida' : 'A obter posição…' };
  const tagDetails = [radiusMeters ? `raio ${radiusMeters} m` : null, fix ? `GPS ±${Math.round(fix.accuracy)} m` : null].filter(Boolean).join(' · ');
  const distance = place?.distancia !== undefined ? `está a ${distanceLabel(place.distancia)}` : '';
  const address = error || place?.mensagem || [place?.local_morada, distance].filter(Boolean).join(' · ') || 'A confirmar a sua posição';
  const here = !error && currentAddress ? `Está em ${currentAddress}` : null;

  return (
    <View style={{ gap: 6 }}>
    <View
      accessibilityLabel={`Mapa: ${chip.label}${place?.distancia !== undefined ? `, a ${distanceLabel(place.distancia)}` : ''}`}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height: MAP_HEIGHT, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.mapLand }}
    >
      {tiles.map((tile) => (
        <Image key={tile.key} source={{ uri: tile.uri }} style={{ position: 'absolute', left: tile.left, top: tile.top, width: TILE_PX, height: TILE_PX }} fadeDuration={0} />
      ))}
      <Svg width={width} height={MAP_HEIGHT} style={{ position: 'absolute', left: 0, top: 0 }}>
        {sitePx ? (
          <>
            <Circle cx={sitePx.x} cy={sitePx.y} r={radiusPx} fill="rgba(37,99,235,.12)" stroke={colors.action} strokeWidth={1.5} strokeDasharray="4 4" />
            <G x={sitePx.x} y={sitePx.y}>
              <Path d="M0 0 C-9 -12 -12 -16 -12 -22 a12 12 0 0 1 24 0 c0 6 -3 10 -12 22z" fill={colors.ink} />
              <Rect x={-5} y={-27} width={10} height={9} rx={1.5} fill="#fff" />
            </G>
          </>
        ) : null}
        {user ? <Circle cx={user.x} cy={user.y} r={7} fill={colors.brand} stroke="#fff" strokeWidth={2.5} /> : null}
      </Svg>
      <Text style={{ position: 'absolute', right: 4, bottom: 2, fontFamily: fonts.body, fontSize: 9, color: colors.ink2, backgroundColor: 'rgba(255,255,255,.75)', paddingHorizontal: 3, borderRadius: 3 }}>© OpenStreetMap</Text>
      {user ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', left: user.x - 9, top: user.y - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,195,255,.35)',
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          }}
        />
      ) : null}
      <View style={{ position: 'absolute', left: 10, top: 10, right: 56, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10, elevation: 3 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink }} numberOfLines={1}>{place?.local ?? 'Local de trabalho'}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: error ? colors.danger : colors.ink2 }} numberOfLines={2}>{address}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Atualizar a minha posição"
        onPress={onRecenter}
        style={({ pressed }) => ({ position: 'absolute', right: 10, top: 10, width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', elevation: 3, transform: [{ scale: pressed ? 0.94 : 1 }] })}
      >
        <RecenterIcon size={18} color={colors.action} />
      </Pressable>
      <View style={{ position: 'absolute', left: 10, bottom: 10, right: 10, flexDirection: 'row' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, elevation: 3 }}>
          <Chip tone={chip.tone} label={chip.label} />
          {tagDetails ? <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink2 }}>{tagDetails}</Text> : null}
        </View>
      </View>
    </View>
    {here ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
        <PinIcon size={14} color={colors.brand} />
        <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.ink2 }} numberOfLines={1}>{here}</Text>
      </View>
    ) : null}
    </View>
  );
}
