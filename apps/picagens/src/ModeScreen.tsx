// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// 1.º arranque: escolher se este dispositivo é o telemóvel do colaborador ou o tablet de quiosque da obra.
// Funciona nas duas orientações (o modo ainda não está escolhido, por isso a orientação está livre).
import { StatusBar } from 'expo-status-bar';
import { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeviceMode } from './deviceMode';
import { KeypadIcon, PhoneIcon } from './components/icons';
import { Logo } from './components/ui';
import { colors, fonts } from './theme';

const WIDE_LAYOUT_MIN_WIDTH = 720;

export function ModeScreen({ onChoose }: { onChoose: (mode: DeviceMode) => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= WIDE_LAYOUT_MIN_WIDTH;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 24 }}
    >
      <StatusBar style="dark" />
      <View style={{ alignItems: 'center', gap: 14 }}>
        <Logo height={44} />
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.ink, textAlign: 'center', letterSpacing: -0.4 }}>
          Este dispositivo é…
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink2, textAlign: 'center', maxWidth: 460 }}>
          Escolha uma vez. Para mudar depois é preciso terminar a sessão ou, no tablet, o código de administrador.
        </Text>
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14, alignSelf: 'center', width: '100%', maxWidth: wide ? 860 : 480 }}>
        <ModeCard
          icon={<PhoneIcon size={30} color={colors.action} />}
          title="O meu telemóvel"
          text="Sou colaborador: pico a entrada e a saída, vejo as minhas horas e os meus pedidos."
          action="Entrar como colaborador"
          onPress={() => onChoose('employee')}
        />
        <ModeCard
          icon={<KeypadIcon size={30} color={colors.action} />}
          title="Tablet da empresa (quiosque)"
          text="Fica na entrada da obra. Cada colaborador pica com o seu PIN e uma foto de confirmação."
          action="Configurar tablet"
          onPress={() => onChoose('kiosk')}
        />
      </View>
    </ScrollView>
  );
}

interface CardProps {
  icon: ReactNode;
  title: string;
  text: string;
  action: string;
  onPress: () => void;
}

function ModeCard({ icon, title, text, action, onPress }: CardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${action}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: pressed ? colors.action : colors.line,
        borderRadius: 22,
        padding: 20,
        gap: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink }}>{title}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink2, lineHeight: 21 }}>{text}</Text>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.action, marginTop: 4 }}>{action} ›</Text>
    </Pressable>
  );
}
