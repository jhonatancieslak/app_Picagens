// Peças visuais do separador do chefe, iguais aos artboards aprovados (canvas 24/11: «Pedidos» e «Hoje» do chefe).
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const CHEFE = { faixa: '#243746', fundo: '#FAF8F4', borda: '#E6E2D9', verde: '#1E7A45', vermelho: '#8F2A20', ambar: '#7A4A07', ambarFundo: '#FCEFD9', cinza: '#55657A', pilula: '#EEF1F5', avatar: '#E4EAF0' };

export function CabecalhoChefe({ titulo, subtitulo, onVoltar }: { titulo: string; subtitulo?: string; onVoltar: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: CHEFE.faixa, paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 18, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}>
      <Pressable onPress={onVoltar} accessibilityRole="button" accessibilityLabel="Voltar"
        style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M15 6l-6 6 6 6" />
        </Svg>
      </Pressable>
      <Text style={{ marginTop: 14, fontFamily: 'Inter_700Bold', fontSize: 24, color: '#FFFFFF' }}>{titulo}</Text>
      {subtitulo ? <Text style={{ marginTop: 4, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#D5DEE5' }}>{subtitulo}</Text> : null}
    </View>
  );
}

export function IniciaisAvatar({ nome }: { nome: string }) {
  const iniciais = nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: CHEFE.avatar, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: CHEFE.faixa }}>{iniciais}</Text>
    </View>
  );
}

export function Pilula({ texto, ambar = false }: { texto: string; ambar?: boolean }) {
  return (
    <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: ambar ? CHEFE.ambarFundo : CHEFE.pilula }}>
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: ambar ? CHEFE.ambar : CHEFE.cinza }}>{texto}</Text>
    </View>
  );
}

export function CartaoChefe({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, gap: 10, shadowColor: '#243746', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 }}>
      {children}
    </View>
  );
}
