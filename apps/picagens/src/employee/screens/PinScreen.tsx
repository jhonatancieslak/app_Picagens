// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// «Ver o meu PIN» (2.5.0, canvas 26, doc 68 §0.4): o PIN fica guardado em HMAC e não se pode mostrar o antigo, por
// isso confirma-se → o servidor cria um PIN novo (POST /eu/pin) → mostra-o uma vez. Limite do dia → 429.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { employeeApi } from '../api';
import { BackLink, Button, Card, ErrorText, Muted, Title } from '../ui';

type Step = 'confirm' | 'shown' | 'limit';

interface Props {
  token: string;
  onBack: () => void;
  onAuthError: (error: unknown) => boolean;
}

/** PIN em letra grande, com o aviso de que não volta a aparecer. Também usado no «Esqueci o PIN» da entrada. */
export function PinShown({ pin, text }: { pin: string; text: string }) {
  return (
    <Card style={{ paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 14 }}>
      <Text accessibilityLabel={`O seu PIN é ${pin.split('').join(' ')}`} style={{ fontFamily: fonts.display, fontSize: 48, letterSpacing: 14, color: colors.ink }}>{pin}</Text>
      <Muted size={14} center>{text}</Muted>
    </Card>
  );
}

export function PinScreen({ token, onBack, onAuthError }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('confirm');
  const [pin, setPin] = useState('');
  const [limit, setLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    setBusy(true);
    setError('');
    try {
      const result = await employeeApi.newPin(token);
      setPin(result.pin);
      setStep('shown');
    } catch (exc) {
      if (onAuthError(exc)) return;
      if (exc instanceof ApiError && exc.status === 429) {
        setLimit(exc.message);
        setStep('limit');
      } else {
        setError(exc instanceof NetworkError ? 'Sem ligação à internet. Tente de novo.' : exc instanceof ApiError ? exc.message : 'Não foi possível criar o PIN. Tente de novo.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24, gap: 16 }}>
      <BackLink label="Voltar" onPress={onBack} />
      {step === 'confirm' ? (
        <>
          <Title>Criar um PIN novo?</Title>
          <Muted size={15}>Por segurança, o PIN não fica guardado à vista. Para o ver, criamos um PIN novo e mostramo-lo uma vez.</Muted>
          <View style={{ backgroundColor: colors.warnSoft, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.warnInk }}>O PIN anterior deixa de funcionar no tablet e no computador da empresa.</Text>
          </View>
          <ErrorText>{error}</ErrorText>
          <Button primary title={busy ? 'A criar…' : 'Criar PIN novo'} busy={busy} onPress={create} />
          <Button ghost title="Cancelar" onPress={onBack} />
        </>
      ) : null}
      {step === 'shown' ? (
        <>
          <Title>O seu PIN de picagem</Title>
          <PinShown pin={pin} text="Anote-o agora: não volta a ser mostrado. No tablet ou no computador da empresa, escreva este PIN para picar." />
          <Muted>Esqueceu-se mais tarde? Volte aqui e crie outro. Também serve para entrar noutro telemóvel.</Muted>
          <Button primary title="Já anotei" onPress={onBack} />
        </>
      ) : null}
      {step === 'limit' ? (
        <>
          <Title>Limite do dia</Title>
          <Card style={{ padding: 20, gap: 12 }}>
            <Muted size={15}>{limit}</Muted>
          </Card>
          <Button ghost title="Voltar ao início" onPress={onBack} />
        </>
      ) : null}
    </ScrollView>
  );
}
