// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Sessão do colaborador no armazenamento seguro do Android (Keystore). Chaves separadas das do quiosque.
import * as SecureStore from 'expo-secure-store';

import type { Me } from './api';

const TOKEN_KEY = 'employee_token';
const ME_KEY = 'employee_me';
const COMPANY_CODE_KEY = 'company_code';

export const getEmployeeToken = () => SecureStore.getItemAsync(TOKEN_KEY);

export async function getCachedMe(): Promise<Me | null> {
  try {
    const raw = await SecureStore.getItemAsync(ME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const KEEP_KEY = 'employee_keep_session';

/** "Manter sessão neste telemóvel" (protótipo v6): desligado, a sessão só vive enquanto a app está aberta. */
export const getKeepSession = async () => (await SecureStore.getItemAsync(KEEP_KEY)) !== '0';
export const saveKeepSession = (keep: boolean) => SecureStore.setItemAsync(KEEP_KEY, keep ? '1' : '0');

export async function saveSession(token: string, me: Me) {
  if (!(await getKeepSession())) {
    await clearSession();
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(ME_KEY, JSON.stringify(me));
}

export async function clearSession() {
  await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(ME_KEY)]);
}

/** Último código da empresa usado: depois de terminar sessão não é preciso voltar a escrevê-lo. */
export const getLastCompanyCode = () => SecureStore.getItemAsync(COMPANY_CODE_KEY);
export const saveLastCompanyCode = (code: string) => SecureStore.setItemAsync(COMPANY_CODE_KEY, code);
