// Correções dos colaboradores que o chefe autorizado decide (doc 229, decisão 7). Sem autorização, a lista vem vazia.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { TeamCollaboratorCorrection, teamApi } from '../api';
import { colors, fonts } from '../../theme';

type Props = { token: string; pinToken: string; equipa?: string | null; onBack: () => void; onAuthError: (error: unknown) => boolean };

export function TeamDecisionsScreen({ token, pinToken, equipa, onBack, onAuthError }: Props) {
  const [pedidos, setPedidos] = useState<TeamCollaboratorCorrection[] | null>(null);
  const [erro, setErro] = useState('');
  const [aDecidir, setADecidir] = useState<string | null>(null);

  const carregar = useCallback(() => {
    teamApi.decisions(token, pinToken, equipa)
      .then((dados) => setPedidos(dados.correcoes_colaborador))
      .catch((error) => { if (!onAuthError(error)) setErro('Não foi possível carregar os pedidos.'); });
  }, [token, pinToken, equipa, onAuthError]);

  useEffect(() => { carregar(); }, [carregar]);

  async function decidir(id: string, aprovar: boolean) {
    setADecidir(id);
    setErro('');
    try {
      await teamApi.decideCorrection(token, pinToken, id, aprovar);
      carregar();
    } catch (error) {
      if (!onAuthError(error)) setErro('Não foi possível guardar a decisão. Tente de novo.');
    } finally {
      setADecidir(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 56 }}>
      <Pressable onPress={onBack} accessibilityRole="button" style={{ paddingHorizontal: 20, paddingVertical: 10 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.action }}>‹ Voltar</Text>
      </Pressable>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 24, color: colors.ink, paddingHorizontal: 20 }}>Correções para decidir</Text>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
        {erro ? <Text style={{ color: colors.danger, fontFamily: fonts.body }}>{erro}</Text> : null}
        {pedidos && pedidos.length === 0 ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink2 }}>Não há correções à espera da sua decisão.</Text>
        ) : null}
        {(pedidos ?? []).map((pedido) => (
          <View key={pedido.id} style={{ padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 6 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>{pedido.nome}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.ink2 }}>{pedido.tipo} · {pedido.data_hora.replace('T', ' ')}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.ink2 }}>Motivo: {pedido.motivo}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <Pressable disabled={aDecidir !== null} onPress={() => decidir(pedido.id, false)} style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bodyBold, color: colors.danger }}>Recusar</Text>
              </Pressable>
              <Pressable disabled={aDecidir !== null} onPress={() => decidir(pedido.id, true)} style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bodyBold, color: '#fff' }}>{aDecidir === pedido.id ? 'A guardar…' : 'Aprovar'}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
