// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Caixa de mensagens (2.3.0, doc 49 §14): o que o gestor escreveu a esta pessoa (ou a todos). Abrir uma mensagem
// marca-a como lida no servidor, e o painel mostra "Lida". Abre-se pelo sino de Hoje ou ao tocar numa notificação.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Illustration } from '../../components/Illustration';
import { colors, fonts } from '../../theme';
import { Message, employeeApi } from '../api';
import { BackLink, Card, Muted, Title } from '../ui';

interface Props {
  token: string;
  onBack: () => void;
  onRead: () => void;
  onAuthError: (error: unknown) => boolean;
}

export function MessagesScreen({ token, onBack, onRead, onAuthError }: Props) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setMessages((await employeeApi.messages(token)).mensagens);
      setError('');
    } catch (exc) {
      if (!onAuthError(exc)) setError('Sem ligação. Puxe para baixo para tentar de novo.');
    }
  }, [token, onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(message: Message) {
    setOpen(open === message.id ? null : message.id);
    if (message.lida) return;
    setMessages((current) => current?.map((m) => (m.id === message.id ? { ...m, lida: true } : m)) ?? null);
    try {
      await employeeApi.readMessage(token, message.id);
      onRead();
    } catch (exc) {
      onAuthError(exc);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 110, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} colors={[colors.action]} />}
    >
      <BackLink label="Hoje" onPress={onBack} />
      <Title>Mensagens</Title>
      {error ? <Muted>{error}</Muted> : null}
      {messages === null && !error ? <ActivityIndicator color={colors.action} /> : null}
      {messages && !messages.length ? (
        <View style={{ alignItems: 'center', gap: 8, paddingTop: 24 }}>
          <Illustration name="messages" width={210} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>Sem mensagens</Text>
          <Muted size={13.5} center>Quando a empresa lhe escrever, a mensagem aparece aqui e recebe um aviso no telemóvel.</Muted>
        </View>
      ) : null}
      {messages?.map((message) => (
        <Pressable key={message.id} accessibilityRole="button" accessibilityState={{ expanded: open === message.id }} onPress={() => toggle(message)}>
          <Card style={{ padding: 14, gap: 6, borderColor: message.lida ? colors.line : colors.action }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {!message.lida ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.action }} /> : null}
              <Text style={{ flex: 1, fontFamily: message.lida ? fonts.bodyMedium : fonts.bodyBold, fontSize: 15, color: colors.ink }}>{message.titulo}</Text>
            </View>
            <Muted size={12.5}>{message.de} · {message.data}</Muted>
            <Text style={{ fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink2 }} numberOfLines={open === message.id ? undefined : 2}>{message.texto}</Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
