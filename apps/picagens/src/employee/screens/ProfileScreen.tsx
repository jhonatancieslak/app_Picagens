// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Perfil (artboards p2311-perfil-termos, p2311-perfil-dados e p2311-termos-leitura, aprovados 24/11), aberto pelo avatar:
// foto, «A minha conta» (Meus dados, Esqueci o meu PIN, Política de privacidade, Termos de uso, Apagar minha conta),
// definições, «Desconectar» e a versão. Os dados, os textos legais e o apagar a conta vêm do mesmo serviço da PWA.
// Diferenças assumidas: ecrã inteiro em vez do painel que entra pela direita; «Lembretes para picar» no lugar de «Notificações».
import * as Application from 'expo-application';
import * as ImagePicker from 'expo-image-picker';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { KeyIcon, LockIcon, ShieldIcon, DocumentIcon, UserIcon } from '../../components/icons';
import { Bloco } from '../../components/Skeleton';
import { ApiError, NetworkError } from '../../http';
import { colors, fonts } from '../../theme';
import { LegalDocument, Me, ProfileData, employeeApi } from '../api';
import { getKeepSession, saveKeepSession } from '../storage';
import { Avatar, AvatarPhoto, BarraRodape, Button, ErrorText, Field, Header, Muted, Toggle } from '../ui';

const PHOTO_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true };
const errorText = (exc: unknown) => (exc instanceof NetworkError ? 'Sem ligação à internet. Tente de novo.' : exc instanceof ApiError ? exc.message : 'Não foi possível concluir. Tente de novo.');

interface Props {
  token: string;
  me: Me;
  photo: AvatarPhoto | null;
  onMeChange: (me: Me) => void;
  onAuthError: (error: unknown) => boolean;
  pending: number;
  onBack: () => void;
  onLogout: () => void;
  /** Abre «Esqueci o meu PIN» (artboard p2311-esqueci-pin). */
  onForgotPin: () => void;
  /** «Ver o meu PIN» (saiu do Hoje a 26/11, doc 252): só com `me.opcoes.ver_pin` (a empresa tem tablet ou PC de picagem). */
  onPin: () => void;
}

type View_ = 'main' | 'dados' | 'alterar' | 'termos' | 'privacidade' | 'apagar';

