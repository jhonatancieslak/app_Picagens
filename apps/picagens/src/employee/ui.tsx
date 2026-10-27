// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Peças do modo colaborador (telemóvel, vertical). Medidas e cores do protótipo v6 aprovado (doc 49).
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShieldCheckIcon } from '../components/icons';
import { Logo } from '../components/ui';
import { colors, fonts } from '../theme';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18 }, style]}>
      {children}
    </View>
  );
}

export type ChipTone = 'ok' | 'warn' | 'danger' | 'neutral' | 'info' | 'action' | 'hol';

const CHIP_COLORS: Record<ChipTone, { bg: string; fg: string }> = {
  ok: { bg: colors.okSoft, fg: colors.ok },
  warn: { bg: colors.warnSoft, fg: colors.warnInk },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  neutral: { bg: '#EEF1F5', fg: colors.ink2 },
  info: { bg: colors.infoSoft, fg: colors.info },
  action: { bg: colors.actionSoft, fg: colors.action },
  hol: { bg: colors.holSoft, fg: colors.hol },
};

export function Chip({ tone, label }: { tone: ChipTone; label: string }) {
  const palette = CHIP_COLORS[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: palette.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
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
  ghost?: boolean;
  link?: boolean;
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

/** Botões do protótipo: .btn (azul), .btn.ghost (branco com texto azul), .btn.link (só texto). */
export function Button({ title, onPress, primary, danger, ghost, link, busy, disabled, icon }: ButtonProps) {
  const solid = primary || (!ghost && !link && !danger);
  const background = link ? 'transparent' : solid ? colors.action : colors.surface;
  const foreground = solid ? '#fff' : danger ? colors.danger : colors.action;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => ({
        minHeight: link ? 44 : 52,
        borderRadius: 16,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        backgroundColor: background,
        borderWidth: !solid && !link ? 1 : 0,
        borderColor: colors.line,
        opacity: disabled ? 0.55 : 1,
        transform: [{ scale: pressed && !link ? 0.97 : 1 }],
      })}
    >
      {busy ? <ActivityIndicator color={foreground} size="small" /> : icon}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: foreground }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink2 }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.ink3}
        accessibilityLabel={label}
        {...input}
        style={{ minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink }}
      />
      {hint ? <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3 }}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorText({ children }: { children: string }) {
  if (!children) return null;
  return <Text accessibilityRole="alert" style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.danger, minHeight: 18 }}>{children}</Text>;
}

export function Title({ children, size = 26 }: { children: ReactNode; size?: number }) {
  return <Text style={{ fontFamily: fonts.display, fontSize: size, color: colors.ink, letterSpacing: -0.5, lineHeight: size * 1.1 }}>{children}</Text>;
}

export function Muted({ children, size = 14, center }: { children: ReactNode; size?: number; center?: boolean }) {
  return <Text style={{ fontFamily: fonts.body, fontSize: size, color: colors.ink2, lineHeight: size * 1.45, textAlign: center ? 'center' : 'left' }}>{children}</Text>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3, textAlign: 'center' }}>{children}</Text>;
}

/** "‹ Voltar" no topo dos ecrãs secundários. */
export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.action }}>‹ {label}</Text>
    </Pressable>
  );
}

/** Título de secção em maiúsculas (".sec"), com contador ou texto à direita. */
export function Section({ title, right, count }: { title: string; right?: string; count?: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginHorizontal: 2, marginBottom: -4 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink3, letterSpacing: 0.7, textTransform: 'uppercase' }}>{title}</Text>
      {count ? (
        <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: '#fff' }}>{count}</Text>
        </View>
      ) : right ? (
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink3, letterSpacing: 0.7, textTransform: 'uppercase' }}>{right}</Text>
      ) : null}
    </View>
  );
}

/** Linha de lista dentro de um Card (".row"). */
export function Row({ title, subtitle, left, right, first, onPress }: { title: string; subtitle?: string; left?: ReactNode; right?: ReactNode; first?: boolean; onPress?: () => void }) {
  const content = (
    <>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink }}>{title}</Text>
        {subtitle ? <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink2 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </>
  );
  const style: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 58, borderTopWidth: first ? 0 : 1, borderColor: colors.line };
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, pressed && { backgroundColor: colors.bg }]}>
      {content}
    </Pressable>
  );
}

/** Interruptor com título e explicação (".toggle"). */
export function Toggle({ title, subtitle, value, onChange, flat }: { title: string; subtitle?: string; value: boolean; onChange: (value: boolean) => void; flat?: boolean }) {
  const knob = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(knob, { toValue: value ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [value, knob]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.surface, borderWidth: flat ? 0 : 1, borderColor: colors.line, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }}>{title}</Text>
        {subtitle ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.ink2 }}>{subtitle}</Text> : null}
      </View>
      <Animated.View style={{ width: 46, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: knob.interpolate({ inputRange: [0, 1], outputRange: [colors.line, colors.ok] }) }}>
        <Animated.View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', elevation: 2, transform: [{ translateX: knob.interpolate({ inputRange: [0, 1], outputRange: [3, 21] }) }] }} />
      </Animated.View>
    </Pressable>
  );
}

