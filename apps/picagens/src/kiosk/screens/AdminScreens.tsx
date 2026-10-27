// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Administração do tablet (código de administrador, 15 min): testar câmara, picagens por enviar,
// ecrã e bloqueio, sair. O rosto (quando a empresa o liga) compara-se em src/face, nunca aqui.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ReactNode, useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import type { LicenseState } from '../api';
import { CameraIcon, CloudIcon, ExitIcon, LockIcon } from '../../components/icons';
import { BigButton, Heading, LinkButton, Notice, Paragraph, useVw } from '../../components/ui';
import type { QueueStatus } from '../queue';
import type { ScreenSettings } from '../storage';
import { colors, fonts } from '../../theme';
import { androidLabel, versionLabel } from './WaitScreen';

function AdminHeader({ title, right, onBack }: { title: string; right?: ReactNode; onBack?: () => void }) {
  const vw = useVw();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: vw(1.6) }}>
        {onBack ? <LinkButton title="‹ Admin" onPress={onBack} /> : null}
        <Heading>{title}</Heading>
      </View>
      {right}
    </View>
  );
}

function Tile({ title, text, icon, badge, danger, onPress }: { title: string; text: string; icon: ReactNode; badge?: number; danger?: boolean; onPress: () => void }) {
  const vw = useVw();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: vw(16), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: vw(1.8), padding: vw(2), gap: vw(0.8), opacity: pressed ? 0.8 : 1 })}>
      <View style={{ width: vw(5), height: vw(5), borderRadius: vw(1.4), alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? colors.dangerSoft : colors.actionSoft }}>{icon}</View>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.9), color: colors.ink }}>{title}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: vw(1.35), color: colors.ink2 }}>{text}</Text>
      {badge ? (
        <View style={{ position: 'absolute', top: vw(1.4), right: vw(1.4), minWidth: vw(2.6), height: vw(2.6), borderRadius: 99, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: vw(0.6) }}>
          <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: vw(1.3) }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

interface AdminProps {
  secondsLeft: number;
  license: LicenseState;
  licenseUntil: string | null;
  queue: QueueStatus;
  settings: ScreenSettings;
  tabletName: string;
  /** Versão mais recente publicada, quando é mais nova do que a instalada. */
  update?: { version: string; url: string } | null;
  onCamera: () => void;
  onScreen: () => void;
  onFlush: () => void;
  onExit: () => void;
}

export function AdminScreen({ secondsLeft, license, licenseUntil, queue, settings, tabletName, update, onCamera, onScreen, onFlush, onExit }: AdminProps) {
  const vw = useVw();
  const minutes = Math.floor(secondsLeft / 60);
  const queueText = queue.pending
    ? `${queue.pending} guardada${queue.pending > 1 ? 's' : ''} no tablet. Enviam sozinhas quando houver rede.`
    : 'Tudo enviado. Fotos incluídas.';
  return (
    <View style={{ flex: 1, paddingTop: vw(7.5), paddingHorizontal: vw(4), gap: vw(1.8) }}>
      <AdminHeader
        title="Administração do tablet"
        right={
          <View style={{ backgroundColor: colors.warnSoft, borderRadius: 999, paddingHorizontal: vw(1.2), paddingVertical: vw(0.6) }}>
            <Text style={{ color: colors.warn, fontFamily: fonts.bodyBold, fontSize: vw(1.5) }}>Termina em {minutes}:{String(secondsLeft % 60).padStart(2, '0')}</Text>
          </View>
        }
      />
      <View style={{ flexDirection: 'row', gap: vw(1.4) }}>
        <Tile title="Testar câmara" text="Posicionar o tablet e ver a luz. Nada é guardado." icon={<CameraIcon size={vw(2.8)} color={colors.action} />} onPress={onCamera} />
        <Tile title="Picagens por enviar" text={queue.rejected ? `${queueText} ${queue.rejected} recusada(s) pelo servidor.` : queueText} badge={queue.pending} icon={<CloudIcon size={vw(2.8)} color={colors.action} />} onPress={onFlush} />
        <Tile title="Ecrã e bloqueio" text={[settings.keepAwake ? 'Sempre ligado' : 'Apaga sozinho', settings.dimAtNight ? 'Escurece à noite' : null].filter(Boolean).join(' · ')} icon={<LockIcon size={vw(2.8)} color={colors.action} />} onPress={onScreen} />
        <Tile title="Sair" text="Volta ao ecrã de picagem." danger icon={<ExitIcon size={vw(2.8)} color={colors.danger} />} onPress={onExit} />
      </View>
      {update ? (
        <Pressable accessibilityRole="button" onPress={() => Linking.openURL(update.url)}>
          <Notice tone="info">Nova versão disponível ({update.version}). Toque para descarregar e instalar por cima: o tablet continua ligado à empresa.</Notice>
        </Pressable>
      ) : null}
      {license === 'a_terminar' ? (
        <Notice tone="info">A licença termina{licenseUntil ? ` a ${licenseUntil.split('-').reverse().join('/')}` : ' em breve'}. Só o administrador vê este aviso. A renovação faz-se no painel da empresa › Plano.</Notice>
      ) : null}
      <Text style={{ textAlign: 'center', fontFamily: fonts.body, fontSize: vw(1.3), color: colors.ink3 }}>O modo de administração fecha sozinho ao fim de 15 minutos.</Text>
      <Text style={{ textAlign: 'center', fontFamily: fonts.body, fontSize: vw(1.3), color: colors.ink3 }}>
        {versionLabel()} · {androidLabel()} · Tablet “{tabletName}”
      </Text>
    </View>
  );
}

export function CameraTestScreen({ onBack }: { onBack: () => void }) {
  const vw = useVw();
  const [permission, requestPermission] = useCameraPermissions();
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingTop: vw(6), paddingHorizontal: vw(4), gap: vw(3) }}>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ width: vw(28), aspectRatio: 3 / 4, borderRadius: vw(2.4), overflow: 'hidden', backgroundColor: '#232A35' }}>
          {permission?.granted ? <CameraView facing="front" style={{ flex: 1 }} /> : null}
          <View pointerEvents="none" style={{ position: 'absolute', top: '12%', bottom: '12%', left: '18%', right: '18%', borderRadius: 999, borderWidth: vw(0.5), borderColor: colors.ok }} />
        </View>
      </View>
      <View style={{ flex: 1, gap: vw(1.3) }}>
        <LinkButton title="‹ Admin" onPress={onBack} />
        <Heading>Testar câmara</Heading>
        <Paragraph>Use para posicionar o tablet. Nada é guardado neste teste.</Paragraph>
        {permission && !permission.granted ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <BigButton small primary title="Permitir câmara" onPress={requestPermission} />
          </View>
        ) : null}
        {['Rosto inteiro dentro da moldura, à altura dos olhos', 'Luz de frente, sem janela atrás da pessoa', 'Funciona com capacete e óculos de proteção'].map((tip) => (
          <Text key={tip} style={{ fontFamily: fonts.body, fontSize: vw(1.55), color: colors.ink2 }}>●  {tip}</Text>
        ))}
      </View>
    </View>
  );
}

