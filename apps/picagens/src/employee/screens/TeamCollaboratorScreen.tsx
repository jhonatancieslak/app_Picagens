// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// «Colaborador no mapa» (artboard AppChefeColaboradorMapa, 24/11): os dias de uma pessoa da equipa dentro da janela de
// correção, «Corrigir o dia» (corrigir ou acrescentar picagens), «Marcar como falta» e mês fechado (só leitura, pedir ao RH).
// As regras estão no servidor (app/equipas.py: janela, mês fechado, correção direta ou proposta ao RH); a app só as mostra.
// Sem inventar entrada nem saída: marcar falta deixa o dia sem horas e com o motivo.
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { TeamCollaboratorDays, teamApi } from '../api';
import { Button, ErrorText, Field, Header, Muted, ToastMessage } from '../ui';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TYPE_LABEL: Record<string, string> = { entrada: 'Entrada', saida: 'Saída', pausa_inicio: 'Início da pausa', pausa_fim: 'Fim da pausa' };
const errorText = (exc: unknown) => (exc instanceof NetworkError ? 'Sem rede. Tente quando houver ligação.' : exc instanceof ApiError ? exc.message : 'Não foi possível concluir.');

type Day = TeamCollaboratorDays['dias'][number];
type Sheet = { kind: 'fix'; day: Day } | { kind: 'absence'; day: Day } | { kind: 'closed'; day: Day } | null;

interface Props {
  token: string;
  pinToken: string;
  person: { id: string; nome: string };
  avatar: ReactNode;
  onBack: () => void;
  onAuthError: (error: unknown) => boolean;
  toast: (message: ToastMessage) => void;
}

export function TeamCollaboratorScreen({ token, pinToken, person, avatar, onBack, onAuthError, toast }: Props) {
  const [data, setData] = useState<TeamCollaboratorDays | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await teamApi.collaboratorDays(token, pinToken, person.id));
    } catch (exc) {
      if (!onAuthError(exc)) setError(errorText(exc));
    } finally {
      setLoading(false);
    }
  }, [token, pinToken, person.id, onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  const done = (title: string, text: string) => {
    setSheet(null);
    toast({ tone: 'ok', title, text });
    load();
  };

  return (
    <View style={{ flex: 1 }}>
      <Header variante="faixaLogo" title={person.nome} subtitle={data ? `Pode corrigir até ${data.janela} dias atrás, com o mês aberto` : 'Colaborador no mapa'} onVoltar={onBack} right={avatar} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 4 }}
        refreshControl={<RefreshControl refreshing={loading && Boolean(data)} onRefresh={load} colors={[colors.band]} />}>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {loading && !data ? <ActivityIndicator color={colors.band} /> : null}
        {(data?.dias ?? []).map((day, index) => (
          <Pressable key={day.data} accessibilityRole="button" onPress={() => setSheet(dayAction(day))}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: index % 2 ? colors.zebra : 'transparent', marginHorizontal: index % 2 ? -10 : 0, paddingHorizontal: index % 2 ? 10 : 0 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{day.rotulo}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 2 }}>{summary(day)}</Text>
            </View>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: stateColor(day.estado) }}>{day.fechado ? 'Fechado' : day.texto}</Text>
          </Pressable>
        ))}
        {data ? <Muted size={12.5}>Toque num dia para corrigir as picagens ou marcar falta. {data.correcao_direta ? 'A correção conta logo e o RH é avisado.' : 'As correções seguem como proposta ao RH, que decide.'}</Muted> : null}
      </ScrollView>
      {sheet && data ? <DaySheet token={token} pinToken={pinToken} person={person} sheet={sheet} data={data} onClose={() => setSheet(null)} onDone={done} onAuthError={onAuthError} /> : null}
    </View>
  );
}

const dayAction = (day: Day): Sheet => (day.fechado ? { kind: 'closed', day } : day.pode_marcar_falta && !day.picagens.length ? { kind: 'absence', day } : { kind: 'fix', day });

const summary = (day: Day) => (day.picagens.length ? day.picagens.map((p) => `${p.hora} ${TYPE_LABEL[p.tipo]?.toLowerCase() ?? p.tipo}`).join(' · ') : day.fechado ? 'Mês fechado · só o RH' : day.texto);
const stateColor = (state: Day['estado']) => (state === 'falta' || state === 'sem_registo' ? colors.warnInk : state === 'completo' || state === 'a_trabalhar' ? colors.ok : colors.ink3);

