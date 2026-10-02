// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Peças do modo colaborador (telemóvel, vertical). Medidas fixas em dp, como no protótipo v4 do doc 44.
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

import { colors, fonts } from '../theme';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 22, padding: 16 }, style]}>
      {children}
    </View>
  );
}

export type ChipTone = 'ok' | 'warn' | 'danger' | 'neutral' | 'info';

const CHIP_COLORS: Record<ChipTone, { bg: string; fg: string }> = {
  ok: { bg: colors.okSoft, fg: colors.ok },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  neutral: { bg: '#EEF1F5', fg: colors.ink2 },
  info: { bg: colors.infoSoft, fg: colors.info },
};

export function Chip({ tone, label }: { tone: ChipTone; label: string }) {
  const palette = CHIP_COLORS[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: palette.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.fg }} />
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: palette.fg }}>{label}</Text>
    </View>
  );
}

interface ButtonProps {
  title: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  busy?: boolean;
  disabled?: boolean;
}

export function Button({ title, onPress, primary, danger, busy, disabled }: ButtonProps) {
  const background = danger ? colors.danger : primary ? colors.action : colors.surface;
  const foreground = primary || danger ? '#fff' : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 16,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
        backgroundColor: background,
        borderWidth: primary || danger ? 0 : 1,
        borderColor: colors.line,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? <ActivityIndicator color={foreground} /> : null}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: foreground }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.ink3}
        accessibilityLabel={label}
        {...input}
        style={{ minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 16, color: colors.ink }}
      />
      {hint ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink3 }}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorText({ children }: { children: string }) {
  if (!children) return null;
  return <Text accessibilityRole="alert" style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.danger }}>{children}</Text>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.ink, letterSpacing: -0.5 }}>{children}</Text>;
}

export function Muted({ children, size = 14 }: { children: ReactNode; size?: number }) {
  return <Text style={{ fontFamily: fonts.body, fontSize: size, color: colors.ink2, lineHeight: size * 1.4 }}>{children}</Text>;
}

/** Avatar com iniciais e contador vermelho de avisos (doc 44 v4.1). */
export function Avatar({ name, count, onPress }: { name: string; count: number; onPress: () => void }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join('');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={count ? `Perfil, ${count} avisos` : 'Perfil'} onPress={onPress} hitSlop={8}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.action }}>{initials}</Text>
      </View>
      {count ? (
        <View style={{ position: 'absolute', top: -5, right: -6, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10.5, color: '#fff' }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
