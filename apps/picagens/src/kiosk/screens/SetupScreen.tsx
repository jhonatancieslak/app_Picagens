// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Ligar o tablet (doc 49 §9): chave de ativação criada no painel (Gestão do App › Computadores e tablets),
// escrita, colada ou lida pelo QR. Passos: 1 Chave → 2 Confirmar (empresa e local, sem gastar a chave) →
// 3 Câmara. No canto, "Sou colaborador" volta à entrada do telemóvel.
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { ReactNode, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { ApiError, KeyCheck, NetworkError, api } from '../api';
import { ClipboardIcon, PhoneIcon, QrIcon } from '../../components/icons';
import { BigButton, CornerButton, Heading, Logo, Paragraph, useVw } from '../../components/ui';
import { colors, fonts } from '../../theme';

const KEY_LENGTH = 12;
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
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [permission, requestCameraPermission] = useCameraPermissions();
  const scanned = useRef(false);

  async function verify(value = key) {
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
      if (!permission?.granted) await requestCameraPermission();
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

  return (
    <View style={{ flex: 1 }}>
      <CornerButton label="Sou colaborador" icon={<PhoneIcon size={16} color={colors.ink2} />} onPress={onBack} top={14} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: vw(5), paddingTop: vw(4), gap: vw(4) }}>
        <View style={{ flex: 1, gap: vw(1.5) }}>
          <Logo height={vw(4.5)} />
          <Steps current={step} />
          <Heading>Ligar este tablet</Heading>
          <Paragraph>Só se faz uma vez. Depois o tablet fica na obra e os colaboradores picam aqui com o PIN.</Paragraph>
          <View style={{ flexDirection: 'row', gap: vw(1) }}>
            <TextInput
              value={key}
              onChangeText={(text) => { setKey(formatKey(text)); setError(''); if (step) restart(); }}
              placeholder="XXXX-XXXX-XXXX"
              placeholderTextColor={colors.ink3}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Chave de ativação"
              style={{ flex: 1, fontFamily: fonts.display, fontSize: vw(2.4), letterSpacing: vw(0.3), paddingHorizontal: vw(1.6), paddingVertical: vw(1.2), borderRadius: vw(1.6), borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink }}
            />
            <SmallButton icon={<ClipboardIcon size={vw(2.1)} color={colors.action} />} title="Colar" onPress={paste} />
          </View>
          <Text accessibilityRole="alert" style={{ minHeight: vw(2.3), color: colors.danger, fontFamily: fonts.bodyBold, fontSize: vw(1.5) }}>{error}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: vw(1.5) }}>
            <BigButton primary small title={busy && step === 0 ? 'A verificar…' : 'Ligar tablet'} onPress={() => verify()} disabled={busy || key.length < KEY_LENGTH + 2 || step > 0} />
            <SmallButton icon={<QrIcon size={vw(2.1)} color={colors.action} />} title="Ler QR do painel" onPress={startScan} />
          </View>
        </View>

        <View style={{ flex: 1.05, gap: vw(1.6) }}>
          {scanning ? (
            <View style={{ gap: vw(1) }}>
              <View style={{ aspectRatio: 4 / 3, borderRadius: vw(1.8), overflow: 'hidden', backgroundColor: '#232A35' }}>
                <CameraView style={{ flex: 1 }} facing={facing} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
              </View>
              <View style={{ flexDirection: 'row', gap: vw(1.5), alignItems: 'center' }}>
                <Paragraph>Aponte para o QR da chave no painel.</Paragraph>
                <SmallButton title="Trocar câmara" onPress={() => setFacing((side) => (side === 'front' ? 'back' : 'front'))} />
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
              <Paragraph>A seguir o Android pede a câmara: serve só para a foto de confirmação de cada picagem (30 dias, cifrada, sem reconhecimento facial).</Paragraph>
              <View style={{ flexDirection: 'row', gap: vw(1.2) }}>
                <BigButton primary small title={busy ? 'A ligar…' : 'Permitir câmara e começar'} onPress={activate} disabled={busy} />
                <BigButton small title="Não é esta empresa" onPress={restart} />
              </View>
            </View>
          ) : (
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: vw(1.6), padding: vw(1.8), gap: vw(0.9) }}>
              <View style={{ flexDirection: 'row', gap: vw(1.6), alignItems: 'center' }}>
                <View style={{ width: vw(9), height: vw(9), borderRadius: vw(1.4), borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
                  <QrIcon size={vw(6)} color={colors.ink} />
                </View>
                <View style={{ flex: 1, gap: vw(0.5) }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.7), color: colors.ink }}>Onde está a chave?</Text>
                  <Paragraph>O gestor gera-a no painel da empresa: Sistema › Gestão do App › Computadores e tablets › Tablet de quiosque.</Paragraph>
                </View>
              </View>
              <Paragraph>Aparece como texto e como QR, e pode ser enviada por email. Serve uma só vez e expira em 7 dias.</Paragraph>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function Steps({ current }: { current: Step }) {
  const vw = useVw();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: vw(1) }} accessibilityLabel={`Passo ${current + 1} de 3`}>
      {['Chave', 'Confirmar', 'Câmara'].map((label, index) => {
        const done = index < current;
        const on = index === current;
        return (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: vw(0.6) }}>
            {index ? <View style={{ width: vw(2), height: 2, backgroundColor: colors.line }} /> : null}
            <View style={{ width: vw(2.4), height: vw(2.4), borderRadius: 99, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? colors.ok : on ? colors.action : colors.line }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.2), color: done || on ? '#fff' : colors.ink2 }}>{done ? '✓' : index + 1}</Text>
            </View>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.35), color: on ? colors.ink : colors.ink3 }}>{label}</Text>
          </View>
        );
      })}
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

function SmallButton({ title, icon, onPress }: { title: string; icon?: ReactNode; onPress: () => void }) {
  const vw = useVw();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: vw(0.7), paddingHorizontal: vw(1.4), paddingVertical: vw(1), borderRadius: vw(1.4), borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 })}
    >
      {icon}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.45), color: colors.action }}>{title}</Text>
    </Pressable>
  );
}
