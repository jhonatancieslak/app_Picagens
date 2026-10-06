// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Foto de confirmação: reduzida a 640 px em JPEG, devolvida em base64 e o ficheiro original da câmara
// apagado logo. Sem reconhecimento facial: a foto só segue para o servidor como prova (doc 44 §14).
import type { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { PHOTO_JPEG_QUALITY, PHOTO_WIDTH_PX } from '../config';

export function removeQuietly(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ficheiro temporário da cache; se já não existir não há nada a fazer
  }
}

export async function takeConfirmationPhoto(camera: CameraView): Promise<string | null> {
  const picture = await camera.takePictureAsync({ quality: 0.8, shutterSound: false });
  if (!picture?.uri) return null;
  try {
    const context = ImageManipulator.manipulate(picture.uri);
    context.resize({ width: PHOTO_WIDTH_PX, height: null });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_JPEG_QUALITY, base64: true });
    removeQuietly(saved.uri);
    return saved.base64 ?? null;
  } finally {
    removeQuietly(picture.uri);
  }
}
