// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Modo do dispositivo, escolhido no 1.º arranque: telemóvel do colaborador ou tablet de quiosque.
// Fica guardado; só volta à escolha quando a sessão termina (colaborador) ou o tablet é desligado (admin).
import * as SecureStore from 'expo-secure-store';

export type DeviceMode = 'employee' | 'kiosk';

const MODE_KEY = 'device_mode';

export async function getDeviceMode(): Promise<DeviceMode | null> {
  const value = await SecureStore.getItemAsync(MODE_KEY);
  return value === 'employee' || value === 'kiosk' ? value : null;
}

export const saveDeviceMode = (mode: DeviceMode) => SecureStore.setItemAsync(MODE_KEY, mode);
export const clearDeviceMode = () => SecureStore.deleteItemAsync(MODE_KEY);
