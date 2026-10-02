// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Configuração inicial: a chave criada no painel (Gestão do App › Computadores e tablets) liga o
// tablet a uma empresa e a um local. Só se faz uma vez.
import { useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';

import { ApiError, NetworkError, api } from '../api';
import { BigButton, Heading, Logo, Paragraph, useVw } from '../components/ui';
import { colors, fonts } from '../theme';

const KEY_LENGTH = 12;

const formatKey = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, KEY_LENGTH).replace(/(.{4})(?=.)/g, '$1-');

export function SetupScreen({ onActivated }: { onActivated: (token: string) => void }) {
  const vw = useVw();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ token: string; empresa: string; tablet: string } | null>(null);
  const [, requestCameraPermission] = useCameraPermissions();

  async function activate() {
    setBusy(true);
    setError('');
    try {
      const model = String((Platform.constants as { Model?: string }).Model ?? 'Android');
      setFound(await api.activate(key, model));
    } catch (exc) {
      setError(exc instanceof NetworkError ? 'Sem ligação à internet. Ligue o tablet ao Wi-Fi e tente de novo.'
        : exc instanceof ApiError ? exc.message : 'Não foi possível ligar o tablet.');
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!found) return;
    await requestCameraPermission();
    onActivated(found.token);
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: vw(5), gap: vw(4) }}>
      <View style={{ flex: 1, gap: vw(1.6) }}>
        <Logo height={vw(5)} />
        <Heading>Configurar este tablet</Heading>
        <Paragraph>Só se faz uma vez. Depois o tablet fica ligado à obra e os colaboradores picam aqui.</Paragraph>
        <TextInput
          value={key}
          onChangeText={(text) => setKey(formatKey(text))}
          placeholder="XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Chave da empresa"
          style={{ fontFamily: fonts.display, fontSize: vw(3), letterSpacing: 4, paddingHorizontal: vw(1.8), paddingVertical: vw(1.2), borderRadius: vw(1.6), borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink }}
        />
        <Text accessibilityRole="alert" style={{ minHeight: vw(2.3), color: colors.danger, fontFamily: fonts.bodyBold, fontSize: vw(1.6) }}>{error}</Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <BigButton primary small title={busy ? 'A ligar…' : 'Ligar tablet'} onPress={activate} disabled={busy || key.length < KEY_LENGTH + 2} />
        </View>
      </View>
      <View style={{ flex: 1.1, gap: vw(1.6) }}>
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: vw(1.6), padding: vw(1.6), gap: vw(0.8) }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: vw(1.6), color: colors.ink }}>Onde encontro a chave?</Text>
          <Paragraph>No painel da empresa: Sistema › Gestão do App › Computadores e tablets › Novo tablet. A chave serve uma só vez e liga o tablet a um local.</Paragraph>
        </View>
        {found ? (
          <View style={{ backgroundColor: colors.okSoft, borderRadius: vw(1.8), padding: vw(2), gap: vw(1.2) }}>
            <Text style={{ fontFamily: fonts.bodyBold, color: colors.ok, fontSize: vw(1.6) }}>✓ Chave válida</Text>
            <Text style={{ fontFamily: fonts.bodyBold, color: colors.ink, fontSize: vw(2.4) }}>{found.empresa}</Text>
            <Paragraph>Tablet “{found.tablet}”. A seguir o Android pede acesso à câmara, para a foto de confirmação das picagens.</Paragraph>
            <View style={{ alignSelf: 'flex-start' }}>
              <BigButton primary small title="Começar a picar" onPress={start} />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
