// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Aviso de versão nova enquanto a app é distribuída por APK (fora da Google Play): o servidor diz qual é a versão
// mais recente e o link; a app compara com a instalada. O APK novo instala-se por cima (mesma chave de assinatura).
import { appVersion } from './http';

const parts = (version: string) => version.split('.').map((part) => Number.parseInt(part, 10) || 0);

/** true se `latest` for mais recente do que `current` (ex.: 2.2.0 > 2.1.3). */
export function isNewer(latest: string | undefined | null, current = appVersion) {
  if (!latest) return false;
  const a = parts(latest);
  const b = parts(current);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) > (b[index] ?? 0);
  }
  return false;
}

/** Link do APK quando não vem do servidor (o mesmo de Gestão do App › App Picagens). */
export const DEFAULT_UPDATE_URL = 'https://picagens.pt/downloads/android/picagens.apk';
