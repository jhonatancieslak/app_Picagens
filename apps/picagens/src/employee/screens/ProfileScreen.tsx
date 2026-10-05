// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Perfil (protótipo v6), aberto pelo avatar de Hoje: os avisos (saída em falta, visto do mês, contrato por assinar),
// dados da sessão, definições (manter sessão, fotos do tablet, RGPD), terminar sessão e a versão da app.
import * as Application from 'expo-application';
import { ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckSquareIcon, ClockIcon, PenIcon } from '../../components/icons';
import { colors, fonts } from '../../theme';
import { Me, Notice } from '../api';
import { getKeepSession, saveKeepSession } from '../storage';
import { Avatar, BackLink, Button, Card, Chip, Muted, Row, Section, Toggle } from '../ui';

const NOTICE_STYLE: Record<Notice['tipo'], { bg: string; fg: string; icon: (color: string) => ReactNode; action: string }> = {
  saida_em_falta: { bg: colors.warnSoft, fg: colors.warn, icon: (c) => <ClockIcon size={18} color={c} />, action: 'Corrigir' },
  visto: { bg: colors.actionSoft, fg: colors.action, icon: (c) => <CheckSquareIcon size={18} color={c} />, action: 'Ver' },
  contrato: { bg: colors.infoSoft, fg: colors.info, icon: (c) => <PenIcon size={18} color={c} />, action: 'Assinar' },
};

interface Props {
  me: Me;
  notices: Notice[];
  pending: number;
  onBack: () => void;
  onNotice: (notice: Notice) => void;
  onLogout: () => void;
  onInfo: (title: string, text: string) => void;
}

export function ProfileScreen({ me, notices, pending, onBack, onNotice, onLogout, onInfo }: Props) {
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);
  const [keep, setKeep] = useState(true);

  useEffect(() => {
    getKeepSession().then(setKeep);
  }, []);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 110, gap: 12 }}>
      <BackLink label="Hoje" onPress={onBack} />
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 4 }}>
        <View style={{ borderWidth: 4, borderColor: '#fff', borderRadius: 60, elevation: 4 }}>
          <Avatar name={me.colaborador.nome} count={0} size={96} />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginTop: 6, textAlign: 'center' }}>{me.colaborador.nome}</Text>
        <Muted size={13} center>{me.empresa.nome}{me.local ? ` · ${me.local}` : ''}</Muted>
      </View>

      <Section title="Avisos" count={notices.length} />
      {notices.length ? (
        <View style={{ gap: 8 }}>
          {notices.map((notice, index) => {
            const style = NOTICE_STYLE[notice.tipo];
            return (
              <Pressable key={`${notice.tipo}-${notice.id ?? notice.data ?? index}`} accessibilityRole="button" onPress={() => onNotice(notice)}
                style={({ pressed }) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 54, paddingVertical: 9, paddingLeft: 12, paddingRight: 10, borderRadius: 16, backgroundColor: style.bg, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>{style.icon(style.fg)}</View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: style.fg }}>{notice.titulo}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: style.fg, opacity: 0.88 }}>{notice.detalhe}</Text>
                </View>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: style.fg }}>{style.action} ›</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Muted size={13}>Sem avisos. Está tudo em dia.</Muted>
      )}
      {pending ? <Chip tone="warn" label={`${pending} picagem(ns) por enviar`} /> : null}

      <Card style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 4 }}>
        <KeyValue label="Empresa" value={me.empresa.nome} />
        <KeyValue label="Local" value={me.local ?? 'Sem local atribuído'} />
        <KeyValue label="Localização" value={me.opcoes.localizacao_obrigatoria ? 'Obrigatória ao picar' : 'Opcional'} />
      </Card>

      <Section title="Definições" />
      <Card>
        <Toggle flat title="Manter sessão neste telemóvel" subtitle="Desligue em telemóveis partilhados" value={keep} onChange={(value) => { setKeep(value); saveKeepSession(value); }} />
        <Row
          title="Fotos das picagens no tablet"
          subtitle="Guardadas 30 dias, cifradas. Só o gestor vê, para rever."
          right={<Text style={{ color: colors.ink3 }}>›</Text>}
          onPress={() => onInfo('Fotos no tablet da obra', 'Servem só para confirmar que foi mesmo você. Não há reconhecimento facial. Peça cópia ao RH.')}
        />
        <Row
          title="Os meus dados (RGPD)"
          subtitle="Ver e pedir cópia dos seus dados"
          right={<Text style={{ color: colors.ink3 }}>›</Text>}
          onPress={() => onInfo('Os seus dados', `Peça ver, corrigir ou copiar os seus dados ao RH da ${me.empresa.nome}, responsável pelo tratamento.`)}
        />
      </Card>

      {confirming ? (
        <Card style={{ gap: 10, padding: 14, borderColor: colors.danger }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>Terminar sessão neste telemóvel?</Text>
          <Muted size={13}>
            {pending ? `Atenção: ${pending} picagem(ns) ainda não foram enviadas e serão perdidas. Ligue-se à internet primeiro. ` : ''}
            Para voltar a entrar precisa do código da empresa, do NIF e do PIN.
          </Muted>
          <Button danger title="Terminar sessão" onPress={onLogout} />
          <Button ghost title="Cancelar" onPress={() => setConfirming(false)} />
        </Card>
      ) : (
        <Button ghost danger title="Terminar sessão" onPress={() => setConfirming(true)} />
      )}

      <Text style={{ textAlign: 'center', fontFamily: fonts.body, fontSize: 12, color: colors.ink3 }}>
        Picagens {Application.nativeApplicationVersion} · modo colaborador · {me.empresa.nome}
      </Text>
    </ScrollView>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.ink3 }}>{label}</Text>
      <Text style={{ flex: 1, textAlign: 'right', fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.ink }}>{value}</Text>
    </View>
  );
}
