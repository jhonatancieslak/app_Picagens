// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// «Relatórios» do colaborador (artboard p2311-relatorio-v2, 6 estados): escolher o relatório e o período, a gerar, sucesso,
// erro e o relatório aberto. O servidor monta os dados e o PDF (o mesmo serviço da PWA); a app descarrega o PDF com a
// sessão e entrega-o ao sistema para guardar ou imprimir. Sem localização.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { ApiError, NetworkError, appVersion } from '../../http';
import { colors, fonts } from '../../theme';
import { ReportChoice, ReportOptions, ReportView, employeeApi } from '../api';
import { BarraRodape, Button, ErrorText, Field, Header } from '../ui';

const DATE_TEXT = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const toIso = (text: string) => {
  const match = DATE_TEXT.exec(text.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
};
const errorText = (exc: unknown) => (exc instanceof NetworkError ? 'Sem ligação. Tente mais tarde. Os seus registos estão guardados.' : exc instanceof ApiError ? exc.message : 'Não foi possível gerar. Tente mais tarde.');

type Step = 'choose' | 'busy' | 'done' | 'error' | 'open';

export function ReportsScreen({ token, avatar, onBack, onAuthError }: { token: string; avatar: ReactNode; onBack: () => void; onAuthError: (error: unknown) => boolean }) {
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [choice, setChoice] = useState<ReportChoice>({ tipo: 'registo', periodo: 'mes' });
  const [sheet, setSheet] = useState(false);
  const [step, setStep] = useState<Step>('choose');
  const [view, setView] = useState<ReportView | null>(null);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    employeeApi.reportOptions(token).then(setOptions).catch((exc) => { if (!onAuthError(exc)) setMessage(errorText(exc)); });
  }, [token, onAuthError]);

  const period = options?.periodos.find((item) => item.chave === choice.periodo);
  const periodText = choice.periodo === 'datas' && choice.inicio && choice.fim ? `${choice.inicio.split('-').reverse().join('/')} a ${choice.fim.split('-').reverse().join('/')}` : (period?.detalhe ?? period?.nome ?? '');

  async function generate() {
    setStep('busy');
    setMessage('');
    try {
      const data = await employeeApi.reportView(token, choice);
      const target = new File(Paths.cache, `relatorio-${choice.tipo}.pdf`);
      const saved = await File.downloadFileAsync(employeeApi.reportPdfUrl(choice), target, {
        headers: { Authorization: `Bearer ${token}`, 'X-App-Versao': appVersion }, idempotent: true,
      });
      setView(data);
      setFile(saved);
      setStep('done');
    } catch (exc) {
      if (onAuthError(exc)) return;
      setMessage(errorText(exc));
      setStep('error');
    }
  }

  async function share() {
    if (file) await Sharing.shareAsync(file.uri, { dialogTitle: view?.titulo ?? 'Relatório' }).catch(() => undefined);
  }

  if (step === 'busy') {
    return (
      <Frame title="Relatórios" avatar={avatar} onBack={onBack}>
        <Center>
          <ActivityIndicator size="large" color={colors.band} />
          <Text style={titleStyle}>A gerar o relatório…</Text>
          <Text style={bodyStyle}>Pode demorar uns segundos. Não feche a aplicação.</Text>
        </Center>
      </Frame>
    );
  }

  if (step === 'done') {
    return (
      <Frame title="Relatórios" avatar={avatar} onBack={onBack}>
        <Center>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.okIconBg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 40, color: colors.ok }}>✓</Text>
          </View>
          <Text style={titleStyle}>Relatório gerado</Text>
          <Text style={bodyStyle}>{view?.titulo} de {view?.periodo}. O ficheiro foi descarregado.</Text>
          <View style={{ width: '100%', gap: 10, marginTop: 10 }}>
            <Button primary tone="verde" title="Ver o relatório" onPress={() => setStep('open')} />
            <Button ghost tone="faixa" title="Fechar" onPress={() => setStep('choose')} />
          </View>
        </Center>
      </Frame>
    );
  }

  if (step === 'error') {
    return (
      <Frame title="Relatórios" avatar={avatar} onBack={onBack}>
        <Center>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.dangerIconBg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 40, color: colors.dangerIconInk }}>✕</Text>
          </View>
          <Text style={titleStyle}>Não foi possível gerar</Text>
          <Text style={bodyStyle}>{message || 'Sem ligação ou o servidor não respondeu. Tente mais tarde. Os seus registos estão guardados.'}</Text>
          <View style={{ width: '100%', gap: 10, marginTop: 10 }}>
            <Button primary tone="verde" title="Tentar de novo" onPress={generate} />
            <Button ghost tone="faixa" title="Fechar" onPress={() => setStep('choose')} />
          </View>
        </Center>
      </Frame>
    );
  }

  if (step === 'open' && view) {
    return (
      <Frame title={view.titulo} avatar={avatar} onBack={() => setStep('choose')} footer={<Button ghost tone="faixa" title="Imprimir ou guardar" onPress={share} />}>
        <Pressable accessibilityRole="button" onPress={() => { setStep('choose'); setSheet(true); }} style={periodBoxStyle}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{view.periodo}</Text>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ok }}>Mudar</Text>
        </Pressable>
        <View>
          {view.resumo.map((item, index) => (
            <View key={item.rotulo} style={{ marginBottom: index < view.resumo.length - 1 ? 8 : 0 }}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink3 }}>{item.rotulo}</Text>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: index === 0 ? 32 : 18, color: colors.ink, fontVariant: ['tabular-nums'] }}>{item.valor}</Text>
            </View>
          ))}
        </View>
        {view.vazio ? <Text style={bodyStyle}>Sem dados neste período.</Text> : (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.line }}>
            {view.itens.map((item, index) => (
              <View key={`${item.titulo}-${index}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: index % 2 ? colors.zebra : 'transparent', marginHorizontal: index % 2 ? -10 : 0, paddingHorizontal: index % 2 ? 10 : 0 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{item.titulo}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 2 }}>{item.sub}</Text>
                </View>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] }}>{item.valor}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={noteStyle}>Não inclui localização. O ficheiro descarrega ao gerar.</Text>
      </Frame>
    );
  }

  return (
    <Frame title="Relatórios" avatar={avatar} onBack={onBack} footer={<Button primary tone="verde" title="Gerar relatório" disabled={!options || (choice.periodo === 'datas' && !(choice.inicio && choice.fim))} onPress={generate} />}>
      <Text style={noteStyle}>Os seus registos, prontos a ver ou imprimir.</Text>
      <Pressable accessibilityRole="button" onPress={() => setSheet(true)} style={periodBoxStyle}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{periodText || 'Período'}</Text>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ok }}>Mudar</Text>
      </Pressable>
      {message ? <ErrorText>{message}</ErrorText> : null}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.line }}>
        {(options?.tipos ?? []).map((item, index) => {
          const selected = item.chave === choice.tipo;
          return (
            <Pressable key={item.chave} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setChoice({ ...choice, tipo: item.chave })}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: index % 2 ? colors.zebra : 'transparent', marginHorizontal: index % 2 ? -10 : 0, paddingHorizontal: index % 2 ? 10 : 0, minHeight: 56 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{item.titulo}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 2 }}>{item.sub}</Text>
              </View>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: selected ? 18 : 20, color: selected ? colors.ok : colors.ink3 }}>{selected ? '✓' : '›'}</Text>
            </Pressable>
          );
        })}
      </View>
      {!options && !message ? <ActivityIndicator color={colors.band} /> : null}
      <PeriodSheet visible={sheet} options={options} choice={choice} onClose={() => setSheet(false)} onPick={(next) => { setChoice(next); setSheet(false); }} />
    </Frame>
  );
}

const titleStyle = { fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 28, color: colors.ink, textAlign: 'center' } as const;
const bodyStyle = { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink2, textAlign: 'center' } as const;
const noteStyle = { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink3 } as const;
const periodBoxStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56, borderRadius: 14, borderWidth: 1.5, borderColor: colors.fieldBorder, backgroundColor: colors.surface, paddingHorizontal: 14 } as const;

function Center({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 }}>{children}</View>;
}

function Frame({ title, avatar, onBack, footer, children }: { title: string; avatar: ReactNode; onBack: () => void; footer?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <Header variante="faixaLogo" title={title} subtitle="" onVoltar={onBack} right={avatar} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 16, gap: 14 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      {footer ? <BarraRodape aboveMenu>{footer}</BarraRodape> : null}
    </View>
  );
}

/** Folha «Período» (artboard 2): as opções do servidor e «Escolher datas» com dois campos dd/mm/aaaa. */
function PeriodSheet({ visible, options, choice, onClose, onPick }: { visible: boolean; options: ReportOptions | null; choice: ReportChoice; onClose: () => void; onPick: (choice: ReportChoice) => void }) {
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const valid = Boolean(toIso(from) && toIso(to) && toIso(to) >= toIso(from));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fechar" onPress={onClose} style={{ flex: 1, backgroundColor: colors.scrim }} />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28 }}>
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.handle, alignSelf: 'center', marginBottom: 10 }} />
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: colors.ink, marginBottom: 6 }}>Período</Text>
        {(options?.periodos ?? []).map((item) => {
          const selected = item.chave === choice.periodo;
          const isCustom = item.chave === 'datas';
          return (
            <Pressable key={item.chave} accessibilityRole="radio" accessibilityState={{ selected }}
              onPress={() => (isCustom ? setCustom(true) : onPick({ tipo: choice.tipo, periodo: item.chave }))}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, borderBottomWidth: isCustom ? 0 : 1, borderBottomColor: colors.line }}>
              <Text style={{ fontFamily: selected ? fonts.bodyBold : fonts.bodyMedium, fontSize: 16, color: colors.ink }}>{item.detalhe ? `${item.nome} · ${item.detalhe.replace(/^Esta semana, /, '')}` : item.nome}</Text>
              {selected ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: colors.band }}>✓</Text> : null}
            </Pressable>
          );
        })}
        {custom ? (
          <View style={{ gap: 10, marginTop: 6 }}>
            <Field label="De (dd/mm/aaaa)" value={from} onChangeText={setFrom} keyboardType="number-pad" />
            <Field label="Até (dd/mm/aaaa)" value={to} onChangeText={setTo} keyboardType="number-pad" />
            <Button primary tone="verde" title="Usar estas datas" disabled={!valid} onPress={() => onPick({ tipo: choice.tipo, periodo: 'datas', inicio: toIso(from), fim: toIso(to) })} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
