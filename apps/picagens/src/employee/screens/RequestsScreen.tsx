// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// «Pedidos» (artboard p2311-pedidos-v2, aprovado 24/11): cartão com os dias de férias por gozar, «Próximos» e «Passados»,
// «Pedir férias» e «Pedir baixa» e a folha «Pedido enviado». As listas, o saldo e os dias úteis vêm do servidor (o mesmo
// serviço da PWA). Atestado da baixa opcional (decisão de 24/11, doc 245). O calendário só serve para escolher as datas.
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import ResultSheet, { ResultadoPicar } from '../../components/ResultSheet';
import { ListaSkeleton } from '../../components/Skeleton';
import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { RequestLine, Requests, employeeApi } from '../api';
import { holidayName, workingDays } from '../holidays';
import { sickLeavePhotoBase64 } from '../photo';
import { Avatar, AvatarPhoto, BarraRodape, Button, ErrorText, Field, Header, Muted, Toggle } from '../ui';

const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DAY_MS = 86_400_000;
const SICK_REASONS = ['Doença', 'Acidente de trabalho'];

const fromIso = (text: string) => {
  const [year, month, day] = text.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const same = (a: Date, b: Date) => iso(a) === iso(b);
const dayMonth = (date: Date) => `${date.getDate()} ${MONTHS[date.getMonth()]}`;
const longPeriod = (start: Date, end: Date) => (same(start, end) ? `${start.getDate()} de ${MONTHS_LONG[start.getMonth()]}`
  : start.getMonth() === end.getMonth() ? `${start.getDate()} a ${end.getDate()} de ${MONTHS_LONG[end.getMonth()]}`
  : `${start.getDate()} de ${MONTHS_LONG[start.getMonth()]} a ${end.getDate()} de ${MONTHS_LONG[end.getMonth()]}`);

const errorText = (exc: unknown) => (exc instanceof NetworkError ? 'Sem rede. Tente quando houver ligação.' : exc instanceof ApiError ? exc.message : 'Não foi possível concluir.');

type Kind = 'ferias' | 'baixa';

const PILL: Record<string, { bg: string; fg: string }> = {
  espera: { bg: colors.warnIconBg, fg: colors.warnIconInk },
  ok: { bg: colors.okSoft, fg: colors.okInk },
  nao: { bg: colors.dangerPill, fg: colors.dangerInk },
};

interface Props {
  token: string;
  name: string;
  photo: AvatarPhoto | null;
  onProfile: () => void;
  onAuthError: (error: unknown) => boolean;
}

export function RequestsScreen({ token, name, photo, onProfile, onAuthError }: Props) {
  const [data, setData] = useState<Requests | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'proximos' | 'passados'>('proximos');
  const [form, setForm] = useState<Kind | null>(null);
  const [sent, setSent] = useState<ResultadoPicar | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await employeeApi.requests(token));
    } catch (exc) {
      if (!onAuthError(exc)) setError(errorText(exc));
    } finally {
      setLoading(false);
    }
  }, [token, onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  const avatar = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.surface }}>{name.split(/\s+/)[0]}</Text>
      <Avatar name={name} count={0} onPress={onProfile} photo={photo} size={36} />
    </View>
  );

  if (form) {
    return (
      <>
        <NewRequest
          kind={form}
          token={token}
          data={data}
          onBack={() => setForm(null)}
          onSent={(result) => { setForm(null); setSent(result); load(); }}
          onAuthError={onAuthError}
          avatar={avatar}
        />
        <ResultSheet resultado={sent} onClose={() => setSent(null)} />
      </>
    );
  }

  const lines = (tab === 'proximos' ? data?.proximos : data?.passados) ?? [];
  const saldo = data?.saldo;
  const waiting = data?.pendentes ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <Header variante="faixaLogo" title="Pedidos" subtitle="" right={avatar} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 14 }}
        refreshControl={<RefreshControl refreshing={loading && Boolean(data)} onRefresh={load} colors={[colors.action]} />}
      >
        {saldo ? (
          <View accessibilityLabel={`Dias de férias por gozar em ${saldo.ano}: ${saldo.por_gozar}`} style={{ backgroundColor: colors.band, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, gap: 4, elevation: 4 }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.surface, opacity: 0.85 }}>Dias de férias por gozar em {saldo.ano}</Text>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 36, lineHeight: 40, color: colors.surface, fontVariant: ['tabular-nums'] }}>{saldo.por_gozar} {saldo.por_gozar === 1 ? 'dia' : 'dias'}</Text>
            {waiting ? <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.surface, opacity: 0.9 }}>{waiting} {waiting === 1 ? 'pedido à espera' : 'pedidos à espera'} de decisão do RH</Text> : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 22, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          {([['proximos', 'Próximos'], ['passados', 'Passados']] as const).map(([value, label]) => (
            <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)}
              style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: tab === value ? colors.band : 'transparent', marginBottom: -1 }}>
              <Text style={{ fontFamily: tab === value ? fonts.bodyBold : fonts.bodyMedium, fontSize: 15, color: tab === value ? colors.band : colors.ink3 }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <ErrorText>{error}</ErrorText> : null}
        {loading && !data ? <ListaSkeleton /> : null}
        {data && !lines.length ? <Muted>{tab === 'proximos' ? 'Não tem pedidos por decidir nem férias por vir.' : 'Ainda não tem pedidos passados.'}</Muted> : null}
        <View>
          {lines.map((line, index) => <Line key={line.id} line={line} zebra={index % 2 === 1} />)}
        </View>
      </ScrollView>
      <BarraRodape aboveMenu>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Button primary tone="verde" title="Pedir férias" onPress={() => setForm('ferias')} /></View>
          <View style={{ flex: 1 }}><Button ghost tone="faixa" title="Pedir baixa" onPress={() => setForm('baixa')} /></View>
        </View>
      </BarraRodape>
      <ResultSheet resultado={sent} onClose={() => setSent(null)} />
    </View>
  );
}

