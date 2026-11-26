// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Confirmação biométrica opcional ao picar (impressão digital, rosto ou bloqueio do telemóvel). A verificação é feita pelo Android:
// a app só recebe «confirmou» ou «não confirmou»; nenhum dado biométrico é lido, guardado ou enviado (RGPD: a Picagens não trata a biometria).
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_KEY = 'employee_biometric';

export async function biometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export const getBiometricEnabled = async () => (await SecureStore.getItemAsync(BIOMETRIC_KEY)) === '1';
export const saveBiometricEnabled = (enabled: boolean) => SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? '1' : '0');

/** Pede ao Android a confirmação do dono do telemóvel. `true` só se confirmou. */
export async function confirmBiometric(reason: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: 'Cancelar' });
    return result.success;
  } catch {
    return false;
  }
}
