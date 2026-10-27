// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Informação ao colaborador sobre a foto (RGPD art. 13.º), licença suspensa e versão desatualizada.
import { useEffect, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';

import { BigButton, Heading, LinkButton, Logo, Paragraph, useVw } from '../../components/ui';
import { DEFAULT_UPDATE_URL } from '../../update';
import { colors, fonts } from '../../theme';

export function PhotoInfoScreen({ company, retentionDays, face = false, onBack }: { company: string; retentionDays: number; face?: boolean; onBack: () => void }) {
  const vw = useVw();
  const rows: [string, string][] = [
    ['Para quê', 'Confirmar que quem picou é o dono do PIN. Evita picagens feitas por colegas.'],
    ['Reconhecimento facial', face
      ? 'Sim, só para confirmar a picagem. O tablet compara o rosto com um código cifrado registado por si; a fotografia não é guardada para isso e nada sai do tablet além do resultado.'
      : 'Não. A foto não é analisada por nenhum programa. Ninguém lê o seu rosto.'],
    ['Quem vê', 'Só o gestor da empresa, quando precisa de rever uma picagem. Não aparece no tablet.'],
    ['Quanto tempo', `${retentionDays} dias, guardada cifrada, depois é apagada. As horas da picagem ficam guardadas 5 anos, como manda a lei.`],
    ['Responsável', `${company} (a sua entidade empregadora). Picagens.pt trata os dados por conta dela.`],
    ['Os seus direitos', 'Pode pedir para ver as suas fotos e uma cópia dos seus dados ao RH da empresa.'],
  ];
  return (
    <ScrollView contentContainerStyle={{ paddingTop: vw(7.5), paddingHorizontal: vw(5), paddingBottom: vw(3), gap: vw(1.4) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: vw(1.6) }}>
        <LinkButton title="‹ Voltar" onPress={onBack} />
        <Heading>Porque é que o tablet tira uma foto?</Heading>
      </View>
      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: vw(1.8), padding: vw(2.2), gap: vw(1.1) }}>
        {rows.map(([label, text]) => (
          <View key={label} style={{ flexDirection: 'row', gap: vw(2.4) }}>
            <Text style={{ width: vw(22), fontFamily: fonts.bodyBold, fontSize: vw(1.55), color: colors.ink3 }}>{label}</Text>
            <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: vw(1.55), color: colors.ink }}>{text}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

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