function Line({ line, zebra }: { line: RequestLine; zebra: boolean }) {
  const pill = PILL[line.tom] ?? PILL.espera;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: zebra ? colors.zebra : 'transparent', marginHorizontal: zebra ? -10 : 0, paddingHorizontal: zebra ? 10 : 0 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>{line.titulo}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 2 }}>{line.sub}</Text>
      </View>
      <View style={{ backgroundColor: pill.bg, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: pill.fg }}>{line.estado_texto}</Text>
      </View>
    </View>
  );
}

function NewRequest({ kind, token, data, onBack, onSent, onAuthError, avatar }: {
  kind: Kind; token: string; data: Requests | null; onBack: () => void; onSent: (result: ResultadoPicar) => void; onAuthError: (error: unknown) => boolean; avatar: React.ReactNode;
}) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [start, setStart] = useState<Date | undefined>(kind === 'baixa' ? startOfToday : undefined);
  const [end, setEnd] = useState<Date | undefined>(kind === 'baixa' ? startOfToday : undefined);
  const [picking, setPicking] = useState<'start' | 'end'>(kind === 'baixa' ? 'start' : 'start');
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [typeId, setTypeId] = useState<string | undefined>(data?.tipos_ferias[0]?.id);
  const [reason, setReason] = useState(SICK_REASONS[0]);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  /** Baixa sem data de fim («o RH fecha depois»): segue sem data_fim. Por omissão, como no artboard. */
  const [noEnd, setNoEnd] = useState(kind === 'baixa');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState<{ dias: number; depois: number | null } | null>(null);
  const classes = useMemo(() => new Map<string, DayClass>(), []);

  // Se o Android fechou a app enquanto a câmara estava aberta (pouca memória), a foto tirada fica pendente: recupera-a.
  useEffect(() => {
    if (kind !== 'baixa') return;
    ImagePicker.getPendingResultAsync().then((result) => {
      if (result && 'assets' in result && !result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
    }).catch(() => undefined);
  }, [kind]);

  // «São N dias úteis. Ficam-lhe M dias de férias por gozar.»: pergunta ao servidor (o mesmo serviço da PWA).
  useEffect(() => {
    if (kind !== 'ferias' || !start || !end) { setHint(null); return; }
    let active = true;
    employeeApi.vacationDays(token, iso(start), iso(end)).then((result) => { if (active) setHint(result); }).catch(() => { if (active) setHint(null); });
    return () => { active = false; };
  }, [kind, start, end, token]);

  function pick(day: Date) {
    setError('');
    if (kind === 'ferias' && day < startOfToday) {
      setError('Não é possível pedir férias em datas passadas.');
      return;
    }
    if (picking === 'start' || !start || day < start) {
      setStart(day);
      setEnd(day);
      setPicking('end');
      if (kind === 'baixa') setNoEnd(true);
    } else {
      setEnd(day);
      setPicking('start');
      if (kind === 'baixa') setNoEnd(false);
    }
  }

  async function takePhoto(camera: boolean) {
    setError('');
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        setError('Sem acesso à câmara. Permita nas definições do Android ou escolha uma foto da galeria.');
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
    } catch {
      setError(camera ? 'Não foi possível abrir a câmara. Tente «Escolher» para usar uma foto da galeria.' : 'Não foi possível abrir a galeria. Tente de novo.');
    }
  }

  async function send() {
    if (!start || !end) return;
    setSending(true);
    setError('');
    try {
      if (kind === 'ferias') {
        await employeeApi.requestVacation(token, iso(start), iso(end), typeId);
        onSent({ tone: 'ok', title: 'Pedido enviado', text: `Férias de ${longPeriod(start, end)}. O RH decide e avisamo-lo.`, botao: 'Ver os meus pedidos' });
      } else {
        let documento: string | undefined;
        if (photo) {
          try {
            documento = await sickLeavePhotoBase64(photo);
          } catch {
            setError('Não foi possível ler a foto. Tire outra ou escolha da galeria.');
            return;
          }
        }
        const motivo = [reason, note.trim()].filter(Boolean).join(': ');
        await employeeApi.requestSickLeave(token, {
          data_inicio: iso(start),
          ...(noEnd ? {} : { data_fim: iso(end) }),
          motivo,
          ...(documento ? { documento, documento_nome: 'baixa.jpg' } : {}),
        });
        onSent({ tone: 'ok', title: 'Pedido enviado', text: `Baixa desde ${longPeriod(start, start)}. O RH regista-a e avisamo-lo.`, botao: 'Ver os meus pedidos' });
      }
    } catch (exc) {
      if (!onAuthError(exc)) setError(errorText(exc));
    } finally {
      setSending(false);
    }
  }

  const days = start && end ? workingDays(start, end) : 0;
  const ready = Boolean(start && end) && (kind === 'ferias' ? days > 0 : true);
  const missing = !start ? 'Escolha a data no calendário.' : kind === 'ferias' && days <= 0 ? 'Escolha dias úteis (sem fins de semana nem feriados).' : '';
  const types = data?.tipos_ferias ?? [];

  return (
    <View style={{ flex: 1 }}>
      <Header variante="faixaLogo" title={kind === 'ferias' ? 'Pedir férias' : 'Pedir baixa'} subtitle="" onVoltar={onBack} right={avatar} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
        {kind === 'baixa' ? (
          <View style={{ gap: 8 }}>
            <Text style={labelStyle}>Motivo</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {SICK_REASONS.map((value) => <Chip key={value} label={value} on={reason === value} onPress={() => setReason(value)} />)}
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <DateBox label="Primeiro dia" value={start} active={picking === 'start'} onPress={() => setPicking('start')} />
          <DateBox label="Último dia" value={kind === 'baixa' && noEnd ? undefined : end} active={picking === 'end'} onPress={() => setPicking('end')}
            empty={kind === 'baixa' ? { title: 'Em aberto', hint: 'o RH fecha depois' } : undefined} />
        </View>

        {kind === 'ferias' && start && end ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink3 }}>
            {hint
              ? `São ${hint.dias} ${hint.dias === 1 ? 'dia útil' : 'dias úteis'}.${hint.depois !== null ? ` Ficam-lhe ${hint.depois} dias de férias por gozar.` : ''}`
              : `São ${days} ${days === 1 ? 'dia útil' : 'dias úteis'}.`}
          </Text>
        ) : null}

        <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12 }}>
          <MonthHeader month={month} onMove={(delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))} />
          <MonthGrid month={month} classes={classes} today={today} selected={{ start, end }} onDay={pick} />
        </View>

        {kind === 'ferias' && types.length > 1 ? (
          <View style={{ gap: 8 }}>
            <Text style={labelStyle}>Tipo</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {types.map((type) => <Chip key={type.id} label={type.nome} on={typeId === type.id} onPress={() => setTypeId(type.id)} />)}
            </View>
          </View>
        ) : null}

        {kind === 'baixa' ? (
          <>
            <Toggle flat title="Ainda não sei a data de fim" subtitle="O RH acrescenta-a quando souber" value={noEnd} onChange={setNoEnd} />
            <Field label="Nota para o RH (opcional)" value={note} onChangeText={setNote} placeholder="Ex.: consulta e repouso" />
            <View style={{ gap: 8 }}>
              <Text style={labelStyle}>Atestado (opcional)</Text>
              {photo ? (
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Image source={{ uri: photo.uri }} style={{ width: 64, height: 64, borderRadius: 10 }} />
                  <Button link tone="verde" title="Trocar foto" onPress={() => takePhoto(true)} />
                  <Button link tone="verde" title="Tirar" onPress={() => setPhoto(null)} />
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><Button ghost tone="faixa" title="Tirar foto" onPress={() => takePhoto(true)} /></View>
                  <View style={{ flex: 1 }}><Button ghost tone="faixa" title="Escolher" onPress={() => takePhoto(false)} /></View>
                </View>
              )}
            </View>
            <Muted size={13}>O RH regista a baixa. Se precisar do atestado, avisa-o.</Muted>
          </>
        ) : null}

        <ErrorText>{error}</ErrorText>
        {!ready && missing ? <Muted size={13}>{missing}</Muted> : null}
      </ScrollView>
      <BarraRodape aboveMenu>
        <Button primary tone="verde" title={sending ? 'A enviar…' : 'Enviar pedido'} busy={sending} disabled={!ready} onPress={send} />
      </BarraRodape>
    </View>
  );
}

