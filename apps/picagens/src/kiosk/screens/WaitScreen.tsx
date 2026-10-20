// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Ecrã de espera: relógio grande, um só botão (PIN) e o aviso da foto de confirmação (só se a empresa a usar).
import * as Application from 'expo-application';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { CameraIcon, KeypadIcon } from '../../components/icons';
import { BigButton, LinkButton, useVw } from '../../components/ui';
import { colors, fonts } from '../../theme';

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const two = (value: number) => String(value).padStart(2, '0');

export function formatDate(date: Date) {
  const text = `${WEEKDAYS[date.getDay()]}, ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
  return text[0].toUpperCase() + text.slice(1);
}

const ANDROID_RELEASES: Record<number, string> = { 28: '9', 29: '10', 30: '11', 31: '12', 32: '12L', 33: '13', 34: '14', 35: '15', 36: '16' };

export const androidLabel = () =>
  Platform.OS === 'android' ? `Android ${ANDROID_RELEASES[Platform.Version as number] ?? `API ${Platform.Version}`}` : Platform.OS;

export const versionLabel = () => `Picagens ${Application.nativeApplicationVersion ?? ''} · quiosque`;

interface Props {
  tabletName: string;
  place: string | null;
  address: string | null;
  /** A empresa usa a foto de confirmação (Gestão do App). */
  photo: boolean;
  onPin: () => void;
  onInfo: () => void;
  dimmed: boolean;
  onWake: () => void;
}

export function WaitScreen({ tabletName, place, address, photo, onPin, onInfo, dimmed, onWake }: Props) {
  const vw = useVw();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ flex: 1.15, justifyContent: 'center', paddingLeft: vw(4), paddingRight: vw(3), gap: vw(0.8) }}>
        <Text style={{ fontFamily: fonts.display, fontSize: vw(13), color: colors.ink, letterSpacing: -4 }} accessibilityLabel={`São ${now.getHours()} e ${now.getMinutes()}`}>
          {two(now.getHours())}:{two(now.getMinutes())}
          <Text style={{ fontSize: vw(5.6), color: colors.ink3, letterSpacing: -1 }}>:{two(now.getSeconds())}</Text>
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: vw(2.2), color: colors.ink2 }}>{formatDate(now)}</Text>
        <View style={{ marginTop: vw(1.4), alignSelf: 'flex-start', backgroundColor: colors.okSoft, borderRadius: 999, paddingHorizontal: vw(1.4), paddingVertical: vw(0.8) }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.5), color: colors.ok }}>✓ Tablet ativo nesta obra</Text>
        </View>
        {place || address ? (
          <View style={{ marginTop: vw(0.6), gap: vw(0.2) }} accessibilityLabel={`Local: ${[place, address].filter(Boolean).join(', ')}`}>
            {place ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.7), color: colors.ink }}>{place}</Text> : null}
            {address ? <Text style={{ fontFamily: fonts.body, fontSize: vw(1.5), color: colors.ink2 }}>{address}</Text> : null}
          </View>
        ) : null}
        {/* 2.5.0 (canvas 26): o PIN não se cria no tablet (aparelho partilhado); vê-se na app ou no link do email. */}
        <View style={{ marginTop: vw(1.6), alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: colors.actionSoft, borderRadius: vw(1.6), padding: vw(1.4), gap: vw(0.3) }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.6), color: colors.ink }}>Não sabe o seu PIN?</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: vw(1.45), color: colors.ink2 }}>Abra a app ou o link que recebeu por email e toque em «Ver o meu PIN».</Text>
        </View>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', paddingLeft: vw(1), paddingRight: vw(4), gap: vw(1.5) }}>
        <BigButton primary title="Picar com PIN" subtitle={photo ? 'Código de 4 dígitos, depois uma foto rápida' : 'Código de 4 dígitos'} icon={<KeypadIcon size={vw(3.3)} color="#fff" />} onPress={onPin} />
        {photo ? (
        <View style={{ flexDirection: 'row', gap: vw(1.1), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: vw(1.6), padding: vw(1.4) }}>
          <CameraIcon size={vw(2.4)} color={colors.action} />
          <View style={{ flex: 1, gap: vw(0.4) }}>
            <Text style={{ fontFamily: fonts.body, fontSize: vw(1.4), color: colors.ink2 }}>
              Ao picar, o tablet tira uma foto para confirmar que foi mesmo você.{' '}
              <Text style={{ fontFamily: fonts.bodyBold }}>Não fazemos reconhecimento facial.</Text>
            </Text>
            <LinkButton title="Saber mais" onPress={onInfo} />
          </View>
        </View>
        ) : null}
        <Text style={{ textAlign: 'center', fontFamily: fonts.body, fontSize: vw(1.3), color: colors.ink3 }}>O nome de quem picou só aparece por 5 segundos.</Text>
      </View>
      <Text style={{ position: 'absolute', left: vw(4), bottom: vw(2.4), fontFamily: fonts.bodyMedium, fontSize: vw(1.2), color: colors.ink3 }}>
        {versionLabel()} · Tablet “{tabletName}”
      </Text>
      {dimmed ? (
        <Pressable accessibilityLabel="Ecrã escurecido, toque para acordar" onPress={onWake} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.6)' }} />
      ) : null}
    </View>
  );
}
