// Calculadora de volumen, traída del artifact "Volumen de Ignacio" (misma lógica y números).
// Sus datos (peso, % grasa, fase, opciones) quedan guardados en este teléfono.

// [kcal, prot, carb, grasa] por 100 g (o 100 ml)
const F = {
  carne: [167, 30.6, 0, 4.9], // carne magra ya cocida (rinde ~72 % del peso crudo)
  arroz: [130, 2.7, 28, 0.3], fideos: [158, 5.8, 31, 0.9], papa: [87, 1.9, 20, 0.1],
  avena: [370, 13, 60, 7], leche: [35, 3.3, 4.9, 0.1], whey: [400, 80, 7, 5], pan: [245, 11, 41, 4],
  huevo: [143, 12.6, 0.7, 9.5], jamon: [115, 17, 1, 4.5], aceite: [884, 0, 0, 100],
  // milanesa ya cocida: 130 g carne cruda + 25 g pan rallado + huevo ≈ 130 g; frita absorbe ~12 g de aceite
  milaH: [200, 25.4, 13.8, 4.6], milaF: [282, 25.4, 13.8, 13.8],
};
const MILA_G = 130, MILA_CARNE = 94; // milanesa mediana cocida; su carne equivale a ~94 g de carne cocida
// t: p = escala con el peso, c = carbohidrato que ajusta las calorías, f = fijo
const MEALS = [
  { name: 'Desayuno', items: [{ k: 'avena', g: 80, t: 'c', s: 5 }, { k: 'leche', g: 300, t: 'f' }, { k: 'whey', g: 30, t: 'f', opt: 1 }] },
  { name: 'Almuerzo', items: [{ k: 'carne', g: 145, t: 'p', s: 5 }, { k: 'arroz', g: 250, t: 'c', s: 10, alt: 1 }, { k: 'aceite', g: 10, t: 'f' }] },
  { name: 'Merienda', items: [{ k: 'pan', g: 90, t: 'c', s: 30, min: 60 }, { k: 'huevo', g: 150, t: 'f' }, { k: 'jamon', g: 40, t: 'f' }] },
  { name: 'Cena', items: [{ k: 'carne', g: 130, t: 'p', s: 5 }, { k: 'fideos', g: 250, t: 'c', s: 10, alt: 1 }, { k: 'aceite', g: 10, t: 'f' }] },
];
const LABEL = {
  carne: ['Carne magra', 'peso cocido'], arroz: ['Arroz', 'cocido'], fideos: ['Fideos', 'cocidos'], avena: ['Avena', 'pesada seca'],
  leche: ['Leche descremada', 'o de almendras'], whey: ['Proteína en polvo', '1 scoop'],
  pan: ['Pan integral tostado', ''], huevo: ['Huevos enteros', '3 unidades'], jamon: ['Jamón cocido', '2 fetas'],
  aceite: ['Aceite de oliva', '1 cucharada, medida'],
  milaH: ['Milanesa al horno', 'mediana ≈ 130 g ya cocida'], milaF: ['Milanesa frita', 'mediana ≈ 130 g ya cocida'],
};
const mac = (k, g) => F[k].map((v) => (v * g) / 100);
const rnd = (x, s, min) => Math.max(min || s, Math.round(x / s) * s);
const add = (a, b) => a.map((v, i) => v + b[i]);

export function calc(peso, grasa, vol, whey, modes = {}) {
  const lbm = peso * (1 - grasa / 100), bmr = 370 + 21.6 * lbm, tdee = bmr * 1.55, target = tdee + (vol ? 250 : 0), ps = peso / 71;
  const meals = MEALS.map((m) => ({ name: m.name, items: m.items.filter((i) => !(i.opt && !whey)).map((i) => ({ ...i })) }));
  let other = 0, cbase = 0;
  meals.forEach((m) => m.items.forEach((i) => {
    if (i.t === 'p') i.g = rnd(i.g * ps, i.s);
    if (i.t === 'c') cbase += mac(i.k, i.g)[0];
    else other += mac(i.k, i.g)[0];
  }));
  const k = Math.min(1.8, Math.max(0.5, (target - other) / cbase));
  meals.forEach((m) => {
    m.items.forEach((i) => { if (i.t === 'c') i.g = rnd(i.g * k, i.s, i.min); });
    const mode = modes[m.name];
    if (mode === 'milaH' || mode === 'milaF') { // cambia carne por milanesas y descuenta las kcal extra de la guarnición de esa comida
      const c = m.items.find((i) => i.k === 'carne'), gu = m.items.find((i) => i.alt), u = rnd(c.g / MILA_CARNE, 0.5);
      let extra = mac(mode, u * MILA_G)[0] - mac('carne', c.g)[0];
      if (mode === 'milaF') { // frita: ya trae su aceite
        const a = m.items.find((i) => i.k === 'aceite');
        extra -= mac('aceite', a.g)[0];
        m.items = m.items.filter((i) => i !== a);
      }
      Object.assign(c, { k: mode, g: u * MILA_G, u });
      gu.g = rnd(gu.g - (extra / F[gu.k][0]) * 100, 10, 50);
    }
  });
  let tot = [0, 0, 0, 0];
  meals.forEach((m) => {
    m.tot = [0, 0, 0, 0];
    m.items.forEach((i) => { i.m = mac(i.k, i.g); m.tot = add(m.tot, i.m); });
    tot = add(tot, m.tot);
  });
  return { lbm, bmr, tdee, target, tot, meals };
}

