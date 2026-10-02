// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Token do tablet e preferências do ecrã no armazenamento seguro do Android (Keystore).
import * as SecureStore from 'expo-secure-store';

import type { KioskConfig } from './api';

const TOKEN_KEY = 'tablet_token';
const SCREEN_KEY = 'screen_settings';
const CONFIG_KEY = 'config_cache';

export interface ScreenSettings {
  keepAwake: boolean;
  dimAtNight: boolean;
}

export const DEFAULT_SCREEN_SETTINGS: ScreenSettings = { keepAwake: true, dimAtNight: false };

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const saveToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const deleteToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

export async function getScreenSettings(): Promise<ScreenSettings> {
  try {
    const raw = await SecureStore.getItemAsync(SCREEN_KEY);
    return raw ? { ...DEFAULT_SCREEN_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SCREEN_SETTINGS;
  } catch {
    return DEFAULT_SCREEN_SETTINGS;
  }
}

export const saveScreenSettings = (settings: ScreenSettings) =>
  SecureStore.setItemAsync(SCREEN_KEY, JSON.stringify(settings));

/** Última configuração recebida: o tablet volta a abrir sem rede (picagens vão para a fila). */
export async function getCachedConfig(): Promise<KioskConfig | null> {
  try {
    const raw = await SecureStore.getItemAsync(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const saveCachedConfig = (config: KioskConfig) => SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(config));

export async function clearAll() {
  await Promise.all([deleteToken(), SecureStore.deleteItemAsync(CONFIG_KEY), SecureStore.deleteItemAsync(SCREEN_KEY)]);
}
