// Alertas da equipa de hoje (doc 226): atrasos e saídas antecipadas, pela hora prevista e a tolerância da empresa.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { TeamAlert, teamApi } from '../api';
import { colors, fonts } from '../../theme';

type Props = { token: string; pinToken: string; equipa?: string | null; onBack: () => void; onAuthError: (error: unknown) => boolean };

const ROTULO: Record<TeamAlert['tipo'], string> = { atraso: 'Atraso', saida_antecipada: 'Saída antecipada' };

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 56 }}>
      <Pressable onPress={onBack} accessibilityRole="button" style={{ paddingHorizontal: 20, paddingVertical: 10 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.action }}>‹ Voltar</Text>
      </Pressable>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 24, color: colors.ink, paddingHorizontal: 20 }}>Alertas de hoje</Text>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
        {erro ? <Text style={{ color: colors.danger, fontFamily: fonts.body }}>{erro}</Text> : null}
        {alertas && alertas.length === 0 ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink2 }}>Ninguém picou atrasado nem saiu antes.</Text>
        ) : null}
        {(alertas ?? []).map((alerta) => (
          <View key={`${alerta.colaborador_id}-${alerta.tipo}`} style={{ padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 4 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>{alerta.nome}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.ink2 }}>
              {ROTULO[alerta.tipo]} · previsto {alerta.previsto}, real {alerta.real} ({alerta.minutos} min)
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
