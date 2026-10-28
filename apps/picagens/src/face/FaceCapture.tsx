// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Câmara do rosto com passos (canvas «Registo do rosto», aprovado 28/10): só fotografa quando vê um rosto dentro do
// oval; nos passos «frente» guarda fotos para o código do rosto; nos movimentos (esquerda, direita, cima, baixo) só
// confirma que a cabeça virou, prova de que é uma pessoa e não uma fotografia, e apaga a foto. Usado no registo e na
// picagem. Cada passo tem um limite de tempo: nunca fica preso.
import { CameraView } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts } from '../theme';
import { FacePose, facePose, removePhoto } from './engine';

export type FaceMove = 'esquerda' | 'direita' | 'cima' | 'baixo';
export type FaceStep =
  | { kind: 'front'; photos: number; label: string; title: string; detail: string; hidden?: boolean }
  | { kind: 'move'; move: FaceMove; label: string; title: string; detail: string };

const STEP_TIMEOUT_MS = 15000;
const FRONT_MAX_DEGREES = 10; // «de frente» para as fotos do código
const YAW_MIN_DEGREES = 20; // cabeça virada para o lado
const PITCH_MIN_DEGREES = 15; // queixo para cima ou para baixo
const OVAL_WIDTH = 250;
const OVAL_HEIGHT = 320;
const CAMERA_GROUND = '#0E1522';
const IDLE_SEGMENT = '#3A4A63';
const SOFT_TEXT = '#C9D3E0';

const ARROWS: Record<FaceMove, { path: string; dx: number; dy: number }> = {
  esquerda: { path: 'M15 18l-6-6l6-6', dx: -1, dy: 0 },
  direita: { path: 'M9 6l6 6l-6 6', dx: 1, dy: 0 },
  cima: { path: 'M6 15l6-6l6 6', dx: 0, dy: -1 },
  baixo: { path: 'M6 9l6 6l6-6', dx: 0, dy: 1 },
};

const MOVE_ERRORS: Record<FaceMove, string> = {
  esquerda: 'Não vimos a cabeça a virar para a esquerda.',
  direita: 'Não vimos a cabeça a virar para a direita.',
  cima: 'Não vimos o queixo a subir.',
  baixo: 'Não vimos o queixo a descer.',
};

function moveReached(move: FaceMove, pose: FacePose): boolean {
  switch (move) {
    case 'esquerda': return pose.yaw >= YAW_MIN_DEGREES;
    case 'direita': return pose.yaw <= -YAW_MIN_DEGREES;
    case 'cima': return pose.pitch >= PITCH_MIN_DEGREES;
    case 'baixo': return pose.pitch <= -PITCH_MIN_DEGREES;
  }
}

function isFrontal(pose: FacePose): boolean {
  return Math.abs(pose.yaw) <= FRONT_MAX_DEGREES && Math.abs(pose.pitch) <= FRONT_MAX_DEGREES;
}

interface Props {
  steps: FaceStep[];
  /** Fotos de frente (para o código do rosto). Quem recebe apaga-as. */
  onComplete: (frontPhotos: string[]) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

export function FaceCapture({ steps, onComplete, onError, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [faceSeen, setFaceSeen] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Uma foto de cada vez: mede a posição, avança o passo quando cumprido, guarda só as de frente.
  useEffect(() => {
    if (!ready || !camera.current) return;
    let active = true;
    const kept: string[] = [];
    (async () => {
      for (let index = 0; index < steps.length && active; index += 1) {
        const step = steps[index];
        setStepIndex(index);
        const deadline = Date.now() + STEP_TIMEOUT_MS;
        let photos = 0;
        let done = false;
        while (active && !done) {
          if (Date.now() > deadline) {
            kept.forEach(removePhoto);
            onError(step.kind === 'move' ? MOVE_ERRORS[step.move] : 'Não encontrámos o rosto de frente. Procure boa luz e olhe para a câmara.');
            return;
          }
          let uri: string | undefined;
          try {
            uri = (await camera.current?.takePictureAsync({ quality: 0.7, shutterSound: false }))?.uri;
            if (!uri || !active) continue;
            const pose = await facePose(uri);
            setFaceSeen(Boolean(pose));
            if (pose && step.kind === 'front' && isFrontal(pose)) {
              kept.push(uri);
              uri = undefined; // fica para o código do rosto
              photos += 1;
              done = photos >= step.photos;
            } else if (pose && step.kind === 'move' && moveReached(step.move, pose)) {
              done = true;
            }
          } catch {
            // foto falhada: tenta a seguinte até ao limite do passo
          } finally {
            if (uri) removePhoto(uri);
          }
        }
        if (active) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
      if (active) onComplete(kept);
      else kept.forEach(removePhoto);
    })();
    return () => { active = false; };
  }, [ready, steps, onComplete, onError]);

  const step = steps[stepIndex];
  const visible = steps.filter((item) => !(item.kind === 'front' && item.hidden));
  const doneVisible = steps.slice(0, stepIndex).filter((item) => !(item.kind === 'front' && item.hidden)).length;
  const searching = !faceSeen && step.kind === 'front';
  const arrow = step.kind === 'move' ? ARROWS[step.move] : null;
  const shift = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 10] });

  return (
    <View style={{ flex: 1, backgroundColor: CAMERA_GROUND }}>
      <CameraView ref={camera} style={{ flex: 1 }} facing="front" onCameraReady={() => setReady(true)} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: OVAL_WIDTH, height: OVAL_HEIGHT, borderRadius: OVAL_WIDTH, borderWidth: 5, borderStyle: searching ? 'dashed' : 'solid', borderColor: searching ? '#fff' : colors.brand }} />
      </View>
      {arrow ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={{
              width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
              transform: [
                { translateX: arrow.dx * (OVAL_WIDTH / 2 + 20) },
                { translateY: arrow.dy * (OVAL_HEIGHT / 2 + 20) },
                { translateX: Animated.multiply(shift, arrow.dx) },
                { translateY: Animated.multiply(shift, arrow.dy) },
              ],
            }}
          >
            <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={CAMERA_GROUND} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <Path d={arrow.path} />
            </Svg>
          </Animated.View>
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, paddingTop: insets.top + 8, paddingHorizontal: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={onCancel} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: '#fff' }}>Cancelar</Text>
          </Pressable>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: SOFT_TEXT }}>
            {searching ? 'À procura do rosto…' : `Passo ${Math.min(doneVisible + 1, visible.length)} de ${visible.length}`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {visible.map((item, index) => {
            const current = index === doneVisible && !searching;
            const color = index < doneVisible ? colors.ok : current ? colors.brand : IDLE_SEGMENT;
            return (
              <View key={item.label} style={{ flex: 1, gap: 6 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: color }} />
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11.5, textAlign: 'center', color: index < doneVisible ? '#7EE2A4' : current ? '#fff' : SOFT_TEXT }}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 36, alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: '#fff', textAlign: 'center' }}>
          {searching ? 'Coloque o rosto dentro do oval' : step.title}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 15, color: SOFT_TEXT, textAlign: 'center', maxWidth: 320 }}>
          {searching ? 'Segure o telemóvel à altura dos olhos, com boa luz.' : step.detail}
        </Text>
      </View>
    </View>
  );
}