interface ScreenSettingsProps {
  settings: ScreenSettings;
  onChange: (settings: ScreenSettings) => void;
  onUnlink: () => void;
  onBack: () => void;
}

export function ScreenSettingsScreen({ settings, onChange, onUnlink, onBack }: ScreenSettingsProps) {
  const vw = useVw();
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const row = (title: string, text: string, value: boolean, key: keyof ScreenSettings) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: vw(2), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: vw(1.6), padding: vw(1.6) }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.9), color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: vw(1.4), color: colors.ink2 }}>{text}</Text>
      </View>
      <Switch value={value} onValueChange={(next) => onChange({ ...settings, [key]: next })} trackColor={{ true: colors.ok }} accessibilityLabel={title} />
    </View>
  );
  return (
    <ScrollView contentContainerStyle={{ paddingTop: vw(7.5), paddingHorizontal: vw(4), paddingBottom: vw(3), gap: vw(1.4) }}>
      <AdminHeader title="Ecrã e bloqueio" onBack={onBack} />
      {row('Ecrã sempre ligado', 'O tablet não apaga o ecrã enquanto a app está aberta. Deixe-o ligado à corrente.', settings.keepAwake, 'keepAwake')}
      {row('Escurecer fora de horas', 'Entre as 20:00 e as 06:00 o ecrã fica mais escuro. Volta ao normal com um toque.', settings.dimAtNight, 'dimAtNight')}
      <Notice tone="info">
        Para não sair da app: Definições do Android › Segurança › Afixar app, e depois afixe a app Picagens. O bloqueio total (sem barra do Android) é feito na instalação assistida.
      </Notice>
      <View style={{ marginTop: vw(1), gap: vw(1) }}>
        {confirmUnlink ? (
          <>
            <Paragraph color={colors.danger}>O tablet deixa de picar para esta empresa e as picagens por enviar são apagadas. Para voltar a usar é preciso uma chave nova.</Paragraph>
            <View style={{ flexDirection: 'row', gap: vw(1.2) }}>
              <BigButton small title="Cancelar" onPress={() => setConfirmUnlink(false)} />
              <BigButton small primary title="Desligar este tablet" onPress={onUnlink} />
            </View>
          </>
        ) : (
          <LinkButton title="Desligar este tablet da empresa" onPress={() => setConfirmUnlink(true)} />
        )}
      </View>
    </ScrollView>
  );
}
