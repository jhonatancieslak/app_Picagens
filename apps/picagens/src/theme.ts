// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Tokens da marca (doc 02/30 e protótipo v6 aprovado, doc 49). Verde reservado a "picagem feita".

import { tokens } from './tokens';

export const colors = {
  bg: tokens.cores.fundo,
  surface: tokens.cores.cartao,
  line: tokens.cores.borda,
  ink: tokens.cores.texto,
  ink2: tokens.cores.textoSecundario,
  ink3: tokens.cores.textoSuave,
  action: tokens.cores.azul,
  actionSoft: '#E8EFFE',
  brand: '#00C3FF',
  ok: tokens.cores.verde,
  okSoft: '#E6F6EC',
  pending: '#0E7490',
  warn: tokens.cores.ambar,
  warnSoft: tokens.cores.ambarFundo,
  /** Texto âmbar sobre warnSoft: #B86E00 dava 3,6:1 (abaixo de WCAG AA); este dá 6,5:1 (doc 52 §3 n.º 5). */
  warnInk: '#92400E',
  danger: tokens.cores.vermelho,
  dangerSoft: '#FDECEC',
  info: '#0B7FA6',
  infoSoft: '#E6F7FD',
  hol: '#7C3AED',
  holSoft: '#F1EBFE',
  mapLand: '#EEF1F4',
  mapRoad: '#FFFFFF',
  mapBlock: '#E2E7EC',
  mapPark: '#DDEFE2',
};

export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
