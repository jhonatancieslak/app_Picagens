// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// «Esqueci o meu PIN» no Perfil (artboard p2311-esqueci-pin, aprovado 25/11): código de 6 números para o email da
// ficha → PIN novo gerado pelo servidor e mostrado uma vez. A pessoa não escolhe o PIN. O PIN anterior deixa de
// funcionar e a sessão antiga cai: o servidor devolve uma sessão nova, que a app guarda ao fechar este ecrã.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import ResultSheet, { ResultadoPicar } from '../../components/ResultSheet';
import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { Me, Session, employeeApi } from '../api';
import { Avatar, BarraRodape, Button, Card, ErrorText, Header, Muted, NumPad, OtpCells, applyKey } from '../ui';
import { PinShown } from './PinScreen';

const EMAIL_CODE_LENGTH = 6;
const TITLES = { email: 'Esqueci o meu PIN', code: 'Código enviado para o email', shown: 'O seu PIN novo' } as const;

interface Props {
  token: string;
  me: Me;
  onBack: () => void;
  onAuthError: (error: unknown) => boolean;
  /** Sessão nova devolvida pelo servidor (a anterior caiu com o PIN antigo). */
  onSession: (session: Session) => void;
}

export function EsqueciPinScreen({ token, me, onBack, onAuthError, onSession }: Props) {
  const [step, setStep] = useState<keyof typeof TITLES>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<ResultadoPicar | null>(null);
  const [codeToken, setCodeToken] = useState('');
  const [message, setMessage] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [pin, setPin] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const maskedEmail = me.email_mascarado ?? null;

  function fail(exc: unknown) {
    if (onAuthError(exc)) return;
    if (exc instanceof NetworkError) {
      setSheet({ tone: 'err', title: 'PIN não criado', text: 'Verifique a ligação à internet e tente de novo. O seu PIN continua o mesmo.' });
    } else {
      setError(exc instanceof ApiError ? exc.message : 'Não foi possível continuar. Tente de novo.');
    }
  }

  async function sendCode() {
    setBusy(true);
    setError('');
    try {
      const result = await employeeApi.mePinRequestCode(token);
      setCodeToken(result.token);
      setMessage(`${result.mensagem} O código vale ${result.validade_minutos} minutos.`);
      setEmailCode('');
      setStep('code');
    } catch (exc) {
      fail(exc);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(value: string) {
    setBusy(true);
    setError('');
    try {
      const { pin: created, ...newSession } = await employeeApi.mePinConfirm(token, codeToken, value);
      setPin(created);
      setSession(newSession);
      setStep('shown');
    } catch (exc) {
      setEmailCode('');
      fail(exc);
    } finally {
      setBusy(false);
    }
  }

  function codeKey(key: string) {
    if (busy) return;
    const next = applyKey(emailCode, key, EMAIL_CODE_LENGTH);
    setEmailCode(next);
    setError('');
    if (next.length === EMAIL_CODE_LENGTH && key !== '⌫') setTimeout(() => confirm(next), 250);
  }

  // O PIN já mudou: guardar a sessão nova antes de sair, senão o próximo pedido dava 401.
  function done() {
    if (session) onSession(session);
    onBack();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header variante="faixaLogo" subtitle="" title={TITLES[step]} onVoltar={step === 'shown' ? undefined : step === 'code' ? () => setStep('email') : onBack}
        right={<Avatar name={me.colaborador.nome} count={0} size={36} />} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        {step === 'email' ? (
          <>
            <Muted size={15}>Enviamos um código de 6 números para o email da sua ficha. Com o código, criamos um PIN novo para si.</Muted>
            <Card style={{ padding: 16, gap: 8 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }}>Email</Text>
              <View style={{ minHeight: 52, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: colors.surface }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{maskedEmail ?? 'Sem email na ficha'}</Text>
              </View>
            </Card>
            <Muted size={13}>
              {maskedEmail ? 'Se o email estiver errado, fale com o RH para o corrigir nos seus dados.' : 'A sua ficha não tem email. Peça ao RH para o acrescentar, ou um PIN novo ao seu responsável.'}
            </Muted>
            <ErrorText>{error}</ErrorText>
          </>
        ) : null}
        {step === 'code' ? (
          <>
            <Muted size={15}>{message}</Muted>
            <OtpCells value={emailCode} length={EMAIL_CODE_LENGTH} />
            <ErrorText>{busy ? '' : error}</ErrorText>
            <NumPad onKey={codeKey} />
            <Muted size={13}>Não encontra o email? Veja a pasta de spam.</Muted>
          </>
        ) : null}
        {step === 'shown' ? (
          <>
            <PinShown pin={pin} text="Anote-o agora: por segurança não volta a ser mostrado. Serve para entrar noutro telemóvel e para picar no tablet da empresa." />
            <View style={{ backgroundColor: colors.warnSoft, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 21, color: colors.warnInk }}>O PIN anterior deixou de funcionar no tablet e no computador da empresa.</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
      <BarraRodape>
        {step === 'email' ? (
          <>
            <Button primary tone="verde" title={busy ? 'A enviar…' : 'Enviar código para o meu email'} busy={busy} disabled={!maskedEmail} onPress={sendCode} />
            <Button ghost title="Cancelar" onPress={onBack} />
          </>
        ) : null}
        {step === 'code' ? (
          <>
            <Button primary tone="verde" title="Confirmar" busy={busy} disabled={emailCode.length !== EMAIL_CODE_LENGTH} onPress={() => confirm(emailCode)} />
            <Button link tone="verde" title="Não recebi: pedir outro código" onPress={sendCode} />
          </>
        ) : null}
        {step === 'shown' ? <Button primary tone="verde" title="Já anotei" onPress={done} /> : null}
      </BarraRodape>
      <ResultSheet resultado={sheet} onClose={() => setSheet(null)} />
    </View>
  );
}
