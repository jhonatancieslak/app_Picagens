// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Valores fixos da app Picagens Quiosque. A API está descrita no doc 43 §4 (repo picagens-saas-v2).

export const API_BASE_URL = 'https://picagens.pt/app/api/quiosque/v1';

export const PIN_LENGTH = 4;
export const ADMIN_CODE_MAX_LENGTH = 8;
export const IDLE_TIMEOUT_SECONDS = 20;
export const PHOTO_COUNTDOWN_SECONDS = 3;
export const PHOTO_WIDTH_PX = 640;
export const PHOTO_JPEG_QUALITY = 0.7;
export const NO_PHOTO_AUTO_SECONDS = 10;
export const CONFIRMATION_MS = 5000;
export const CONFIG_REFRESH_MS = 10 * 60 * 1000;
export const QUEUE_RETRY_MS = 60 * 1000;
export const ADMIN_SESSION_SECONDS = 15 * 60;
export const REQUEST_TIMEOUT_MS = 20 * 1000;
export const PHOTO_RETENTION_DAYS_DEFAULT = 30;
