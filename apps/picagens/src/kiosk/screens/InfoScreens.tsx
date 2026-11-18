// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Licença suspensa e versão desatualizada.
import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { BigButton, Heading, LinkButton, Logo, Paragraph, useVw } from '../../components/ui';
import { DEFAULT_UPDATE_URL } from '../../update';
import { colors, fonts } from '../../theme';

export function SuspendedScreen({ onAdmin }: { onAdmin: () => void }) {
  const vw = useVw();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: vw(1.6), padding: vw(4) }}>
      <Logo height={vw(6)} />
      <Text style={{ fontFamily: fonts.display, fontSize: vw(5), color: colors.ink3 }}>
        {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
      </Text>
      <Heading>Picagem suspensa</Heading>
      <Paragraph>O acesso da empresa ao Picagens está suspenso. As picagens anteriores estão guardadas. Avise o responsável da obra.</Paragraph>
      <LinkButton title="Administração" onPress={onAdmin} />
    </View>
  );
}

/** Versão abaixo da mínima (HTTP 426). Enquanto a app é distribuída por APK, o botão descarrega a versão nova,
 * que se instala por cima da atual sem perder a sessão nem a configuração do tablet. */
export function UpdateRequiredScreen({ url }: { url?: string | null }) {
  const vw = useVw();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: vw(1.6), padding: vw(4) }}>
      <Logo height={vw(6)} />
      <Heading>Atualize a app</Heading>
      <Paragraph>Esta versão da app Picagens já não é suportada. Descarregue a versão nova: instala-se por cima desta, sem perder os seus dados.</Paragraph>
      <BigButton primary title="Descarregar a versão nova" onPress={() => Linking.openURL(url || DEFAULT_UPDATE_URL)} />
    </View>
  );
}
