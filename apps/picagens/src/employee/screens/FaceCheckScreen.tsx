// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Confirmação do rosto ao picar (doc 77 §9.11): câmara da frente, uma foto de frente comparada com o modelo guardado
// no próprio telemóvel (funciona sem rede); sem movimentos (decisão do Jhonatan 28/10: ao picar só reconhece e
// confirma; os movimentos ficam no registo). As fotos não saem do telemóvel. A picagem conta sempre; o resultado vai com ela e o RH vê «Rosto não
// confirmado» no Livro de ponto. Telemóvel novo sem modelo guardado: pede-o ao servidor uma vez.
import { useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Svg, { Path } from 'react-native-svg';

import { FaceCapture, FaceStep } from '../../face/FaceCapture';
import { FaceEngineUnavailable, FaceNotUsable, FaceTemplate, matchesFaceTemplate, removePhoto } from '../../face/engine';
import { colors, fonts } from '../../theme';
import { FaceStatus, employeeApi } from '../api';
import { getFaceTemplate, saveFaceTemplate } from '../storage';
import { Button } from '../ui';

type Phase = 'loading' | 'camera' | 'checking' | 'confirmed' | 'failed';

const CHECK_STEPS: FaceStep[] = [
  { kind: 'front', photos: 1, label: 'Frente', title: 'A reconhecer…', detail: 'Mantenha o rosto dentro do oval.' },
];
/** Tempo do «Rosto confirmado» no ecrã antes de seguir para a picagem. */
const CONFIRMED_PAUSE_MS = 900;

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
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('loading');
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

  const fail = useCallback((text: string, status: FaceStatus = 'nao_verificado') => {
    setFailedStatus(status);
    setMessage(text);
    setPhase('failed');
  }, []);

  // A foto de frente compara-se com o modelo guardado; o movimento já foi confirmado pela câmara.
  const check = useCallback(async (frontPhotos: string[]) => {
    const [photo, ...extra] = frontPhotos;
    extra.forEach(removePhoto);
    if (!photo || !template.current) return fail('Não foi possível ler o rosto.');
    setPhase('checking');
    try {
      if (await matchesFaceTemplate(photo, template.current)) {
        setPhase('confirmed');
        setTimeout(() => onResult('confirmado'), CONFIRMED_PAUSE_MS);
        return;
      }
      fail('O rosto não corresponde ao registado. Tente de novo, com boa luz.', 'nao_confirmado');
    } catch (failure) {
      fail(failure instanceof FaceNotUsable || failure instanceof FaceEngineUnavailable ? failure.message : 'Não foi possível ler o rosto.');
    }
  }, [fail, onResult]);

  if (phase === 'camera') {
    return <FaceCapture key={attempt} steps={CHECK_STEPS} autoStart onComplete={check} onError={fail} onCancel={() => fail('Confirmação cancelada.')} />;
  }

  if (phase === 'confirmed') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: colors.okSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke={colors.ok} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M5 12.5l4.5 4.5L19 7.5" />
          </Svg>
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.ink }}>Rosto confirmado</Text>
      </View>
    );
  }

  if (phase === 'failed') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20, gap: 14 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink }}>Rosto não confirmado</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink2 }}>{message}</Text>
        <View style={{ flex: 1 }} />
        {permission?.granted ? <Button primary title="Tentar outra vez" onPress={() => { setAttempt((value) => value + 1); setPhase('camera'); }} /> : null}
        <Button link title="Picar sem confirmar (o RH é avisado)" onPress={() => onResult(failedStatus)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <ActivityIndicator color={colors.action} size="large" />
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>{phase === 'checking' ? 'A confirmar…' : 'A preparar a câmara…'}</Text>
    </View>
  );
}
