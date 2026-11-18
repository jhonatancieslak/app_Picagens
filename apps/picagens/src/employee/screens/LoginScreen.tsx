// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Entrada do colaborador (protótipo v6, doc 49): boas-vindas → código da empresa (6 células + teclado do ecrã)
// → empresa encontrada + NIF + PIN + "Manter sessão". Alternativa: o link de acesso do email (abre a app sozinho;
// senão cola-se aqui). No canto, "Quiosque" pergunta antes de passar este aparelho a tablet da empresa.
// 2.5.0 (canvas 28): "Esqueci o PIN" → NIF → código de 6 números no email → PIN novo mostrado uma vez → entra.
import { ReactNode, useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyIcon, MailIcon, OkIcon, TabletIcon } from '../../components/icons';
import { CornerButton, Logo } from '../../components/ui';
import { ACTIVATION_LINK_PATTERN } from '../../config';
import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { Company, Session, employeeApi } from '../api';
import { PinShown } from './PinScreen';
import { getKeepSession, getLastCompanyCode, saveKeepSession, saveLastCompanyCode } from '../storage';
import { BackLink, Button, Card, ErrorText, FadeIn, Field, Hint, Muted, NumPad, OtpCells, PadField, Title, Toggle, applyKey } from '../ui';

const COMPANY_CODE_LENGTH = 6;
const NIF_LENGTH = 9;
const PIN_LENGTH = 4;
const EMAIL_CODE_LENGTH = 6;

export const parseActivationLink = (text: string) => {
  const match = text.match(ACTIVATION_LINK_PATTERN);
  return match ? { company: match[1].toLowerCase(), token: decodeURIComponent(match[2]) } : null;
};

function errorMessage(error: unknown) {
  if (error instanceof NetworkError) return 'Sem ligação à internet. Tente de novo.';
  if (error instanceof ApiError) return error.message;
  return 'Não foi possível entrar. Tente de novo.';
}

const groupNif = (nif: string) => nif.replace(/(\d{3})(?=\d)/g, '$1 ');

interface Props {
  link: string | null;
  onSession: (session: Session) => void;
  onKiosk: () => void;
}

type Step = 'welcome' | 'code' | 'credentials' | 'link' | 'kiosk' | 'forgot' | 'forgotCode' | 'newPin';

