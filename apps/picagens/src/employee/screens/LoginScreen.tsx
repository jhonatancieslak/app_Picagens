// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Entrada do colaborador (protótipo v6, doc 49): boas-vindas → código da empresa (6 células + teclado do ecrã)
// → empresa encontrada + NIF + PIN + "Manter sessão". Alternativa: o link de acesso do email (abre a app sozinho;
// senão cola-se aqui). No canto, "Quiosque" pergunta antes de passar este aparelho a tablet da empresa.
// 2.5.0 (canvas 28): "Esqueci o PIN" → NIF → código de 6 números no email → PIN novo mostrado uma vez → entra.
import * as Application from 'expo-application';
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
import { BarraRodape, Button, Card, ErrorText, FadeIn, Field, Header, Hint, Muted, NumPad, OtpCells, PadField, Title, Toggle, applyKey } from '../ui';

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
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {corner}
        <FadeIn deps={step}>
          <View style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: insets.top + 84, paddingBottom: insets.bottom + 26, gap: 16 }}>
            <View style={{ gap: 18 }}>
              <Logo height={41} />
              <Title size={30}>Picar o ponto, sem papéis.</Title>
              <Muted size={15}>Entre com o código da sua empresa, o seu NIF e o seu PIN. Só precisa de fazer isto uma vez.</Muted>
            </View>
            <View style={{ gap: 10 }}>
              <Button primary tone="verde" icon={<KeyIcon size={20} color={colors.surface} />} title="Entrar com o código da empresa" onPress={startCode} />
              <Button ghost tone="faixa" icon={<MailIcon size={20} color={colors.band} />} title="Recebi um link por email" onPress={() => go('link')} />
              <Hint>Não sabe o código? Peça-o ao encarregado ou veja no cartaz da obra.</Hint>
            </View>
          </View>
        </FadeIn>
      </View>
    );
  }

  // «Esqueci-me do PIN» (artboards p2311-abertura 5–7 e p2311-esqueci-pin, aprovados 25/11): faixa com logótipo,
  // corpo com teclado e barra de botões fixa em baixo. O servidor gera o PIN (nunca é escolhido pela pessoa).
  if ((step === 'forgot' || step === 'forgotCode' || step === 'newPin') && (company || step === 'newPin')) {
    const titles = { forgot: 'Esqueci-me do PIN', forgotCode: 'Veja o seu email', newPin: 'O seu PIN novo' } as const;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header variante="faixaLogo" subtitle="" title={titles[step]} onVoltar={step === 'forgot' ? () => go('credentials') : step === 'forgotCode' ? () => go('forgot') : undefined} />
        <FadeIn deps={step}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
            {step === 'forgot' ? (
              <>
                <Muted size={15}>Também serve para o primeiro acesso. Enviamos um código de 6 números para o email que a empresa tem na sua ficha.</Muted>
                <PadField label="O seu NIF" value={groupNif(nif)} placeholder="9 dígitos" active onPress={() => undefined} />
                <ErrorText>{error}</ErrorText>
                <NumPad onKey={credentialKey} />
                <Hint>Se a empresa não tiver o seu email, peça ao gestor um PIN novo.</Hint>
              </>
            ) : null}
            {step === 'forgotCode' ? (
              <>
                <Muted size={15}>{forgotMessage}</Muted>
                <OtpCells value={emailCode} length={EMAIL_CODE_LENGTH} />
                <ErrorText>{busy ? '' : error}</ErrorText>
                {busy ? <Hint>A confirmar…</Hint> : null}
                <NumPad onKey={emailCodeKey} />
              </>
            ) : null}
            {step === 'newPin' ? (
              <>
                <PinShown pin={newPin} text="Anote-o agora: por segurança não volta a ser mostrado. Serve para entrar noutro telemóvel e para picar no tablet da empresa." />
                <View style={{ backgroundColor: colors.warnSoft, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 21, color: colors.warnInk }}>O PIN anterior deixou de funcionar.</Text>
                </View>
                <ErrorText>{error}</ErrorText>
              </>
            ) : null}
          </ScrollView>
        </FadeIn>
        <BarraRodape>
          {step === 'forgot' ? (
            <Button primary tone="verde" title={busy ? 'A enviar…' : 'Enviar código para o meu email'} busy={busy} disabled={nif.length !== NIF_LENGTH} onPress={requestPinCode} />
          ) : null}
          {step === 'forgotCode' ? (
            <>
              <Button primary tone="verde" title="Confirmar" busy={busy} disabled={emailCode.length !== EMAIL_CODE_LENGTH} onPress={() => confirmPinCode(emailCode)} />
              <Button link tone="verde" title="Não recebi: pedir outro código" onPress={() => go('forgot')} />
            </>
          ) : null}
          {step === 'newPin' ? <Button primary tone="verde" title={resetSession ? 'Já anotei, entrar' : 'Já anotei'} onPress={enterWithNewPin} /> : null}
        </BarraRodape>
      </View>
    );
  }

  // Código, dados, link e quiosque (artboard p2311-abertura 3, 4, 8 e 9): faixa com logótipo e voltar, corpo e barra de
  // botões fixa. O «Quiosque» no canto mantém-se nos passos de colaborador (a versão «sem quiosque» é só proposta).
  const titles = { code: 'Código da empresa', credentials: 'Os seus dados', link: 'Link do email', kiosk: 'Quiosque' } as const;
  const back = {
    code: () => go('welcome'),
    credentials: () => { setCode(''); go('code'); },
    link: () => go('welcome'),
    kiosk: () => go('welcome'),
  } as const;
  const faixaStep = step === 'code' || step === 'credentials' || step === 'link' || step === 'kiosk' ? step : 'code';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header variante="faixaLogo" subtitle="" title={titles[faixaStep]} onVoltar={back[faixaStep]} />
      {corner}
      <FadeIn deps={step}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
          {step === 'code' ? (
            <>
              <Muted size={15}>São 6 números. Cada empresa tem o seu.</Muted>
              <OtpCells value={code} />
              <ErrorText>{busy ? '' : error}</ErrorText>
              {busy ? <Hint>A procurar a empresa…</Hint> : null}
              <NumPad onKey={codeKey} />
            </>
          ) : null}

          {step === 'credentials' && company ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.okSoft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {company.logo_url ? <Image source={{ uri: company.logo_url }} style={{ width: 30, height: 30 }} resizeMode="contain" /> : <OkIcon size={18} color={colors.ok} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ok }}>Empresa encontrada · código {company.codigo.slice(0, 3)} {company.codigo.slice(3)}</Text>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }} numberOfLines={2}>{company.nome}</Text>
                </View>
              </View>
              <PadField label="O seu NIF" value={groupNif(nif)} placeholder="9 dígitos" active={field === 'nif'} onPress={() => setField('nif')} />
              <PadField label="PIN (o mesmo do tablet da obra)" value={'•'.repeat(pin.length)} placeholder="4 dígitos" active={field === 'pin'} error={Boolean(error)} onPress={() => setField('pin')} />
              <ErrorText>{error}</ErrorText>
              <Toggle title="Manter sessão neste telemóvel" subtitle="Abre sempre em Hoje, sem pedir o PIN." value={keep} onChange={setKeep} />
              <NumPad onKey={credentialKey} />
            </>
          ) : null}

          {step === 'link' ? (
            <>
              <Muted size={15}>Abra neste telemóvel o email da sua empresa e toque em «Ativar o meu acesso»: a app abre e entra sozinha. Se abrir o navegador, copie o link e cole-o aqui.</Muted>
              <Field label="Link de acesso" value={pasted} onChangeText={setPasted} placeholder="https://picagens.pt/app/colaborador/…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
              <ErrorText>{error}</ErrorText>
            </>
          ) : null}

          {step === 'kiosk' ? (
            <View style={{ gap: 14, paddingTop: 6 }}>
              <View style={{ width: 56, height: 56, borderRadius: 6, backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center' }}>
                <TabletIcon size={30} color={colors.band} />
              </View>
              <Title size={24}>Usar como quiosque?</Title>
              <Muted size={14}>Para o tablet da empresa, fixo na entrada da obra. Todos os colaboradores picam aqui só com o PIN.</Muted>
              <Card style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 6 }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink }}>Vai precisar de</Text>
                <Need>A <B>chave de ativação</B> que o gestor gera no painel (ou o QR)</Need>
                <Need>Wi-Fi ou dados móveis</Need>
                <Need>A app passa a horizontal e pede a câmara</Need>
              </Card>
            </View>
          ) : null}
        </ScrollView>
      </FadeIn>
      <BarraRodape>
        {step === 'code' ? (
          <>
            <Button primary tone="verde" title="Continuar" busy={busy} disabled={code.length !== COMPANY_CODE_LENGTH} onPress={() => findCompany(code)} />
            <Hint>Não sabe o código? Peça-o ao encarregado ou veja no cartaz da obra.</Hint>
          </>
        ) : null}
        {step === 'credentials' ? (
          <>
            <Button primary tone="verde" title={busy ? 'A entrar…' : 'Entrar'} busy={busy} disabled={nif.length !== NIF_LENGTH || pin.length !== PIN_LENGTH} onPress={enter} />
            <Button link tone="verde" title="Esqueci o PIN" onPress={() => go('forgot')} />
          </>
        ) : null}
        {step === 'link' ? (
          <>
            <Button primary tone="verde" title={busy ? 'A entrar…' : 'Entrar'} busy={busy} disabled={!pasted.trim()} onPress={() => activate(pasted)} />
            <Button link tone="verde" title="Entrar com o código da empresa" onPress={startCode} />
          </>
        ) : null}
        {step === 'kiosk' ? (
          <>
            <Button primary tone="verde" title="Configurar como quiosque" onPress={onKiosk} />
            <Button link tone="verde" title="Sou colaborador" onPress={() => go('welcome')} />
          </>
        ) : null}
      </BarraRodape>
    </KeyboardAvoidingView>
  );
}

const B = ({ children }: { children: ReactNode }) => <Text style={{ fontFamily: fonts.bodyBold, color: colors.ink }}>{children}</Text>;

function Need({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: colors.ink2 }}>• {children}</Text>;
}

/** Abertura de 1,3 s (artboard p2311-abertura n.º 1): fundo escuro, logótipo branco, «A abrir…» e, em baixo, «desenvolvido
 * por» Cieslak Sistemas (discreto) com a versão e o build. */
export function Splash() {
  return (
    <Pressable style={{ flex: 1, backgroundColor: colors.band, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <Logo height={45} white />
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.surface, opacity: 0.7 }}>A abrir…</Text>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center', gap: 10 }}>
        <Image source={require('../../../assets/logo-cieslak.png')} style={{ height: 22, width: 22 * (297 / 86), opacity: 0.5, tintColor: colors.surface }}
          resizeMode="contain" accessibilityLabel="Desenvolvido por Cieslak Sistemas" />
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.surface, opacity: 0.6 }}>
          Versão {Application.nativeApplicationVersion} · build {Application.nativeBuildVersion}
        </Text>
      </View>
    </Pressable>
  );
}