function qty(i) {
  if (i.k === 'leche') return `${i.g} ml`;
  if (i.k === 'huevo') return '3 u';
  if (i.k === 'pan') return `${i.g / 30} rodajas, ${i.g} g`;
  if (i.u) return `${String(i.u).replace('.', ',')} u, ~${i.g} g`;
  return `${i.g} g`;
}
// Guarnición igualada en carbohidratos
const alts = (i) => ['arroz', 'fideos', 'papa'].map((k) => [k, rnd((mac(i.k, i.g)[2] / F[k][2]) * 100, 10)]);
const f0 = (n) => Math.round(n).toLocaleString('es-AR');
const coma = (n, d = 1) => n.toFixed(d).replace('.', ',');

// ---------- Estado guardado en el teléfono ----------
const CLAVE = 'rutina-calc';
const est = { peso: 71, grasa: 21, vol: true, whey: false, modes: { Almuerzo: 'carne', Cena: 'carne' } };
try {
  const g = JSON.parse(localStorage.getItem(CLAVE)) ?? {};
  Object.assign(est, { peso: Number(g.peso) || est.peso, grasa: Number(g.grasa) || est.grasa, vol: g.vol ?? est.vol, whey: !!g.whey, modes: { ...est.modes, ...g.modes } });
} catch {}
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(est)); } catch {} };
const valido = () => est.peso >= 40 && est.peso <= 150 && est.grasa >= 5 && est.grasa <= 45;

