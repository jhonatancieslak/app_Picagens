// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Registo do rosto (doc 77 §9.11; canvas «Registo do rosto», aprovado 28/10). Aparece ao abrir a app quando a empresa
// ligou o rosto e o colaborador ainda não o registou. Primeiro explica, depois a câmara da frente guia 5 passos
// (frente, esquerda, direita, cima, baixo) e uma última foto de frente. Só as fotos de frente fazem o código do rosto;
// os movimentos provam que é uma pessoa. As fotos nunca saem do telemóvel: só o código cifrado vai para o servidor.
// "Agora não" deixa usar a app nesta abertura; na seguinte volta a pedir.
import { useCameraPermissions } from 'expo-camera';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { FaceCapture, FaceStep } from '../../face/FaceCapture';
import { FaceEngineUnavailable, FaceNotUsable, computeFaceTemplate } from '../../face/engine';
import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { employeeApi } from '../api';
import { saveFaceTemplate } from '../storage';
import { Button, Card, ErrorText, Fact, Muted, Title } from '../ui';

type Phase = 'intro' | 'camera' | 'saving' | 'done' | 'error';

const ENROLL_STEPS: FaceStep[] = [
  { kind: 'front', photos: 2, label: 'Frente', title: 'Rosto encontrado. Olhe de frente', detail: 'Fique quieto um momento.' },
  { kind: 'move', move: 'esquerda', label: 'Esquerda', title: 'Vire devagar a cabeça para a esquerda', detail: 'Sem mexer o telemóvel. Avança sozinho.' },
  { kind: 'move', move: 'direita', label: 'Direita', title: 'Agora para a direita', detail: 'Devagar, até avançar.' },
  { kind: 'move', move: 'cima', label: 'Cima', title: 'Levante um pouco o queixo', detail: 'Olhe para cima, sem sair do oval.' },
  { kind: 'move', move: 'baixo', label: 'Baixo', title: 'E agora para baixo', detail: 'Depois olhe de frente outra vez.' },
  { kind: 'front', photos: 1, label: 'Fim', title: 'Olhe de frente outra vez', detail: 'Última foto.', hidden: true },
];

const STEP_ICONS = [
  { label: 'Frente', path: 'M12 3a5 5 0 1 0 0 10a5 5 0 1 0 0-10zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6' },
  { label: 'Esquerda', path: 'M15 18l-6-6l6-6' },
  { label: 'Direita', path: 'M9 6l6 6l-6 6' },
  { label: 'Cima', path: 'M6 15l6-6l6 6' },
  { label: 'Baixo', path: 'M6 9l6 6l6-6' },
];

interface Props {
  token: string;
  company: string;
  onDone: () => void;
  onLater: () => void;
}

export function FaceEnrollScreen({ token, company, onDone, onLater }: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('intro');
  const [error, setError] = useState('');

  async function start() {
    const granted = permission?.granted || (await requestPermission()).granted;
    if (!granted) {
      setError('Sem acesso à câmara. Autorize a câmara nas definições do telemóvel para registar o rosto.');
      setPhase('error');
      return;
    }
    setPhase('camera');
  }

  const fail = useCallback((message: string) => {
    setError(message);
    setPhase('error');
  }, []);

  // Fotos de frente → código do rosto no telemóvel → só o código vai para o servidor.
  const save = useCallback(async (frontPhotos: string[]) => {
    setPhase('saving');
    try {
      const template = await computeFaceTemplate(frontPhotos);
      await employeeApi.saveFace(token, template.modelo, template.versao);
      await saveFaceTemplate(template);
      setPhase('done');
    } catch (failure) {
      fail(
        failure instanceof FaceEngineUnavailable || failure instanceof FaceNotUsable ? failure.message
          : failure instanceof NetworkError ? 'Sem ligação. O rosto é guardado quando houver rede; tente de novo.'
            : failure instanceof ApiError ? failure.message
              : 'Não foi possível ler o rosto. Procure boa luz e olhe de frente para a câmara.',
      );
    }
  }, [token, fail]);

  if (phase === 'camera') {
    return <FaceCapture steps={ENROLL_STEPS} onComplete={save} onError={fail} onCancel={() => setPhase('intro')} />;
  }

  if (phase === 'saving' || phase === 'done') {
    const saving = phase === 'saving';
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingBottom: insets.bottom + 20, alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1 }} />
        <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: saving ? colors.actionSoft : colors.okSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke={saving ? colors.action : colors.ok} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d={saving ? 'M12 3a9 9 0 1 0 9 9' : 'M5 12.5l4.5 4.5L19 7.5'} />
          </Svg>
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.ink, textAlign: 'center' }}>{saving ? 'A guardar…' : 'Rosto registado'}</Text>
        <Muted size={15} center>
          {saving ? 'Só o código cifrado sai do telemóvel.' : 'A partir de agora, quando picar, a app confirma que é mesmo você. Demora 2 segundos.'}
        </Muted>
        <View style={{ flex: 1 }} />
        {saving ? null : <View style={{ alignSelf: 'stretch' }}><Button primary title="Continuar" onPress={onDone} /></View>}
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: insets.top + 30, paddingBottom: insets.bottom + 20, gap: 14 }}>
      <Title>Registar o rosto</Title>
      <Muted size={14.5}>A {company} pede que confirme o rosto quando pica. Faz-se uma vez e demora uns 15 segundos.</Muted>
      <Card>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink2, marginBottom: 12 }}>VAI-LHE SER PEDIDO</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {STEP_ICONS.map((item) => (
            <View key={item.label} style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={colors.action} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d={item.path} />
                </Svg>
              </View>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <Fact title="Não guardamos fotografias">As fotos ficam só no telemóvel e são apagadas logo a seguir.</Fact>
        <Fact title="Só um código cifrado" divider>Do código não se consegue refazer a cara.</Fact>
        <Fact title="Os movimentos provam que é mesmo você" divider>Assim ninguém pica com uma fotografia sua.</Fact>
      </Card>
      {phase === 'error' ? <ErrorText>{error}</ErrorText> : null}
      <View style={{ flex: 1 }} />
      <Button primary title={phase === 'error' ? 'Tentar outra vez' : 'Começar'} onPress={start} />
      <Button link title="Agora não" onPress={onLater} />
    </ScrollView>
  );
}
