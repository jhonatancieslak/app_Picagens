// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Ilustração de estado (pedido enviado, em análise, aprovado, listas vazias, sem rede), doc 52 §5. Só no telemóvel:
// o quiosque não as usa no fluxo de picar, que tem de ser instantâneo.
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { approvedSvg, documentsSvg, messagesSvg, offlineSvg, reviewSvg, sentSvg, signedSvg } from './illustrations-data';

const SOURCES = {
  sent: sentSvg,
  review: reviewSvg,
  approved: approvedSvg,
  messages: messagesSvg,
  documents: documentsSvg,
  signed: signedSvg,
  offline: offlineSvg,
};

export type IllustrationName = keyof typeof SOURCES;

/** Proporção das ilustrações originais (1141 × 1014). */
const RATIO = 1014 / 1141;

export function Illustration({ name, width = 200 }: { name: IllustrationName; width?: number }) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ alignSelf: 'center' }}>
      <SvgXml xml={SOURCES[name]} width={width} height={width * RATIO} />
    </View>
  );
}
