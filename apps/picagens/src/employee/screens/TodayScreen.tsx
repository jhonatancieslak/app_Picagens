// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// "Hoje" (protótipo v6): logótipo, data · local, saudação e avatar com avisos; cartão do dia com o anel de horas
// à volta do botão de picar, linha das picagens e o mapa centrado na sua posição (raio da obra, distância, morada).
// A posição só é lida com este ecrã aberto (atualiza-se a cada ~20 s) e no toque de picar, nunca em segundo plano.
// 2.3.0 (doc 49 §14, doc 52): longe da obra com bloqueio o botão avisa antes do toque; vibra ao registar; GPS falso
// segue marcado para o servidor; sino das mensagens; aviso urgente no topo. O servidor decide o tipo (doc 43 §3).
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Animated, Easing, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { KeyIcon, PinIcon, RecenterIcon } from '../../components/icons';
import { Logo } from '../../components/ui';
import { HojeSkeleton } from '../../components/Skeleton';
import SlideAction from '../../components/SlideAction';
import ResultSheet, { ResultadoPicar } from '../../components/ResultSheet';
import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { Dashboard, Me, Notice, PlaceCheck, PunchPayload, PunchType, TeamRef, WeekSummary, employeeApi } from '../api';
import { TeamHomeCards } from './TeamHomeCards';
import { FIX_ERROR_MESSAGES, Fix, addressOf, isFreshFix, readPosition, watchPosition } from '../location';
import { enqueueEmployeePunch } from '../queue';
import { Avatar, AvatarPhoto, Button, Chip, ChipTone } from '../ui';

const WEEK_CHART_HEIGHT = 84;
/** O relógio mostra os segundos (pedido do Jhonatan, 25/11): atualiza a cada segundo. */
const CLOCK_TICK_MS = 1000;
const PUNCH_FEEDBACK_MS = 1100;
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

/** "7h30" (formato do servidor) → minutos. */
export const parseHours = (text: string) => {
  const match = /^(\d+)h(\d{2})$/.exec(text ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
};

export const formatHours = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}`;

const clock = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const distanceLabel = (meters: number) => (meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.', ',')} km` : `${meters} m`);

const LABELS: Record<string, string> = { entrada: 'Entrada', saida: 'Saída', pausa_inicio: 'Pausa', pausa_fim: 'Fim pausa' };

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
  photo: AvatarPhoto | null;
  onRefresh: () => Promise<void>;
  onProfile: () => void;
  onQueued: () => void;
  onAuthError: (error: unknown) => boolean;
  /** «Ver o meu PIN» (2.5.0): só aparece com `me.opcoes.ver_pin` (a empresa tem tablet ou PC de picagem). */
  onPin: () => void;
  toast: (message: { tone: 'ok' | 'queued' | 'err'; title: string; text?: string; icon?: React.ReactNode }) => void;
  /** Só para chefes de equipa: a equipa a mostrar no Hoje (artboard AppChefeHoje) e a prova do PIN do separador Equipa. */
  team?: { teams: TeamRef[]; pinToken: string | null; onOpen: () => void };
}