function resultado() {
  if (!valido()) return '<p class="vacio">Revisá los datos: peso entre 40 y 150 kg y grasa entre 5 y 45 %.</p>';
  const r = calc(est.peso, est.grasa, est.vol, est.whey, est.modes), t = r.tot, p = est.peso;
  const stat = (cls, titulo, valor, detalle) => `<div class="stat ${cls}"><small>${titulo}</small><span class="display">${valor}</span><small>${detalle}</small></div>`;
  return `
    <div class="stats">
      ${stat('', 'Calorías', f0(t[0]), `objetivo ${f0(r.target)}`)}
      ${stat('p', 'Proteína', `${f0(t[1])} g`, `${coma(t[1] / p)} g por kg`)}
      ${stat('c', 'Carbohidratos', `${f0(t[2])} g`, `${coma(t[2] / p)} g por kg`)}
      ${stat('g', 'Grasas', `${f0(t[3])} g`, `${coma(t[3] / p)} g por kg`)}
    </div>
    <p class="base-calc">Masa magra ${coma(r.lbm)} kg, basal ${f0(r.bmr)} kcal, mantenimiento ${f0(r.tdee)} kcal. ${est.vol ? 'Volumen: +250 kcal.' : 'Adaptación: mantenimiento.'}</p>
    ${r.meals.map((m) => {
      const a = m.items.find((i) => i.alt);
      const selector = m.name in est.modes
        ? `<select data-modo="${m.name}" aria-label="Proteína del ${m.name.toLowerCase()}">${[['carne', 'Carne'], ['milaH', 'Milanesa al horno'], ['milaF', 'Milanesa frita']]
          .map(([v, l]) => `<option value="${v}"${est.modes[m.name] === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`
        : '';
      return `<section class="comida-calc">
        <div class="fila"><h2>${m.name}</h2><small class="kcal">${f0(m.tot[0])} kcal, ${f0(m.tot[1])} g de proteína</small></div>
        ${selector}
        ${m.items.map((i) => {
          const [n, nota] = LABEL[i.k];
          return `<div class="ingrediente"><span><b>${n}</b>${i.opt ? ' <em>opcional</em>' : ''}${nota ? `<small>${nota}</small>` : ''}</span>
            <span class="cant">${qty(i)}<small>${i.m[1].toFixed(0)} g prot.</small></span></div>`;
        }).join('')}
        ${a ? `<div class="plan guarnicion"><span class="comp">Guarnición, elegí una</span>${alts(a).map(([k, g]) => `<span class="chip">${k} ${g} g</span>`).join('<span class="o">o</span>')}</div>` : ''}
      </section>`;
    }).join('')}
    <section class="reglas">
      <details><summary>Ajuste semanal</summary><ul>
        <li>Pesate 3 o 4 mañanas por semana, en ayunas, y usá el <b>promedio</b>.</li>
        <li>Meta: subir <b>${coma(p * 0.0025, 2)} a ${coma(p * 0.005, 2)} kg</b> por semana (desde la semana 3).</li>
        <li>Si en 2 semanas sube menos: sumá 50 g de arroz o fideos cocidos en almuerzo y en cena (~150 kcal).</li>
        <li>Si sube más: sacá esos mismos 50 + 50 g.</li>
        <li>Medí la cintura a la altura del ombligo cada 2 semanas. Si crece más de 1 cm por mes, bajá 150 kcal aunque el peso esté en rango.</li>
      </ul></details>
      <details><summary>Milanesa</summary><ul>
        <li>En almuerzo y cena elegí <b>Milanesa al horno</b> o <b>Milanesa frita</b>: el plan cambia la carne por milanesas y baja la guarnición para compensar el pan rallado (y el aceite, si es frita).</li>
        <li>Promedio usado: una milanesa mediana casera lleva unos 130 g de carne cruda y pesa unos 130 g ya cocida. Si querés precisión, pesala hecha.</li>
        <li>Si es grande (tapa todo el plato), contala como 1,5. Si es chica, como 0,5 menos.</li>
        <li>Vale igual para milanesa de carne o de pollo.</li>
      </ul></details>
      <details><summary>Equivalencias</summary><ul>
        <li><b>Carne:</b> nalga, peceto, cuadrada, bola de lomo, carne picada especial, pechuga de pollo o solomillo de cerdo, mismo peso. Merluza o pescado blanco: +30 % de peso.</li>
        <li><b>Guarnición:</b> arroz, fideos y papa están igualados en carbohidratos.</li>
        <li><b>Leche de almendras</b> en vez de descremada: mismas calorías aprox., pero perdés unos 8 g de proteína.</li>
        <li><b>Proteína en polvo:</b> el plan no la necesita. Si algún día comprás, tildala arriba y el plan baja los carbohidratos para mantener las calorías.</li>
      </ul></details>
      <details><summary>Cómo usarlo</summary><ul>
        <li>Semanas 1 y 2 en <b>Sem. 1–2</b> (mantenimiento). Después pasá a <b>Volumen</b>.</li>
        <li>Los primeros días la balanza puede subir 1 a 1,5 kg de golpe: es glucógeno y agua por comer más carbohidratos, no grasa.</li>
        <li>Mismo plan los días de gimnasio y los de elíptico. Aceite siempre medido.</li>
      </ul></details>
      <p class="base-calc">Cálculo: metabolismo basal por masa magra (Katch-McArdle) × 1,55 por actividad. Valores aproximados por 100 g. Es una estimación: la balanza manda.</p>
    </section>`;
}

export function vistaCalculadora() {
  return `
    <header class="cab-calc">
      <button class="volver" data-acc="volver-plan" aria-label="Volver a Plan">‹</button>
      <div><small>Todo en peso cocido, salvo la avena</small><h1>Volumen</h1></div>
    </header>
    <section class="calc-datos">
      <label>Peso (kg)<input type="number" inputmode="decimal" step="0.1" min="40" max="150" data-calc="peso" value="${est.peso}"></label>
      <label>% grasa<input type="number" inputmode="decimal" step="0.5" min="5" max="45" data-calc="grasa" value="${est.grasa}"></label>
      <div class="segmentos fase" role="group" aria-label="Fase">
        <button type="button" data-fase="adapt" class="${est.vol ? '' : 'pri'}" aria-pressed="${!est.vol}">Sem. 1–2</button>
        <button type="button" data-fase="vol" class="${est.vol ? 'pri' : ''}" aria-pressed="${est.vol}">Volumen</button>
      </div>
      <label class="item"><input type="checkbox" data-calc="whey" ${est.whey ? 'checked' : ''}><span><b>Uso proteína en polvo</b><small>en el desayuno</small></span></label>
    </section>
    <div id="calc-res">${resultado()}</div>`;
}

// Recalcula solo los resultados (los campos no se redibujan, así no se pierde el foco al escribir).
function refrescar(root) {
  guardar();
  root.querySelector('#calc-res').innerHTML = resultado();
}

export function cambioCalculadora(e, root) {
  const t = e.target;
  if (t.dataset.calc === 'whey') est.whey = t.checked;
  else if (t.dataset.calc) est[t.dataset.calc] = parseFloat(t.value);
  else if (t.dataset.modo) est.modes[t.dataset.modo] = t.value;
  else return false;
  refrescar(root);
  return true;
}

export function clickCalculadora(e, root) {
  const b = e.target.closest('[data-fase]');
  if (!b) return false;
  est.vol = b.dataset.fase === 'vol';
  root.querySelectorAll('[data-fase]').forEach((x) => {
    const on = (x.dataset.fase === 'vol') === est.vol;
    x.classList.toggle('pri', on);
    x.setAttribute('aria-pressed', on);
  });
  refrescar(root);
  return true;
}
