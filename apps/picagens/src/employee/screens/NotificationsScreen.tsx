// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Separador «Notificações» (artboards p2311-notificacoes e p2311-skeleton-notificacoes, aprovados 24/11): «Por resolver»
// (documentos e contratos por assinar, saída em falta, registos por confirmar, mensagens do RH) e «Anteriores». Os
// itens vêm do servidor, do mesmo serviço da PWA; cada um diz para onde leva (`destino`) e o ecrã só navega.
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarIcon, CheckSquareIcon, ClockIcon, DocumentIcon, MailIcon, OkIcon, PenIcon } from '../../components/icons';
import { Bloco } from '../../components/Skeleton';
import { Logo } from '../../components/ui';
import { colors, fonts } from '../../theme';
import { NotificationItem, NotificationKind, Notifications, employeeApi } from '../api';
import { Avatar, AvatarPhoto, ErrorText } from '../ui';

const ICON_SIZE = 22;
const ICONS: Record<NotificationKind, (color: string) => ReactNode> = {
  assinar: (c) => <PenIcon size={ICON_SIZE} color={c} />,
  saida: (c) => <ClockIcon size={ICON_SIZE} color={c} />,
  vistos: (c) => <CheckSquareIcon size={ICON_SIZE} color={c} />,
  mensagem: (c) => <MailIcon size={ICON_SIZE} color={c} />,
  assinado: (c) => <DocumentIcon size={ICON_SIZE} color={c} />,
  ferias: (c) => <CalendarIcon size={ICON_SIZE} color={c} />,
};

interface Props {
  token: string;
  name: string;
  photo: AvatarPhoto | null;
  onProfile: () => void;
  onOpen: (item: NotificationItem) => void;
  /** Depois de marcar todas como lidas: atualiza a etiqueta do separador. */
  onChanged: () => void;
  onAuthError: (error: unknown) => boolean;
}

export function NotificationsScreen({ token, name, photo, onProfile, onOpen, onChanged, onAuthError }: Props) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Notifications | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await employeeApi.notifications(token));
      setError('');
    } catch (exc) {
      if (!onAuthError(exc)) setError('Sem ligação. Puxe para baixo para tentar de novo.');
    }
  }, [token, onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  async function readAll() {
    try {
      await employeeApi.readAllMessages(token);
      await load();
      onChanged();
    } catch (exc) {
      if (!onAuthError(exc)) setError('Não foi possível marcar como lidas. Tente de novo.');
    }
  }

  const pending = data?.por_resolver ?? [];
  const previous = data?.anteriores ?? [];
  const hasMessages = pending.some((item) => item.tipo === 'mensagem');

  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo height={26} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }}>{name.split(/\s+/)[0]}</Text>
            <Avatar name={name} count={0} onPress={onProfile} photo={photo} size={36} />
          </View>
        </View>
        <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 27, color: colors.ink }}>Notificações</Text>
          {hasMessages ? (
            <Pressable accessibilityRole="button" onPress={readAll} hitSlop={6} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.action, textDecorationLine: 'underline' }}>Marcar todas como lidas</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {!data && !error ? <NotificationsSkeleton /> : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 120, gap: 6 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} colors={[colors.action]} />}
        >
          {error ? <ErrorText>{error}</ErrorText> : null}
          {data && !pending.length ? (
            <View style={{ alignItems: 'center', gap: 12, paddingTop: 60, paddingHorizontal: 12 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.okIconBg, alignItems: 'center', justifyContent: 'center' }}>
                <OkIcon size={30} color={colors.ok} />
              </View>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink }}>Tudo em dia</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink2, textAlign: 'center' }}>Não tem nada por resolver. Quando houver um aviso, aparece aqui.</Text>
            </View>
          ) : null}
          {pending.length ? <Text style={sectionStyle}>Por resolver · {pending.length}</Text> : null}
          {pending.map((item, index) => <Row key={`p${index}`} item={item} onOpen={onOpen} />)}
          {previous.length ? <Text style={sectionStyle}>Anteriores</Text> : null}
          {previous.map((item, index) => <Row key={`a${index}`} item={item} onOpen={onOpen} />)}
        </ScrollView>
      )}
    </View>
  );
}

const sectionStyle = { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink2, marginTop: 10, marginBottom: 2 } as const;

function Row({ item, onOpen }: { item: NotificationItem; onOpen: (item: NotificationItem) => void }) {
  const primary = item.acao === 'Assinar';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ width: 24, alignItems: 'center' }}>{ICONS[item.tipo](colors.band)}</View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, flexShrink: 1 }}>{item.titulo}</Text>
          {item.novo ? (
            <View style={{ backgroundColor: colors.warnIconBg, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.warnIconInk }}>Novo</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink3, marginTop: 2 }}>{item.sub}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.acao}: ${item.titulo}`}
        onPress={() => onOpen(item)}
        style={({ pressed }) => ({
          minHeight: 44, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
          borderColor: primary ? colors.ok : colors.band, backgroundColor: primary ? colors.ok : colors.surface, transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: primary ? colors.surface : colors.band }}>{item.acao}</Text>
      </Pressable>
    </View>
  );
}

/** Notificações a carregar (artboard p2311-skeleton-notificacoes): duas secções de linhas em bloco. */
function NotificationsSkeleton() {
  const row = (key: string) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Bloco style={{ width: 24, height: 24, borderRadius: 12 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <Bloco style={{ height: 14, width: '70%' }} />
        <Bloco style={{ height: 11, width: '50%' }} />
      </View>
      <Bloco style={{ width: 84, height: 36, borderRadius: 12 }} />
    </View>
  );
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="A carregar notificações" accessibilityLiveRegion="polite" style={{ paddingHorizontal: 20, paddingTop: 14 }}>
      <Bloco style={{ height: 14, width: 120, marginTop: 10, marginBottom: 2 }} />
      {[0, 1, 2, 3].map((i) => row(`a${i}`))}
      <Bloco style={{ height: 14, width: 110, marginTop: 14, marginBottom: 2 }} />
      {[0, 1].map((i) => row(`b${i}`))}
    </View>
  );
}