const labelStyle = { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink2 } as const;

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={{ minHeight: 42, paddingHorizontal: 16, borderRadius: 21, borderWidth: 1.5, borderColor: on ? colors.band : colors.fieldBorder, backgroundColor: on ? colors.band : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: on ? fonts.bodyBold : fonts.bodyMedium, fontSize: 14, color: on ? colors.surface : colors.ink2 }}>{label}</Text>
    </Pressable>
  );
}

function DateBox({ label, value, active, onPress, empty }: { label: string; value?: Date; active: boolean; onPress: () => void; empty?: { title: string; hint: string } }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flex: 1, gap: 8 }}>
      <Text style={labelStyle}>{label}</Text>
      <View style={{ minHeight: 56, borderRadius: 14, borderWidth: 1.5, borderColor: active ? colors.band : colors.fieldBorder, backgroundColor: colors.surface, paddingHorizontal: 14, justifyContent: 'center' }}>
        {value ? (
          <>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>{dayMonth(value)}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3 }}>{WEEKDAYS_LONG[value.getDay()]}</Text>
          </>
        ) : empty ? (
          <>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>{empty.title}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3 }}>{empty.hint}</Text>
          </>
        ) : <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink3 }}>Escolher</Text>}
      </View>
    </Pressable>
  );
}

