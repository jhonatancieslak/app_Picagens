// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// App Picagens: uma só app para o telemóvel do colaborador e para o tablet de quiosque da obra.
// Abre sempre na entrada do colaborador; o botão "Quiosque" no canto passa o aparelho a tablet da empresa
// (doc 49). Cada modo tem a sua API, o seu armazenamento e a sua orientação.
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { REACHABILITY_URL } from './src/config';
import { DeviceMode, clearDeviceMode, getDeviceMode, saveDeviceMode } from './src/deviceMode';
import { EmployeeApp } from './src/employee/EmployeeApp';
import { KioskApp } from './src/kiosk/KioskApp';
import { colors } from './src/theme';

const ORIENTATION: Record<DeviceMode, ScreenOrientation.OrientationLock> = {
  employee: ScreenOrientation.OrientationLock.PORTRAIT_UP,
  kiosk: ScreenOrientation.OrientationLock.LANDSCAPE,
};

NetInfo.configure({ reachabilityUrl: REACHABILITY_URL, reachabilityTest: async (response) => response.status === 200, reachabilityRequestTimeout: 10 * 1000 });

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold });
  const [mode, setMode] = useState<DeviceMode | undefined>(undefined);

  useEffect(() => {
    getDeviceMode().then((saved) => setMode(saved ?? 'employee'));
  }, []);

  useEffect(() => {
    if (mode) ScreenOrientation.lockAsync(ORIENTATION[mode]).catch(() => undefined);
  }, [mode]);

  const toKiosk = useCallback(async () => {
    await saveDeviceMode('kiosk');
    setMode('kiosk');
  }, []);

  const toEmployee = useCallback(async () => {
    await clearDeviceMode();
    setMode('employee');
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
      {mode === 'kiosk' ? <KioskApp onLeave={toEmployee} /> : <EmployeeApp onKiosk={toKiosk} />}
    </SafeAreaProvider>
  );
}