/** Teclado numérico do ecrã (".npad"): 1-9, 0 e apagar. */
export function NumPad({ onKey }: { onKey: (key: string) => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
      {keys.map((key, index) => (
        <Pressable
          key={`${key}-${index}`}
          disabled={!key}
          accessibilityRole="button"
          accessibilityLabel={key === '⌫' ? 'Apagar' : key}
          onPress={() => onKey(key)}
          style={({ pressed }) => ({
            width: '31.6%', height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            backgroundColor: key ? colors.surface : 'transparent', borderWidth: key ? 1 : 0, borderColor: colors.line,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          })}
        >
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: key === '⌫' ? 15 : 19, color: key === '⌫' ? colors.ink3 : colors.ink }}>{key}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Aplica uma tecla do NumPad a um texto com tamanho máximo. */
export const applyKey = (value: string, key: string, max: number) => (key === '⌫' ? value.slice(0, -1) : value.length < max ? value + key : value);

/** Células do código (".otp"): 6 caixas, a preenchida fica com borda azul. */
export function OtpCells({ value, length = 6 }: { value: string; length?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 7 }} accessibilityLabel={`${value.length} de ${length} algarismos`}>
      {Array.from({ length }, (_, index) => (
        <View key={index} style={{ flex: 1, aspectRatio: 0.85, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: index < value.length ? colors.action : colors.line, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.ink }}>{value[index] ?? ''}</Text>
        </View>
      ))}
    </View>
  );
}

/** Campo "falso" que mostra o valor escrito no NumPad (".inp"); tocar escolhe-o. */
export function PadField({ label, value, placeholder, active, error, onPress }: { label: string; value: string; placeholder: string; active: boolean; error?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ gap: 4 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink2 }}>{label}</Text>
      <View style={{ minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: error ? colors.danger : active ? colors.action : colors.line, backgroundColor: colors.surface, paddingHorizontal: 12, justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, letterSpacing: 0.9, color: value ? colors.ink : colors.ink3 }}>{value || placeholder}</Text>
      </View>
    </Pressable>
  );
}

/** Avatar com iniciais e contador vermelho de avisos. */
/** Foto de perfil como data URI: o <Image> do Android não enviava o cabeçalho Authorization (401 na 2.3.0). */
export interface AvatarPhoto {
  uri: string;
}

export function Avatar({ name, count, onPress, size = 38, photo }: { name: string; count: number; onPress?: () => void; size?: number; photo?: AvatarPhoto | null }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join('');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={count ? `Perfil, ${count} avisos` : 'Perfil'} onPress={onPress} disabled={!onPress} hitSlop={8}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {photo ? <Image source={photo} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
          : <Text style={{ fontFamily: fonts.bodyBold, fontSize: size * 0.34, color: colors.action }}>{initials}</Text>}
      </View>
      {count ? (
        <View style={{ position: 'absolute', top: -5, right: -6, minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10.5, color: '#fff' }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Cabeçalho dos separadores (".hd"): logótipo (Hoje) ou ícone, subtítulo, título grande e saudação. */
export function Header({ subtitle, title, right, wordmark, greeting }: { subtitle: string; title: string; right?: ReactNode; wordmark?: boolean; greeting?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, paddingTop: 2 }}>
      <View style={{ flex: 1 }}>
        {wordmark ? <Logo height={34} /> : null}
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink2, marginTop: wordmark ? 10 : 0 }}>{subtitle}</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 32, color: colors.ink, letterSpacing: -1, lineHeight: 34, marginTop: 6 }}>{title}</Text>
        {greeting ? <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink2, marginTop: 6 }}>{greeting}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export type ToastTone = 'ok' | 'queued' | 'err';
export interface ToastMessage { tone: ToastTone; title: string; text?: string; icon?: ReactNode }

const TOAST_COLORS: Record<ToastTone, string> = { ok: colors.ok, queued: colors.warn, err: colors.danger };
const TOAST_MS = 2600;

/** Aviso que desce do topo (".toast") e some sozinho. */
export function useToast() {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const offset = useRef(new Animated.Value(-160)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((next: ToastMessage) => {
    setMessage(next);
    if (timer.current) clearTimeout(timer.current);
    Animated.spring(offset, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
    timer.current = setTimeout(() => Animated.timing(offset, { toValue: -160, duration: 250, useNativeDriver: true }).start(), TOAST_MS);
  }, [offset]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const node = message ? (
    <Animated.View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={{
        position: 'absolute', left: 14, right: 14, top: insets.top + 8, zIndex: 20, borderRadius: 16, padding: 14,
        flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: TOAST_COLORS[message.tone],
        shadowColor: '#101828', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8,
        transform: [{ translateY: offset }],
      }}
    >
      {message.icon}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15.5, color: '#fff' }}>{message.title}</Text>
        {message.text ? <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: 'rgba(255,255,255,.92)' }}>{message.text}</Text> : null}
      </View>
    </Animated.View>
  ) : null;

  return { show, node };
}

/** Entrada suave dos ecrãs (".body.anim"): sobe 8 dp e aparece. */
export function FadeIn({ children, deps }: { children: ReactNode; deps: unknown }) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    value.setValue(0);
    Animated.timing(value, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [deps, value]);
  return (
    <Animated.View style={{ flex: 1, opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

/** Ecrã de sucesso (".hero-ok"): círculo verde com visto, título e texto. */
export function HeroOk({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  }, [scale]);
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingTop: 18, paddingHorizontal: 6, paddingBottom: 6 }}>
      <Animated.View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.okSoft, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
        {icon}
      </Animated.View>
      <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink, letterSpacing: -0.5, marginTop: 4 }}>{title}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.ink2, textAlign: 'center', maxWidth: 280 }}>{text}</Text>
    </View>
  );
}

/** Linha de garantia com visto verde (ecrãs que explicam antes de pedir uma permissão: localização, rosto). */
export function Fact({ title, children, divider }: { title: string; children: ReactNode; divider?: boolean }) {
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
