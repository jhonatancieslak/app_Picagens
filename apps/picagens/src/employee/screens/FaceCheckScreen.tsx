// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Confirmação do rosto ao picar (doc 77 §9.11): câmara da frente, uma foto que não sai do telemóvel, comparada com o
// modelo guardado no próprio telemóvel (funciona sem rede). A picagem conta sempre; o resultado vai com ela e o RH vê
// «Rosto não confirmado» no Livro de ponto. Telemóvel novo sem modelo guardado: pede-o ao servidor uma vez.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FaceEngineUnavailable, FaceNotUsable, FaceTemplate, matchesFaceTemplate } from '../../face/engine';
import { colors, fonts } from '../../theme';
import { FaceStatus, employeeApi } from '../api';
import { getFaceTemplate, saveFaceTemplate } from '../storage';
import { Button } from '../ui';

const CAPTURE_DELAY_MS = 700;
const OVAL_WIDTH = 210;
const OVAL_HEIGHT = 270;

type Phase = 'loading' | 'camera' | 'checking' | 'failed';

async function savedTemplate(token: string): Promise<FaceTemplate | null> {
  const local = await getFaceTemplate();
  if (local) return local;
  try {
    const { rosto } = await employeeApi.face(token);
    if (rosto) await saveFaceTemplate(rosto);
    return rosto;
  } catch {
    return null; // sem rede e sem modelo neste telemóvel: pica sem verificação
  }
}

export function FaceCheckScreen({ token, onResult }: { token: string; onResult: (status: FaceStatus) => void }) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('loading');
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [failedStatus, setFailedStatus] = useState<FaceStatus>('nao_verificado');
  const [attempt, setAttempt] = useState(0);
  const template = useRef<FaceTemplate | null>(null);

  useEffect(() => {
    (async () => {
      template.current = await savedTemplate(token);
      if (!template.current) return onResult('nao_verificado');
      const granted = permission?.granted || (await requestPermission()).granted;
      if (!granted) {
        setMessage('Sem acesso à câmara. A picagem fica marcada como não verificada.');
        setPhase('failed');
        return;
      }
      setPhase('camera');
    })();
    // só ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'camera' || !ready || !camera.current || !template.current) return;
    let active = true;
    (async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, CAPTURE_DELAY_MS));
        const picture = await camera.current?.takePictureAsync({ quality: 0.7, shutterSound: false });
        if (!active || !picture?.uri || !template.current) return;
        setPhase('checking');
        if (await matchesFaceTemplate(picture.uri, template.current)) return onResult('confirmado');
        setFailedStatus('nao_confirmado');
        setMessage('O rosto não corresponde ao registado. Tente de novo, com boa luz.');
      } catch (failure) {
        setFailedStatus('nao_verificado');
        setMessage(failure instanceof FaceNotUsable || failure instanceof FaceEngineUnavailable ? failure.message : 'Não foi possível ler o rosto.');
      }
      if (active) setPhase('failed');
    })();
    return () => { active = false; };
  }, [phase, ready, attempt, onResult]);

  if (phase === 'failed') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20, gap: 14 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink }}>Rosto não confirmado</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink2 }}>{message}</Text>
        <View style={{ flex: 1 }} />
        {permission?.granted ? <Button primary title="Tentar outra vez" onPress={() => { setReady(false); setAttempt((n) => n + 1); setPhase('camera'); }} /> : null}
        <Button link title="Picar sem confirmar (o RH é avisado)" onPress={() => onResult(failedStatus)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {phase === 'loading' ? null : <CameraView key={attempt} ref={camera} style={{ flex: 1 }} facing="front" onCameraReady={() => setReady(true)} />}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: OVAL_WIDTH, height: OVAL_HEIGHT, borderRadius: OVAL_WIDTH, borderWidth: 4, borderColor: phase === 'checking' ? colors.ok : '#fff' }} />
      </View>
      <Text style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 32, fontFamily: fonts.bodyBold, fontSize: 17, color: '#fff', textAlign: 'center' }}>
        {phase === 'checking' ? 'A confirmar…' : 'Olhe para a câmara'}
      </Text>
    </View>
  );
}
