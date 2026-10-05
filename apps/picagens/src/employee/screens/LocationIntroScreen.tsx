// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Explica a localização ANTES do pedido do Android (protótipo v6, doc 49 §11): para quê, quando (só ao picar) e o
// que o gestor vê. Só aparece enquanto o Android ainda não perguntou. "Agora não" segue sem pedir.
import * as Location from 'expo-location';
import { ReactNode, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PinIcon, ShieldCheckIcon } from '../../components/icons';
import { colors, fonts } from '../../theme';
import { Button, Card, Muted, Title } from '../ui';

export function LocationIntroScreen({ company, onDone }: { company: string; onDone: (granted: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  async function allow() {
    setBusy(true);
    let granted = false;
    try {
      granted = (await Location.requestForegroundPermissionsAsync()).granted;
    } finally {
      setBusy(false);
      onDone(granted);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: insets.top + 30, paddingBottom: insets.bottom + 20, gap: 14 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center' }}>
        <PinIcon size={34} color={colors.action} />
      </View>
      <Title>Localização só no momento de picar</Title>
      <Muted size={14.5}>A {company} pede que confirme que está na obra quando pica. A seguir o Android pergunta se autoriza.</Muted>
      <Card>
        <Fact title="Só quando toca em Picar">Nunca em segundo plano nem com a app fechada.</Fact>
        <Fact title="Não segue o seu percurso" divider>Guarda um ponto por picagem, mais nada.</Fact>
        <Fact title="O gestor vê se estava no local" divider>Dentro ou fora, e a distância.</Fact>
      </Card>
      <View style={{ flex: 1 }} />
      <Button primary icon={<PinIcon size={20} color="#fff" />} title="Continuar" busy={busy} onPress={allow} />
      <Button link title="Agora não" onPress={() => onDone(false)} />
    </ScrollView>
  );
}

function Fact({ title, children, divider }: { title: string; children: ReactNode; divider?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: divider ? 1 : 0, borderTopColor: colors.line }}>
      <ShieldCheckIcon size={20} color={colors.ok} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: colors.ink2 }}>{children}</Text>
      </View>
    </View>
  );
}
