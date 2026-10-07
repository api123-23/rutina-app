// Lógica pura (sin DOM ni red) para poder testearla con node.

export const COMIDAS = ['desayuno', 'almuerzo', 'merienda', 'cena'];
export const DIAS_GYM = [1, 3, 5]; // lunes, miércoles, viernes
export const CHECKS = [...COMIDAS, 'hipopresivos', 'estiramientos', 'entreno'];

// YYYY-MM-DD en hora local (toISOString usaría UTC y cambiaría el día de noche).
export function fechaISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function deISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const esGym = (fecha) => DIAS_GYM.includes(deISO(fecha).getDay());

// 'completo' | 'parcial' | 'nada'
export function estadoDia(dia) {
  const hechos = CHECKS.filter((k) => dia?.[k]).length;
  return hechos === CHECKS.length ? 'completo' : hechos > 0 ? 'parcial' : 'nada';
}

// Celdas del mes empezando en lunes; null = hueco antes del día 1.
export function celdasMes(anio, mes) {
  const huecos = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const total = new Date(anio, mes + 1, 0).getDate();
  return [...Array(huecos).fill(null), ...Array.from({ length: total }, (_, i) => fechaISO(new Date(anio, mes, i + 1)))];
}
