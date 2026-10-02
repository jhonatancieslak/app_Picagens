// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Foto de confirmação depois do PIN: contagem 3-2-1 e foto com a câmara da frente. A foto nunca é
// mostrada no ecrã. Câmara tapada, sem luz ou sem permissão não bloqueia: "Tentar outra vez" ou
// "Registar sem foto" (automático ao fim de NO_PHOTO_AUTO_SECONDS) — o gestor revê depois.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { NO_PHOTO_AUTO_SECONDS, PHOTO_COUNTDOWN_SECONDS } from '../../config';
import { takeConfirmationPhoto } from '../photo';
import { BigButton, Heading, Paragraph, useVw } from '../../components/ui';
import { colors, fonts } from '../../theme';

type Phase = 'countdown' | 'capturing' | 'failed';

interface Props {
  sending: boolean;
  onPhoto: (photoBase64: string | null) => void;
}

export function PhotoScreen({ sending, onPhoto }: Props) {
  const vw = useVw();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [count, setCount] = useState(PHOTO_COUNTDOWN_SECONDS);
  const [autoLeft, setAutoLeft] = useState(NO_PHOTO_AUTO_SECONDS);
  const [attempt, setAttempt] = useState(0);
  const done = useRef(false);

  const finish = (photo: string | null) => {
    if (done.current) return;
    done.current = true;
    onPhoto(photo);
  };

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
    if (permission && !permission.granted && !permission.canAskAgain) setPhase('failed');
  }, [permission, requestPermission]);

  // Contagem só depois de a câmara estar pronta; se não ficar pronta em 6 s, falha.
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (!ready) {
      const guard = setTimeout(() => setPhase('failed'), 6000);
      return () => clearTimeout(guard);
    }
    if (count <= 0) {
      setPhase('capturing');
      return;
    }
    const timer = setTimeout(() => setCount((value) => value - 1), 800);
    return () => clearTimeout(timer);
  }, [phase, ready, count]);

  useEffect(() => {
    if (phase !== 'capturing' || !camera.current) return;
    takeConfirmationPhoto(camera.current)
      .then((photo) => (photo ? finish(photo) : setPhase('failed')))
      .catch(() => setPhase('failed'));
  }, [phase]);

  useEffect(() => {
    if (phase !== 'failed') return;
    setAutoLeft(NO_PHOTO_AUTO_SECONDS);
    const timer = setInterval(() => setAutoLeft((left) => left - 1), 1000);
    return () => clearInterval(timer);
  }, [phase, attempt]);
  useEffect(() => {
    if (phase === 'failed' && autoLeft <= 0) finish(null);
  }, [phase, autoLeft]);

  function retry() {
    setAttempt((value) => value + 1);
    setCount(PHOTO_COUNTDOWN_SECONDS);
    setPhase('countdown');
  }

  const failed = phase === 'failed';
  const frameColor = failed ? colors.danger : phase === 'capturing' || sending ? colors.ok : colors.brand;

  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingTop: vw(6), paddingHorizontal: vw(4), gap: vw(3) }}>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ width: vw(28), aspectRatio: 3 / 4, borderRadius: vw(2.4), overflow: 'hidden', backgroundColor: '#232A35' }}>
          {permission?.granted ? (
            <CameraView key={attempt} ref={camera} facing="front" style={{ flex: 1 }} onCameraReady={() => setReady(true)} onMountError={() => setPhase('failed')} />
          ) : null}
          <View pointerEvents="none" style={{ position: 'absolute', top: '12%', bottom: '12%', left: '18%', right: '18%', borderRadius: 999, borderWidth: vw(0.5), borderColor: frameColor }} />
          {phase === 'countdown' && ready && count > 0 ? (
            <Text style={{ position: 'absolute', alignSelf: 'center', top: '35%', fontFamily: fonts.display, fontSize: vw(12), color: '#fff', textShadowColor: 'rgba(0,0,0,.45)', textShadowRadius: 12 }}>{count}</Text>
          ) : null}
        </View>
      </View>
      <View style={{ flex: 1, gap: vw(1.2) }}>
        <Heading>{failed ? 'Não conseguimos tirar a foto' : sending ? 'A registar…' : 'Olhe para a câmara'}</Heading>
        <Paragraph>
          {failed
            ? 'A câmara parece tapada, está sem luz ou sem permissão. Pode tentar outra vez ou registar sem foto.'
            : 'Foto de confirmação da picagem. Fique parado um segundo.'}
        </Paragraph>
        <Step done label="PIN introduzido" />
        <Step done={!failed && (phase === 'capturing' || sending)} failed={failed} label="Foto de confirmação" />
        <Step done={false} label="Picagem registada" />
        {failed ? (
          <>
            <View style={{ flexDirection: 'row', gap: vw(1.2), marginTop: vw(0.6) }}>
              <BigButton small title="Tentar outra vez" onPress={retry} />
              <BigButton small primary title="Registar sem foto" onPress={() => finish(null)} />
            </View>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: vw(1.4), color: colors.ink3 }}>Regista sem foto em {Math.max(autoLeft, 0)} s.</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

function Step({ label, done, failed }: { label: string; done: boolean; failed?: boolean }) {
  const vw = useVw();
  const background = failed ? colors.danger : done ? colors.ok : colors.line;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: vw(1) }}>
      <View style={{ width: vw(2.2), height: vw(2.2), borderRadius: 99, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: done || failed ? '#fff' : colors.ink2, fontFamily: fonts.bodyBold, fontSize: vw(1.2) }}>{failed ? '!' : done ? '✓' : '·'}</Text>
      </View>
      <Text style={{ fontFamily: done || failed ? fonts.bodyMedium : fonts.body, fontSize: vw(1.55), color: failed ? colors.danger : done ? colors.ink : colors.ink2 }}>{label}</Text>
    </View>
  );
}