export function ProfileScreen({ token, me, photo, onMeChange, onAuthError, pending, onBack, onLogout, onForgotPin, onPin }: Props) {
  const [view, setView] = useState<View_>('main');
  const [keep, setKeep] = useState(true);
  const [choosingPhoto, setChoosingPhoto] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reminders = me.opcoes.lembretes_picagem !== false;

  useEffect(() => {
    getKeepSession().then(setKeep);
  }, []);

  async function changePhoto(camera: boolean) {
    setError('');
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        setError('Sem acesso à câmara. Permita nas definições do Android.');
        return;
      }
      const result = camera ? await ImagePicker.launchCameraAsync(PHOTO_OPTIONS) : await ImagePicker.launchImageLibraryAsync(PHOTO_OPTIONS);
      const base64 = !result.canceled ? result.assets[0]?.base64 : null;
      if (!base64) return;
      setBusy(true);
      const { foto_versao } = await employeeApi.uploadProfilePhoto(token, base64);
      onMeChange({ ...me, colaborador: { ...me.colaborador, foto_versao } });
      setChoosingPhoto(false);
    } catch (exc) {
      if (!onAuthError(exc)) setError(exc instanceof ApiError ? exc.message : 'Não foi possível guardar a foto. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setError('');
    setBusy(true);
    try {
      await employeeApi.deleteProfilePhoto(token);
      onMeChange({ ...me, colaborador: { ...me.colaborador, foto_versao: null } });
      setChoosingPhoto(false);
    } catch (exc) {
      if (!onAuthError(exc)) setError('Não foi possível remover a foto. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function changeReminders(value: boolean) {
    onMeChange({ ...me, opcoes: { ...me.opcoes, lembretes_picagem: value } });
    try {
      await employeeApi.setReminders(token, value);
    } catch (exc) {
      onMeChange({ ...me, opcoes: { ...me.opcoes, lembretes_picagem: !value } });
      if (!onAuthError(exc)) setError('Sem ligação: não foi possível mudar os lembretes.');
    }
  }

  if (view === 'dados' || view === 'alterar') {
    return <MyData token={token} editing={view === 'alterar'} onEdit={() => setView('alterar')} onDone={() => setView('dados')} onBack={() => setView(view === 'alterar' ? 'dados' : 'main')} onAuthError={onAuthError} />;
  }
  if (view === 'termos' || view === 'privacidade') {
    return <Legal token={token} which={view} onBack={() => setView('main')} onAuthError={onAuthError} />;
  }
  if (view === 'apagar') {
    return <DeleteAccount token={token} onBack={() => setView('main')} onDeleted={onLogout} onAuthError={onAuthError} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Header variante="faixaLogo" title="Perfil" subtitle="" onVoltar={onBack}
        right={<Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.surface }}>{me.colaborador.nome.split(/\s+/)[0]}</Text>} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <Avatar name={me.colaborador.nome} count={0} size={60} photo={photo} onPress={() => setChoosingPhoto(!choosingPhoto)} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink }}>{me.colaborador.nome}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 2 }}>{me.empresa.nome}{me.local ? ` · ${me.local}` : ''}</Text>
            <Pressable accessibilityRole="button" onPress={() => setChoosingPhoto(!choosingPhoto)} hitSlop={8} style={{ minHeight: 36, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ok }}>{photo ? 'Trocar imagem' : 'Pôr uma imagem'}</Text>
            </Pressable>
          </View>
        </View>

        {choosingPhoto ? (
          <View style={{ marginHorizontal: 20, gap: 8 }}>
            <Button primary tone="verde" title="Tirar foto" busy={busy} onPress={() => changePhoto(true)} />
            <Button ghost tone="faixa" title="Escolher da galeria" onPress={() => changePhoto(false)} />
            {photo ? <Button ghost danger title="Remover foto" onPress={removePhoto} /> : null}
          </View>
        ) : null}
        {error ? <View style={{ paddingHorizontal: 20 }}><ErrorText>{error}</ErrorText></View> : null}
        {pending ? <Text style={{ paddingHorizontal: 20, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.warnInk }}>{pending} picagem(ns) por enviar</Text> : null}

        <Text style={sectionStyle}>A minha conta</Text>
        <View style={listStyle}>
          <MenuRow icon={<UserIcon size={22} color={colors.band} />} label="Meus dados" onPress={() => setView('dados')} />
          {me.opcoes.ver_pin ? <MenuRow icon={<KeyIcon size={22} color={colors.band} />} label="Ver o meu PIN" onPress={onPin} /> : null}
          <MenuRow icon={<KeyIcon size={22} color={colors.band} />} label="Esqueci o meu PIN" onPress={onForgotPin} />
          <MenuRow icon={<ShieldIcon size={22} color={colors.band} />} label="Política de privacidade" onPress={() => setView('privacidade')} />
          <MenuRow icon={<DocumentIcon size={22} color={colors.band} />} label="Termos de uso" onPress={() => setView('termos')} />
          <MenuRow icon={<TrashIcon color={colors.danger} />} label="Apagar minha conta" danger last onPress={() => setView('apagar')} />
        </View>

        <Text style={sectionStyle}>Definições</Text>
        <View style={listStyle}>
          <Toggle flat title="Manter sessão neste telemóvel" subtitle="Não pede o PIN outra vez neste aparelho" value={keep} onChange={(value) => { setKeep(value); saveKeepSession(value); }} />
          <Toggle flat title="Lembretes para picar" subtitle="Aviso uns minutos antes da entrada e da saída" value={reminders} onChange={changeReminders} />
          <View style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>Localização</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3, marginTop: 1 }}>Só é lida ao picar</Text>
          </View>
        </View>
      </ScrollView>
      <BarraRodape>
        {confirming ? (
          <>
            <Muted size={13}>{pending ? `Atenção: ${pending} picagem(ns) ainda não foram enviadas e serão perdidas. Ligue-se à internet primeiro. ` : ''}Para voltar a entrar precisa do código da empresa, do NIF e do PIN.</Muted>
            <Button danger title="Terminar sessão" onPress={onLogout} />
            <Button ghost tone="faixa" title="Cancelar" onPress={() => setConfirming(false)} />
          </>
        ) : (
          <>
            <Button ghost tone="faixa" title="Desconectar" onPress={() => setConfirming(true)} />
            <Text style={{ textAlign: 'center', fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3 }}>
              Versão {Application.nativeApplicationVersion} · build {Application.nativeBuildVersion}
            </Text>
          </>
        )}
      </BarraRodape>
    </View>
  );
}

