// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// App Picagens: uma só app para o telemóvel do colaborador e para o tablet de quiosque da obra.
// No 1.º arranque escolhe-se o modo; cada modo tem a sua API, o seu armazenamento e a sua orientação.
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DeviceMode, clearDeviceMode, getDeviceMode, saveDeviceMode } from './src/deviceMode';
import { EmployeeApp } from './src/employee/EmployeeApp';
import { parseActivationLink } from './src/employee/screens/LoginScreen';
import { KioskApp } from './src/kiosk/KioskApp';
import { ModeScreen } from './src/ModeScreen';
import { colors } from './src/theme';

const ORIENTATION: Record<DeviceMode | 'choose', ScreenOrientation.OrientationLock> = {
  choose: ScreenOrientation.OrientationLock.DEFAULT,
  employee: ScreenOrientation.OrientationLock.PORTRAIT_UP,
  kiosk: ScreenOrientation.OrientationLock.LANDSCAPE,
};

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold });
  const [mode, setMode] = useState<DeviceMode | null | undefined>(undefined);

  // Link de ativação do email num telemóvel ainda sem modo escolhido: é um colaborador.
  useEffect(() => {
    (async () => {
      const [saved, url] = await Promise.all([getDeviceMode(), Linking.getInitialURL()]);
      if (!saved && url && parseActivationLink(url)) {
        await saveDeviceMode('employee');
        setMode('employee');
        return;
      }
      setMode(saved);
    })();
  }, []);

  useEffect(() => {
    if (mode === undefined) return;
    ScreenOrientation.lockAsync(ORIENTATION[mode ?? 'choose']).catch(() => undefined);
  }, [mode]);

  const choose = useCallback(async (next: DeviceMode) => {
    await saveDeviceMode(next);
    setMode(next);
  }, []);

  const leave = useCallback(async () => {
    await clearDeviceMode();
    setMode(null);
  }, []);

  if (!fontsLoaded || mode === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.action} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {mode === 'kiosk' ? <KioskApp onLeave={leave} /> : null}
      {mode === 'employee' ? <EmployeeApp onLeave={leave} /> : null}
      {mode === null ? <ModeScreen onChoose={choose} /> : null}
    </SafeAreaProvider>
  );
}
