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
  actionSoft: tokens.cores.azulSuave,
  brand: '#00C3FF',
  ok: tokens.cores.verde,
  okSoft: tokens.cores.verdeFundo,
  pending: '#0E7490',
  warn: tokens.cores.ambar,
  warnSoft: tokens.cores.ambarFundo,
  /** Texto âmbar sobre warnSoft: #B86E00 dava 3,6:1 (abaixo de WCAG AA); este dá 6,5:1 (doc 52 §3 n.º 5). */
  warnInk: tokens.cores.ambarTexto,
  danger: tokens.cores.vermelho,
  /** Faixa escura do cabeçalho (artboards de 24/11) e o fundo da folha de resultado. */
  band: tokens.cores.faixa,
  scrim: tokens.cores.veu,
  handle: tokens.cores.puxador,
  /** Skeleton (blocos a carregar) e fila de envio. */
  skeleton: tokens.cores.esqueleto,
  skeletonDark: tokens.cores.esqueletoEscuro,
  queueBg: tokens.cores.filaFundo,
  bandBlock: tokens.cores.faixaBloco,
  bandLine: tokens.cores.faixaContorno,
  bandSoft: tokens.cores.faixaSuave,
  zebra: tokens.cores.zebra,
  fieldBorder: tokens.cores.bordaCampo,
  /** Texto e fundo das pílulas de estado (aprovado, recusado). */
  okInk: tokens.cores.verdeTexto,
  dangerInk: tokens.cores.vermelhoTexto,
  dangerPill: tokens.cores.vermelhoFundo,
  /** Ícones da folha de resultado: sucesso, fila sem rede e erro (fundo e traço). */
  okIconBg: tokens.cores.verdeIcone,
  warnIconBg: tokens.cores.ambarIcone,
  warnIconInk: tokens.cores.ambarIconeTexto,
  dangerIconBg: tokens.cores.vermelhoIcone,
  dangerIconInk: tokens.cores.vermelhoErro,
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

/** Barra de separadores (EmployeeApp) e botão de picar fixo do Hoje: as medidas num só sítio, para o botão ficar sempre por cima do menu. */
export const tabBar = { paddingTop: 6, tabMinHeight: 56, paddingBottomExtra: 8, border: 1 };
export const tabBarHeight = (bottomInset: number) => tabBar.paddingTop + tabBar.tabMinHeight + tabBar.paddingBottomExtra + tabBar.border + bottomInset;
/** O botão de picar tem sempre esta altura e este sítio (pedido do Jhonatan, 26/11): só mudam o texto, o ícone e a cor. */
export const punchButton = { height: 72, radius: 12, padding: 12, margin: 20 };
export const punchFooterHeight = punchButton.height + punchButton.padding * 2 + 1;

/** O Hoje alinhado ao painel (doc 252, artboards V4HojeSimples e V4Alinhamento): neutros frios dos tokens (`coresPainel`), linha de 1 px, sem sombras. */
export const painel = {
  papel: tokens.coresPainel.papel,
  superficie: tokens.coresPainel.superficie,
  linha: tokens.coresPainel.linha,
  texto: tokens.coresPainel.texto,
  texto2: tokens.coresPainel.texto2,
  texto3: tokens.coresPainel.texto3,
  faltaFundo: tokens.coresPainel.faltaFundo,
  faltaTexto: tokens.coresPainel.falta,
};
export const painelForma = { cartao: 6, botao: 12 };
