// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Posição lida em Hoje e no momento de picar (nunca em segundo plano): com a app aberta em Hoje atualiza-se a cada
// ~20 s (watchPosition) para o mapa mostrar onde a pessoa está (2.3.0, doc 49 §14). O servidor recusa posições com
// mais de 120 s ou pior do que ±1000 m quando a empresa bloqueia fora do local (picagem_service.py). `mocked` vem
// do Android quando a posição é de uma app de GPS falso: segue para o servidor, que a marca (doc 52 §4 A).
import * as Location from 'expo-location';

export interface Fix {
  lat: number;
  lon: number;
  accuracy: number;
  takenAt: number;
  mocked: boolean;
}

const WATCH_INTERVAL_MS = 20 * 1000;
const WATCH_DISTANCE_M = 10;
/** Limites para picar depressa (o servidor recusa posições com mais de 120 s quando a empresa bloqueia fora do local). */
const FRESH_FIX_MAX_AGE_MS = 60 * 1000;
const RECENT_FIX_MAX_AGE_MS = 60 * 1000;
const RECENT_FIX_MAX_ERROR_M = 100;
const STALE_FIX_MAX_AGE_MS = 5 * 60 * 1000;
const FIX_TIMEOUT_MS = 4 * 1000;

const toFix = (position: Location.LocationObject): Fix => ({
  lat: position.coords.latitude,
  lon: position.coords.longitude,
  accuracy: position.coords.accuracy ?? 9999,
  takenAt: position.timestamp,
  mocked: position.mocked === true,
});

export type FixResult = { fix: Fix } | { error: 'denied' | 'disabled' | 'unavailable' };

export async function readPosition(): Promise<FixResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { error: 'denied' };
  if (!(await Location.hasServicesEnabledAsync())) return { error: 'disabled' };
  try {
    // Rápido primeiro: uma posição recente do sistema basta (o servidor decide pela idade e precisão que recebe).
    const recent = await Location.getLastKnownPositionAsync({ maxAge: RECENT_FIX_MAX_AGE_MS, requiredAccuracy: RECENT_FIX_MAX_ERROR_M });
    if (recent) return { fix: toFix(recent) };
    // Leitura nova com limite de tempo: o GPS a frio dentro de um edifício não pode prender o botão de picar.
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
    ]);
    if (fresh) return { fix: toFix(fresh) };
    const stale = await Location.getLastKnownPositionAsync({ maxAge: STALE_FIX_MAX_AGE_MS });
    return stale ? { fix: toFix(stale) } : { error: 'unavailable' };
  } catch {
    return { error: 'unavailable' };
  }
}

/** Posição já lida pelo ecrã Hoje, ainda fresca: picar não precisa de esperar por nova leitura. */
export const isFreshFix = (fix: Fix | null | undefined): fix is Fix => !!fix && Date.now() - fix.takenAt < FRESH_FIX_MAX_AGE_MS;

/** Segue a posição enquanto o ecrã está aberto (só com a permissão já dada; não pede). Devolve a função para parar. */
export async function watchPosition(onFix: (fix: Fix) => void): Promise<() => void> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return () => undefined;
  try {
    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: WATCH_INTERVAL_MS, distanceInterval: WATCH_DISTANCE_M },
      (position) => onFix(toFix(position)),
    );
    return () => subscription.remove();
  } catch {
    return () => undefined;
  }
}

/** Morada aproximada da posição atual ("Rua X 12, Lisboa"), pelo serviço de geocodificação do Android. */
export async function addressOf(fix: Fix): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: fix.lat, longitude: fix.lon });
    if (!place) return null;
    const street = [place.street, place.streetNumber].filter(Boolean).join(' ');
    return [street || place.name, place.city || place.subregion].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}

export const FIX_ERROR_MESSAGES: Record<'denied' | 'disabled' | 'unavailable', string> = {
  denied: 'A localização está bloqueada para a Picagens. Permita nas definições do Android.',
  disabled: 'A localização do telemóvel está desligada. Ligue-a e tente de novo.',
  unavailable: 'Não foi possível obter a posição. Vá para um sítio aberto e tente de novo.',
};