const sectionStyle = { marginTop: 14, marginHorizontal: 20, marginBottom: 4, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink2 } as const;
const listStyle = { marginHorizontal: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, overflow: 'hidden' } as const;

function Chevron() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

function TrashIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </Svg>
  );
}

function MenuRow({ icon, label, onPress, danger, last }: { icon: ReactNode; label: string; onPress: () => void; danger?: boolean; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line, opacity: pressed ? 0.8 : 1 })}>
      {icon}
      <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: danger ? colors.danger : colors.ink }}>{label}</Text>
      <Chevron />
    </Pressable>
  );
}

/** Meus dados e Alterar dados (artboard p2311-perfil-dados): nome e NIF só o RH altera; telemóvel, email e morada, a pessoa. */
function MyData({ token, editing, onEdit, onDone, onBack, onAuthError }: {
  token: string; editing: boolean; onEdit: () => void; onDone: () => void; onBack: () => void; onAuthError: (error: unknown) => boolean;
}) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const fill = useCallback((next: ProfileData) => {
    setData(next);
    setPhone(next.telefone_texto);
    setEmail(next.email);
    setAddress(next.morada);
  }, []);

  useEffect(() => {
    employeeApi.profileData(token).then(fill).catch((exc) => { if (!onAuthError(exc)) setError(errorText(exc)); });
  }, [token, fill, onAuthError]);

  async function save() {
    setBusy(true);
    setError('');
    try {
      fill(await employeeApi.saveProfileData(token, { telefone: phone, email, morada: address }));
      setSaved(true);
      onDone();
    } catch (exc) {
      if (!onAuthError(exc)) setError(exc instanceof ApiError ? exc.message : errorText(exc));
    } finally {
      setBusy(false);
    }
  }

  const row = (label: string, value: string, locked?: boolean) => (
    <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>{label}</Text>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
        <Text style={{ flexShrink: 1, textAlign: 'right', fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink }}>{value || '—'}</Text>
        {locked ? <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.ink3 }}>Só o RH</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Header variante="faixaLogo" title={editing ? 'Alterar dados' : 'Ver meus dados'} subtitle="" onVoltar={onBack} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        {!data && !error ? <><Bloco style={{ height: 52 }} /><Bloco style={{ height: 52 }} /><Bloco style={{ height: 52 }} /></> : null}
        {data && !editing ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
            {row('Nome', data.nome, true)}
            {row('NIF', data.nif_texto, true)}
            {row('Email', data.email)}
            {row('Telemóvel', data.telefone_texto)}
            {row('Morada', data.morada)}
          </View>
        ) : null}
        {data && editing ? (
          <>
            <Muted size={13}>O nome e o NIF só o RH pode alterar. Se estiverem errados, fale com o RH.</Muted>
            <Field label="Telemóvel" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} />
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={200} />
            <Field label="Morada" value={address} onChangeText={setAddress} multiline maxLength={300} />
          </>
        ) : null}
        {saved && !editing ? <Muted size={13}>O seu telemóvel, email e morada foram atualizados.</Muted> : null}
        <ErrorText>{error}</ErrorText>
      </ScrollView>
      <BarraRodape>
        {editing ? (
          <>
            <Button primary tone="verde" title={busy ? 'A guardar…' : 'Guardar alterações'} busy={busy} onPress={save} />
            <Button ghost tone="faixa" title="Cancelar" onPress={onDone} />
          </>
        ) : (
          <Button primary tone="verde" title="Alterar dados" disabled={!data} onPress={() => { setSaved(false); onEdit(); }} />
        )}
      </BarraRodape>
    </View>
  );
}

