// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Botão de picar do Hoje (doc 252, artboards V4PicarToque e V4EstadosPicar): um toque grande, sempre no mesmo sítio e com a mesma
// altura. Depois do toque corre uma contagem de PUNCH_UNDO_SECONDS com «Desfazer»; só no fim a picagem sai. O servidor não anula
// picagens (registo legal, art. 202.º do CT), por isso o «Desfazer» é só aqui, antes de enviar. Só mudam o texto, o ícone e a cor.
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Pressable, Text, View } from 'react-native';

import { PUNCH_UNDO_SECONDS } from '../config';
import { colors, fonts, punchButton } from '../theme';
import { EntryDoorIcon, ExitDoorIcon, PlayIcon } from './icons';

export type PunchKind = 'entrada' | 'saida' | 'retomar';

/** Verde só para «Entrar»; «Sair» vermelho; «Retomar» âmbar (cada cor tem uma só função). */
const KINDS = {
  entrada: { label: 'Entrar', done: 'Entrada', color: colors.ok, Icon: EntryDoorIcon },
  saida: { label: 'Sair', done: 'Saída', color: colors.danger, Icon: ExitDoorIcon },
  retomar: { label: 'Retomar', done: 'Retoma', color: colors.warn, Icon: PlayIcon },
} as const;

const clockOf = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const UNDO_MS = PUNCH_UNDO_SECONDS * 1000;
const TICK_MS = 250;

interface Props {
  kind: PunchKind;
  /** Sem poder picar (fora do local com bloqueio, painel por carregar): o botão fica no sítio, cinzento. */
  disabled: boolean;
  /** A localizar ou a enviar: o botão fica no sítio com «A registar…». */
  busy: boolean;
  /** Só com `disabled`: porquê («indisponível aqui»). */
  reason?: string;
  /** Chamado no fim da contagem (ou já, se a app sair do ecrã); `tappedAt` = hora do toque (ISO). */
  onConfirm: (tappedAt: string) => void;
}

export default function PunchButton({ kind, disabled, busy, reason, onConfirm }: Props) {
  const spec = KINDS[kind];
  const [counting, setCounting] = useState(false);
  const [left, setLeft] = useState(PUNCH_UNDO_SECONDS);
  const [tappedLabel, setTappedLabel] = useState('');
  const progress = useRef(new Animated.Value(0)).current;
  const tapped = useRef<Date | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;

  const stopTicker = () => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  };

  const finish = () => {
    stopTicker();
    progress.setValue(0);
    setCounting(false);
    const at = tapped.current;
    tapped.current = null;
    if (at) confirmRef.current(at.toISOString());
  };

  const undo = () => {
    stopTicker();
    progress.stopAnimation();
    progress.setValue(0);
    setCounting(false);
    tapped.current = null;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AccessibilityInfo.announceForAccessibility('Picagem desfeita.');
  };

  const start = () => {
    if (disabled || busy || counting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const at = new Date();
    tapped.current = at;
    const endsAt = at.getTime() + UNDO_MS;
    setTappedLabel(clockOf(at));
    setLeft(PUNCH_UNDO_SECONDS);
    setCounting(true);
    ticker.current = setInterval(() => setLeft(Math.max(Math.ceil((endsAt - Date.now()) / 1000), 0)), TICK_MS);
    Animated.timing(progress, { toValue: 1, duration: UNDO_MS, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (finished) finish();
    });
    AccessibilityInfo.announceForAccessibility(`${spec.done} daqui a ${PUNCH_UNDO_SECONDS} segundos. Toque em Desfazer para cancelar.`);
  };

  // Quem tocou quis picar: se a app sai do primeiro plano (ou o ecrã fecha) durante a contagem, a picagem sai já,
  // porque os temporizadores podem parar em segundo plano.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState !== 'active' && tapped.current) {
        progress.stopAnimation();
        finish();
      }
    });
    return () => {
      subscription.remove();
      progress.stopAnimation();
      if (tapped.current) finish();
      stopTicker();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (counting) {
    return (
      <View
        accessibilityLiveRegion="polite"
        style={{
          height: punchButton.height, borderRadius: punchButton.radius, borderWidth: 2, borderColor: spec.color, backgroundColor: colors.surface,
          overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 12,
        }}
      >
        <View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink }}>{spec.done} às {tappedLabel}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink2 }}>A enviar em {left} s</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Desfazer a picagem"
          onPress={undo}
          style={({ pressed }) => ({ height: 48, minWidth: 104, borderRadius: 8, backgroundColor: colors.band, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}
        >
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.surface }}>Desfazer</Text>
        </Pressable>
        <Animated.View style={{ position: 'absolute', left: 0, bottom: 0, height: 5, backgroundColor: spec.color, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
    );
  }

  const ink = disabled ? colors.ink3 : colors.surface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spec.label}
      accessibilityHint={disabled ? reason : `Toque para registar. Tem ${PUNCH_UNDO_SECONDS} segundos para desfazer.`}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={start}
      style={({ pressed }) => ({
        height: punchButton.height, borderRadius: punchButton.radius, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
        backgroundColor: disabled ? colors.skeleton : spec.color, borderWidth: disabled ? 1 : 0, borderColor: colors.fieldBorder,
        opacity: busy ? 0.75 : 1, transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      {busy ? (
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: ink }}>A registar…</Text>
      ) : (
        <>
          <spec.Icon size={28} color={ink} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 22, color: ink }}>{spec.label}</Text>
          {disabled && reason ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink3 }}>{reason}</Text> : null}
        </>
      )}
    </Pressable>
  );
}
