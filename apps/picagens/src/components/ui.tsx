// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Peças comuns (desenhadas para o quiosque). Medidas em percentagem da largura (vw), como no protótipo, para o mesmo
// desenho servir tablets de 8" a 13".
import { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, fonts, radius } from '../theme';

export function useVw() {
  const { width } = useWindowDimensions();
  return (value: number) => (width * value) / 100;
}

export function Logo({ height, white = false }: { height: number; white?: boolean }) {
  const source = white ? require('../../assets/logo-white.png') : require('../../assets/logo-color.png');
  return <Image source={source} style={{ height, width: height * (1298 / 278) }} resizeMode="contain" accessibilityLabel="Picagens.pt" />;
}

interface BigButtonProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  primary?: boolean;
  small?: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function BigButton({ title, subtitle, icon, primary, small, onPress, disabled }: BigButtonProps) {
  const vw = useVw();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.bigButton,
        { padding: vw(small ? 1.4 : 2.3), gap: vw(2), borderRadius: vw(2) },
        primary && styles.bigButtonPrimary,
        (pressed || disabled) && { opacity: 0.75 },
      ]}
    >
      {icon ? (
        <View style={[styles.bigIcon, { width: vw(6), height: vw(6), borderRadius: vw(1.6) }, primary && styles.bigIconPrimary]}>{icon}</View>
      ) : null}
      <View style={{ flexShrink: 1 }}>
        <Text style={[styles.bigTitle, { fontSize: vw(small ? 1.8 : 2.5) }, primary && { color: '#fff' }]}>{title}</Text>
        {subtitle ? <Text style={[styles.bigSubtitle, { fontSize: vw(1.45) }, primary && { color: 'rgba(255,255,255,.85)' }]}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  const vw = useVw();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={12}>
      <Text style={{ color: colors.action, fontFamily: fonts.bodyMedium, fontSize: vw(1.6) }}>{title}</Text>
    </Pressable>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'ok'];

export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  const vw = useVw();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: vw(9.2) * 3 + vw(1.1) * 2, gap: vw(1.1) }}>
      {KEYS.map((key) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={key === 'clear' ? 'Limpar' : key === 'ok' ? 'Confirmar' : key}
          onPress={() => onKey(key)}
          style={({ pressed }) => [
            styles.key,
            { width: vw(9.2), height: vw(8), borderRadius: vw(1.8) },
            key === 'ok' && { backgroundColor: colors.ok, borderColor: colors.ok },
            pressed && { transform: [{ translateY: 2 }], opacity: 0.85 },
          ]}
        >
          <Text
            style={{
              fontFamily: key.length > 1 ? fonts.bodyBold : fonts.bodyMedium,
              fontSize: vw(key.length > 1 ? 1.8 : 3.2),
              color: key === 'ok' ? '#fff' : key === 'clear' ? colors.ink2 : colors.ink,
            }}
          >
            {key === 'clear' ? 'Limpar' : key === 'ok' ? 'OK' : key}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Dots({ length, filled, error }: { length: number; filled: number; error?: boolean }) {
  const vw = useVw();
  return (
    <View style={{ flexDirection: 'row', gap: vw(1.3), marginVertical: vw(0.8) }} accessibilityLabel={`${filled} de ${length} algarismos`}>
      {Array.from({ length }, (_, index) => (
        <View
          key={index}
          style={{
            width: vw(2.3),
            height: vw(2.3),
            borderRadius: vw(2),
            borderWidth: 2.5,
            borderColor: error ? colors.danger : index < filled ? colors.band : colors.line,
            backgroundColor: index < filled ? (error ? colors.danger : colors.band) : colors.surface,
          }}
        />
      ))}
    </View>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const vw = useVw();
  return <Text style={{ fontFamily: fonts.display, fontSize: vw(3.6), color: colors.ink, letterSpacing: -0.5 }}>{children}</Text>;
}

export function Paragraph({ children, color = colors.ink2 }: { children: ReactNode; color?: string }) {
  const vw = useVw();
  return <Text style={{ fontFamily: fonts.body, fontSize: vw(1.65), color, lineHeight: vw(2.3) }}>{children}</Text>;
}

export function Notice({ tone, children }: { tone: 'warn' | 'info'; children: ReactNode }) {
  const vw = useVw();
  const palette = tone === 'warn' ? { bg: colors.warnSoft, fg: colors.warn } : { bg: colors.infoSoft, fg: colors.info };
  return (
    <View style={{ backgroundColor: palette.bg, borderRadius: vw(1.6), padding: vw(1.4) }}>
      <Text style={{ color: palette.fg, fontFamily: fonts.bodyMedium, fontSize: vw(1.5) }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bigButtonPrimary: { backgroundColor: colors.action, borderColor: colors.action },
  bigIcon: { backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center' },
  bigIconPrimary: { backgroundColor: 'rgba(255,255,255,.18)' },
  bigTitle: { fontFamily: fonts.bodyBold, color: colors.ink },
  bigSubtitle: { fontFamily: fonts.body, color: colors.ink2 },
  key: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
  },
});

export { radius };

/** Botão discreto no canto superior direito: "Quiosque" no login do telemóvel e "Sou colaborador" no tablet (doc 49). */
export function CornerButton({ label, icon, onPress, top }: { label: string; icon: ReactNode; onPress: () => void; top: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({
        position: 'absolute', top, right: 14, zIndex: 5, flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line,
        backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {icon}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink2 }}>{label}</Text>
    </Pressable>
  );
}
