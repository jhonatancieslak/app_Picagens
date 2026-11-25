// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Licença suspensa, versão desatualizada e bloqueio temporário por PINs errados (artboard p2311-quiosque-tablet n.º 7).
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { LockIcon } from '../../components/icons';
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

const mmss = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/** Muitos PINs errados neste tablet: contagem do tempo de espera e, no canto, «Picar outro colaborador» (volta ao início,
 * onde o servidor volta a dizer se ainda há bloqueio). Acabada a contagem, volta sozinho ao início. */
export function LockedScreen({ minutes, onOther }: { minutes: number; onOther: () => void }) {
  const vw = useVw();
  const [left, setLeft] = useState(Math.max(minutes, 1) * 60);
  useEffect(() => {
    const timer = setInterval(() => setLeft((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (left <= 0) onOther();
  }, [left, onOther]);
  return (
    <View accessibilityLiveRegion="polite" style={{ flex: 1, backgroundColor: colors.band, alignItems: 'center', justifyContent: 'center', gap: vw(1.2), paddingHorizontal: vw(6) }}>
      <Pressable accessibilityRole="button" onPress={onOther}
        style={{ position: 'absolute', top: vw(2.2), right: vw(2.2), flexDirection: 'row', alignItems: 'center', gap: vw(1), paddingVertical: vw(1.2), paddingHorizontal: vw(1.8), borderRadius: 999, backgroundColor: colors.surface }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.6), color: colors.band }}>Picar outro colaborador</Text>
      </Pressable>
      <View style={{ width: vw(11.3), height: vw(11.3), borderRadius: vw(5.65), backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <LockIcon size={vw(5)} color={colors.band} />
      </View>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(3.3), color: colors.surface }}>Muitas tentativas</Text>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: vw(1.95), lineHeight: vw(2.8), color: colors.surface, textAlign: 'center', maxWidth: vw(70) }}>
        Foram digitados PINs errados demasiadas vezes neste tablet. Aguarde e tente de novo.
      </Text>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(6.2), color: colors.surface, letterSpacing: -1, fontVariant: ['tabular-nums'] }}>{mmss(Math.max(left, 0))}</Text>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: vw(1.55), color: colors.surface, opacity: 0.8 }}>Tempo de espera</Text>
    </View>
  );
}
