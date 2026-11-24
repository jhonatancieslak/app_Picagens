// Folha de resultado ao picar (canvas aprovado 23/11, «Resultado ao picar»): sucesso, fila sem rede e erro.
import { useEffect, useRef } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { CloudSavedIcon, OkIcon, PinIcon } from './icons';
import { colors, fonts } from '../theme';

export type ResultadoPicar = { tone: 'ok' | 'queued' | 'err'; title: string; text?: string };

const FECHO_AUTOMATICO_MS = 5000;

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
  const cor = resultado.tone === 'ok' ? colors.ok : resultado.tone === 'queued' ? colors.warn : colors.danger;
  const icone = resultado.tone === 'ok'
    ? <OkIcon size={30} color="#fff" />
    : resultado.tone === 'queued'
      ? <CloudSavedIcon size={30} color="#fff" />
      : <PinIcon size={30} color="#fff" />;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={() => { if (resultado.tone !== 'err') onClose(); }}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(27,42,54,0.32)' }} onPress={() => { if (resultado.tone !== 'err') onClose(); }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 30, alignItems: 'center', gap: 10 }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: cor, alignItems: 'center', justifyContent: 'center' }}>{icone}</View>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink, textAlign: 'center' }}>{resultado.title}</Text>
        {resultado.text ? <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink2, textAlign: 'center' }}>{resultado.text}</Text> : null}
        <Pressable onPress={onClose} style={{ alignSelf: 'stretch', height: 52, borderRadius: 14, backgroundColor: colors.action, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: '#fff' }}>{resultado.tone === 'err' ? 'Tentar de novo' : 'Continuar'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