/** Folha do dia: corrigir ou acrescentar picagem, marcar falta ou (mês fechado) só ler. */
function DaySheet({ token, pinToken, person, sheet, data, onClose, onDone, onAuthError }: {
  token: string; pinToken: string; person: { id: string; nome: string }; sheet: NonNullable<Sheet>; data: TeamCollaboratorDays;
  onClose: () => void; onDone: (title: string, text: string) => void; onAuthError: (error: unknown) => boolean;
}) {
  const { day } = sheet;
  const [mode, setMode] = useState<'fix' | 'absence'>(sheet.kind === 'absence' ? 'absence' : 'fix');
  const [editing, setEditing] = useState<string | null>(null); // id da picagem; '' = picagem em falta nova
  const [type, setType] = useState<'entrada' | 'saida'>('entrada');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const startEdit = (id: string, current?: { tipo: string; hora: string }) => {
    setEditing(id);
    setType(current?.tipo === 'saida' ? 'saida' : 'entrada');
    setTime(current?.hora ?? '');
    setError('');
  };

  async function send(action: () => Promise<{ mensagem: string }>, title: string) {
    setBusy(true);
    setError('');
    try {
      const result = await action();
      onDone(title, result.mensagem);
    } catch (exc) {
      if (!onAuthError(exc)) setError(errorText(exc));
    } finally {
      setBusy(false);
    }
  }

  const saveFix = () => {
    if (!TIME_RE.test(time)) { setError('Escreva a hora no formato 08:30.'); return; }
    if (!reason.trim()) { setError('O motivo é obrigatório.'); return; }
    const body = editing
      ? { picagem_id: editing, tipo: type, hora: time, motivo: reason.trim() }
      : { colaborador_id: person.id, data: day.data, tipo: type, hora: time, motivo: reason.trim() };
    send(() => teamApi.propose(token, pinToken, body), 'Correção enviada');
  };
  const saveAbsence = () => {
    if (!reason.trim()) { setError('O motivo é obrigatório.'); return; }
    send(() => teamApi.markAbsence(token, pinToken, { colaborador_id: person.id, data: day.data, motivo: reason.trim() }), 'Falta registada');
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fechar" onPress={onClose} style={{ flex: 1, backgroundColor: colors.scrim }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ maxHeight: 640, backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26 }} contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28, gap: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.handle, alignSelf: 'center' }} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink }}>{day.rotulo}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.ink2 }}>{person.nome} · {mode === 'absence' ? 'marcar como falta' : sheet.kind === 'closed' ? 'mês fechado' : 'corrigir o dia'}</Text>

          {sheet.kind === 'closed' ? (
            <>
              <Muted size={14}>Este mês já está fechado. Não pode editar nem inserir picagens neste dia. Peça ao RH.</Muted>
              {day.picagens.map((p) => <ReadRow key={p.id} label={TYPE_LABEL[p.tipo] ?? p.tipo} value={p.hora} />)}
              <Button ghost tone="faixa" title="Fechar" onPress={onClose} />
            </>
          ) : mode === 'absence' ? (
            <>
              <Muted size={13.5}>{data.correcao_direta ? 'A falta fica marcada logo e o RH é avisado.' : 'Esta falta vai como proposta ao RH, que decide.'} Não se inventa entrada nem saída: o dia fica sem horas, com o motivo registado.</Muted>
              <Field label="Motivo (obrigatório)" value={reason} onChangeText={setReason} multiline />
              <ErrorText>{error}</ErrorText>
              <Button primary tone="verde" title={busy ? 'A enviar…' : data.correcao_direta ? 'Marcar falta' : 'Enviar proposta ao RH'} busy={busy} disabled={!reason.trim()} onPress={saveAbsence} />
              {day.picagens.length === 0 ? <Button link title="Voltar a corrigir o dia" onPress={() => { setMode('fix'); setError(''); }} /> : null}
            </>
          ) : editing === null ? (
            <>
              {day.picagens.length ? day.picagens.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                  <View>
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{TYPE_LABEL[p.tipo] ?? p.tipo} · {p.hora}</Text>
                    {p.pendente ? <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3 }}>Correção à espera do RH</Text> : null}
                  </View>
                  {p.pendente || !['entrada', 'saida'].includes(p.tipo) ? null : <Button ghost tone="faixa" title="Editar" onPress={() => startEdit(p.id, p)} />}
                </View>
              )) : <Muted size={14}>Sem picagens neste dia.</Muted>}
              <Button ghost tone="faixa" title="+ Acrescentar picagem em falta" onPress={() => startEdit('')} />
              {day.pode_marcar_falta ? <Button ghost tone="faixa" title="Marcar como falta" onPress={() => { setMode('absence'); setError(''); }} /> : null}
              <Button link title="Fechar" onPress={onClose} />
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['entrada', 'saida'] as const).map((value) => (
                  <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: type === value }} onPress={() => setType(value)}
                    style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: type === value ? colors.band : colors.fieldBorder, backgroundColor: type === value ? colors.band : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: type === value ? colors.surface : colors.ink }}>{TYPE_LABEL[value]}</Text>
                  </Pressable>
                ))}
              </View>
              <Field label="Hora (08:30)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" maxLength={5} />
              <Field label="Motivo (obrigatório)" value={reason} onChangeText={setReason} multiline />
              <ErrorText>{error}</ErrorText>
              <Button primary tone="verde" title={busy ? 'A enviar…' : 'Guardar correção'} busy={busy} onPress={saveFix} />
              <Button link title="Voltar" onPress={() => { setEditing(null); setError(''); }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink }}>{label}</Text>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}
