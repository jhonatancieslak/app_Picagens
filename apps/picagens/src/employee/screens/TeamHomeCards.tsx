// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// «Hoje» do chefe (artboard AppChefeHoje, 24/11): a equipa agora, os alertas de hoje e «Precisa de si», por baixo do que o
// colaborador já vê. Dados de outras pessoas só com a prova do PIN válida (a mesma do separador Equipa): sem ela, um
// atalho para Equipa pede o PIN. Só presença e contagens, nunca saldos nem GPS.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Bloco } from '../../components/Skeleton';
import { ApiError } from '../../http';
import { colors, fonts } from '../../theme';
import { TeamAlert, TeamMissing, TeamRef, TeamRequests, TeamToday, teamApi } from '../api';

interface Props {
  token: string;
  /** Prova do PIN válida (separador Equipa), ou null. */
  pinToken: string | null;
  team: TeamRef;
  onOpenTeam: () => void;
  onAuthError: (error: unknown) => boolean;
}

export function TeamHomeCards({ token, pinToken, team, onOpenTeam, onAuthError }: Props) {
  const [today, setToday] = useState<TeamToday | null>(null);
  const [alerts, setAlerts] = useState<TeamAlert[] | null>(null);
  const [missing, setMissing] = useState<TeamMissing | null>(null);
  const [requests, setRequests] = useState<TeamRequests | null>(null);

  useEffect(() => {
    if (!pinToken) return;
    let alive = true;
    Promise.all([teamApi.today(token, pinToken, team.id), teamApi.alerts(token, pinToken, team.id), teamApi.missing(token, pinToken, team.id), teamApi.requests(token, pinToken, team.id)])
      .then(([t, a, m, r]) => { if (alive) { setToday(t); setAlerts(a.alertas); setMissing(m); setRequests(r); } })
      .catch((exc) => {
        const pinExpired = exc instanceof ApiError && exc.status === 401 && exc.data.pin_necessario === true; // não é fim de sessão
        if (alive && !pinExpired) onAuthError(exc);
      });
    return () => { alive = false; };
  }, [token, pinToken, team.id, onAuthError]);

  if (!pinToken) {
    return (
      <Pressable accessibilityRole="button" onPress={onOpenTeam} style={({ pressed }) => ({ borderRadius: 18, backgroundColor: colors.surface, padding: 16, gap: 4, elevation: 2, opacity: pressed ? 0.85 : 1 })}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{team.nome}, agora</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: colors.ink2 }}>Confirme o seu PIN para ver quem está a trabalhar, os alertas e o que precisa de si.</Text>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.band, marginTop: 4 }}>Ver a minha equipa ›</Text>
      </Pressable>
    );
  }
  if (!today || !alerts) return <Bloco style={{ height: 150, borderRadius: 18 }} />;

  const notPunched = today.membros.filter((m) => m.estado === 'por_comecar' || m.estado === 'em_falta_entrada').length;
  const toForgive = missing?.faltas.length ?? 0;
  const toOpine = requests?.pedidos.filter((p) => !p.parecer).length ?? 0;
  const counts: [number, string][] = [[today.resumo.a_trabalhar, 'a trabalhar'], [notPunched, 'não picaram'], [today.resumo.em_falta, 'em falta']];

  return (
    <>
      <View style={{ borderRadius: 18, backgroundColor: colors.surface, padding: 16, gap: 12, elevation: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{team.nome}, agora</Text>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink3 }}>{today.membros.length} pessoas</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {counts.map(([value, label]) => (
            <View key={label} style={{ flex: 1, backgroundColor: colors.bg, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 22, color: colors.ink, fontVariant: ['tabular-nums'] }}>{value}</Text>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink2 }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ borderRadius: 18, backgroundColor: colors.surface, padding: 16, gap: 10, elevation: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>Alertas da equipa</Text>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink3 }}>{alerts.length ? `${alerts.length} hoje` : 'sem alertas'}</Text>
        </View>
        {alerts.length === 0 ? <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: colors.ink2 }}>Ninguém picou atrasado nem saiu antes.</Text> : null}
        {alerts.slice(0, 3).map((alert) => (
          <View key={`${alert.colaborador_id}-${alert.tipo}`}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }}>{alert.nome} {alert.tipo === 'atraso' ? 'entrou' : 'saiu'} às {alert.real}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3 }}>{alert.minutos} min {alert.tipo === 'atraso' ? 'depois' : 'antes'} da hora prevista ({alert.previsto})</Text>
          </View>
        ))}
      </View>

      {toForgive + toOpine > 0 ? (
        <Pressable accessibilityRole="button" onPress={onOpenTeam}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 56, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface, elevation: 2, opacity: pressed ? 0.9 : 1 })}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }}>Precisa de si</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3, marginTop: 2 }}>
              {[toOpine ? `${toOpine} ${toOpine === 1 ? 'pedido' : 'pedidos'} para parecer` : '', toForgive ? `${toForgive} ${toForgive === 1 ? 'falta' : 'faltas'} na equipa` : ''].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.band }}>Ver</Text>
        </Pressable>
      ) : null}
    </>
  );
}
