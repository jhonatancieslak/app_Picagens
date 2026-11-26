// Termos e política ao entrar (canvas aprovado 24/11, «Aceitar termos ao entrar»). Enquanto a versão atual não for aceite, não se avança.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { employeeApi } from '../api';
import { colors, fonts } from '../../theme';

export const VERSAO_TERMOS = '2026-11';

type Props = { token: string; onDone: () => void; onAuthError: (error: unknown) => boolean };

function Aceite({ titulo, texto, marcado, onToggle }: { titulo: string; texto: string; marcado: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: marcado }}
      style={{ flexDirection: 'row', gap: 14, padding: 16, borderRadius: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: marcado ? colors.ok : colors.ink, backgroundColor: marcado ? colors.ok : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        {marcado ? <Text style={{ color: '#fff', fontFamily: fonts.bodyBold }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>{titulo}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink2 }}>{texto}</Text>
      </View>
    </Pressable>
  );
}

export function TermosScreen({ token, onDone, onAuthError }: Props) {
  const [termos, setTermos] = useState(false);
  const [politica, setPolitica] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState('');
  const pode = termos && politica && !aEnviar;

  async function continuar() {
    setAEnviar(true);
    setErro('');
    try {
      await employeeApi.acceptTerms(token, VERSAO_TERMOS);
      onDone();
    } catch (error) {
      setAEnviar(false);
      if (!onAuthError(error)) setErro('Não foi possível guardar o aceite. Tente de novo.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60, gap: 14 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 24, color: colors.ink }}>Antes de começar</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink2 }}>Para usar a Picagens, leia e aceite os termos. Sem aceitar, não consegue entrar na app.</Text>
      <Aceite titulo="Termos de uso" texto="Regras de uso da app e da sua conta" marcado={termos} onToggle={() => setTermos((v) => !v)} />
      <Aceite titulo="Política de privacidade" texto="Como tratamos os seus dados e a localização ao picar" marcado={politica} onToggle={() => setPolitica((v) => !v)} />
      {erro ? <Text style={{ color: colors.danger, fontFamily: fonts.body }}>{erro}</Text> : null}
      <View style={{ flex: 1 }} />
      <Pressable disabled={!pode} onPress={continuar} style={{ height: 54, borderRadius: 14, backgroundColor: pode ? colors.action : colors.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: pode ? '#fff' : colors.ink3 }}>{aEnviar ? 'A guardar…' : 'Continuar'}</Text>
      </Pressable>
    </View>
  );
}
