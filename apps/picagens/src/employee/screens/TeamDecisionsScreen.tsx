// Correções para decidir (doc 229, decisão 7). Desenho do artboard «Chefe · Pedidos com libertação (aprova)»: cartões com Recusar e Aprovar.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { TeamCollaboratorCorrection, teamApi } from '../api';
import { CHEFE, CabecalhoChefe, CartaoChefe, IniciaisAvatar, Pilula } from './chefeUi';
import { colors } from '../../theme';

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

  const lista = pedidos ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: CHEFE.fundo }}>
      <CabecalhoChefe titulo="Correções" subtitulo="Decide o chefe desta equipa. Fica registado." onVoltar={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        {erro ? <Text style={{ color: colors.danger, fontFamily: 'Inter_400Regular' }}>{erro}</Text> : null}
        {pedidos && lista.length === 0 ? (
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: CHEFE.cinza }}>Não há correções à espera da sua decisão.</Text>
        ) : null}
        {lista.map((pedido) => (
          <CartaoChefe key={pedido.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IniciaisAvatar nome={pedido.nome} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.ink }}>{pedido.nome}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: CHEFE.cinza }}>{pedido.tipo} · {pedido.data_hora.replace('T', ' ')}</Text>
              </View>
              <Pilula texto="Aguarda" />
            </View>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.ink2 }}>Motivo: {pedido.motivo}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable disabled={aDecidir !== null} onPress={() => decidir(pedido.id, false)} accessibilityRole="button"
                style={{ flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: CHEFE.vermelho, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: CHEFE.vermelho }}>Recusar</Text>
              </Pressable>
              <Pressable disabled={aDecidir !== null} onPress={() => decidir(pedido.id, true)} accessibilityRole="button"
                style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: CHEFE.verde, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' }}>{aDecidir === pedido.id ? 'A guardar…' : 'Aprovar'}</Text>
              </Pressable>
            </View>
          </CartaoChefe>
        ))}
      </ScrollView>
    </View>
  );
}
