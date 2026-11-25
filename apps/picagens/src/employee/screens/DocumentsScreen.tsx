// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// «Documentos» (artboard p2311-documentos, aprovado 24/11): resumo «Para assinar», «Por assinar» e «Para ver»; ler o documento
// dentro da app (o servidor desenha as páginas do PDF), assinar com o dedo, confirmar com o código do email, folha «assinado»
// e ver o documento guardado. Serve recibos e contratos anexados (assinaturas de documentos) e os contratos de trabalho.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import ResultSheet, { ResultadoPicar } from '../../components/ResultSheet';
import { SignaturePad } from '../../components/SignaturePad';
import { Bloco, ListaSkeleton } from '../../components/Skeleton';
import { ApiError, NetworkError, appVersion } from '../../http';
import { colors, fonts } from '../../theme';
import { Contract, Documents, Me, employeeApi } from '../api';
import { BarraRodape, Button, ErrorText, Field, Header, Muted, applyKey } from '../ui';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const CODE_LENGTH = 6;
const IMAGE_FILE = /\.(jpe?g|png|webp)$/i;

const dateLabel = (text: string | null) => {
  if (!text) return '';
  const [year, month, day] = text.slice(0, 10).split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}${year !== new Date().getFullYear() ? ` ${year}` : ''}`;
};
const shortDate = (text: string | null) => (text ? `${text.slice(8, 10)}/${text.slice(5, 7)}` : '');
const errorText = (exc: unknown) => (exc instanceof NetworkError ? 'Sem rede. Tente quando houver ligação.' : exc instanceof ApiError ? exc.message : 'Não foi possível concluir.');

type Target = { kind: 'recibo' | 'contrato'; id: string; title: string };
type View_ = { name: 'list' } | { name: 'sign'; target: Target } | { name: 'view'; id: string; title: string; file: string };

interface Props {
  token: string;
  me: Me;
  /** Nome e avatar à direita da faixa (como nos outros ecrãs). */
  avatar: ReactNode;
  openContract?: string | null;
  onContractClosed: () => void;
  onAuthError: (error: unknown) => boolean;
}

export function DocumentsScreen({ token, me, avatar, openContract, onContractClosed, onAuthError }: Props) {
  const [data, setData] = useState<Documents | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View_>({ name: 'list' });
  const [result, setResult] = useState<ResultadoPicar | null>(null);

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

  // Notificação «Assinar» de um contrato abre-o diretamente.
  useEffect(() => {
    if (openContract) setView({ name: 'sign', target: { kind: 'contrato', id: openContract, title: 'Contrato de trabalho' } });
  }, [openContract]);

  if (view.name === 'sign') {
    return (
      <>
        <SignFlow token={token} me={me} avatar={avatar} target={view.target} onAuthError={onAuthError}
          onBack={() => { setView({ name: 'list' }); onContractClosed(); }}
          onSigned={(text) => { setView({ name: 'list' }); onContractClosed(); setResult({ tone: 'ok', title: `${view.target.kind === 'recibo' ? 'Recibo' : 'Contrato'} assinado`, text, botao: 'Ver em Documentos' }); load(); }} />
        <ResultSheet resultado={result} onClose={() => setResult(null)} />
      </>
    );
  }
  if (view.name === 'view') {
    return <Viewer token={token} avatar={avatar} id={view.id} title={view.title} file={view.file} onBack={() => setView({ name: 'list' })} />;
  }

  const pending = [
    ...(data?.por_assinar ?? []).map((item) => ({ ...item, kind: 'recibo' as const })),
    ...(data?.contratos_por_assinar ?? []).map((item) => ({ ...item, tipo: 'contrato', kind: 'contrato' as const })),
  ];
  const docs = data?.documentos ?? [];

  return (
    <View style={{ flex: 1 }}>
      <Header variante="faixaLogo" title="Documentos" subtitle="" right={avatar} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 110, gap: 14 }}
        refreshControl={<RefreshControl refreshing={loading && Boolean(data)} onRefresh={load} colors={[colors.band]} />}>
        {pending.length ? (
          <View style={{ backgroundColor: colors.band, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, gap: 4, elevation: 4 }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.surface, opacity: 0.85 }}>Para assinar</Text>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 32, lineHeight: 36, color: colors.surface }}>{pending.length} {pending.length === 1 ? 'documento' : 'documentos'}</Text>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.surface, opacity: 0.9 }}>Leia o documento e assine no ecrã ou com o código do email</Text>
          </View>
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        {loading && !data ? <ListaSkeleton /> : null}
        {data && !pending.length && !docs.length ? <Muted>Ainda não há documentos para si.</Muted> : null}
        {pending.length ? (
          <View>
            <Text style={sectionStyle}>Por assinar</Text>
            {pending.map((item, index) => (
              <Line key={item.id} zebra={index % 2 === 1} title={item.titulo} sub={`${item.kind === 'recibo' ? 'Recibo' : 'Contrato'}${item.criado_em ? ` · ${shortDate(item.criado_em)}` : ''}`}
                right={<Pill label="Por assinar" />} onPress={() => setView({ name: 'sign', target: { kind: item.kind, id: item.id, title: item.titulo } })} />
            ))}
          </View>
        ) : null}
        {docs.length ? (
          <View>
            <Text style={sectionStyle}>Para ver</Text>
            {docs.map((doc, index) => (
              <Line key={doc.id} zebra={index % 2 === 1} title={doc.titulo}
                sub={doc.valido_ate ? `${doc.tipo_nome} · válido até ${dateLabel(doc.valido_ate)}` : `${doc.tipo_nome}${doc.criado_em ? ` · ${dateLabel(doc.criado_em)}` : ''}`}
                right={<ViewButton onPress={() => setView({ name: 'view', id: doc.id, title: doc.titulo, file: doc.ficheiro })} />}
                onPress={() => setView({ name: 'view', id: doc.id, title: doc.titulo, file: doc.ficheiro })} />
            ))}
          </View>
        ) : null}
      </ScrollView>
      <ResultSheet resultado={result} onClose={() => setResult(null)} />
    </View>
  );
}

const sectionStyle = { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink2, marginBottom: 2 } as const;

function Pill({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: colors.warnIconBg, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.warnIconInk }}>{label}</Text>
    </View>
  );
}

function ViewButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.band, backgroundColor: colors.surface, justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.band }}>Ver</Text>
    </Pressable>
  );
}

function Line({ title, sub, right, zebra, onPress }: { title: string; sub: string; right: ReactNode; zebra: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: zebra ? colors.zebra : 'transparent', marginHorizontal: zebra ? -10 : 0, paddingHorizontal: zebra ? 10 : 0 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 2 }}>{sub}</Text>
      </View>
      {right}
    </Pressable>
  );
}

/** Páginas do PDF desenhadas pelo servidor, uma por imagem (sem biblioteca nativa de PDF na app). */
function PdfPages({ token, base, fallbackImage }: { token: string; base: string; fallbackImage?: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const headers = { Authorization: `Bearer ${token}`, 'X-App-Versao': appVersion };

  useEffect(() => {
    employeeApi.pdfPages(token, base).then((result) => setCount(result.paginas)).catch(() => setFailed(true));
  }, [token, base]);

  if (failed && fallbackImage) return <PageImage uri={fallbackImage} headers={headers} />;
  if (failed) return <Muted size={14}>Não foi possível mostrar este documento aqui. Use «Descarregar cópia».</Muted>;
  if (count === null) return <Bloco style={{ height: 320, borderRadius: 14 }} />;
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: count }, (_, index) => <PageImage key={index} uri={employeeApi.pdfPageUrl(base, index + 1)} headers={headers} />)}
    </View>
  );
}

function PageImage({ uri, headers }: { uri: string; headers: Record<string, string> }) {
  const [ratio, setRatio] = useState(1.414);
  useEffect(() => {
    Image.getSizeWithHeaders(uri, headers, (width, height) => { if (width) setRatio(height / width); }, () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);
  return (
    <View style={{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
      <Image source={{ uri, headers }} style={{ width: '100%', aspectRatio: 1 / ratio }} resizeMode="contain" accessibilityLabel="Página do documento" />
    </View>
  );
}

function Screen({ title, avatar, onBack, footer, children }: { title: string; avatar: ReactNode; onBack: () => void; footer: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <Header variante="faixaLogo" title={title} subtitle="" onVoltar={onBack} right={avatar} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 16, gap: 14 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      <BarraRodape aboveMenu>{footer}</BarraRodape>
    </View>
  );
}

/** Ver um documento guardado (artboard n.º 5): as páginas e «Descarregar cópia». */
function Viewer({ token, avatar, id, title, file, onBack }: { token: string; avatar: ReactNode; id: string; title: string; file: string; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    setBusy(true);
    setError('');
    try {
      const name = (file || `${title}.pdf`).replace(/[^\w.\-]+/g, '_');
      const saved = await File.downloadFileAsync(employeeApi.documentUrl(id), new File(Paths.cache, name), {
        headers: { Authorization: `Bearer ${token}`, 'X-App-Versao': appVersion }, idempotent: true,
      });
      await Sharing.shareAsync(saved.uri, { dialogTitle: title });
    } catch {
      setError('Não foi possível descarregar o documento. Verifique a ligação e tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={title} avatar={avatar} onBack={onBack} footer={<Button ghost tone="faixa" title={busy ? 'A descarregar…' : 'Descarregar cópia'} busy={busy} onPress={download} />}>
      <PdfPages token={token} base={`/documentos/${encodeURIComponent(id)}`} fallbackImage={IMAGE_FILE.test(file) ? employeeApi.documentUrl(id) : undefined} />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

/** Ler e assinar (artboards n.º 2 e 3): ler → confirmar a leitura e assinar com o dedo → código do email e nome → assinado. */
function SignFlow({ token, me, avatar, target, onBack, onSigned, onAuthError }: {
  token: string; me: Me; avatar: ReactNode; target: Target; onBack: () => void; onSigned: (text: string) => void; onAuthError: (error: unknown) => boolean;
}) {
  const [step, setStep] = useState<'read' | 'code'>('read');
  const [contract, setContract] = useState<Contract | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState(me.colaborador.nome);
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (target.kind === 'contrato') employeeApi.contract(token, target.id).then(setContract).catch((exc) => { if (!onAuthError(exc)) setError(errorText(exc)); });
  }, [target, token, onAuthError]);

  async function requestCode() {
    if (!signature) return;
    setBusy(true);
    setError('');
    try {
      const result = target.kind === 'recibo' ? await employeeApi.signatureCode(token, target.id, signature) : await employeeApi.contractCode(token, target.id, signature);
      setSentTo(result.mensagem);
      setCode('');
      setStep('code');
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
      const result = target.kind === 'recibo' ? await employeeApi.signatureSign(token, target.id, name.trim(), code) : await employeeApi.signContract(token, target.id, name.trim(), code);
      onSigned(result.mensagem);
    } catch (exc) {
      if (!onAuthError(exc)) setError(errorText(exc));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  const noun = target.kind === 'recibo' ? 'recibo' : 'contrato';
  if (step === 'code') {
    return (
      <Screen title="Confirmar" avatar={avatar} onBack={() => setStep('read')}
        footer={<><Button primary tone="verde" title={busy ? 'A assinar…' : `Assinar ${noun}`} busy={busy} disabled={code.length !== CODE_LENGTH || name.trim().length < 3} onPress={sign} /><Button ghost tone="faixa" title="Reenviar o código" onPress={requestCode} /></>}>
        <Muted size={15}>{sentTo} Escreva-o para confirmar a assinatura.</Muted>
        <CodeBoxes value={code} onKey={(key) => { setError(''); setCode(applyKey(code, key, CODE_LENGTH)); }} />
        <Field label="Nome completo" value={name} onChangeText={setName} autoCapitalize="words" />
        <ErrorText>{error}</ErrorText>
        <Muted size={12.5}>Registamos a data, a hora e o dispositivo da assinatura.</Muted>
      </Screen>
    );
  }

  return (
    <Screen title={target.title} avatar={avatar} onBack={onBack}
      footer={<>
        <Button primary tone="verde" title={busy ? 'A enviar o código…' : 'Continuar'} busy={busy} disabled={!accepted || !signature} onPress={requestCode} />
        <Text style={{ textAlign: 'center', fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3 }}>Depois enviamos um código de 6 dígitos para o seu email.</Text>
      </>}>
      {target.kind === 'recibo' ? (
        <PdfPages token={token} base={`/documentos/assinaturas/${encodeURIComponent(target.id)}`} />
      ) : contract ? (
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 16 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.ink }}>{contract.corpo}</Text>
        </View>
      ) : <ActivityIndicator color={colors.band} />}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted(!accepted)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: accepted ? colors.ok : colors.band, backgroundColor: accepted ? colors.ok : colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
          {accepted ? <Text style={{ color: colors.surface, fontFamily: fonts.bodyBold, fontSize: 14 }}>✓</Text> : null}
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink }}>Li o documento e concordo com o seu conteúdo.</Text>
      </Pressable>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink2 }}>A sua assinatura</Text>
      <SignaturePad onChange={setSignature} />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

/** Seis caixas do código com o teclado numérico (mesmo gesto do resto da app). */
function CodeBoxes({ value, onKey }: { value: string; onKey: (key: string) => void }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {Array.from({ length: CODE_LENGTH }, (_, index) => (
          <View key={index} style={{ flex: 1, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: value.length === index ? colors.band : colors.fieldBorder, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 22, color: colors.ink, fontVariant: ['tabular-nums'] }}>{value[index] ?? ''}</Text>
          </View>
        ))}
      </View>
      <NumKeys onKey={onKey} />
    </View>
  );
}

function NumKeys({ onKey }: { onKey: (key: string) => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {keys.map((key, index) => key ? (
        <Pressable key={index} accessibilityRole="button" accessibilityLabel={key === '⌫' ? 'Apagar' : key} onPress={() => onKey(key)}
          style={({ pressed }) => ({ width: '31.5%', height: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink }}>{key}</Text>
        </Pressable>
      ) : <View key={index} style={{ width: '31.5%' }} />)}
    </View>
  );
}
