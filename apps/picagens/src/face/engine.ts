// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Motor do rosto (doc 77 §9.11): calcula no aparelho um modelo do rosto (vetor de 128 números, não reversível) a
// partir de fotos que nunca saem do telemóvel nem do tablet, e compara dois modelos ali mesmo. O servidor só guarda
// o modelo cifrado. Telemóvel e quiosque usam este mesmo módulo.
//
// Passos por foto: orientação corrigida → ML Kit encontra um só rosto, de frente → recorte com margem →
// 112×112 → MobileFaceNet (assets/models, Apache-2.0) → vetor normalizado. Várias fotos = média normalizada.
import FaceDetection, { Face } from '@react-native-ml-kit/face-detection';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as jpeg from 'jpeg-js';
import { TfliteModel, loadTensorflowModel } from 'react-native-fast-tflite';

export const FACE_ENGINE_VERSION = 'mobilefacenet-1';
/** Fotos por registo: um modelo médio é mais estável do que uma foto só. */
export const FACE_SAMPLES = 3;
/** Semelhança mínima (cosseno) para aceitar a pessoa. Valor de partida para MobileFaceNet/ArcFace: afinar com
 *  testes reais (mesma pessoa vs. colegas) antes de pôr em produção numa empresa. */
export const FACE_MATCH_THRESHOLD = 0.6;

const INPUT_SIZE = 112;
const EMBEDDING_SIZE = 128;
const FACE_MARGIN = 0.15; // margem à volta do rosto no recorte (o modelo foi treinado com a testa e o queixo)
const MAX_HEAD_TURN_DEGREES = 20;
const MIN_FACE_RATIO = 0.2; // rosto com pelo menos 20 % da largura da foto (perto da câmara)
const WORK_WIDTH_PX = 720; // fotos reduzidas antes da deteção: rápido e suficiente para 112×112

export class FaceEngineUnavailable extends Error {}
export class FaceNotUsable extends Error {}

export interface FaceTemplate {
  modelo: string;
  versao: string;
}

let modelPromise: Promise<TfliteModel> | null = null;

function model(): Promise<TfliteModel> {
  if (!modelPromise) {
    modelPromise = loadTensorflowModel(require('../../assets/models/mobile_facenet.tflite'), []).catch((error) => {
      modelPromise = null;
      throw new FaceEngineUnavailable(`Não foi possível carregar o reconhecimento do rosto (${String(error)}).`);
    });
  }
  return modelPromise;
}

/** Modelo médio das fotos. Apaga sempre as fotos, com ou sem sucesso. */
export async function computeFaceTemplate(photoUris: string[]): Promise<FaceTemplate> {
  try {
    const vectors: Float32Array[] = [];
    for (const uri of photoUris) vectors.push(await embeddingOf(uri));
    if (!vectors.length) throw new FaceNotUsable('Não foi possível ler o rosto. Tente de novo.');
    return { modelo: encode(average(vectors)), versao: FACE_ENGINE_VERSION };
  } finally {
    photoUris.forEach(removeQuietly);
  }
}

/** Compara uma foto (ficheiro) com o modelo guardado. Apaga a foto. */
export async function matchesFaceTemplate(photoUri: string, saved: FaceTemplate): Promise<boolean> {
  if (saved.versao !== FACE_ENGINE_VERSION) return false;
  const current = await computeFaceTemplate([photoUri]);
  return cosine(decode(current.modelo), decode(saved.modelo)) >= FACE_MATCH_THRESHOLD;
}

/** Igual, para a foto do quiosque, que já vem em base64 (JPEG). */
export async function matchesFaceTemplateBase64(photoBase64: string, saved: FaceTemplate): Promise<boolean> {
  const file = new File(Paths.cache, `rosto-${Date.now()}.jpg`);
  file.create();
  file.write(Uint8Array.from(atob(photoBase64), (char) => char.charCodeAt(0)));
  return matchesFaceTemplate(file.uri, saved);
}

