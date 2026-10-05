// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Valores fixos da app Picagens (modos colaborador e quiosque). APIs no doc 43 §3 e §4 (repo picagens-saas-v2).

export const KIOSK_API_URL = 'https://picagens.pt/app/api/quiosque/v1';
export const EMPLOYEE_API_URL = 'https://picagens.pt/app/api/v1/mobile';
/** Link de ativação do email: https://picagens.pt/app/colaborador/<empresa>/ativar/<token> */
export const ACTIVATION_LINK_PATTERN = /\/colaborador\/([a-z0-9_-]+)\/ativar\/([^/?#\s]+)/i;

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
/** Prazo em que o servidor ainda aceita uma picagem feita sem rede (picagem_service.py). */
export const OFFLINE_MAX_HOURS = 48;
