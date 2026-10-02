// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// "Perfil": avisos (saída em falta, visto, contrato), dados da sessão, versão e terminar sessão.
// Terminar sessão volta à escolha do modo (é por aqui que um telemóvel passa a quiosque).
import * as Application from 'expo-application';
import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '../../theme';
import { Me, Notice } from '../api';
import { Button, Card, Chip, Muted, Title } from '../ui';

const PWA_URL = (company: string) => `https://picagens.pt/app/colaborador/${company}/painel`;

interface Props {
  me: Me;
  notices: Notice[];
  pending: number;
  onRecords: () => void;
  onLogout: () => void;
}

export function ProfileScreen({ me, notices, pending, onRecords, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);

  function openNotice(notice: Notice) {
    if (notice.acao === 'registos') onRecords();
    else Linking.openURL(PWA_URL(me.empresa.slug));
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingTop: insets.top + 16, paddingBottom: 120, gap: 14 }}>
      <Title>Perfil</Title>
      <Card style={{ gap: 4 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: colors.ink }}>{me.colaborador.nome}</Text>
        <Muted>{me.empresa.nome}{me.local ? ` · ${me.local}` : ''}</Muted>
      </Card>

      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Avisos</Text>
      {notices.length ? (
        <Card style={{ padding: 0 }}>
          {notices.map((notice, index) => (
            <Text
              key={`${notice.tipo}-${notice.id ?? notice.data ?? index}`}
              accessibilityRole="button"
              onPress={() => openNotice(notice)}
              style={{ padding: 14, borderTopWidth: index ? 1 : 0, borderColor: colors.line }}
            >
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{notice.titulo}{'\n'}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink2 }}>{notice.detalhe} ›</Text>
            </Text>
          ))}
        </Card>
      ) : (
        <Muted>Sem avisos. Está tudo em dia.</Muted>
      )}

      {pending ? <Chip tone="warn" label={`${pending} picagem(ns) por enviar`} /> : null}

      <Card style={{ gap: 10 }}>
        <Muted size={13}>Pedidos de férias, correções, documentos e contratos: por agora na página da empresa.</Muted>
        <Button title="Abrir na página da empresa" onPress={() => Linking.openURL(PWA_URL(me.empresa.slug))} />
      </Card>

      {confirming ? (
        <Card style={{ gap: 10, borderColor: colors.danger }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>Terminar sessão neste telemóvel?</Text>
          <Muted size={13}>
            {pending ? `Atenção: ${pending} picagem(ns) ainda não foram enviadas e serão perdidas. Ligue-se à internet primeiro. ` : ''}
            Para voltar a entrar precisa do link do email ou do NIF e PIN.
          </Muted>
          <Button danger title="Terminar sessão" onPress={onLogout} />
          <Button title="Cancelar" onPress={() => setConfirming(false)} />
        </Card>
      ) : (
        <Button title="Terminar sessão" onPress={() => setConfirming(true)} />
      )}

      <View style={{ alignItems: 'center', paddingTop: 6 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.ink3 }}>
          Picagens {Application.nativeApplicationVersion} ({Application.nativeBuildVersion}) · modo colaborador
        </Text>
      </View>
    </ScrollView>
  );
}
