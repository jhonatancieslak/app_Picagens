// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Explica a localização ANTES do pedido do Android (artboard p2311-abertura n.º 10, aprovado 24/11): para quê, quando
// (só ao picar) e o que o gestor vê. Só aparece enquanto o Android ainda não perguntou. "Agora não" segue sem pedir.
import * as Location from 'expo-location';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { PinIcon } from '../../components/icons';
import { colors } from '../../theme';
import { BarraRodape, Button, Card, Fact, Header, Muted, Title } from '../ui';

export function LocationIntroScreen({ company, onDone }: { company: string; onDone: (granted: boolean) => void }) {
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header variante="faixaLogo" subtitle="" title="Localização" onVoltar={() => onDone(false)} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 22, gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center' }}>
          <PinIcon size={34} color={colors.band} />
        </View>
        <Title size={24}>Localização só no momento de picar</Title>
        <Muted size={14}>A {company} pede que confirme que está na obra quando pica. A seguir o Android pergunta se autoriza.</Muted>
        <Card>
          <Fact title="Só quando toca em Picar">Nunca em segundo plano nem com a app fechada.</Fact>
          <Fact title="Não segue o seu percurso" divider>Guarda um ponto por picagem, mais nada.</Fact>
          <Fact title="O gestor vê se estava no local" divider>Dentro ou fora, e a distância.</Fact>
        </Card>
      </ScrollView>
      <BarraRodape>
        <Button primary tone="verde" title="Continuar" busy={busy} onPress={allow} />
        <Button link tone="verde" title="Agora não" onPress={() => onDone(false)} />
      </BarraRodape>
    </View>
  );
}
