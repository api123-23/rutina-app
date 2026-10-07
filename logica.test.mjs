// node logica.test.mjs
import assert from 'node:assert';
import { fechaISO, esGym, estadoDia, celdasMes } from './logica.js';

assert.equal(fechaISO(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
assert.equal(esGym('2026-10-05'), true); // lunes
assert.equal(esGym('2026-10-06'), false); // martes
assert.equal(esGym('2026-10-11'), false); // domingo

const todo = { desayuno: 1, almuerzo: 1, merienda: 1, cena: 1, hipopresivos: 1, estiramientos: 1, entreno: 1 };
assert.equal(estadoDia(todo), 'completo');
assert.equal(estadoDia({ ...todo, cena: false }), 'parcial');
assert.equal(estadoDia({}), 'nada');
assert.equal(estadoDia(undefined), 'nada');

const oct = celdasMes(2026, 9); // octubre 2026 arranca jueves
assert.deepEqual(oct.slice(0, 4), [null, null, null, '2026-10-01']);
assert.equal(oct.at(-1), '2026-10-31');

console.log('ok');