async function embeddingOf(uri: string): Promise<Float32Array> {
  // 1. Orientação aplicada e foto reduzida: a deteção e o recorte passam a usar as mesmas coordenadas.
  const upright = await (await ImageManipulator.manipulate(uri).resize({ width: WORK_WIDTH_PX, height: null }).renderAsync())
    .saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  try {
    const faces = await FaceDetection.detect(upright.uri, { performanceMode: 'accurate', minFaceSize: MIN_FACE_RATIO });
    const face = usableFace(faces, upright.width);
    // 2. Recorte quadrado com margem, dentro dos limites da foto.
    const side = Math.min(Math.max(face.frame.width, face.frame.height) * (1 + 2 * FACE_MARGIN), upright.width, upright.height);
    const centerX = face.frame.left + face.frame.width / 2;
    const centerY = face.frame.top + face.frame.height / 2;
    const originX = Math.round(clamp(centerX - side / 2, 0, upright.width - side));
    const originY = Math.round(clamp(centerY - side / 2, 0, upright.height - side));
    const crop = await (await ImageManipulator.manipulate(upright.uri)
      .crop({ originX, originY, width: Math.floor(side), height: Math.floor(side) })
      .resize({ width: INPUT_SIZE, height: INPUT_SIZE })
      .renderAsync())
      .saveAsync({ format: SaveFormat.JPEG, compress: 1, base64: true });
    removeQuietly(crop.uri);
    // 3. Píxeis RGB → tensor NCHW 0–1 → MobileFaceNet.
    const pixels = jpeg.decode(Uint8Array.from(atob(crop.base64 ?? ''), (char) => char.charCodeAt(0)), { useTArray: true, formatAsRGBA: false });
    const input = toTensor(pixels.data, pixels.width, pixels.height);
    const [output] = await (await model()).run([input.buffer as ArrayBuffer, input.buffer as ArrayBuffer]);
    return normalize(new Float32Array(output).slice(0, EMBEDDING_SIZE));
  } finally {
    removeQuietly(upright.uri);
  }
}

function usableFace(faces: Face[], imageWidth: number): Face {
  if (!faces.length) throw new FaceNotUsable('Não encontrámos o rosto. Procure boa luz e olhe para a câmara.');
  if (faces.length > 1) throw new FaceNotUsable('Só uma pessoa à frente da câmara, por favor.');
  const face = faces[0];
  if (face.frame.width < imageWidth * MIN_FACE_RATIO) throw new FaceNotUsable('Aproxime-se um pouco da câmara.');
  if (Math.abs(face.rotationY) > MAX_HEAD_TURN_DEGREES || Math.abs(face.rotationZ) > MAX_HEAD_TURN_DEGREES) {
    throw new FaceNotUsable('Olhe de frente para a câmara, com a cabeça direita.');
  }
  return face;
}

function toTensor(rgb: Uint8Array, width: number, height: number): Float32Array {
  const plane = width * height;
  const tensor = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    tensor[i] = rgb[i * 3] / 255;
    tensor[plane + i] = rgb[i * 3 + 1] / 255;
    tensor[2 * plane + i] = rgb[i * 3 + 2] / 255;
  }
  return tensor;
}

function normalize(vector: Float32Array): Float32Array {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function average(vectors: Float32Array[]): Float32Array {
  const mean = new Float32Array(EMBEDDING_SIZE);
  vectors.forEach((vector) => vector.forEach((value, i) => { mean[i] += value / vectors.length; }));
  return normalize(mean);
}

function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot; // os dois vetores já vêm normalizados
}

function encode(vector: Float32Array): string {
  const bytes = new Uint8Array(vector.buffer);
  let text = '';
  bytes.forEach((byte) => { text += String.fromCharCode(byte); });
  return btoa(text);
}

function decode(base64: string): Float32Array {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Float32Array(bytes.buffer);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function removeQuietly(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // a foto temporária já não existe
  }
}
