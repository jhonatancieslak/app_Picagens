// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Motor do rosto (doc 77 §9.11): calcula no aparelho um modelo do rosto (vetor de números, não reversível) a partir
// de fotos que nunca saem do telemóvel nem do tablet, e compara dois modelos ali mesmo. O servidor só guarda o modelo
// cifrado. Telemóvel e quiosque usam este mesmo módulo.
//
// POR LIGAR: deteção (ML Kit) + modelo MobileFaceNet em TFLite exigem módulos nativos, logo um build novo (EAS).
// Até lá `faceEngineReady` é false e o ecrã de registo diz que o rosto ainda não está disponível nesta versão.
import { File } from 'expo-file-system';

export const FACE_ENGINE_VERSION = 'mobilefacenet-1';
/** Fotos por registo: de frente, com pequenas variações, para um modelo médio estável. */
export const FACE_SAMPLES = 3;
/** Semelhança mínima (cosseno) para aceitar a pessoa; afinar com testes reais antes de publicar. */
export const FACE_MATCH_THRESHOLD = 0.7;

export const faceEngineReady = false;

export class FaceEngineUnavailable extends Error {}

export interface FaceTemplate {
  modelo: string;
  versao: string;
}

/** Modelo médio das fotos. Apaga sempre as fotos, com ou sem sucesso. */
export async function computeFaceTemplate(photoUris: string[]): Promise<FaceTemplate> {
  try {
    throw new FaceEngineUnavailable('O reconhecimento do rosto chega na próxima versão da app.');
  } finally {
    photoUris.forEach(removeQuietly);
  }
}

/** true se o rosto das fotos corresponde ao modelo guardado. */
export async function matchesFaceTemplate(photoUris: string[], saved: FaceTemplate): Promise<boolean> {
  if (saved.versao !== FACE_ENGINE_VERSION) return false;
  const current = await computeFaceTemplate(photoUris);
  return cosine(decode(current.modelo), decode(saved.modelo)) >= FACE_MATCH_THRESHOLD;
}

function decode(base64: string): Float32Array {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Float32Array(bytes.buffer);
}

function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

function removeQuietly(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // a foto temporária já não existe
  }
}
