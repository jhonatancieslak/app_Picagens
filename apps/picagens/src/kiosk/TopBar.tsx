// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Barra de topo em faixa escura (artboard p2311-quiosque-tablet, aprovado 24/11): logótipo Picagens, empresa e local,
// estado da rede e acesso ao admin.
import { Pressable, Text, View } from 'react-native';

import { colors, fonts } from '../theme';
import { GearIcon } from '../components/icons';
import { Logo, useVw } from '../components/ui';

interface Props {
  company: string;
  place: string | null;
  online: boolean;
  onAdmin?: () => void;
}

/** Altura da faixa em % da largura: os ecrãs do quiosque começam abaixo dela. */
export const BAR_HEIGHT_VW = 8.2;

const initials = (name: string) =>
  name.split(/\s+/).filter((word) => word.length > 2).slice(0, 2).map((word) => word[0].toUpperCase()).join('') || name.slice(0, 2).toUpperCase();

export function TopBar({ company, place, online, onAdmin }: Props) {
  const vw = useVw();
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: vw(BAR_HEIGHT_VW), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: vw(2.7), backgroundColor: colors.band, borderBottomLeftRadius: vw(2.1), borderBottomRightRadius: vw(2.1), elevation: 6, zIndex: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: vw(1.4) }}>
        <Logo white height={vw(2.9)} />
        <View style={{ width: 1, height: vw(2.7), backgroundColor: colors.bandLine }} />
        <View style={{ width: vw(3.7), height: vw(3.7), borderRadius: vw(1.85), backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.band, fontFamily: fonts.bodyBold, fontSize: vw(1.3) }}>{initials(company)}</Text>
        </View>
        <View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.65), color: colors.surface }}>{company}</Text>
          {place ? <Text style={{ fontFamily: fonts.body, fontSize: vw(1.35), color: colors.surface, opacity: 0.8 }}>{place}</Text> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: vw(1) }}>
        <View
          accessibilityLabel={online ? 'Ligado à internet' : 'Sem rede, as picagens ficam guardadas'}
          style={{ flexDirection: 'row', alignItems: 'center', gap: vw(0.8), backgroundColor: colors.surface, paddingHorizontal: vw(1.4), paddingVertical: vw(0.7), borderRadius: 999 }}
        >
          <View style={{ width: vw(0.9), height: vw(0.9), borderRadius: 99, backgroundColor: online ? colors.ok : colors.warn }} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.4), color: colors.ink2 }}>{online ? 'Ligado' : 'Sem rede · guarda'}</Text>
        </View>
        {onAdmin ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Administração"
            onPress={onAdmin}
            style={{ width: vw(4.3), height: vw(4.3), borderRadius: vw(2.15), borderWidth: 1, borderColor: colors.bandLine, alignItems: 'center', justifyContent: 'center' }}
          >
            <GearIcon size={vw(2.2)} color={colors.surface} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
