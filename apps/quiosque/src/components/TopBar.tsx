// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Barra de topo: um só logótipo Picagens, empresa e local, estado da rede e acesso ao admin.
import { Pressable, Text, View } from 'react-native';

import { colors, fonts } from '../theme';
import { GearIcon } from './icons';
import { Logo, useVw } from './ui';

interface Props {
  company: string;
  place: string | null;
  online: boolean;
  onAdmin?: () => void;
}

const initials = (name: string) =>
  name.split(/\s+/).filter((word) => word.length > 2).slice(0, 2).map((word) => word[0].toUpperCase()).join('') || name.slice(0, 2).toUpperCase();

export function TopBar({ company, place, online, onAdmin }: Props) {
  const vw = useVw();
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: vw(2.8), paddingVertical: vw(2), zIndex: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: vw(1.4) }}>
        <Logo height={vw(3.4)} />
        <View style={{ width: 1, height: vw(2.6), backgroundColor: colors.line }} />
        <View style={{ width: vw(3.6), height: vw(3.6), borderRadius: vw(1), backgroundColor: '#0F5132', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: vw(1.3) }}>{initials(company)}</Text>
        </View>
        <View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.6), color: colors.ink }}>{company}</Text>
          {place ? <Text style={{ fontFamily: fonts.body, fontSize: vw(1.3), color: colors.ink2 }}>{place}</Text> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: vw(1) }}>
        <View
          accessibilityLabel={online ? 'Ligado à internet' : 'Sem rede, as picagens ficam guardadas'}
          style={{ flexDirection: 'row', alignItems: 'center', gap: vw(0.7), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: vw(1.2), paddingVertical: vw(0.6), borderRadius: 999 }}
        >
          <View style={{ width: vw(0.9), height: vw(0.9), borderRadius: 99, backgroundColor: online ? colors.ok : colors.warn }} />
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: vw(1.45), color: colors.ink2 }}>{online ? 'Ligado' : 'Sem rede · guarda'}</Text>
        </View>
        {onAdmin ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Administração"
            onPress={onAdmin}
            style={{ width: vw(4.2), height: vw(4.2), borderRadius: vw(1.2), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
          >
            <GearIcon size={vw(2.2)} color={colors.ink2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
