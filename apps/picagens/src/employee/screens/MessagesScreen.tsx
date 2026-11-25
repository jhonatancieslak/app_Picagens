// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Caixa de mensagens (doc 49 §14): o que o gestor escreveu a esta pessoa (ou a todos). A lista mostra o início de
// cada mensagem; tocar abre "Ver mensagem" com o texto completo (pode ser grande) e marca-a como lida.
// 2.3.2: arrastar para a esquerda apaga (com "Anular" durante uns segundos), para a direita marca como lida;
// "Marcar todas como lidas". Apagar só tira da caixa do colaborador: a empresa continua a ver a mensagem.
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, PanResponder, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Illustration } from '../../components/Illustration';
import { ListaSkeleton } from '../../components/Skeleton';
import { colors, fonts } from '../../theme';
import { Message, employeeApi } from '../api';
import { BackLink, Button, Card, Muted, Title } from '../ui';

/** Tempo para "Anular" depois de apagar; só então segue para o servidor. */
const UNDO_MS = 5000;
/** Fração da largura a partir da qual o arrasto conta (apagar / marcar como lida). */
const SWIPE_FRACTION = 0.33;
/** Movimento mínimo, e mais horizontal do que vertical, para não roubar o scroll da lista. */
const SWIPE_START_PX = 12;

interface Props {
  token: string;
  onBack: () => void;
  onRead: () => void;
  onAuthError: (error: unknown) => boolean;
}

