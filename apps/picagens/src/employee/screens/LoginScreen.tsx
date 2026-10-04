// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Entrada do colaborador (doc 49): código da empresa (6 algarismos) → confirmar a empresa → NIF + PIN.
// Alternativa: o link de acesso do email (abre a app sozinho; senão cola-se aqui). No canto, "Quiosque"
// passa este aparelho a tablet da empresa.
import { ReactNode, useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, KeyIcon, MailIcon, TabletIcon } from '../../components/icons';
import { CornerButton, Logo } from '../../components/ui';
import { ACTIVATION_LINK_PATTERN } from '../../config';
import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { Company, Session, employeeApi } from '../api';
import { getLastCompanyCode, saveLastCompanyCode } from '../storage';
import { Button, Card, ErrorText, Field, Muted, Title } from '../ui';

const COMPANY_CODE_LENGTH = 6;
const NIF_LENGTH = 9;
const PIN_LENGTH = 4;

export const parseActivationLink = (text: string) => {
  const match = text.match(ACTIVATION_LINK_PATTERN);
  return match ? { company: match[1].toLowerCase(), token: decodeURIComponent(match[2]) } : null;
};

const digits = (text: string, max: number) => text.replace(/\D/g, '').slice(0, max);

function errorMessage(error: unknown) {
  if (error instanceof NetworkError) return 'Sem ligação à internet. Tente de novo.';
  if (error instanceof ApiError) return error.message;
  return 'Não foi possível entrar. Tente de novo.';
}

interface Props {
  link: string | null;
  onSession: (session: Session) => void;
  onKiosk: () => void;
}

type Step = 'code' | 'credentials' | 'link';

export function LoginScreen({ link, onSession, onKiosk }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [company, setCompany] = useState<Company | null>(null);
  const [nif, setNif] = useState('');
  const [pin, setPin] = useState('');
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pinHelp, setPinHelp] = useState(false);

  useEffect(() => {
    getLastCompanyCode().then((saved) => saved && setCode(saved));
  }, []);

  async function run<T>(action: () => Promise<T>, then: (result: T) => void) {
    setBusy(true);
    setError('');
    try {
      then(await action());
    } catch (exc) {
      setError(errorMessage(exc));
    } finally {
      setBusy(false);
    }
  }

  const findCompany = (value = code) => run(() => employeeApi.company(value), (found) => {
    setCompany(found);
    setStep('credentials');
  });

  const enter = () => run(() => employeeApi.login(company!.codigo, nif, pin), async (session) => {
    await saveLastCompanyCode(company!.codigo);
    onSession(session);
  });

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
    setPinHelp(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CornerButton label="Quiosque" icon={<TabletIcon size={16} color={colors.ink2} />} onPress={onKiosk} top={insets.top + 10} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 22, paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24, gap: 18 }} keyboardShouldPersistTaps="handled">
        <Logo height={38} />

        {step === 'code' ? (
          <>
            <View style={{ gap: 8 }}>
              <Title>Picar o ponto, sem papéis.</Title>
              <Muted size={15}>Escreva o código da sua empresa. Peça-o ao encarregado ou veja no cartaz da obra.</Muted>
            </View>
            <Field
              label="Código da empresa"
              value={code}
              onChangeText={(text) => { setCode(digits(text, COMPANY_CODE_LENGTH)); setError(''); }}
              placeholder="6 números"
              keyboardType="number-pad"
              maxLength={COMPANY_CODE_LENGTH}
              autoFocus={!code}
              onSubmitEditing={() => code.length === COMPANY_CODE_LENGTH && findCompany()}
            />
            <ErrorText>{error}</ErrorText>
            <Button primary title={busy ? 'A procurar…' : 'Continuar'} busy={busy} disabled={code.length !== COMPANY_CODE_LENGTH} onPress={() => findCompany()} />
            <View style={{ flex: 1 }} />
            <AltLink icon={<MailIcon size={18} color={colors.action} />} title="Recebi um link por email" onPress={() => go('link')} />
          </>
        ) : null}

        {step === 'credentials' && company ? (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="Mudar de empresa" onPress={() => go('code')}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.okSoft, borderColor: colors.okSoft }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {company.logo_url ? <Image source={{ uri: company.logo_url }} style={{ width: 34, height: 34 }} resizeMode="contain" /> : <CheckIcon size={18} color={colors.ok} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ok }}>Empresa · código {company.codigo.slice(0, 3)} {company.codigo.slice(3)}</Text>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }} numberOfLines={2}>{company.nome}</Text>
                </View>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.action }}>Mudar</Text>
              </Card>
            </Pressable>
            <Title>Os seus dados</Title>
            <Field label="O seu NIF" value={nif} onChangeText={(text) => { setNif(digits(text, NIF_LENGTH)); setError(''); }} keyboardType="number-pad" maxLength={NIF_LENGTH} placeholder="9 números" autoFocus />
            <Field
              label="PIN"
              hint="O mesmo PIN do tablet da obra."
              value={pin}
              onChangeText={(text) => { setPin(digits(text, PIN_LENGTH)); setError(''); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={PIN_LENGTH}
              placeholder="4 números"
              onSubmitEditing={() => nif.length === NIF_LENGTH && pin.length === PIN_LENGTH && enter()}
            />
            <ErrorText>{error}</ErrorText>
            <Button primary title={busy ? 'A entrar…' : 'Entrar'} busy={busy} disabled={nif.length !== NIF_LENGTH || pin.length !== PIN_LENGTH} onPress={enter} />
            <Muted size={13}>A sessão fica guardada neste telemóvel: da próxima vez a app abre logo no dia de hoje.</Muted>
            <AltLink icon={<KeyIcon size={18} color={colors.action} />} title="Esqueci o PIN" onPress={() => setPinHelp((open) => !open)} />
            {pinHelp ? (
              <Card style={{ backgroundColor: colors.infoSoft, borderColor: colors.infoSoft }}>
                <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.info, lineHeight: 20 }}>O PIN é dado pela sua empresa. Peça ao gestor um PIN novo: ele troca-o no painel em segundos.</Text>
              </Card>
            ) : null}
          </>
        ) : null}

        {step === 'link' ? (
          <>
            <View style={{ gap: 8 }}>
              <Title>Link do email</Title>
              <Muted size={15}>Abra neste telemóvel o email da sua empresa e toque em "Ativar o meu acesso": a app abre e entra sozinha. Se abrir o navegador, copie o link e cole-o aqui.</Muted>
            </View>
            <Field label="Link de acesso" value={pasted} onChangeText={setPasted} placeholder="https://picagens.pt/app/colaborador/…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            <ErrorText>{error}</ErrorText>
            <Button primary title={busy ? 'A entrar…' : 'Entrar'} busy={busy} disabled={!pasted.trim()} onPress={() => activate(pasted)} />
            <AltLink icon={<KeyIcon size={18} color={colors.action} />} title="Entrar com o código da empresa" onPress={() => go('code')} />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AltLink({ icon, title, onPress }: { icon: ReactNode; title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}>
      {icon}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.action }}>{title}</Text>
    </Pressable>
  );
}
