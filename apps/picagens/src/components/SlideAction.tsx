// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Controlo «deslizar para confirmar» (canvas v31: Hoje · em intervalo e Hoje · entrada registada).
// O gesto fica só no botão (não num Pressable externo, que roubava o toque). Arrastar até ao fim chama
// onConfirm; um toque curto volta ao início. Leitores de ecrã ativam a ação sem gesto (accessibilityActions).
import React, { useRef, useState } from 'react';
import { AccessibilityActionEvent, Animated, PanResponder, StyleSheet, Text, View, LayoutChangeEvent } from 'react-native';
import { colors } from '../theme';
const fonts = { bodyBold: 'Inter_700Bold' } as const;

const TRACK_HEIGHT = 66;
const KNOB_SIZE = 56;
const KNOB_INSET = 5;
const CONFIRM_RATIO = 0.8;

interface SlideActionProps {
  label: string;
  color: string;
  onConfirm: () => void;
  disabled?: boolean;
}

export default function SlideAction({ label, color, onConfirm, disabled = false }: SlideActionProps) {
  const [width, setWidth] = useState(0);
  const travel = Math.max(width - KNOB_SIZE - KNOB_INSET * 2, 1);
  const offset = useRef(new Animated.Value(0)).current;
  // Valores atuais para o PanResponder (que é criado uma vez e não vê props novas).
  const latest = useRef({ travel, disabled, onConfirm });
  latest.current = { travel, disabled, onConfirm };

  const reset = () => {
    Animated.spring(offset, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
  };

  const confirm = () => {
    reset();
    latest.current.onConfirm();
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onMoveShouldSetPanResponder: (_, gesture) => !latest.current.disabled && Math.abs(gesture.dx) > 4,
      onPanResponderMove: (_, gesture) => {
        offset.setValue(Math.min(Math.max(gesture.dx, 0), latest.current.travel));
      },
      onPanResponderRelease: (_, gesture) => {
        const { travel: total } = latest.current;
        if (gesture.dx >= total * CONFIRM_RATIO) {
          Animated.timing(offset, { toValue: total, duration: 120, useNativeDriver: true }).start(() => confirm());
        } else {
          reset();
        }
      },
      onPanResponderTerminate: reset,
    }),
  ).current;

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'activate' && !latest.current.disabled) confirm();
  };

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Deslize até ao fim para confirmar"
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'activate', label }]}
      onAccessibilityAction={onAccessibilityAction}
      style={[styles.track, { backgroundColor: color, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={styles.label}>{label}</Text>
      <Animated.View {...responder.panHandlers} style={[styles.knob, { transform: [{ translateX: offset }] }]}>
        <Text style={[styles.arrow, { color }]}>›</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: 16,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: '#fff',
    paddingLeft: KNOB_SIZE + KNOB_INSET * 2 + 8,
  },
  knob: {
    position: 'absolute',
    left: KNOB_INSET,
    top: KNOB_INSET,
    bottom: KNOB_INSET,
    width: KNOB_SIZE,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 26,
  },
});
