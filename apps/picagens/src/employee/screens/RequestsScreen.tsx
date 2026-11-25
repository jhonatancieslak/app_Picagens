// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// "Pedidos" (protótipo v6): resumo, calendário do mês (semanas numeradas, feriados nacionais, férias aprovadas,
// pedidos em análise e baixas) ou lista; "Novo pedido" de férias ou baixa médica (com foto do certificado),
// dias úteis contados sem fins de semana nem feriados, ecrã de enviado e seguimento Enviado › Em análise › Decisão.
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraIcon, MedicalIcon, SunIcon } from '../../components/icons';
import { Illustration } from '../../components/Illustration';
import { ApiError, NetworkError } from '../../http';
import { ListaSkeleton } from '../../components/Skeleton';
import { colors, fonts } from '../../theme';
import { RequestState, Requests, employeeApi } from '../api';
import { holidayName, holidaysBetween, workingDays } from '../holidays';
import { sickLeavePhotoBase64 } from '../photo';
import { BackLink, Button, Card, Chip, ChipTone, ErrorText, Field, Header, Muted, Row, Title, Toggle } from '../ui';

const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DAY_MS = 86_400_000;

const fromIso = (text: string) => {
  const [year, month, day] = text.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const same = (a: Date, b: Date) => iso(a) === iso(b);
const short = (date: Date) => `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
const span = (start: Date, end: Date) => (same(start, end) ? `${start.getDate()} ${MONTHS[start.getMonth()]}`
  : start.getMonth() === end.getMonth() ? `${start.getDate()} a ${end.getDate()} ${MONTHS[end.getMonth()]}`
  : `${start.getDate()} ${MONTHS[start.getMonth()]} a ${end.getDate()} ${MONTHS[end.getMonth()]}`);

const STATE: Record<RequestState, { tone: ChipTone; label: string }> = {
  pendente: { tone: 'warn', label: 'Em análise' },
  aprovada: { tone: 'ok', label: 'Aprovado' },
  rejeitada: { tone: 'danger', label: 'Recusado' },
};

type Kind = 'ferias' | 'baixa';
interface Item { id: string; kind: Kind; start: Date; end: Date; state: RequestState; note?: string | null }
type View_ = { name: 'main' } | { name: 'new'; from?: Date } | { name: 'sent'; item: Item } | { name: 'track'; item: Item };

function items(data: Requests | null): Item[] {
  if (!data) return [];
  const vacations = data.ferias.map((f) => ({
    id: f.id, kind: 'ferias' as const, state: f.estado,
    start: fromIso(f.data_inicio_aprovada ?? f.data_inicio), end: fromIso(f.data_fim_aprovada ?? f.data_fim),
  }));
  const leaves = data.baixas.map((b) => ({
    id: b.id, kind: 'baixa' as const, state: b.estado, note: b.motivo_rejeicao,
    start: fromIso(b.data_inicio), end: fromIso(b.data_fim ?? b.data_inicio),
  }));
  return [...vacations, ...leaves].sort((a, b) => b.start.getTime() - a.start.getTime());
}

const errorText = (exc: unknown) => (exc instanceof NetworkError ? 'Sem rede. Tente quando houver ligação.' : exc instanceof ApiError ? exc.message : 'Não foi possível concluir.');

export function RequestsScreen({ token, onAuthError }: { token: string; onAuthError: (error: unknown) => boolean }) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Requests | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'cal' | 'list'>('cal');
  const [view, setView] = useState<View_>({ name: 'main' });

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

  const all = useMemo(() => items(data), [data]);
  const container = { paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 110, gap: 12 };

  if (view.name === 'new') {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={container} keyboardShouldPersistTaps="handled">
        <NewRequest
          token={token}
          data={data}
          all={all}
          from={view.from}
          onBack={() => setView({ name: 'main' })}
          onSent={(item) => { setView({ name: 'sent', item }); load(); }}
          onAuthError={onAuthError}
        />
      </ScrollView>
    );
  }

  if (view.name === 'sent' || view.name === 'track') {
    const item = view.item;
    const days = item.kind === 'ferias' ? workingDays(item.start, item.end) : Math.round((item.end.getTime() - item.start.getTime()) / DAY_MS) + 1;
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={container}>
        {view.name === 'sent' ? (
          <View style={{ alignItems: 'center', gap: 6, paddingTop: 8 }}>
            <Illustration name="sent" width={200} />
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink }}>Pedido enviado</Text>
            <Muted size={14} center>O gestor recebeu uma notificação. Avisamos no telemóvel quando houver decisão.</Muted>
          </View>
        ) : (
          <>
            <BackLink label="Pedidos" onPress={() => setView({ name: 'main' })} />
            <Illustration name={item.state === 'aprovada' ? 'approved' : 'review'} width={170} />
            <Title size={24}>{item.kind === 'ferias' ? 'Férias' : 'Baixa médica'} {span(item.start, item.end)}</Title>
          </>
        )}
        <Card style={{ paddingVertical: 6, paddingHorizontal: 14 }}>
          <Step state="done" mark="✓" title="Enviado" text={`${view.name === 'sent' ? 'Agora · ' : ''}${days} dia${days > 1 ? 's' : ''}${item.kind === 'ferias' ? ' úteis' : ''}`} />
          <Step
            state={item.state === 'pendente' ? 'now' : 'done'}
            mark={item.state === 'pendente' ? '…' : '✓'}
            title="Em análise"
            text={item.state === 'pendente' ? 'O gestor está a ver o pedido' : 'Analisado pelo gestor'}
          />
          <Step
            state={item.state === 'pendente' ? 'todo' : item.state === 'aprovada' ? 'done' : 'bad'}
            mark={item.state === 'pendente' ? '3' : item.state === 'aprovada' ? '✓' : '!'}
            title="Decisão"
            text={item.state === 'pendente' ? 'Aprovado, alterado ou recusado com motivo' : item.state === 'aprovada' ? 'Aprovado' : `Recusado${item.note ? `: ${item.note}` : ''}`}
            last
          />
        </Card>
        <Button ghost title="Ver no calendário" onPress={() => { setMode('cal'); setView({ name: 'main' }); }} />
      </ScrollView>
    );
  }

  const pending = all.filter((i) => i.state === 'pendente').length;
  const year = new Date().getFullYear();
  const booked = all.filter((i) => i.kind === 'ferias' && i.state === 'aprovada' && i.start.getFullYear() === year).reduce((sum, i) => sum + workingDays(i.start, i.end), 0);
  const leaves = all.filter((i) => i.kind === 'baixa' && i.start.getFullYear() === year).length;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={container} refreshControl={<RefreshControl refreshing={loading && Boolean(data)} onRefresh={load} colors={[colors.action]} />}>
      <Header subtitle="Férias e baixas" title="Pedidos" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Balance value={booked} label="férias marcadas" />
        <Balance value={pending} label="em análise" />
        <Balance value={leaves} label={`baixa${leaves === 1 ? '' : 's'} em ${year}`} />
      </View>
      <View style={{ flexDirection: 'row', backgroundColor: colors.line, borderRadius: 12, padding: 3 }}>
        {(['cal', 'list'] as const).map((value) => (
          <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: mode === value }} onPress={() => setMode(value)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: mode === value ? colors.surface : 'transparent', elevation: mode === value ? 2 : 0 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: mode === value ? colors.ink : colors.ink2 }}>{value === 'cal' ? 'Calendário' : 'Lista'}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Muted>{error}</Muted> : null}
      {loading && !data ? <ListaSkeleton /> : null}
      {mode === 'cal' ? (
        <CalendarView all={all} onDay={(day) => setView({ name: 'new', from: day })} onItem={(item) => setView({ name: 'track', item })} />
      ) : (
        <RequestList all={all} onItem={(item) => setView({ name: 'track', item })} />
      )}
      <Button primary title="Novo pedido" onPress={() => setView({ name: 'new' })} />
    </ScrollView>
  );
}

function Balance({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 10, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.ink }}>{value}</Text>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.ink2, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function Step({ state, mark, title, text, last }: { state: 'done' | 'now' | 'todo' | 'bad'; mark: string; title: string; text: string; last?: boolean }) {
  const bg = state === 'done' ? colors.ok : state === 'now' ? colors.warn : state === 'bad' ? colors.danger : colors.line;
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 8 }}>
      <View style={{ alignItems: 'center', width: 28 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', zIndex: 1, borderWidth: state === 'now' ? 4 : 0, borderColor: colors.warnSoft }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: state === 'todo' ? colors.ink3 : '#fff' }}>{mark}</Text>
        </View>
        {!last ? <View style={{ position: 'absolute', top: 30, bottom: -14, width: 2, backgroundColor: state === 'done' ? colors.ok : colors.line }} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink2 }}>{text}</Text>
      </View>
    </View>
  );
}

function RequestList({ all, onItem }: { all: Item[]; onItem: (item: Item) => void }) {
  if (!all.length) return <Muted>Ainda não fez pedidos.</Muted>;
  return (
    <Card>
      {all.map((item, index) => (
        <Row
          key={item.id}
          first={index === 0}
          onPress={() => onItem(item)}
          title={`${span(item.start, item.end)} · ${item.kind === 'ferias' ? 'Férias' : 'Baixa médica'}`}
          subtitle={item.kind === 'ferias' ? `${workingDays(item.start, item.end)} dias úteis` : 'Com foto do certificado'}
          right={<Chip tone={STATE[item.state].tone} label={STATE[item.state].label} />}
        />
      ))}
    </Card>
  );
}

type DayClass = { vac?: boolean; pend?: boolean; leave?: boolean };

/** Calendário mensal (".cal"): segunda a domingo, número da semana à esquerda. */
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
              let bg = 'transparent';
              let fg = col > 4 ? colors.ink3 : colors.ink;
              let border = 'transparent';
              if (holiday) { bg = colors.holSoft; fg = colors.hol; }
              if (info.leave) { bg = colors.dangerSoft; fg = colors.danger; }
              if (info.vac) { bg = colors.ok; fg = '#fff'; }
              if (info.pend) { bg = colors.warnSoft; fg = colors.warn; border = colors.warn; }
              if (isToday) { border = colors.action; if (!info.vac) fg = colors.action; }
              if (isSelected) { bg = colors.action; fg = '#fff'; border = colors.action; }
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

function dayClasses(all: Item[]) {
  const map = new Map<string, DayClass>();
  all.filter((i) => i.state !== 'rejeitada').forEach((item) => {
    for (let d = new Date(item.start); d <= item.end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const entry = map.get(iso(d)) ?? {};
      if (item.kind === 'baixa') entry.leave = true;
      else if (item.state === 'aprovada') entry.vac = true;
      else entry.pend = true;
      map.set(iso(d), entry);
    }
  });
  return map;
}

function MonthHeader({ month, onMove }: { month: Date; onMove: (delta: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => onMove(-1)} style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 16, color: colors.ink }}>‹</Text>
      </Pressable>
      <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.ink }}>{MONTHS_LONG[month.getMonth()][0].toUpperCase() + MONTHS_LONG[month.getMonth()].slice(1)} de {month.getFullYear()}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Mês seguinte" onPress={() => onMove(1)} style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 16, color: colors.ink }}>›</Text>
      </Pressable>
    </View>
  );
}

function CalendarView({ all, onDay, onItem }: { all: Item[]; onDay: (day: Date) => void; onItem: (item: Item) => void }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const classes = useMemo(() => dayClasses(all), [all]);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const holidays = holidaysBetween(month, monthEnd);
  const inMonth = all.filter((i) => i.end >= month && i.start <= monthEnd);
  return (
    <>
      <Card style={{ padding: 12 }}>
        <MonthHeader month={month} onMove={(delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))} />
        <MonthGrid month={month} classes={classes} today={today} onDay={(day) => (day >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? onDay(day) : undefined)} />
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, rowGap: 6, columnGap: 12, paddingHorizontal: 12 }}>
        <Legend color={colors.holSoft} border={colors.hol} label="Feriado" />
        <Legend color={colors.ok} label="Férias aprovadas" />
        <Legend color={colors.warnSoft} border={colors.warn} label="Em análise" />
        <Legend color={colors.dangerSoft} label="Baixa" />
        <Legend color="transparent" border={colors.action} label="Hoje" />
      </View>
      {holidays.length || inMonth.length ? (
        <Card>
          {holidays.map((h, index) => (
            <Row key={iso(h.date)} first={index === 0} left={<Chip tone="hol" label={`${h.date.getDate()} ${MONTHS[h.date.getMonth()]}`} />} title={h.name} subtitle={`Feriado nacional · ${WEEKDAYS[h.date.getDay()]}`} />
          ))}
          {inMonth.map((item, index) => (
            <Row
              key={item.id}
              first={!holidays.length && index === 0}
              onPress={() => onItem(item)}
              left={<Chip tone={STATE[item.state].tone} label={span(item.start, item.end).replace(/ [a-z]{3}$/, '')} />}
              title={item.kind === 'ferias' ? `Férias · ${workingDays(item.start, item.end)} dias úteis` : 'Baixa médica'}
              right={<Chip tone={STATE[item.state].tone} label={STATE[item.state].label} />}
            />
          ))}
        </Card>
      ) : null}
      <Muted size={12.5}>Toque num dia para pedir férias a partir dele.</Muted>
    </>
  );
}

function Legend({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, borderWidth: border ? 1.5 : 0, borderColor: border }} />
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.ink2 }}>{label}</Text>
    </View>
  );
}

function NewRequest({ token, data, all, from, onBack, onSent, onAuthError }: {
  token: string; data: Requests | null; all: Item[]; from?: Date; onBack: () => void; onSent: (item: Item) => void; onAuthError: (error: unknown) => boolean;
}) {
  const today = new Date();
  const [kind, setKind] = useState<Kind>('ferias');
  const [start, setStart] = useState<Date | undefined>(from);
  const [end, setEnd] = useState<Date | undefined>(from);
  const [picking, setPicking] = useState<'start' | 'end'>(from ? 'end' : 'start');
  const [month, setMonth] = useState(new Date((from ?? today).getFullYear(), (from ?? today).getMonth(), 1));
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  /** Baixa ainda sem data de fim (o certificado só diz o início): segue sem data_fim. */
  const [noEnd, setNoEnd] = useState(false);
  const [sending, setSending] = useState(false);

  // Se o Android fechou a app enquanto a câmara estava aberta (pouca memória), a foto tirada fica pendente:
  // recupera-a ao voltar, em vez de a perder (causa provável das baixas que não saíam na 2.2.0, doc 53 §3).
  useEffect(() => {
    ImagePicker.getPendingResultAsync().then((result) => {
      if (result && 'assets' in result && !result.canceled && result.assets?.[0]) {
        setKind('baixa');
        setPhoto(result.assets[0]);
      }
    }).catch(() => undefined);
  }, []);
  const [error, setError] = useState('');
  const classes = useMemo(() => dayClasses(all), [all]);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

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
    } else {
      setEnd(day);
      setPicking('start');
    }
  }

  async function takePhoto(camera: boolean) {
    setError('');
    try {
      // A galeria usa o seletor de fotos do Android (não precisa de permissão); só a câmara pede.
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        setError('Sem acesso à câmara. Permita nas definições do Android ou escolha uma foto da galeria.');
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
    } catch {
      setError(camera ? 'Não foi possível abrir a câmara. Tente "Escolher" para usar uma foto da galeria.' : 'Não foi possível abrir a galeria. Tente de novo.');
    }
  }

  async function send() {
    if (!start || !end) return;
    setSending(true);
    setError('');
    try {
      let id: string;
      if (kind === 'ferias') {
        id = (await employeeApi.requestVacation(token, iso(start), iso(end), data?.tipos_ferias[0]?.id)).id;
      } else {
        let documento: string;
        try {
          documento = await sickLeavePhotoBase64(photo!);
        } catch {
          setError('Não foi possível ler a foto. Tire outra ou escolha da galeria.');
          return;
        }
        id = (await employeeApi.requestSickLeave(token, {
          data_inicio: iso(start),
          ...(noEnd ? {} : { data_fim: iso(end) }),
          ...(note.trim() ? { motivo: note.trim() } : {}),
          documento,
          documento_nome: 'baixa.jpg',
        })).id;
      }
      onSent({ id, kind, start, end, state: 'pendente' });
    } catch (exc) {
      if (!onAuthError(exc)) setError(errorText(exc));
    } finally {
      setSending(false);
    }
  }

  const days = start && end ? workingDays(start, end) : 0;
  const holidays = start && end ? holidaysBetween(start, end).filter((h) => h.date.getDay() !== 0 && h.date.getDay() !== 6) : [];
  const ready = Boolean(start && end) && (kind === 'ferias' ? days > 0 : Boolean(photo));
  const missing = !start ? 'Escolha a data no calendário.'
    : kind === 'ferias' && days <= 0 ? 'Escolha dias úteis (sem fins de semana nem feriados).'
    : kind === 'baixa' && !photo ? 'Falta a foto do certificado de baixa.'
    : '';

  return (
    <>
      <BackLink label="Pedidos" onPress={onBack} />
      <Title>Novo pedido</Title>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([['ferias', 'Férias', SunIcon], ['baixa', 'Baixa médica', MedicalIcon]] as const).map(([value, label, Icon]) => {
          const active = kind === value;
          return (
            <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => { setKind(value); setError(''); }}
              style={{ flex: 1, minHeight: 72, borderRadius: 14, borderWidth: 1.5, borderColor: active ? colors.action : colors.line, backgroundColor: active ? colors.actionSoft : colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8 }}>
              <Icon size={22} color={active ? colors.action : colors.ink2} />
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12.5, color: active ? colors.action : colors.ink2 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <DateBox label="De" value={start} active={picking === 'start'} onPress={() => setPicking('start')} />
        <DateBox label="Até" value={end} active={picking === 'end'} onPress={() => setPicking('end')} />
      </View>
      <Card style={{ padding: 12 }}>
        <MonthHeader month={month} onMove={(delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))} />
        <MonthGrid month={month} classes={classes} today={today} selected={{ start, end }} onDay={pick} />
      </Card>

      {start && end && kind === 'ferias' ? (
        <View style={{ backgroundColor: colors.actionSoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.action }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 18 }}>{days} dia{days === 1 ? '' : 's'} út{days === 1 ? 'il' : 'eis'}</Text>
            {holidays.length ? ` · ${holidays.map((h) => `${h.date.getDate()} ${MONTHS[h.date.getMonth()]}`).join(', ')} ${holidays.length > 1 ? 'são feriados e não contam' : 'é feriado e não conta'}.` : ' · sem fins de semana nem feriados.'}
          </Text>
        </View>
      ) : null}

      {kind === 'baixa' ? (
        <>
          <Toggle flat title="Ainda não sei a data de fim" subtitle="O gestor acrescenta-a quando souber" value={noEnd} onChange={setNoEnd} />
          <Field label="Nota para o gestor (opcional)" value={note} onChangeText={setNote} placeholder="Ex.: consulta e repouso" />
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink2 }}>Foto do certificado</Text>
            {photo ? (
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Image source={{ uri: photo.uri }} style={{ width: 64, height: 64, borderRadius: 10 }} />
                <Button link title="Trocar foto" onPress={() => takePhoto(true)} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Button ghost icon={<CameraIcon size={20} color={colors.action} />} title="Tirar foto" onPress={() => takePhoto(true)} /></View>
                <View style={{ flex: 1 }}><Button ghost title="Escolher" onPress={() => takePhoto(false)} /></View>
              </View>
            )}
          </View>
        </>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button primary title={sending ? 'A enviar…' : 'Enviar pedido'} busy={sending} disabled={!ready} onPress={send} />
      {!ready && missing ? <Muted size={13} center>{missing}</Muted> : null}
    </>
  );
}

function DateBox({ label, value, active, onPress }: { label: string; value?: Date; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flex: 1, gap: 4 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink2 }}>{label}</Text>
      <View style={{ minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: active ? colors.action : colors.line, backgroundColor: colors.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: value ? colors.ink : colors.ink3 }}>{value ? short(value) : 'Escolher'}</Text>
        <Text style={{ color: colors.ink3 }}>›</Text>
      </View>
    </Pressable>
  );
}
