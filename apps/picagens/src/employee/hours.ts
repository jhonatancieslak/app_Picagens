// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Horas em texto: o formato do servidor («7h30») para minutos e o inverso. Fica fora dos ecrãs para o Hoje e os Registos
// não se importarem um ao outro (ciclo de importações).

/** "7h30" (formato do servidor) → minutos. */
export const parseHours = (text: string) => {
  const match = /^(\d+)h(\d{2})$/.exec(text ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
};

export const formatHours = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}`;
