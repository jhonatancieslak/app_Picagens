// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Folha de resultado, única para a app toda (artboard p2311-resultado-picar, aprovado 24/11): sucesso, erro e «sem rede:
// fica guardada». Sobe de baixo, com puxador, ícone de 60 px, título, texto e botão verde. Cores só dos tokens.
import { useEffect, useRef } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Button } from '../employee/ui';
import { colors, fonts } from '../theme';

export interface ResultadoPicar {
  tone: 'ok' | 'queued' | 'err';
  title: string;
  text?: string;
  /** Só no sucesso: «às 08:58» a verde, por baixo do título. */
  hora?: string;
  /** Só sem rede: quantas picagens esperam envio («1 picagem à espera de envio»). */
  pendentes?: number;
  /** Texto do botão principal (por omissão «Continuar» ou, no erro, «Tentar de novo»). */
  botao?: string;
  /** Só no erro: segunda ação, a contornar (ex.: «Pedir correção ao chefe»). */
  secundario?: { label: string; onPress: () => void };
}

const FECHO_AUTOMATICO_MS = 5000;
const FECHO_AUTOMATICO_S = FECHO_AUTOMATICO_MS / 1000;

const ICONES = {
  ok: { fundo: colors.okIconBg, traco: colors.ok, largura: 2.6, caminho: 'M4 12.5l5 5L20 6.5' },
  queued: { fundo: colors.warnIconBg, traco: colors.warnIconInk, largura: 2.4, caminho: 'M4 12.5l5 5L20 6.5' },
  err: { fundo: colors.dangerIconBg, traco: colors.dangerIconInk, largura: 2.6, caminho: 'M6 6l12 12M18 6L6 18' },
} as const;

export default function ResultSheet({ resultado, onClose }: { resultado: ResultadoPicar | null; onClose: () => void }) {
  // Guardado numa referência: o temporizador não recomeça a cada nova renderização do ecrã.
  const fechar = useRef(onClose);
  fechar.current = onClose;

  useEffect(() => {
    if (!resultado || resultado.tone === 'err') return;
    const temporizador = setTimeout(() => fechar.current(), FECHO_AUTOMATICO_MS);
    return () => clearTimeout(temporizador);
  }, [resultado]);

  if (!resultado) return null;
  const icone = ICONES[resultado.tone];
  const fecha = resultado.tone !== 'err';

  return (
    <Modal transparent animationType="slide" visible onRequestClose={() => { if (fecha) onClose(); }}>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={() => { if (fecha) onClose(); }} />
      <View
        accessibilityRole={resultado.tone === 'err' ? 'alert' : undefined}
        accessibilityLiveRegion={resultado.tone === 'err' ? 'assertive' : 'polite'}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 12, paddingHorizontal: 22, paddingBottom: 26, alignItems: 'center' }}
      >
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.handle, marginBottom: 18 }} />
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: icone.fundo, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={icone.traco} strokeWidth={icone.largura} strokeLinecap="round" strokeLinejoin="round">
            <Path d={icone.caminho} />
          </Svg>
        </View>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 19, lineHeight: 24, color: colors.ink, textAlign: 'center', marginTop: 10 }}>{resultado.title}</Text>
        {resultado.hora ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ok, marginTop: 6 }}>{resultado.hora}</Text> : null}
        {resultado.text ? <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink2, textAlign: 'center', marginTop: 6 }}>{resultado.text}</Text> : null}
        {resultado.pendentes ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.queueBg, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginTop: 16, alignSelf: 'stretch' }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.band} strokeWidth={2}>
              <Circle cx={12} cy={12} r={9} />
              <Path d="M12 7v5l3 2" />
            </Svg>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }}>
              {resultado.pendentes === 1 ? '1 picagem à espera de envio' : `${resultado.pendentes} picagens à espera de envio`}
            </Text>
          </View>
        ) : null}
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 20 }}>
          <Button primary tone="verde" title={resultado.botao ?? (resultado.tone === 'err' ? 'Tentar de novo' : 'Continuar')} onPress={onClose} />
          {resultado.secundario ? <Button ghost title={resultado.secundario.label} onPress={resultado.secundario.onPress} /> : null}
        </View>
        {resultado.tone === 'ok' ? (
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink3, marginTop: 14, textAlign: 'center' }}>Fecha sozinha em {FECHO_AUTOMATICO_S} segundos.</Text>
        ) : null}
      </View>
    </Modal>
  );
}