export function LoginScreen({ link, onSession, onKiosk }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('welcome');
  const [code, setCode] = useState('');
  const [company, setCompany] = useState<Company | null>(null);
  const [nif, setNif] = useState('');
  const [pin, setPin] = useState('');
  const [field, setField] = useState<'nif' | 'pin'>('nif');
  const [keep, setKeep] = useState(true);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [resetSession, setResetSession] = useState<Session | null>(null);

  useEffect(() => {
    getKeepSession().then(setKeep);
  }, []);

  async function run<T>(action: () => Promise<T>, then: (result: T) => void | Promise<void>, onFail?: () => void) {
    setBusy(true);
    setError('');
    try {
      await then(await action());
    } catch (exc) {
      setError(errorMessage(exc));
      onFail?.();
    } finally {
      setBusy(false);
    }
  }

  const findCompany = (value: string) => run(() => employeeApi.company(value), (found) => {
    setCompany(found);
    setNif('');
    setPin('');
    setField('nif');
    setStep('credentials');
  }, () => setCode(''));

  const enter = () => run(() => employeeApi.login(company!.codigo, nif, pin), async (session) => {
    await saveKeepSession(keep);
    await saveLastCompanyCode(company!.codigo);
    onSession(session);
  }, () => { setPin(''); setField('pin'); });

  const requestPinCode = () => run(() => employeeApi.pinRequestCode(company!.codigo, nif), (result) => {
    setForgotToken(result.token);
    setForgotMessage(`${result.mensagem} O código vale ${result.validade_minutos} minutos.`);
    setEmailCode('');
    go('forgotCode');
  });

  // Não usa run(): com o limite de acessos do plano o servidor responde 403 mas já criou o PIN (vem em data.pin).
  async function confirmPinCode(value: string) {
    setBusy(true);
    setError('');
    try {
      const { pin: created, ...session } = await employeeApi.pinConfirm(company!.codigo, forgotToken, value);
      setNewPin(created);
      setResetSession(session);
      go('newPin');
    } catch (exc) {
      const created = exc instanceof ApiError && typeof exc.data.pin === 'string' ? exc.data.pin : '';
      if (created) {
        setNewPin(created);
        setResetSession(null);
        setStep('newPin');
        setError(errorMessage(exc));
      } else {
        setError(errorMessage(exc));
        setEmailCode('');
      }
    } finally {
      setBusy(false);
    }
  }

  async function enterWithNewPin() {
    if (!resetSession) {
      setPin('');
      setField('pin');
      go('credentials');
      return;
    }
    await saveKeepSession(keep);
    await saveLastCompanyCode(company!.codigo);
    onSession(resetSession);
  }

  function emailCodeKey(key: string) {
    if (busy) return;
    const next = applyKey(emailCode, key, EMAIL_CODE_LENGTH);
    setEmailCode(next);
    setError('');
    if (next.length === EMAIL_CODE_LENGTH && key !== '⌫') setTimeout(() => confirmPinCode(next), 250);
  }

  function activate(text: string) {
    const parsed = parseActivationLink(text);
    if (!parsed) {
      setError('Isto não parece o link de acesso. Copie o link completo do email da sua empresa.');
      return;
    }
    run(() => employeeApi.activate(parsed.company, parsed.token), onSession);
  }

  // Link aberto a partir do email (deep link): entra logo.
  useEffect(() => {
    if (link) {
      setStep('link');
      activate(link);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link]);

  const go = (next: Step) => {
    setStep(next);
    setError('');
  };

  async function startCode() {
    const saved = await getLastCompanyCode();
    setCode('');
    go('code');
    if (saved) setCode(saved);
  }

  function codeKey(key: string) {
    if (busy) return;
    const next = applyKey(code, key, COMPANY_CODE_LENGTH);
    setCode(next);
    setError('');
    if (next.length === COMPANY_CODE_LENGTH && key !== '⌫') setTimeout(() => findCompany(next), 250);
  }

  function credentialKey(key: string) {
    setError('');
    if (step === 'forgot') {
      setNif(applyKey(nif, key, NIF_LENGTH));
      return;
    }
    if (field === 'nif') {
      const next = applyKey(nif, key, NIF_LENGTH);
      setNif(next);
      if (next.length === NIF_LENGTH && key !== '⌫') setField('pin');
    } else {
      setPin(applyKey(pin, key, PIN_LENGTH));
    }
  }

  const corner = step !== 'kiosk' && step !== 'newPin' ? (
    <CornerButton label="Quiosque" icon={<TabletIcon size={16} color={colors.ink2} />} onPress={() => go('kiosk')} top={insets.top + 10} />
  ) : null;

  if (step === 'welcome') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {corner}
        <FadeIn deps={step}>
          <View style={{ flex: 1, justifyContent: 'space-between', padding: 22, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 26, gap: 16 }}>
            <View style={{ gap: 18, marginTop: 18 }}>
              <Logo height={41} />
              <Title size={30}>Picar o ponto, sem papéis.</Title>
              <Muted size={15}>Entre com o código da sua empresa, o seu NIF e o seu PIN. Só precisa de fazer isto uma vez.</Muted>
            </View>
            <View style={{ gap: 10 }}>
              <Button primary icon={<KeyIcon size={20} color="#fff" />} title="Entrar com o código da empresa" onPress={startCode} />
              <Button ghost icon={<MailIcon size={20} color={colors.action} />} title="Recebi um link por email" onPress={() => go('link')} />
              <Hint>Não sabe o código? Peça-o ao encarregado ou veja no cartaz da obra.</Hint>
            </View>
          </View>
        </FadeIn>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {corner}
      <FadeIn deps={step}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          {step === 'code' ? (
            <>
              <BackLink label="Voltar" onPress={() => go('welcome')} />
              <View>
                <Title>Código da empresa</Title>
                <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.ink2, marginTop: 4 }}>São 6 números. Cada empresa tem o seu.</Text>
              </View>
              <OtpCells value={code} />
              <ErrorText>{busy ? '' : error}</ErrorText>
              {busy ? <Hint>A procurar a empresa…</Hint> : null}
              <NumPad onKey={codeKey} />
              <Hint>Não sabe o código? Peça-o ao encarregado ou veja no cartaz da obra.</Hint>
            </>
          ) : null}

          {step === 'credentials' && company ? (
            <>
              <BackLink label="Mudar de empresa" onPress={() => { setCode(''); go('code'); }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.okSoft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {company.logo_url ? <Image source={{ uri: company.logo_url }} style={{ width: 30, height: 30 }} resizeMode="contain" /> : <OkIcon size={18} color={colors.ok} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ok }}>Empresa encontrada · código {company.codigo.slice(0, 3)} {company.codigo.slice(3)}</Text>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }} numberOfLines={2}>{company.nome}</Text>
                </View>
              </View>
              <Title size={24}>Os seus dados</Title>
              <PadField label="O seu NIF" value={groupNif(nif)} placeholder="9 dígitos" active={field === 'nif'} onPress={() => setField('nif')} />
              <PadField label="PIN (o mesmo do tablet da obra)" value={'•'.repeat(pin.length)} placeholder="4 dígitos" active={field === 'pin'} error={Boolean(error)} onPress={() => setField('pin')} />
              <ErrorText>{error}</ErrorText>
              <Toggle title="Manter sessão neste telemóvel" subtitle="Abre sempre em Hoje, sem pedir o PIN. Se entrar noutro telemóvel, este sai." value={keep} onChange={setKeep} />
              <NumPad onKey={credentialKey} />
              <Button primary title={busy ? 'A entrar…' : 'Entrar'} busy={busy} disabled={nif.length !== NIF_LENGTH || pin.length !== PIN_LENGTH} onPress={enter} />
              <Button link title="Esqueci o PIN" onPress={() => go('forgot')} />
            </>
          ) : null}

          {step === 'forgot' && company ? (
            <>
              <BackLink label="Voltar" onPress={() => go('credentials')} />
              <Title>Esqueci-me do PIN</Title>
              <Muted size={15}>Também serve para o primeiro acesso. Enviamos um código de 6 números para o email que a empresa tem na sua ficha.</Muted>
              <PadField label="O seu NIF" value={groupNif(nif)} placeholder="9 dígitos" active onPress={() => undefined} />
              <ErrorText>{error}</ErrorText>
              <NumPad onKey={credentialKey} />
              <Button primary title={busy ? 'A enviar…' : 'Enviar código para o meu email'} busy={busy} disabled={nif.length !== NIF_LENGTH} onPress={requestPinCode} />
              <Hint>Se a empresa não tiver o seu email, peça ao gestor um PIN novo.</Hint>
            </>
          ) : null}

          {step === 'forgotCode' && company ? (
            <>
              <BackLink label="Voltar" onPress={() => go('forgot')} />
              <Title>Veja o seu email</Title>
              <Muted size={15}>{forgotMessage}</Muted>
              <OtpCells value={emailCode} length={EMAIL_CODE_LENGTH} />
              <ErrorText>{busy ? '' : error}</ErrorText>
              {busy ? <Hint>A confirmar…</Hint> : null}
              <NumPad onKey={emailCodeKey} />
              <Button primary title="Confirmar" busy={busy} disabled={emailCode.length !== EMAIL_CODE_LENGTH} onPress={() => confirmPinCode(emailCode)} />
              <Button link title="Não recebi: pedir outro código" onPress={() => go('forgot')} />
            </>
          ) : null}

          {step === 'newPin' ? (
            <>
              <View style={{ height: 30 }} />
              <Title>O seu PIN novo</Title>
              <PinShown pin={newPin} text="Anote-o agora: por segurança não volta a ser mostrado. Serve para entrar noutro telemóvel e para picar no tablet da empresa." />
              <View style={{ backgroundColor: colors.warnSoft, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
                <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.warnInk }}>O PIN anterior deixou de funcionar.</Text>
              </View>
              <ErrorText>{error}</ErrorText>
              <Button primary title={resetSession ? 'Já anotei, entrar' : 'Já anotei'} onPress={enterWithNewPin} />
            </>
          ) : null}

          {step === 'link' ? (
            <>
              <BackLink label="Voltar" onPress={() => go('welcome')} />
              <Title>Link do email</Title>
              <Muted size={14}>Abra neste telemóvel o email da sua empresa e toque em "Ativar o meu acesso": a app abre e entra sozinha. Se abrir o navegador, copie o link e cole-o aqui.</Muted>
              <Field label="Link de acesso" value={pasted} onChangeText={setPasted} placeholder="https://picagens.pt/app/colaborador/…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
              <ErrorText>{error}</ErrorText>
              <Button primary title={busy ? 'A entrar…' : 'Entrar'} busy={busy} disabled={!pasted.trim()} onPress={() => activate(pasted)} />
              <Button link icon={<KeyIcon size={18} color={colors.action} />} title="Entrar com o código da empresa" onPress={startCode} />
            </>
          ) : null}

          {step === 'kiosk' ? (
            <>
              <BackLink label="Voltar" onPress={() => go('welcome')} />
              <View style={{ gap: 12, paddingTop: 30 }}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <TabletIcon size={30} color={colors.action} />
                </View>
                <Title size={24}>Usar como quiosque?</Title>
                <Muted>Para o tablet da empresa, fixo na entrada da obra. Todos os colaboradores picam aqui só com o PIN.</Muted>
                <Card style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 6 }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink }}>Vai precisar de</Text>
                  <Need>A <B>chave de ativação</B> que o gestor gera no painel (ou o QR)</Need>
                  <Need>Wi-Fi ou dados móveis</Need>
                  <Need>A app passa a horizontal e pede a câmara</Need>
                </Card>
                <Button primary icon={<TabletIcon size={20} color="#fff" />} title="Configurar como quiosque" onPress={onKiosk} />
                <Button link title="Sou colaborador" onPress={() => go('welcome')} />
              </View>
            </>
          ) : null}
        </ScrollView>
      </FadeIn>
    </KeyboardAvoidingView>
  );
}

const B = ({ children }: { children: ReactNode }) => <Text style={{ fontFamily: fonts.bodyBold, color: colors.ink }}>{children}</Text>;

function Need({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: colors.ink2 }}>• {children}</Text>;
}

/** Ecrã de abertura com o logótipo (".splash"), 1,3 s. 2.5.1: «desenvolvido por» Cieslak Sistemas, discreto (30 %),
 * só aqui (canvas A1 n.º 1, aprovado 22/10). */
export function Splash() {
  return (
    <Pressable style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <Logo height={45} />
      <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3 }}>A abrir…</Text>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: colors.ink3, opacity: 0.8 }}>desenvolvido por</Text>
        <Image source={require('../../../assets/logo-cieslak.png')} style={{ height: 22, width: 22 * (297 / 86), opacity: 0.3 }}
          resizeMode="contain" accessibilityLabel="Cieslak Sistemas" />
      </View>
    </Pressable>
  );
}