type DayClass = { vac?: boolean; pend?: boolean; leave?: boolean };

/** Calendário mensal para escolher as datas: segunda a domingo, número da semana à esquerda, feriados nacionais a roxo. */
function MonthGrid({ month, classes, selected, onDay, today }: { month: Date; classes: Map<string, DayClass>; selected?: { start?: Date; end?: Date }; onDay: (day: Date) => void; today: Date }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first.getTime() - offset * DAY_MS);
  const rows = Math.ceil((offset + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        <View style={{ width: 22 }} />
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((letter, index) => (
          <Text key={index} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.ink3 }}>{letter}</Text>
        ))}
      </View>
      {Array.from({ length: rows }, (_, row) => {
        const monday = new Date(start.getFullYear(), start.getMonth(), start.getDate() + row * 7);
        return (
          <View key={row} style={{ flexDirection: 'row', gap: 3 }}>
            <Text style={{ width: 22, textAlign: 'center', alignSelf: 'center', fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.ink3 }}>{isoWeek(monday)}</Text>
            {Array.from({ length: 7 }, (__, col) => {
              const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + col);
              const outside = day.getMonth() !== month.getMonth();
              const info = classes.get(iso(day)) ?? {};
              const holiday = holidayName(day);
              const isSelected = Boolean(selected?.start && (same(day, selected.start) || (selected.end && day >= selected.start && day <= selected.end)));
              const isToday = same(day, today);
              let bg: string = 'transparent';
              let fg: string = col > 4 ? colors.ink3 : colors.ink;
              let border: string = 'transparent';
              if (holiday) { bg = colors.holSoft; fg = colors.hol; }
              if (info.leave) { bg = colors.dangerSoft; fg = colors.danger; }
              if (info.vac) { bg = colors.ok; fg = colors.surface; }
              if (info.pend) { bg = colors.warnSoft; fg = colors.warnInk; border = colors.warn; }
              if (isToday) { border = colors.band; if (!info.vac) fg = colors.band; }
              if (isSelected) { bg = colors.band; fg = colors.surface; border = colors.band; }
              if (outside) { bg = 'transparent'; fg = colors.line; border = 'transparent'; }
              return (
                <Pressable
                  key={col}
                  disabled={outside}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.getDate()} de ${MONTHS_LONG[day.getMonth()]}${holiday ? `, ${holiday}` : ''}`}
                  onPress={() => onDay(day)}
                  style={{ flex: 1, aspectRatio: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: border === 'transparent' ? 0 : isToday && !isSelected ? 2 : 1.5, borderColor: border }}
                >
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: fg }}>{day.getDate()}</Text>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function isoWeek(monday: Date) {
  const thursday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3);
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  return 1 + Math.round(((thursday.getTime() - jan4.getTime()) / DAY_MS - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

function MonthHeader({ month, onMove }: { month: Date; onMove: (delta: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => onMove(-1)} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18, color: colors.band }}>‹</Text>
      </Pressable>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{MONTHS_LONG[month.getMonth()][0].toUpperCase() + MONTHS_LONG[month.getMonth()].slice(1)} de {month.getFullYear()}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Mês seguinte" onPress={() => onMove(1)} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18, color: colors.band }}>›</Text>
      </Pressable>
    </View>
  );
}
