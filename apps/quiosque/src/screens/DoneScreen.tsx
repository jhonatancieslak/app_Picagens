// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Confirmação (5 s): verde = registada; azul-petróleo = registada sem foto; âmbar = guardada sem rede;
// vermelho = recusada (regra da empresa). Nunca mostra a foto.
import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

import { CONFIRMATION_MS } from '../config';
import { CheckIcon } from '../components/icons';
import { Logo, useVw } from '../components/ui';
import { colors, fonts } from '../theme';

export type DoneKind = 'ok' | 'no_photo' | 'queued' | 'refused';

export interface DoneInfo {
  kind: DoneKind;
  name?: string;
  label: string;
  message: string;
  photoSaved: boolean;
}

const BACKGROUND: Record<DoneKind, string> = { ok: colors.ok, no_photo: colors.pending, queued: colors.warn, refused: colors.danger };

export function DoneScreen({ info, onClose }: { info: DoneInfo; onClose: () => void }) {
  const vw = useVw();
  const progress = useRef(new Animated.Value(1)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    Animated.timing(progress, { toValue: 0, duration: CONFIRMATION_MS, useNativeDriver: false }).start();
    const timer = setTimeout(() => onCloseRef.current(), CONFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [progress]);

  const background = BACKGROUND[info.kind];
  return (
    <View accessibilityLiveRegion="assertive" style={{ flex: 1, backgroundColor: background, alignItems: 'center', justifyContent: 'center', gap: vw(1.1) }}>
      <View style={{ width: vw(11), height: vw(11), borderRadius: 999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        {info.kind === 'refused' ? (
          <Text style={{ fontFamily: fonts.display, fontSize: vw(6), color: background }}>!</Text>
        ) : (
          <CheckIcon size={vw(5.4)} color={background} />
        )}
      </View>
      {info.name ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(3.4), color: '#fff' }}>{info.name}</Text> : null}
      <Text style={{ fontFamily: fonts.display, fontSize: vw(info.kind === 'refused' ? 4.5 : 8), color: '#fff', letterSpacing: -1, textAlign: 'center' }}>{info.label}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: vw(1.9), color: 'rgba(255,255,255,.94)', maxWidth: vw(60), textAlign: 'center' }}>{info.message}</Text>
      {info.photoSaved ? (
        <View style={{ backgroundColor: 'rgba(255,255,255,.2)', borderRadius: 999, paddingHorizontal: vw(1.6), paddingVertical: vw(0.6) }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: vw(1.5), color: '#fff' }}>Foto de confirmação guardada</Text>
        </View>
      ) : null}
      <View style={{ position: 'absolute', bottom: vw(3) }}>
        <Logo white height={vw(3.2)} />
      </View>
      <Animated.View
        style={{ position: 'absolute', left: 0, bottom: 0, height: vw(0.8), backgroundColor: 'rgba(255,255,255,.6)', width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}
      />
    </View>
  );
}
