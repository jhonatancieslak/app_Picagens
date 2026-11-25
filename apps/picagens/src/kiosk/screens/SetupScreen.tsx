// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Ligar o tablet (doc 49 §9): chave de ativação criada no painel (Picagem e app, ex-Gestão do App › Computadores e tablets),
// escrita, colada ou lida pelo QR. Passos: 1 Chave → 2 Confirmar (empresa e local, sem gastar a chave) →
// 3 Ativar. A câmara só se pede ao carregar em «Ler QR do painel» (nunca na ativação). No canto, "Sou colaborador" volta à entrada do telemóvel.
// Layout: em coluna quando a largura é pequena (telemóvel em paisagem), com deslocamento vertical para nada ficar cortado.
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { ReactNode, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { ApiError, KeyCheck, NetworkError, api } from '../api';
import { ClipboardIcon, QrIcon } from '../../components/icons';
import { BigButton, Heading, LinkButton, Logo, Paragraph, useVw } from '../../components/ui';
import { BAR_HEIGHT_VW } from '../TopBar';
import { colors, fonts } from '../../theme';

const KEY_LENGTH = 12;
/** Abaixo desta largura (dp) o ecrã de ativação passa a coluna, para caber num telemóvel em paisagem. */
const NARROW_WIDTH_DP = 700;
/** Letras e números das chaves de ativação: o servidor (`desktop_api.ALFABETO_CHAVE`) não usa 0, O, 1, I nem L, para a chave se poder escrever à mão. */
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const invalidKeyChars = (value: string) => [...new Set(value.toUpperCase().replace(/[^A-Z0-9]/g, '').split('').filter((char) => !KEY_ALPHABET.includes(char)))];
const KEY_IN_TEXT = /([A-Z0-9]{4})-?([A-Z0-9]{4})-?([A-Z0-9]{4})/i;

const formatKey = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, KEY_LENGTH).replace(/(.{4})(?=.)/g, '$1-');

const keyFrom = (text: string) => {
  const match = text.match(KEY_IN_TEXT);
  return match ? formatKey(match.slice(1).join('')) : null;
};

function errorText(exc: unknown, fallback: string) {
  if (exc instanceof NetworkError) return 'Sem ligação à internet. Ligue o tablet ao Wi-Fi e tente de novo.';
  if (exc instanceof ApiError) return exc.message;
  return fallback;
}

type Step = 0 | 1 | 2;

