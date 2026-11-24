// Peças visuais do separador do chefe, iguais aos artboards aprovados (canvas 24/11: «Pedidos» e «Hoje» do chefe).
import { Text, View } from 'react-native';

export const CHEFE = { faixa: '#243746', fundo: '#FAF8F4', borda: '#E6E2D9', verde: '#1E7A45', vermelho: '#8F2A20', ambar: '#7A4A07', ambarFundo: '#FCEFD9', cinza: '#55657A', pilula: '#EEF1F5', avatar: '#E4EAF0' };

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
