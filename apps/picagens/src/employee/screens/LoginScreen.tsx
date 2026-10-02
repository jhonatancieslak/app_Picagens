// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Entrada do colaborador. Caminho principal: o link de acesso que a empresa envia por email (abre a app
// sozinho quando a app está instalada; senão cola-se aqui). Recurso: código da empresa + NIF + PIN.
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '../../components/ui';
import { ACTIVATION_LINK_PATTERN } from '../../config';
import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { Session, employeeApi } from '../api';
import { Button, Card, ErrorText, Field, Muted, Title } from '../ui';

const COMPANY_IN_URL = /\/colaborador\/([a-z0-9_-]+)/i;

export const parseActivationLink = (text: string) => {
  const match = text.match(ACTIVATION_LINK_PATTERN);
  return match ? { company: match[1].toLowerCase(), token: decodeURIComponent(match[2]) } : null;
};

const companyCode = (text: string) => (text.match(COMPANY_IN_URL)?.[1] ?? text).trim().toLowerCase();

function errorMessage(error: unknown) {
  if (error instanceof NetworkError) return 'Sem ligação à internet. Tente de novo.';
  if (error instanceof ApiError) return error.message;
  return 'Não foi possível entrar. Tente de novo.';
}

interface Props {
  link: string | null;
  onSession: (session: Session) => void;
  onBack: () => void;
}

export function LoginScreen({ link, onSession, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<'link' | 'pin'>('link');
  const [pasted, setPasted] = useState('');
  const [company, setCompany] = useState('');
  const [nif, setNif] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<Session>) {
    setBusy(true);
    setError('');
    try {
      onSession(await action());
    } catch (exc) {
      setError(errorMessage(exc));
    } finally {
      setBusy(false);
    }
  }

  function activate(text: string) {
    const parsed = parseActivationLink(text);
    if (!parsed) {
      setError('Isto não parece o link de acesso. Copie o link completo do email da sua empresa.');
      return;
    }
    run(() => employeeApi.activate(parsed.company, parsed.token));
  }

  // Link aberto a partir do email (deep link): ativa logo.
  useEffect(() => {
    if (link) activate(link);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24, gap: 18 }} keyboardShouldPersistTaps="handled">
        <Logo height={36} />
        <View style={{ gap: 6 }}>
          <Title>Entrar</Title>
          <Muted size={15}>Use o acesso que a sua empresa lhe enviou. Fica com sessão iniciada neste telemóvel.</Muted>
        </View>

        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 4 }}>
          {(['link', 'pin'] as const).map((option) => (
            <Text
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: method === option }}
              onPress={() => { setMethod(option); setError(''); }}
              style={{
                flex: 1, textAlign: 'center', paddingVertical: 10, borderRadius: 12, overflow: 'hidden',
                fontFamily: fonts.bodyBold, fontSize: 14,
                color: method === option ? '#fff' : colors.ink2,
                backgroundColor: method === option ? colors.action : 'transparent',
              }}
            >
              {option === 'link' ? 'Link do email' : 'NIF e PIN'}
            </Text>
          ))}
        </View>

        {method === 'link' ? (
          <Card style={{ gap: 14 }}>
            <Muted>Abra neste telemóvel o email de acesso da sua empresa e toque em "Ativar o meu acesso": a app abre e entra sozinha. Se abrir o navegador, copie o link e cole-o aqui.</Muted>
            <Field label="Link de acesso" value={pasted} onChangeText={setPasted} placeholder="https://picagens.pt/app/colaborador/…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            <ErrorText>{error}</ErrorText>
            <Button primary title={busy ? 'A entrar…' : 'Entrar'} busy={busy} disabled={!pasted.trim()} onPress={() => activate(pasted)} />
          </Card>
        ) : (
          <Card style={{ gap: 14 }}>
            <Field label="Código da empresa" value={company} onChangeText={setCompany} placeholder="ex.: construcoes-silva" autoCapitalize="none" autoCorrect={false} hint="Peça ao seu responsável. É a parte do link depois de /colaborador/." />
            <Field label="NIF" value={nif} onChangeText={setNif} keyboardType="number-pad" maxLength={11} />
            <Field label="PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={8} />
            <ErrorText>{error}</ErrorText>
            <Button
              primary
              title={busy ? 'A entrar…' : 'Entrar'}
              busy={busy}
              disabled={!company.trim() || !nif.trim() || !pin.trim()}
              onPress={() => run(() => employeeApi.login(companyCode(company), nif, pin))}
            />
          </Card>
        )}

        <Text accessibilityRole="button" onPress={onBack} style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.action, textAlign: 'center', paddingVertical: 8 }}>
          ‹ Este dispositivo é um tablet da empresa
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
