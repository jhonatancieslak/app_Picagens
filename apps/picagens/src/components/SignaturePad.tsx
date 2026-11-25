// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Quadro para assinar com o dedo (artboard «Ler e assinar com o dedo», doc 249): desenha-se num SVG e devolve-se um PNG em
// data URL (fundo transparente), o formato que o servidor valida (app/assinatura_desenho.py). Sem bibliotecas novas: usa
// react-native-svg, que já faz parte da app. «Limpar» apaga tudo.
import { useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts } from '../theme';

const PAD_HEIGHT = 170;
const STROKE_WIDTH = 3;
const PNG_PREFIX = 'data:image/png;base64,';

interface Props {
  /** Chamado com o PNG em data URL quando há desenho, ou com null quando o quadro fica vazio. */
  onChange: (dataUrl: string | null) => void;
}

export function SignaturePad({ onChange }: Props) {
  const [paths, setPaths] = useState<string[]>([]);
  const [live, setLive] = useState('');
  const [width, setWidth] = useState(300);
  const svg = useRef<{ toDataURL: (callback: (base64: string) => void) => void } | null>(null);
  const current = useRef('');
  const drawn = useRef<string[]>([]);

  function exportPng() {
    // Espera um quadro para o SVG já ter o último traço antes de o converter.
    setTimeout(() => svg.current?.toDataURL((base64) => onChange(`${PNG_PREFIX}${base64}`)), 30);
  }

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false, // o ScrollView não rouba o gesto a meio da assinatura
    onPanResponderGrant: (event) => {
      const { locationX: x, locationY: y } = event.nativeEvent;
      current.current = `M${x.toFixed(1)} ${y.toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)}`; // um toque deixa um ponto
      setLive(current.current);
    },
    onPanResponderMove: (event) => {
      const { locationX: x, locationY: y } = event.nativeEvent;
      current.current += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      setLive(current.current);
    },
    onPanResponderRelease: () => {
      drawn.current = [...drawn.current, current.current];
      current.current = '';
      setPaths(drawn.current);
      setLive('');
      exportPng();
    },
  })).current;

  function clear() {
    drawn.current = [];
    current.current = '';
    setPaths([]);
    setLive('');
    onChange(null);
  }

  return (
    <View style={{ gap: 8 }}>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityLabel="Quadro para desenhar a sua assinatura com o dedo"
        style={{ height: PAD_HEIGHT, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.band, backgroundColor: colors.surface, overflow: 'hidden' }}
        {...responder.panHandlers}
      >
        <Svg ref={(node) => { svg.current = node as never; }} width={width} height={PAD_HEIGHT} pointerEvents="none">
          {paths.map((d, index) => <Path key={index} d={d} stroke={colors.ink} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
          {live ? <Path d={live} stroke={colors.ink} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
        </Svg>
        {!paths.length && !live ? (
          <Text pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: PAD_HEIGHT / 2 - 10, textAlign: 'center', fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink3 }}>Assine aqui</Text>
        ) : null}
      </View>
      <Pressable accessibilityRole="button" onPress={clear} hitSlop={8} style={{ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ok }}>Limpar</Text>
      </Pressable>
    </View>
  );
}
