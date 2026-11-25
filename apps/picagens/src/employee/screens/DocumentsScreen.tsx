// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// "Documentos" (protótipo v6): contratos por assinar em destaque, depois recibos, certificados e avisos da empresa
// com a validade. Abrir descarrega o ficheiro com a sessão e entrega-o ao leitor do Android.
// Contrato: ler o texto, "Li e aceito", código de 6 dígitos por email, nome completo e confirmação.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocumentIcon, MailIcon, PenIcon } from '../../components/icons';
import { ApiError, NetworkError, appVersion } from '../../http';
import { Illustration } from '../../components/Illustration';
import { ListaSkeleton } from '../../components/Skeleton';
import { colors, fonts } from '../../theme';
import { Contract, Documents, Me, employeeApi } from '../api';
import { BackLink, Button, Card, Chip, ErrorText, Field, Header, Muted, NumPad, OtpCells, Row, Title, applyKey } from '../ui';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const CODE_LENGTH = 6;
const EXPIRING_DAYS = 30;

const dateLabel = (text: string | null) => {
  if (!text) return '';
  const [year, month, day] = text.slice(0, 10).split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}${year !== new Date().getFullYear() ? ` ${year}` : ''}`;
};

const errorText = (exc: unknown) => (exc instanceof NetworkError ? 'Sem rede. Tente quando houver ligação.' : exc instanceof ApiError ? exc.message : 'Não foi possível concluir.');

interface Props {
  token: string;
  me: Me;
  openContract?: string | null;
  onContractClosed: () => void;
  onAuthError: (error: unknown) => boolean;
}

export function DocumentsScreen({ token, me, openContract, onContractClosed, onAuthError }: Props) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Documents | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState('');
  const [contract, setContract] = useState<string | null>(openContract ?? null);

  useEffect(() => {
    if (openContract) setContract(openContract);
  }, [openContract]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await employeeApi.documents(token));
    } catch (exc) {
      if (!onAuthError(exc)) setError(errorText(exc));
    } finally {
      setLoading(false);
    }
  }, [token, onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  async function open(id: string, name: string) {
    setOpening(id);
    setError('');
    try {
      const target = new File(Paths.cache, name.replace(/[^\w.\-]+/g, '_') || 'documento.pdf');
      const file = await File.downloadFileAsync(employeeApi.documentUrl(id), target, {
        headers: { Authorization: `Bearer ${token}`, 'X-App-Versao': appVersion },
        idempotent: true,
      });
      await Sharing.shareAsync(file.uri, { dialogTitle: name });
    } catch {
      setError('Não foi possível abrir o documento. Verifique a ligação e tente de novo.');
    } finally {
      setOpening('');
    }
  }

  const container = { paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 110, gap: 12 };

  if (contract) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={container} keyboardShouldPersistTaps="handled">
        <ContractFlow
          token={token}
          me={me}
          id={contract}
          onClose={() => { setContract(null); onContractClosed(); load(); }}
          onAuthError={onAuthError}
        />
      </ScrollView>
    );
  }

  const docs = data?.documentos ?? [];
  const pending = data?.contratos_por_assinar ?? [];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={container} refreshControl={<RefreshControl refreshing={loading && Boolean(data)} onRefresh={load} colors={[colors.action]} />}>
      <Header subtitle="Contratos, recibos e certificados" title="Documentos" />
      {pending.map((item) => (
        <Pressable key={item.id} accessibilityRole="button" onPress={() => setContract(item.id)}
          style={({ pressed }) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 9, paddingLeft: 12, paddingRight: 10, borderRadius: 16, minHeight: 54, backgroundColor: colors.infoSoft, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <PenIcon size={18} color={colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.info }}>{item.titulo}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.info, opacity: 0.88 }}>Assine com um código enviado por email</Text>
          </View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.info }}>Assinar ›</Text>
        </Pressable>
      ))}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {loading && !data ? <ListaSkeleton /> : null}
      {data && !docs.length && !pending.length ? (
        <View style={{ alignItems: 'center', gap: 8, paddingTop: 16 }}>
          <Illustration name="documents" width={190} />
          <Muted center>Ainda não há documentos para si.</Muted>
        </View>
      ) : null}
      {docs.length ? (
        <Card>
          {docs.map((doc, index) => {
            const days = doc.validade?.dias;
            const expiring = doc.valido_ate && typeof days === 'number' && days <= EXPIRING_DAYS;
            return (
              <Row
                key={doc.id}
                first={index === 0}
                onPress={() => open(doc.id, doc.ficheiro || `${doc.titulo}.pdf`)}
                left={(
                  <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center' }}>
                    {opening === doc.id ? <ActivityIndicator size="small" color={colors.action} /> : <DocumentIcon size={18} color={colors.action} />}
                  </View>
                )}
                title={doc.titulo}
                subtitle={doc.valido_ate ? `${doc.tipo_nome} · válido até ${dateLabel(doc.valido_ate)}` : `${doc.tipo_nome}${doc.criado_em ? ` · ${dateLabel(doc.criado_em)}` : ''}`}
                right={expiring ? <Chip tone={days! < 0 ? 'danger' : 'warn'} label={days! < 0 ? 'Expirado' : `${days} dias`} /> : undefined}
              />
            );
          })}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function ContractFlow({ token, me, id, onClose, onAuthError }: { token: string; me: Me; id: string; onClose: () => void; onAuthError: (error: unknown) => boolean }) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [step, setStep] = useState<'read' | 'sign' | 'done'>('read');
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState(me.colaborador.nome);
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [signedAt, setSignedAt] = useState('');

  useEffect(() => {
    employeeApi.contract(token, id).then(setContract).catch((exc) => { if (!onAuthError(exc)) setError(errorText(exc)); });
  }, [token, id, onAuthError]);

  async function requestCode() {
    setBusy(true);
    setError('');
    try {
      const result = await employeeApi.contractCode(token, id);
      setSentTo(result.mensagem);
      setCode('');
      setStep('sign');
    } catch (exc) {
      if (!onAuthError(exc)) setError(errorText(exc));
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    setBusy(true);
    setError('');
    try {
      await employeeApi.signContract(token, id, name.trim(), code);
      const now = new Date();
      setSignedAt(`${now.getDate()} ${MONTHS[now.getMonth()]}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setContract(await employeeApi.contract(token, id).catch(() => contract));
      setStep('done');
    } catch (exc) {
      if (!onAuthError(exc)) setError(errorText(exc));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (!contract) {
    return (
      <>
        <BackLink label="Documentos" onPress={onClose} />
        {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.action} />}
      </>
    );
  }

  if (step === 'done') {
    return (
      <>
        <View style={{ alignItems: 'center', gap: 6, paddingTop: 8 }}>
          <Illustration name="signed" width={200} />
          <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink }}>Contrato assinado</Text>
          <Muted size={14} center>A cópia final com as duas assinaturas está em Documentos e foi enviada para o seu email.</Muted>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Summary label="Assinado em" value={signedAt} />
          <Summary label="Código de verificação" value={contract.codigo_verificacao ?? '—'} />
        </View>
        <Button ghost title="Ver em Documentos" onPress={onClose} />
      </>
    );
  }

  if (step === 'sign') {
    return (
      <>
        <BackLink label="Voltar ao texto" onPress={() => setStep('read')} />
        <Title size={24}>Assinar</Title>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.okSoft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
          <MailIcon size={20} color={colors.ok} />
          <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ok }}>{sentTo}</Text>
        </View>
        <Field label="Nome completo" value={name} onChangeText={setName} autoCapitalize="words" />
        <OtpCells value={code} length={CODE_LENGTH} />
        <ErrorText>{error}</ErrorText>
        <NumPad onKey={(key) => { setError(''); setCode(applyKey(code, key, CODE_LENGTH)); }} />
        <Button primary title={busy ? 'A assinar…' : 'Assinar contrato'} busy={busy} disabled={code.length !== CODE_LENGTH || name.trim().length < 3} onPress={sign} />
        <Button link title="Não recebi o código" onPress={requestCode} />
        <Muted size={12} center>Registamos a data, a hora e o dispositivo da assinatura.</Muted>
      </>
    );
  }

  return (
    <>
      <BackLink label="Documentos" onPress={onClose} />
      <View>
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink2 }}>Enviado por {me.empresa.nome}</Text>
        <Title size={24}>{contract.titulo}</Title>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Summary label="Assinatura da empresa" value={contract.empresa_assinante ? `✓ ${contract.empresa_assinante}` : 'Por assinar'} ok={Boolean(contract.empresa_assinante)} />
        <Summary label="Assinada pela empresa em" value={contract.empresa_assinou_em ? dateLabel(contract.empresa_assinou_em) : '—'} />
      </View>
      <Card style={{ padding: 14 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: colors.ink, lineHeight: 21 }}>{contract.corpo}</Text>
      </Card>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted(!accepted)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: accepted ? colors.action : colors.line, backgroundColor: accepted ? colors.action : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {accepted ? <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: 13 }}>✓</Text> : null}
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.ink }}>Li o documento até ao fim e aceito o seu conteúdo.</Text>
      </Pressable>
      <ErrorText>{error}</ErrorText>
      <Button primary title={busy ? 'A enviar o código…' : 'Continuar para assinar'} busy={busy} disabled={!accepted} onPress={requestCode} />
      <Muted size={12.5} center>Dúvidas sobre o contrato? Fale com o RH da {me.empresa.nome} antes de assinar.</Muted>
    </>
  );
}

function Summary({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.ink3, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: ok ? colors.ok : colors.ink }}>{value}</Text>
    </View>
  );
}
