// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Teclado numérico do PIN do colaborador e do código de administrador. Os algarismos nunca aparecem
// no ecrã; sem toques durante IDLE_TIMEOUT_SECONDS volta ao início (com contagem visível).
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { ADMIN_CODE_MAX_LENGTH, IDLE_TIMEOUT_SECONDS, PIN_LENGTH } from '../../config';
import { Dots, Heading, Keypad, LinkButton, Paragraph, useVw } from '../../components/ui';
import { colors, fonts } from '../../theme';

export type PadMode = 'pin' | 'admin';

interface Props {
  mode: PadMode;
  error: string;
  busy: boolean;
  onSubmit: (code: string) => void;
  onBack: () => void;
}

const TEXTS: Record<PadMode, { title: string; hint: string }> = {
  pin: { title: 'Qual é o seu PIN?', hint: 'Os números não aparecem no ecrã.' },
  admin: { title: 'Código de administrador', hint: 'Peça-o ao responsável da obra.' },
};

export function PadScreen({ mode, error, busy, onSubmit, onBack }: Props) {
  const vw = useVw();
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(IDLE_TIMEOUT_SECONDS);
  const maxLength = mode === 'pin' ? PIN_LENGTH : ADMIN_CODE_MAX_LENGTH;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((left) => left - 1), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (secondsLeft <= 0) onBackRef.current();
  }, [secondsLeft]);
  useEffect(() => {
    if (error) setCode('');
  }, [error]);

  function press(key: string) {
    if (busy) return;
    setSecondsLeft(IDLE_TIMEOUT_SECONDS);
    if (key === 'clear') return setCode('');
    if (key === 'ok') {
      if (code.length >= (mode === 'pin' ? PIN_LENGTH : 4)) onSubmit(code);
      return;
    }
    if (code.length >= maxLength) return;
    const next = code + key;
    setCode(next);
    if (mode === 'pin' && next.length === PIN_LENGTH) setTimeout(() => onSubmit(next), 150);
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingTop: vw(6), paddingHorizontal: vw(4), paddingBottom: vw(2) }}>
      <View style={{ flex: 1, gap: vw(1.1) }}>
        <LinkButton title="‹ Voltar" onPress={onBack} />
        <Heading>{TEXTS[mode].title}</Heading>
        <Paragraph>{TEXTS[mode].hint}</Paragraph>
        <Dots length={mode === 'pin' ? PIN_LENGTH : Math.max(4, code.length)} filled={code.length} />
        <Text accessibilityRole="alert" style={{ minHeight: vw(2.3), fontFamily: fonts.bodyBold, fontSize: vw(1.65), color: colors.danger }}>
          {busy ? '' : error}
        </Text>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: vw(1.4), color: colors.ink3 }}>
          {busy ? 'A verificar…' : `Volta ao início em ${Math.max(secondsLeft, 0)} s sem toques.`}
        </Text>
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Keypad onKey={press} />
      </View>
    </View>
  );
}
