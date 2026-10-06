// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Foto do certificado de baixa: reduzida (lado maior 1600 px) e enviada em JPEG base64 no JSON, como a foto de perfil.
// O envio multipart da 2.2.0/2.3.0 falhava no Android antes de chegar ao servidor ("Sem rede", doc 53 §7).
import type { ImagePickerAsset } from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { SICK_LEAVE_JPEG_QUALITY, SICK_LEAVE_PHOTO_MAX_PX } from '../config';
import { removeQuietly } from '../kiosk/photo';

export async function sickLeavePhotoBase64(asset: ImagePickerAsset): Promise<string> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > SICK_LEAVE_PHOTO_MAX_PX) {
    context.resize(asset.width >= asset.height ? { width: SICK_LEAVE_PHOTO_MAX_PX, height: null } : { width: null, height: SICK_LEAVE_PHOTO_MAX_PX });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: SICK_LEAVE_JPEG_QUALITY, base64: true });
  removeQuietly(saved.uri);
  if (!saved.base64) throw new Error('Foto sem conteúdo.');
  return saved.base64;
}
