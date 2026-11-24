// Alertas da equipa de hoje (doc 226). Desenho do artboard «Chefe · Hoje» aprovado: cartão «Alertas da equipa» com linhas e pílula âmbar.
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { TeamAlert, teamApi } from '../api';
import { CHEFE, CartaoChefe, IniciaisAvatar, Pilula } from './chefeUi';
import { Header } from '../ui';
import { colors, fonts } from '../../theme';

type Props = { token: string; pinToken: string; equipa?: string | null; onBack: () => void; onAuthError: (error: unknown) => boolean };

const ROTULO: Record<TeamAlert['tipo'], string> = { atraso: 'atrasado', saida_antecipada: 'saiu cedo' };

export function TeamAlertsScreen({ token, pinToken, equipa, onBack, onAuthError }: Props) {
  const [alertas, setAlertas] = useState<TeamAlert[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    teamApi.alerts(token, pinToken, equipa)
      .then((dados) => { if (vivo) setAlertas(dados.alertas); })
      .catch((error) => { if (vivo && !onAuthError(error)) setErro('Não foi possível carregar os alertas.'); });
    return () => { vivo = false; };
  }, [token, pinToken, equipa, onAuthError]);

  const lista = alertas ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: CHEFE.fundo }}>
      <Header variante="faixa" title="Alertas da equipa" subtitle="Atrasos e saídas antes da hora prevista" onVoltar={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        {erro ? <Text style={{ color: colors.danger, fontFamily: fonts.body }}>{erro}</Text> : null}
        <CartaoChefe>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.ink }}>Alertas da equipa</Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: CHEFE.cinza }}>{lista.length === 0 ? 'sem alertas' : `${lista.length} hoje`}</Text>
          </View>
          {lista.length === 0 ? (
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: CHEFE.cinza }}>Ninguém picou atrasado nem saiu antes.</Text>
          ) : null}
          {lista.map((alerta) => (
            <View key={`${alerta.colaborador_id}-${alerta.tipo}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IniciaisAvatar nome={alerta.nome} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.ink }}>{alerta.nome} {alerta.tipo === 'atraso' ? 'entrou' : 'saiu'} às {alerta.real}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: CHEFE.cinza, marginTop: 2 }}>{alerta.minutos} min {alerta.tipo === 'atraso' ? 'depois' : 'antes'} da hora prevista ({alerta.previsto})</Text>
              </View>
              <Pilula texto={ROTULO[alerta.tipo]} ambar />
            </View>
          ))}
        </CartaoChefe>
      </ScrollView>
    </View>
  );
}