/** Ler os termos de uso e a política de privacidade (artboard p2311-termos-leitura): aviso de versão e texto a deslizar. */
function Legal({ token, which, onBack, onAuthError }: { token: string; which: 'termos' | 'privacidade'; onBack: () => void; onAuthError: (error: unknown) => boolean }) {
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    employeeApi.legal(token, which).then(setDoc).catch((exc) => { if (!onAuthError(exc)) setError(errorText(exc)); });
  }, [token, which, onAuthError]);

  return (
    <View style={{ flex: 1 }}>
      <Header variante="faixaLogo" title={which === 'termos' ? 'Termos de uso' : 'Política de privacidade'} subtitle="" onVoltar={onBack} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }}>
        {!doc && !error ? <><Bloco style={{ height: 40 }} /><Bloco style={{ height: 14, width: '90%' }} /><Bloco style={{ height: 14, width: '80%' }} /><Bloco style={{ height: 14, width: '85%' }} /></> : null}
        {doc ? (
          <>
            <View style={{ backgroundColor: colors.warnSoft, borderRadius: 12, padding: 12 }}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.warnInk }}>{doc.aviso} (versão {doc.versao})</Text>
            </View>
            {doc.seccoes.map((section) => (
              <View key={section.titulo} style={{ gap: 4 }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }}>{section.titulo}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, color: colors.ink2 }}>{section.texto}</Text>
              </View>
            ))}
          </>
        ) : null}
        <ErrorText>{error}</ErrorText>
      </ScrollView>
    </View>
  );
}

/** Apagar minha conta: diz o que fica guardado (lei) e pede o PIN. Ao concluir a sessão termina. */
function DeleteAccount({ token, onBack, onDeleted, onAuthError }: { token: string; onBack: () => void; onDeleted: () => void; onAuthError: (error: unknown) => boolean }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await employeeApi.deleteAccount(token, pin);
      onDeleted();
    } catch (exc) {
      if (!onAuthError(exc)) setError(errorText(exc));
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Header variante="faixaLogo" title="Apagar minha conta" subtitle="" onVoltar={onBack} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.dangerIconBg, alignItems: 'center', justifyContent: 'center' }}>
            <LockIcon size={24} color={colors.dangerIconInk} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink2 }}>Vai deixar de conseguir entrar. A sua foto e as notificações são apagadas.</Text>
        </View>
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16, gap: 6 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }}>O que fica guardado</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink2 }}>Os registos de ponto, os pedidos e os documentos ficam com a empresa: a lei obriga a guardá-los durante 5 anos (art. 202.º do Código do Trabalho).</Text>
        </View>
        <Field label="Escreva o seu PIN para confirmar" value={pin} onChangeText={(text) => { setPin(text.replace(/\D/g, '').slice(0, 4)); setError(''); }} keyboardType="number-pad" secureTextEntry maxLength={4} />
        <ErrorText>{error}</ErrorText>
      </ScrollView>
      <BarraRodape>
        <Button danger title={busy ? 'A apagar…' : 'Apagar minha conta'} busy={busy} disabled={pin.length !== 4} onPress={confirm} />
        <Button ghost tone="faixa" title="Cancelar" onPress={onBack} />
      </BarraRodape>
    </View>
  );
}
