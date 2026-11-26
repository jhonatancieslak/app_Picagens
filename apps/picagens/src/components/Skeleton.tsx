// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Skeleton único da app (artboards p2311-hoje-skeleton e p2311-skeleton-*, aprovados 24/11): blocos cinzentos com brilho
// suave enquanto os dados chegam. O brilho fica parado com «reduzir movimento» ativo no telemóvel. Só tokens.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';
import { Logo } from './ui';

const BRILHO_MS = 1400;
const BRILHO_MAXIMO = 0.5;

function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduzido).catch(() => undefined);
  }, []);
  return reduzido;
}

/** Bloco a carregar. `sobreFaixa`: versão translúcida para a faixa escura do cabeçalho. */
export function Bloco({ style, sobreFaixa, escuro }: { style?: ViewStyle; sobreFaixa?: boolean; escuro?: boolean }) {
  const reduzido = useMovimentoReduzido();
  const brilho = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduzido) { brilho.setValue(0); return; }
    const volta = Animated.loop(Animated.sequence([
      Animated.timing(brilho, { toValue: 1, duration: BRILHO_MS / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(brilho, { toValue: 0, duration: BRILHO_MS / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    volta.start();
    return () => volta.stop();
  }, [reduzido, brilho]);

  const fundo = sobreFaixa ? colors.bandBlock : escuro ? colors.skeletonDark : colors.skeleton;
  return (
    <View style={[{ backgroundColor: fundo, borderRadius: 10, overflow: 'hidden' }, style]}>
      <Animated.View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.surface, opacity: brilho.interpolate({ inputRange: [0, 1], outputRange: [0, sobreFaixa ? BRILHO_MAXIMO * 0.5 : BRILHO_MAXIMO] }) }} />
    </View>
  );
}

/** Faixa escura do cabeçalho, igual à dos ecrãs já carregados: logótipo e o resto em blocos. */
export function FaixaSkeleton({ children }: { children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.surface, paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo height={26} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Bloco style={{ width: 52, height: 14, borderRadius: 7 }} />
          <Bloco style={{ width: 36, height: 36, borderRadius: 6 }} />
        </View>
      </View>
      {children}
    </View>
  );
}

/** Hoje a carregar (artboard p2311-hoje-skeleton): semana, relógio, mapa, cartão da semana e o botão de picar. */
export function HojeSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="A carregar o Hoje" accessibilityLiveRegion="polite" style={{ flex: 1, backgroundColor: colors.bg }}>
      <FaixaSkeleton>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
          {[0, 1, 2, 3, 4].map((i) => <Bloco key={i} sobreFaixa style={{ width: 40, height: 52 }} />)}
        </View>
      </FaixaSkeleton>
      <View style={{ alignItems: 'center', gap: 10, marginTop: 22 }}>
        <Bloco style={{ width: 170, height: 52 }} />
        <Bloco style={{ width: 210, height: 14 }} />
      </View>
      <Bloco style={{ marginHorizontal: 20, marginTop: 16, height: 112, borderRadius: 6 }} />
      <Bloco style={{ marginHorizontal: 20, marginTop: 12, height: 120, borderRadius: 6 }} />
      <Bloco style={{ marginHorizontal: 20, marginTop: 12, height: 52, borderRadius: 6 }} />
      <View style={{ flex: 1 }} />
      <View style={{ marginHorizontal: 20, marginBottom: 14, height: 66, borderRadius: 14, backgroundColor: colors.skeletonDark }} />
    </View>
  );
}

/** Corpo de cada ecrã a carregar (artboards p2311-skeleton-*): a faixa já é a verdadeira, aqui só o que ainda não chegou. */
const Aviso = ({ nome, children }: { nome: string; children: React.ReactNode }) => (
  <View accessibilityRole="progressbar" accessibilityLabel={`A carregar ${nome}`} accessibilityLiveRegion="polite">{children}</View>
);

export function RegistosSkeleton() {
  return (
    <Aviso nome="os registos">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Bloco style={{ width: 44, height: 44, borderRadius: 22 }} /><Bloco style={{ width: 170, height: 18 }} /><Bloco style={{ width: 44, height: 44, borderRadius: 22 }} />
      </View>
      <Bloco style={{ marginTop: 14, height: 72, borderRadius: 6 }} />
      <View style={{ marginTop: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 4 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
            <Bloco style={{ flex: 1, height: 34 }} /><Bloco style={{ width: 60, height: 18 }} />
          </View>
        ))}
      </View>
    </Aviso>
  );
}

export function PedidosSkeleton() {
  return (
    <Aviso nome="os pedidos">
      <Bloco style={{ height: 96, borderRadius: 6, backgroundColor: colors.skeletonDark }} />
      <Bloco style={{ marginTop: 14, height: 40, borderRadius: 12 }} />
      <View style={{ marginTop: 12, gap: 12 }}>{[0, 1, 2].map((i) => <Bloco key={i} style={{ height: 52 }} />)}</View>
    </Aviso>
  );
}

export function DocumentosSkeleton() {
  return (
    <Aviso nome="os documentos">
      <Bloco style={{ height: 92, borderRadius: 6, backgroundColor: colors.skeletonDark }} />
      <View style={{ marginTop: 14, gap: 12 }}>
        <Bloco style={{ height: 14, width: 110, borderRadius: 7 }} />
        <Bloco style={{ height: 64, borderRadius: 14 }} /><Bloco style={{ height: 64, borderRadius: 14 }} />
        <Bloco style={{ height: 14, width: 90, borderRadius: 7, marginTop: 6 }} />
        <Bloco style={{ height: 64, borderRadius: 14 }} /><Bloco style={{ height: 64, borderRadius: 14 }} />
      </View>
    </Aviso>
  );
}

export function RelatorioSkeleton() {
  return (
    <Aviso nome="o relatório">
      <Bloco style={{ height: 14, width: '55%', borderRadius: 7 }} />
      <Bloco style={{ marginTop: 12, height: 56, borderRadius: 14 }} />
      <Bloco style={{ marginTop: 14, height: 112, borderRadius: 6 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}><Bloco style={{ width: 140, height: 18 }} /><Bloco style={{ width: 60, height: 14 }} /></View>
      {[0, 1, 2].map((i) => <Bloco key={i} style={{ marginTop: i ? 10 : 12, height: 52, borderRadius: 12 }} />)}
    </Aviso>
  );
}

/** Lista a carregar (Mensagens, Equipa): três linhas em bloco, como nos artboards skeleton. */
export function ListaSkeleton({ linhas = 3 }: { linhas?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="A carregar" accessibilityLiveRegion="polite" style={{ gap: 12, marginTop: 4 }}>
      {Array.from({ length: linhas }, (_, i) => <Bloco key={i} style={{ height: 52, borderRadius: 14 }} />)}
    </View>
  );
}
