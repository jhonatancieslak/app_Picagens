// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Feriados nacionais obrigatórios de Portugal (art. 234.º do Código do Trabalho), para o calendário de Pedidos e
// para contar dias úteis. O Carnaval e os feriados municipais não entram (dependem da empresa e do concelho).

const FIXED: [number, number, string][] = [
  [1, 1, 'Ano Novo'], [4, 25, 'Dia da Liberdade'], [5, 1, 'Dia do Trabalhador'], [6, 10, 'Dia de Portugal'],
  [8, 15, 'Assunção de Nossa Senhora'], [10, 5, 'Implantação da República'], [11, 1, 'Todos os Santos'],
  [12, 1, 'Restauração da Independência'], [12, 8, 'Imaculada Conceição'], [12, 25, 'Natal'],
];

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const key = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
const cache = new Map<number, Map<string, string>>();

export function holidaysOf(year: number) {
  let map = cache.get(year);
  if (map) return map;
  map = new Map(FIXED.map(([month, day, name]) => [key(new Date(year, month - 1, day)), name]));
  const sunday = easter(year);
  const shift = (days: number) => new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + days);
  map.set(key(shift(-2)), 'Sexta-feira Santa');
  map.set(key(sunday), 'Páscoa');
  map.set(key(shift(60)), 'Corpo de Deus');
  cache.set(year, map);
  return map;
}

export const holidayName = (date: Date) => holidaysOf(date.getFullYear()).get(key(date));

/** Dias úteis entre duas datas (inclusive): sem sábados, domingos nem feriados nacionais. */
export function workingDays(start: Date, end: Date) {
  let count = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cursor <= end) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6 && !holidayName(cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Feriados dentro de um intervalo (para explicar a conta dos dias úteis). */
export function holidaysBetween(start: Date, end: Date) {
  const found: { date: Date; name: string }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cursor <= end) {
    const name = holidayName(cursor);
    if (name) found.push({ date: new Date(cursor), name });
    cursor.setDate(cursor.getDate() + 1);
  }
  return found;
}