export function MessagesScreen({ token, onBack, onRead, onAuthError }: Props) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [viewing, setViewing] = useState<Message | null>(null);
  const [undo, setUndo] = useState<{ message: Message; index: number } | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDelete = useRef<Message | null>(null);

  const load = useCallback(async () => {
    try {
      const list = (await employeeApi.messages(token)).mensagens;
      setMessages(list.filter((m) => m.id !== pendingDelete.current?.id));
      setError('');
    } catch (exc) {
      if (!onAuthError(exc)) setError('Sem ligação. Puxe para baixo para tentar de novo.');
    }
  }, [token, onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  const commitDelete = useCallback(async () => {
    const message = pendingDelete.current;
    pendingDelete.current = null;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndo(null);
    if (!message) return;
    try {
      await employeeApi.deleteMessage(token, message.id);
      onRead();
    } catch (exc) {
      if (!onAuthError(exc)) {
        setError('Não foi possível apagar a mensagem. Tente de novo.');
        load();
      }
    }
  }, [token, onRead, onAuthError, load]);

  // Ao sair do ecrã, a mensagem apagada (ainda com "Anular" à vista) segue logo para o servidor.
  useEffect(() => () => { commitDelete(); }, [commitDelete]);

  // "Voltar" do Android em "Ver mensagem" volta à lista (este ouvinte é o mais recente, por isso corre primeiro).
  useEffect(() => {
    if (!viewing) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setViewing(null);
      return true;
    });
    return () => subscription.remove();
  }, [viewing]);

  async function markRead(message: Message) {
    if (message.lida) return;
    setMessages((current) => current?.map((m) => (m.id === message.id ? { ...m, lida: true } : m)) ?? null);
    try {
      await employeeApi.readMessage(token, message.id);
      onRead();
    } catch (exc) {
      onAuthError(exc);
    }
  }

  async function markAllRead() {
    setMessages((current) => current?.map((m) => ({ ...m, lida: true })) ?? null);
    try {
      await employeeApi.readAllMessages(token);
      onRead();
    } catch (exc) {
      if (!onAuthError(exc)) load();
    }
  }

  function remove(message: Message) {
    if (pendingDelete.current) commitDelete();
    const index = messages?.findIndex((m) => m.id === message.id) ?? -1;
    setMessages((current) => current?.filter((m) => m.id !== message.id) ?? null);
    setViewing(null);
    pendingDelete.current = message;
    setUndo({ message, index });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    undoTimer.current = setTimeout(commitDelete, UNDO_MS);
  }

  function undoDelete() {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    pendingDelete.current = null;
    setMessages((current) => {
      const list = [...(current ?? [])];
      list.splice(Math.max(0, Math.min(undo.index, list.length)), 0, undo.message);
      return list;
    });
    setUndo(null);
  }

  function openMessage(message: Message) {
    setViewing({ ...message, lida: true });
    markRead(message);
  }

  if (viewing) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 110, gap: 12 }}>
          <BackLink label="Mensagens" onPress={() => setViewing(null)} />
          <Title size={22}>{viewing.titulo}</Title>
          <Muted size={13}>{viewing.de} · {viewing.data}</Muted>
          <Card style={{ padding: 16 }}>
            <Text selectable style={{ fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink }}>{viewing.texto}</Text>
          </Card>
          <Button title="Apagar mensagem" danger onPress={() => remove(viewing)} />
          <Muted size={12.5} center>Apagar tira a mensagem do seu telemóvel. A empresa continua a ter o registo do que enviou.</Muted>
        </ScrollView>
      </View>
    );
  }

  const unread = messages?.filter((m) => !m.lida).length ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 130, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} colors={[colors.action]} />}
      >
        <BackLink label="Hoje" onPress={onBack} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Title>Mensagens</Title>
          {unread ? (
            <Pressable accessibilityRole="button" onPress={markAllRead} hitSlop={10}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.action }}>Marcar todas como lidas</Text>
            </Pressable>
          ) : null}
        </View>
        {error ? <Muted>{error}</Muted> : null}
        {messages === null && !error ? <ListaSkeleton /> : null}
        {messages && !messages.length ? (
          <View style={{ alignItems: 'center', gap: 8, paddingTop: 24 }}>
            <Illustration name="messages" width={210} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>Sem mensagens</Text>
            <Muted size={13.5} center>Quando a empresa lhe escrever, a mensagem aparece aqui e recebe um aviso no telemóvel.</Muted>
          </View>
        ) : null}
        {messages?.length ? <Muted size={12.5}>Toque para ler. Arraste para a direita para marcar como lida, para a esquerda para apagar.</Muted> : null}
        {messages?.map((message) => (
          <SwipeRow key={message.id} message={message} onOpen={() => openMessage(message)} onRead={() => markRead(message)} onDelete={() => remove(message)} />
        ))}
      </ScrollView>
      {undo ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute', left: 14, right: 14, bottom: insets.bottom + 90, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
            flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.ink, elevation: 8,
          }}
        >
          <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: '#fff' }}>Mensagem apagada</Text>
          <Pressable accessibilityRole="button" onPress={undoDelete} hitSlop={10}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.actionSoft }}>ANULAR</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SwipeRow({ message, onOpen, onRead, onDelete }: { message: Message; onOpen: () => void; onRead: () => void; onDelete: () => void }) {
  const { width } = useWindowDimensions();
  const offset = useRef(new Animated.Value(0)).current;
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const threshold = width * SWIPE_FRACTION;
  const actions = useRef({ onRead, onDelete });
  actions.current = { onRead, onDelete };

  const responder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > SWIPE_START_PX && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      offset.setValue(g.dx);
      setDirection(g.dx < 0 ? 'left' : g.dx > 0 ? 'right' : null);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -threshold) {
        Animated.timing(offset, { toValue: -width, duration: 180, useNativeDriver: true }).start(() => actions.current.onDelete());
        return;
      }
      if (g.dx > threshold) actions.current.onRead();
      Animated.spring(offset, { toValue: 0, useNativeDriver: true, friction: 7 }).start(() => setDirection(null));
    },
    onPanResponderTerminate: () => {
      Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start(() => setDirection(null));
    },
  })).current;

  return (
    <View style={{ borderRadius: 18, overflow: 'hidden' }}>
      {direction ? (
        <View style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, paddingHorizontal: 20, justifyContent: 'center',
          alignItems: direction === 'left' ? 'flex-end' : 'flex-start', backgroundColor: direction === 'left' ? colors.danger : colors.ok,
        }}
        >
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: '#fff' }}>{direction === 'left' ? 'Apagar' : 'Marcar como lida'}</Text>
        </View>
      ) : null}
      <Animated.View style={{ transform: [{ translateX: offset }] }} {...responder.panHandlers}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${message.lida ? '' : 'Por ler. '}${message.titulo}. ${message.de}, ${message.data}`}
          accessibilityHint="Abre a mensagem completa"
          accessibilityActions={[{ name: 'activate' }, { name: 'markRead', label: 'Marcar como lida' }, { name: 'delete', label: 'Apagar' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'markRead') onRead();
            else if (event.nativeEvent.actionName === 'delete') onDelete();
            else onOpen();
          }}
          onPress={onOpen}
        >
          <Card style={{ padding: 14, gap: 6, borderColor: message.lida ? colors.line : colors.action }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {!message.lida ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.action }} /> : null}
              <Text style={{ flex: 1, fontFamily: message.lida ? fonts.bodyMedium : fonts.bodyBold, fontSize: 15, color: colors.ink }} numberOfLines={1}>{message.titulo}</Text>
            </View>
            <Muted size={12.5}>{message.de} · {message.data}</Muted>
            <Text style={{ fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink2 }} numberOfLines={2}>{message.texto}</Text>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.action }}>Ver mensagem ›</Text>
          </Card>
        </Pressable>
      </Animated.View>
    </View>
  );
}