export function TodayScreen({ token, me, dashboard, online, pending, notices, urgent, onNotice, photo, onRefresh, onProfile, onQueued, onAuthError, onPin, toast, team }: Props) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState<PunchState>('idle');
  const [resultado, setResultado] = useState<ResultadoPicar | null>(null);
  const fecharResultado = useCallback(() => setResultado(null), []);
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
  const onBreak = next === 'pausa_fim';
  const canBreak = next === 'pausa_inicio'; // pausa à mão: depois da entrada pode-se iniciar a pausa ou sair direto
  const isExit = next === 'saida' || canBreak || onBreak; // em serviço (inclui a pausa)
  const [confirmBreak, setConfirmBreak] = useState(false);
  const minutes = parseHours(dashboard?.horas_hoje ?? '0h00');
  const punches = dashboard?.picagens_hoje ?? [];
  const dayClosed = punches.length > 0 && !isExit;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  function finish(kind: 'done' | 'queued') {
    setState(kind);
    setTimeout(() => setState('idle'), PUNCH_FEEDBACK_MS);
  }

  const blocked = place?.dentro === false && place.bloqueio;

  async function punch(wanted?: PunchType) {
    if (state !== 'idle') return;
    if (blocked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResultado({ tone: 'err', title: 'Não foi possível picar', text: `Está a ${distanceLabel(place?.distancia ?? 0)} do posto${place?.raio ? `. Tem de estar a menos de ${place.raio} metros` : ''}. Aproxime-se e tente de novo.` });
      return;
    }
    const tappedAt = new Date().toISOString();
    setState('locating');
    const position = isFreshFix(fix) ? { fix } : await readPosition();
    let payload: PunchPayload = { chave: Crypto.randomUUID(), ...(wanted ? { tipo: wanted } : {}) };
    if ('fix' in position) {
      const taken = position.fix;
      setFix(taken);
      setFixError('');
      payload = { ...payload, lat: taken.lat, lon: taken.lon, precisao: Math.round(taken.accuracy), loc_idade_ms: Math.max(0, Date.now() - taken.takenAt), simulado: taken.mocked };
    } else if (me.opcoes.localizacao_obrigatoria) {
      setState('idle');
      setFixError(position.error);
      setResultado({ tone: 'err', title: 'Ligue a localização para picar', text: FIX_ERROR_MESSAGES[position.error] });
      return;
    }
    payload.colaborador_id = me.colaborador.id;
    const label = LABELS[next] ?? 'Picagem';

    const queue = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      enqueueEmployeePunch(payload, tappedAt);
      onQueued();
      finish('queued');
      setResultado({ tone: 'queued', title: `Picagem guardada às ${clock(new Date())}`, text: 'Sem rede. A picagem fica neste telemóvel e é enviada sozinha quando houver ligação.', pendentes: pending + 1 });
    };

    if (!online) return queue();
    setState('sending');
    try {
      const result = await employeeApi.punch(token, payload);
      finish('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const where = place?.dentro === true
        ? `Está no local${place.distancia !== undefined ? `, a ${distanceLabel(place.distancia)} do posto` : ''}. Bom trabalho.`
        : place?.dentro === false ? 'Registada fora do local.' : undefined;
      setResultado({ tone: 'ok', title: `${LABELS[result.tipo] ?? 'Picagem'} registada`, hora: `às ${result.hora}`, text: where });
      await onRefresh();
    } catch (error) {
      if (error instanceof NetworkError) return queue();
      setState('idle');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (!onAuthError(error)) {
        setResultado({ tone: 'err', title: 'Picagem não registada', text: error instanceof ApiError ? error.message : 'Tente de novo.' });
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

  // Enquanto o primeiro «Painel» não chega: skeleton do artboard (nunca uma página em branco).
  if (online && !dashboard) return <HojeSkeleton />;

  const week = dashboard?.semana;
  const firstEntry = punches.find((p) => p.tipo === 'entrada');
  const verb = ({ entrada: 'entrar', saida: 'sair', pausa_inicio: 'sair', pausa_fim: 'retomar' } as Record<string, string>)[next] ?? 'picar';
  const breakSince = [...punches].reverse().find((p) => p.tipo === 'pausa_inicio')?.hora;
  const workedText = `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  const subline = isExit ? `${firstEntry ? `entrou às ${firstEntry.hora} · ` : ''}${workedText} hoje` : `agora${me.local ? ` · ${me.local}` : ''}`;
  const placeStatus: { text: string; color: string } | null = !online ? { text: 'Sem rede · a picagem fica guardada', color: colors.warnInk }
    : blocked ? { text: `Está a ${distanceLabel(place?.distancia ?? 0)} do local`, color: colors.danger }
    : onBreak ? { text: `Em pausa${breakSince ? ` desde ${breakSince}` : ''}`, color: colors.warnInk }
    : isExit ? { text: 'Em serviço', color: colors.ok }
    : dayClosed ? { text: 'Dia terminado. Bom descanso.', color: colors.ink2 }
    : place?.dentro === true ? { text: 'Está no local de trabalho', color: colors.ink2 }
    : place?.dentro === false ? { text: 'Fora do local de trabalho', color: colors.warnInk }
    : null;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: colors.band, paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo height={26} white />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.surface }}>{me.colaborador.nome.split(/\s+/)[0]}</Text>
            <Avatar name={me.colaborador.nome} count={notices} onPress={onProfile} photo={photo} size={36} />
          </View>
        </View>
        {week ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }} accessibilityLabel="Dias da semana">
            {week.dias.map((day) => (
              <View key={day.rotulo} style={{ alignItems: 'center', gap: 6, minWidth: 40, opacity: day.hoje ? 1 : 0.8 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: day.hoje ? colors.surface : 'transparent' }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: day.hoje ? colors.band : colors.surface }}>{day.numero}</Text>
                </View>
                <Text style={{ fontFamily: day.hoje ? fonts.bodyBold : fonts.bodyMedium, fontSize: 12, color: colors.surface }}>{day.rotulo}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 110, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.action]} />}
      >
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 64, lineHeight: 70, letterSpacing: -1.5, color: colors.ink, fontVariant: ['tabular-nums'] }}>{clock(now)}<Text style={{ fontSize: 34, color: colors.ink3, letterSpacing: -0.5 }}>:{String(now.getSeconds()).padStart(2, '0')}</Text></Text>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink2, marginTop: 6, textAlign: 'center' }}>{subline}</Text>
          {placeStatus ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: placeStatus.color, marginTop: 6, textAlign: 'center' }}>{placeStatus.text}</Text> : null}
          {pending ? <View style={{ marginTop: 8 }}><Chip tone="warn" label={`${pending} por enviar`} /></View> : null}
        </View>

        {fixError === 'denied' || fixError === 'disabled' ? (
          <View style={{ gap: 10, padding: 16, borderRadius: 18, backgroundColor: colors.warnSoft }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <PinIcon size={20} color={colors.warnInk} />
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.warnInk }}>Localização desligada</Text>
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

        {week ? <WeekCard week={week} /> : null}
        {team ? <TeamHomeCards token={token} pinToken={team.pinToken} teams={team.teams} onOpenTeam={team.onOpen} onAuthError={onAuthError} /> : null}

        {urgent ? (
          <Pressable accessibilityRole="button" onPress={() => onNotice(urgent)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 56, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface, elevation: 2, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }}>{urgent.titulo}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3, marginTop: 2 }}>{urgent.detalhe}</Text>
            </View>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.band }}>
              {urgent.acao === 'contrato' ? 'Assinar' : urgent.acao === 'correcao' ? 'Corrigir' : 'Ver'}
            </Text>
          </Pressable>
        ) : null}

        {(
          // Sempre visível (pedido de 25/11): bloqueado enquanto envia ou quando o local não deixa picar.
          // Deslizar para a ação seguinte (artboard v9): verde para entrar, vermelho-escuro para sair.
          <SlideAction
            label={`Deslize para ${verb}`}
            color={next === 'saida' || canBreak ? colors.danger : next === 'pausa_fim' ? colors.warn : colors.ok}
            disabled={Boolean(blocked) || state !== 'idle' || (online && !dashboard)}
            onConfirm={() => punch(canBreak ? 'saida' : undefined)}
          />
        )}
        {canBreak ? (
          <Button ghost tone="faixa" title="Iniciar pausa" disabled={Boolean(blocked) || state !== 'idle'} onPress={() => setConfirmBreak(true)} />
        ) : null}
        <Modal visible={confirmBreak} transparent animationType="fade" onRequestClose={() => setConfirmBreak(false)}>
          <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 22, gap: 12 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink }}>Iniciar pausa agora?</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink2 }}>A pausa começa às {clock(now)}. Pode retomar quando quiser. A pausa não entra nas horas trabalhadas.</Text>
              <Button ghost tone="faixa" title="Cancelar" onPress={() => setConfirmBreak(false)} />
              <Button primary tone="verde" title="Iniciar pausa" onPress={() => { setConfirmBreak(false); punch('pausa_inicio'); }} />
            </View>
          </View>
        </Modal>

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

        <ResultSheet resultado={resultado} onClose={fecharResultado} />
      </ScrollView>
    </View>
  );
}

/** «21h33» → «21 h 33»; «40h00» → «40 h» (artboard v9). */
const humanHours = (text: string) => {
  const match = /^(\d+)h(\d{2})$/.exec(text);
  return match ? (match[2] === '00' ? `${match[1]} h` : `${match[1]} h ${match[2]}`) : text;
};

/** «Esta semana»: barras por dia, o dia de hoje a escuro, os futuros vazios e a meta diária a tracejado (artboard v9). */
function WeekCard({ week }: { week: WeekSummary }) {
  const total = week.carga_texto ? `${humanHours(week.total_texto)} de ${humanHours(week.carga_texto)}` : humanHours(week.total_texto);
  return (
    <View accessibilityLabel={`Esta semana, ${total}`} style={{ backgroundColor: colors.surface, borderRadius: 18, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12, elevation: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>Esta semana</Text>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink2 }}>{total}</Text>
      </View>
      <View style={{ height: WEEK_CHART_HEIGHT, marginTop: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }} importantForAccessibility="no-hide-descendants">
        {week.meta_altura ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: week.meta_altura, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.line }} /> : null}
        {week.dias.map((day) => (
          <View key={day.rotulo} style={{ flex: 1, maxWidth: 34, alignItems: 'center', justifyContent: 'flex-end' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.ink2, marginBottom: 4, fontVariant: ['tabular-nums'] }}>{day.futuro ? '' : day.texto}</Text>
            <View style={{ width: '100%', height: day.altura, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: day.hoje ? colors.band : day.minutos ? colors.ok : colors.skeleton }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {week.dias.map((day) => (
          <Text key={day.rotulo} style={{ flex: 1, maxWidth: 34, textAlign: 'center', fontFamily: day.hoje ? fonts.bodyBold : fonts.bodyMedium, fontSize: 12, color: day.hoje ? colors.band : colors.ink3 }}>{day.rotulo}</Text>
        ))}
      </View>
    </View>
  );
}

const MAP_HEIGHT = 112;
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
            <Circle cx={sitePx.x} cy={sitePx.y} r={radiusPx} fill={colors.okSoft} fillOpacity={0.7} stroke={colors.ok} strokeWidth={1.5} strokeDasharray="4 4" />
            <G x={sitePx.x} y={sitePx.y}>
              <Path d="M0 0 C-9 -12 -12 -16 -12 -22 a12 12 0 0 1 24 0 c0 6 -3 10 -12 22z" fill={colors.band} />
              <Rect x={-5} y={-27} width={10} height={9} rx={1.5} fill={colors.surface} />
            </G>
          </>
        ) : null}
        {user ? <Circle cx={user.x} cy={user.y} r={6} fill={colors.ok} stroke={colors.surface} strokeWidth={2.5} /> : null}
      </Svg>
      <Text style={{ position: 'absolute', right: 4, bottom: 2, fontFamily: fonts.body, fontSize: 9, color: colors.ink2, backgroundColor: 'rgba(255,255,255,.75)', paddingHorizontal: 3, borderRadius: 3 }}>© OpenStreetMap</Text>
      {user ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', left: user.x - 9, top: user.y - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.okSoft,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          }}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Atualizar a minha posição"
        onPress={onRecenter}
        style={({ pressed }) => ({ position: 'absolute', right: 10, top: 10, width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', elevation: 3, transform: [{ scale: pressed ? 0.94 : 1 }] })}
      >
        <RecenterIcon size={18} color={colors.band} />
      </Pressable>
      <View style={{ position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 8, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 12, elevation: 3 }}>
        <Text style={{ flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 12, color: chip.tone === 'danger' ? colors.danger : chip.tone === 'warn' ? colors.warnInk : colors.ok }} numberOfLines={1}>
          {error ? 'Sem posição' : place?.dentro === true ? 'No raio do posto' : place?.dentro === false ? 'Fora do raio do posto' : chip.label}
        </Text>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink2 }} numberOfLines={1}>{place?.distancia !== undefined ? distanceLabel(place.distancia) : tagDetails}</Text>
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
