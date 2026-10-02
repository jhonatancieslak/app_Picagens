// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Posição lida no momento de picar (nunca em segundo plano). O servidor recusa posições com mais de
// 120 s ou pior do que ±1000 m quando a empresa bloqueia fora do local (picagem_service.py).
import * as Location from 'expo-location';

export interface Fix {
  lat: number;
  lon: number;
  accuracy: number;
  takenAt: number;
}

export type FixResult = { fix: Fix } | { error: 'denied' | 'disabled' | 'unavailable' };

export async function readPosition(): Promise<FixResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { error: 'denied' };
  if (!(await Location.hasServicesEnabledAsync())) return { error: 'disabled' };
  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      fix: {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy ?? 9999,
        takenAt: position.timestamp,
      },
    };
  } catch {
    return { error: 'unavailable' };
  }
}

export const FIX_ERROR_MESSAGES: Record<'denied' | 'disabled' | 'unavailable', string> = {
  denied: 'A localização está bloqueada para a Picagens. Permita nas definições do Android.',
  disabled: 'A localização do telemóvel está desligada. Ligue-a e tente de novo.',
  unavailable: 'Não foi possível obter a posição. Vá para um sítio aberto e tente de novo.',
};
