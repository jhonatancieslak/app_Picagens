// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Registo do rosto (doc 77 §9.11). Aparece ao abrir a app quando a empresa ligou o rosto e o colaborador ainda não o
// registou, também a quem já usava a app antes de a empresa o ligar. Primeiro explica (o que se guarda e onde), depois
// a câmara da frente tira FACE_SAMPLES fotos que nunca saem do telemóvel: só o modelo cifrado vai para o servidor.
// "Agora não" deixa usar a app nesta abertura; na seguinte volta a pedir.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FACE_SAMPLES, FaceEngineUnavailable, FaceNotUsable, computeFaceTemplate } from '../../face/engine';
import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { employeeApi } from '../api';
import { saveFaceTemplate } from '../storage';
import { Button, Card, ErrorText, Fact, Muted, Title } from '../ui';

type Phase = 'intro' | 'camera' | 'saving' | 'error';

const SAMPLE_INTERVAL_MS = 700;
const OVAL_WIDTH = 210;
const OVAL_HEIGHT = 270;

interface Props {
  token: string;
  company: string;
  onDone: () => void;
  onLater: () => void;
}

export function FaceEnrollScreen({ token, company, onDone, onLater }: Props) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('intro');
  const [ready, setReady] = useState(false);
  const [taken, setTaken] = useState(0);
  const [error, setError] = useState('');

  async function start() {
    const granted = permission?.granted || (await requestPermission()).granted;
    if (!granted) {
      setError('Sem acesso à câmara. Autorize a câmara nas definições do telemóvel para registar o rosto.');
      setPhase('error');
      return;
    }
    setTaken(0);
    setReady(false);
    setPhase('camera');
  }

  // Câmara pronta: tira as fotos seguidas, calcula o modelo no telemóvel e envia só o modelo.
  useEffect(() => {
    if (phase !== 'camera' || !ready || !camera.current) return;
    let active = true;
    (async () => {
      const uris: string[] = [];
      try {
        for (let i = 0; i < FACE_SAMPLES && active; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, SAMPLE_INTERVAL_MS));
          const picture = await camera.current?.takePictureAsync({ quality: 0.7, shutterSound: false });
          if (picture?.uri) uris.push(picture.uri);
          setTaken(i + 1);
        }
        if (!active) return;
        setPhase('saving');
        const template = await computeFaceTemplate(uris);
        await employeeApi.saveFace(token, template.modelo, template.versao);
        await saveFaceTemplate(template);
        onDone();
      } catch (failure) {
        if (!active) return;
        setError(
          failure instanceof FaceEngineUnavailable || failure instanceof FaceNotUsable ? failure.message
            : failure instanceof NetworkError ? 'Sem ligação. O rosto é guardado quando houver rede; tente de novo.'
              : failure instanceof ApiError ? failure.message
                : 'Não foi possível ler o rosto. Procure boa luz e olhe de frente para a câmara.',
        );
        setPhase('error');
      }
    })();
    return () => { active = false; };
  }, [phase, ready, token, onDone]);

  if (phase === 'camera' || phase === 'saving') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={camera} style={{ flex: 1 }} facing="front" onCameraReady={() => setReady(true)} />
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: OVAL_WIDTH, height: OVAL_HEIGHT, borderRadius: OVAL_WIDTH, borderWidth: 4, borderColor: phase === 'saving' ? colors.ok : '#fff' }} />
        </View>
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 28, gap: 6, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: '#fff', textAlign: 'center' }}>
            {phase === 'saving' ? 'A guardar…' : 'Olhe de frente, com o rosto dentro do oval'}
          </Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: '#fff', opacity: 0.85 }}>
            {phase === 'saving' ? 'Só o código cifrado sai do telemóvel.' : `${taken} de ${FACE_SAMPLES}`}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: insets.top + 30, paddingBottom: insets.bottom + 20, gap: 14 }}>
      <Title>Registar o rosto</Title>
      <Muted size={14.5}>A {company} pede que confirme o rosto quando pica. Faz-se uma vez e demora uns segundos.</Muted>
      <Card>
        <Fact title="Não guardamos fotografias">As fotos ficam só no telemóvel e são apagadas logo a seguir.</Fact>
        <Fact title="Só um código cifrado" divider>Do código não se consegue refazer a cara.</Fact>
        <Fact title="Só para confirmar a picagem" divider>Comparado no próprio telemóvel ou tablet, e apagado quando sair da empresa.</Fact>
      </Card>
      {phase === 'error' ? <ErrorText>{error}</ErrorText> : null}
      <View style={{ flex: 1 }} />
      <Button primary title={phase === 'error' ? 'Tentar outra vez' : 'Começar'} onPress={start} />
      <Button link title="Agora não" onPress={onLater} />
    </ScrollView>
  );
}