export function SetupScreen({ onActivated, onBack }: { onActivated: (token: string) => void; onBack: () => void }) {
  const vw = useVw();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [found, setFound] = useState<KeyCheck | null>(null);
  const [scanning, setScanning] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [permission, requestCameraPermission] = useCameraPermissions();
  const scanned = useRef(false);
  const { width } = useWindowDimensions();
  const narrow = width < NARROW_WIDTH_DP;

  async function verify(value = key) {
    const wrong = invalidKeyChars(value);
    if (wrong.length) {
      setError(`Há caracteres que não existem nas chaves (${wrong.join(' ')}): elas não usam 0, O, 1, I nem L. Confirme o que escreveu.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      setFound(await api.verify(value));
      setStep(1);
    } catch (exc) {
      setError(errorText(exc, 'Não foi possível verificar a chave.'));
    } finally {
      setBusy(false);
    }
  }

  async function paste() {
    const value = keyFrom(await Clipboard.getStringAsync());
    if (!value) {
      setError('Não há nenhuma chave copiada. Copie a chave do email ou do painel e tente de novo.');
      return;
    }
    setKey(value);
    verify(value);
  }

  async function startScan() {
    setError('');
    const granted = permission?.granted || (await requestCameraPermission()).granted;
    if (!granted) {
      setError('Sem acesso à câmara não é possível ler o QR. Escreva a chave.');
      return;
    }
    scanned.current = false;
    setScanning(true);
  }

  function onScan({ data }: BarcodeScanningResult) {
    if (scanned.current) return;
    const value = keyFrom(data);
    if (!value) return;
    scanned.current = true;
    setScanning(false);
    setKey(value);
    verify(value);
  }

  async function activate() {
    setBusy(true);
    setError('');
    try {
      const model = String((Platform.constants as { Model?: string }).Model ?? 'Android');
      const result = await api.activate(key, model);
      setStep(2);
      onActivated(result.token);
    } catch (exc) {
      setError(errorText(exc, 'Não foi possível ligar o tablet.'));
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setFound(null);
    setKey('');
    setStep(0);
    setError('');
  }

  const keyBox = (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: vw(1.6), padding: vw(1.8), gap: vw(0.6) }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.7), color: colors.ink }}>Onde está a chave?</Text>
      <Paragraph>O gestor gera-a no painel da empresa: Empresa › Picagem e app › Computadores e tablets › Tablet de quiosque.</Paragraph>
      <Paragraph>Aparece como texto e como QR, e pode ser enviada por email. Serve uma só vez e expira em 7 dias.</Paragraph>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: vw(BAR_HEIGHT_VW), backgroundColor: colors.band, borderBottomLeftRadius: vw(2.1), borderBottomRightRadius: vw(2.1), justifyContent: 'center', paddingHorizontal: vw(2.7), elevation: 6 }}>
        <Logo white height={vw(2.9)} />
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: vw(5.8), paddingVertical: vw(3) }}>
      <View style={{ flexDirection: narrow ? 'column' : 'row', alignItems: narrow ? 'stretch' : 'center', gap: vw(4.8) }}>
        <View style={{ flex: narrow ? 0 : 1, gap: vw(1.5) }}>
          <Heading>Ligar este tablet</Heading>
          <Paragraph>Só se faz uma vez. Depois o tablet fica na obra e os colaboradores picam aqui com o PIN.</Paragraph>
          {keyBox}
        </View>

        <View style={{ flex: narrow ? 0 : 1, gap: vw(1.4) }}>
          {scanning ? (
            <View style={{ gap: vw(1) }}>
              <View style={{ aspectRatio: 4 / 3, borderRadius: vw(1.8), overflow: 'hidden', backgroundColor: colors.band }}>
                <CameraView style={{ flex: 1 }} facing={facing} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
              </View>
              <View style={{ flexDirection: 'row', gap: vw(1.5), alignItems: 'center' }}>
                <Paragraph>Aponte para o QR da chave no painel.</Paragraph>
                <SmallButton title="Virar câmara" onPress={() => setFacing((side) => (side === 'front' ? 'back' : 'front'))} />
                <SmallButton title="Cancelar" onPress={() => setScanning(false)} />
              </View>
            </View>
          ) : found ? (
            <View style={{ backgroundColor: colors.okSoft, borderRadius: vw(1.8), padding: vw(2), gap: vw(1.1) }}>
              <Text style={{ fontFamily: fonts.bodyBold, color: colors.ok, fontSize: vw(1.6) }}>✓ Chave válida</Text>
              <Fact label="Empresa" value={found.empresa} />
              <Fact label="Local" value={found.local ?? 'Sem local (posição do tablet)'} />
              {found.local_morada ? <Fact label="Morada" value={found.local_morada} /> : null}
              <Fact label="Nome" value={`Tablet “${found.tablet}”`} />
              <Fact label="Acessos" value={found.acessos.limite ? `${found.acessos.em_uso} de ${found.acessos.limite} do plano` : `${found.acessos.em_uso} (plano sem limite)`} />
              <Paragraph>Não se tiram fotos nem se reconhece o rosto. A câmara só é usada se ler o QR com «Ler QR do painel».</Paragraph>
              <Text accessibilityRole="alert" style={{ minHeight: vw(2.3), color: colors.danger, fontFamily: fonts.bodyBold, fontSize: vw(1.5) }}>{error}</Text>
              <View style={{ flexDirection: 'row', gap: vw(1.2) }}>
                <BigButton primary small title={busy ? 'A ligar…' : 'Ligar este tablet'} onPress={activate} disabled={busy} />
                <BigButton small title="Não é esta empresa" onPress={restart} />
              </View>
            </View>
          ) : (
            <>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.5), color: colors.ink2 }}>Chave de ativação</Text>
              <TextInput
                value={key}
                onChangeText={(text) => { setKey(formatKey(text)); setError(''); if (step) restart(); }}
                placeholder="XXXX-XXXX-XXXX"
                placeholderTextColor={colors.ink3}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
                importantForAutofill="no"
                keyboardType="visible-password"
                accessibilityLabel="Chave de ativação"
                style={{ fontFamily: fonts.bodyBold, fontSize: vw(2.1), letterSpacing: vw(0.3), paddingHorizontal: vw(1.8), paddingVertical: vw(1.3), borderRadius: vw(1.4), borderWidth: 1.5, borderColor: colors.fieldBorder, backgroundColor: colors.surface, color: colors.ink }}
              />
              <View style={{ flexDirection: 'row', gap: vw(1) }}>
                <View style={{ flex: 1 }}><SmallButton wide icon={<ClipboardIcon size={vw(2.1)} color={colors.band} />} title="Colar" onPress={paste} /></View>
                <View style={{ flex: 1 }}><SmallButton wide icon={<QrIcon size={vw(2.1)} color={colors.band} />} title="Ler QR do painel" onPress={startScan} /></View>
              </View>
              <Text accessibilityRole="alert" style={{ minHeight: vw(2.3), color: colors.danger, fontFamily: fonts.bodyBold, fontSize: vw(1.5) }}>{error}</Text>
              <BigButton primary small title={busy ? 'A verificar…' : 'Ligar tablet'} onPress={() => verify()} disabled={busy || key.length < KEY_LENGTH + 2} />
              <LinkButton title="Sou colaborador" onPress={onBack} />
            </>
          )}
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const vw = useVw();
  return (
    <View style={{ flexDirection: 'row', gap: vw(1.6) }}>
      <Text style={{ width: vw(8), fontFamily: fonts.body, fontSize: vw(1.5), color: colors.ink2 }}>{label}</Text>
      <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: vw(1.5), color: colors.ink }}>{value}</Text>
    </View>
  );
}

function SmallButton({ title, icon, onPress, wide }: { title: string; icon?: ReactNode; onPress: () => void; wide?: boolean }) {
  const vw = useVw();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: vw(0.7), paddingHorizontal: vw(1.4), paddingVertical: vw(1.2), borderRadius: vw(1.4), borderWidth: 1.5, borderColor: colors.band, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1, ...(wide ? { alignSelf: 'stretch' } : null) })}
    >
      {icon}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.5), color: colors.band }}>{title}</Text>
    </Pressable>
  );
}
