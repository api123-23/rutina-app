import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { COMIDAS, CHECKS, fechaISO, deISO, esGym, estadoDia, celdasMes } from './logica.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const $main = document.querySelector('main');
const hoy = () => fechaISO(new Date());
const NOMBRE_DIA = { 1: 'Lunes', 3: 'Miércoles', 5: 'Viernes' };
const LISTAS = { hipopresivos: 'Hipopresivos', estiramientos: 'Estiramientos / postura' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const fechaCorta = (f) => deISO(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const porOrden = (a, b) => a.orden - b.orden || a.id - b.id;
const sigOrden = (items) => Math.max(0, ...items.map((i) => i.orden)) + 1;

const st = {
  vista: 'dia',
  fecha: hoy(),
  editando: false,
  mes: [new Date().getFullYear(), new Date().getMonth()],
  gymDia: esGym(hoy()) ? new Date().getDay() : 1,
  dieta: [],
  listas: [],
  ejercicios: [],
};

// Toda llamada a Supabase pasa por acá: si falla, se avisa (no se pierde un check en silencio).
async function q(consulta) {
  const { data, error } = await consulta;
  if (error) {
    alert('No se pudo guardar/cargar: ' + error.message);
    throw error;
  }
  return data;
}

async function cargarBase() {
  [st.dieta, st.listas, st.ejercicios] = await Promise.all([
    q(db.from('dieta_items').select('*')),
    q(db.from('lista_items').select('*')),
    q(db.from('ejercicios').select('*')),
  ]);
  [st.dieta, st.listas, st.ejercicios].forEach((l) => l.sort(porOrden));
}

// Agrupa las opciones de una comida por componente: { Proteína: [items], ... }
function planComida(comida) {
  const grupos = {};
  for (const i of st.dieta.filter((i) => i.comida === comida)) (grupos[i.componente] ??= []).push(i);
  return grupos;
}
const textoOpcion = (i) => esc(i.opcion) + (i.gramos ? ` ${i.gramos} g` : '');

// ---------- Día ----------
async function vistaDia() {
  const f = st.fecha;
  const dia = (await q(db.from('dias').select('*').eq('fecha', f).maybeSingle())) ?? {};
  const esHoy = f === hoy();
  const dis = !esHoy && !st.editando ? 'disabled' : '';
  const check = (campo, titulo, detalle = '') =>
    `<label class="item"><input type="checkbox" data-campo="${campo}" ${dia[campo] ? 'checked' : ''} ${dis}>
      <span><b>${titulo}</b>${detalle}</span></label>`;
  const lista = (tipo) => {
    const items = st.listas.filter((i) => i.tipo === tipo);
    return items.length ? `<details><summary>Ver lista (${items.length})</summary><ol>${items.map((i) => `<li>${esc(i.texto)}</li>`).join('')}</ol></details>` : '';
  };
  const dsem = deISO(f).getDay();
  const hechos = CHECKS.filter((k) => dia[k]).length;
  const entreno = esGym(f)
    ? check('entreno', `Gym, rutina del ${NOMBRE_DIA[dsem].toLowerCase()}`) +
      (st.ejercicios.some((e) => e.dia === dsem)
        ? `<details><summary>Ver ejercicios</summary><ol>${st.ejercicios.filter((e) => e.dia === dsem).map((e) => `<li>${esc(e.nombre)}</li>`).join('')}</ol></details>`
        : '')
    : check('entreno', 'Elíptico') +
      `<label class="minutos">Minutos <input type="number" inputmode="numeric" min="0" data-campo="eliptico_min" value="${dia.eliptico_min ?? ''}" ${dis}></label>`;

  $main.innerHTML = `
    <header class="cabecera">
      <div>
        <div class="dia-sem">${esHoy ? 'Hoy, ' : ''}${deISO(f).toLocaleDateString('es-AR', { weekday: 'long' })}</div>
        <div class="fecha"><span class="display num">${deISO(f).getDate()}</span><span class="mes">${deISO(f).toLocaleDateString('es-AR', { month: 'long' })}</span></div>
      </div>
      <div class="flechas">
        <button data-acc="mover-dia" data-delta="-1" aria-label="Día anterior">‹</button>
        <button data-acc="mover-dia" data-delta="1" aria-label="Día siguiente">›</button>
      </div>
    </header>
    <div class="progreso" role="img" aria-label="${hechos} de ${CHECKS.length} cumplidos">
      <div class="barra">${CHECKS.map((k) => `<span class="${dia[k] ? 'on' : ''}"></span>`).join('')}</div>
      <output>${hechos === CHECKS.length ? 'Todo cumplido' : `${hechos} de ${CHECKS.length}`}</output>
    </div>
    ${esHoy ? '' : `<div class="barra-editar">
      <button data-acc="ir-hoy" class="sec">Ir a hoy</button>
      <button data-acc="editar" class="${st.editando ? 'pri' : 'sec'}">${st.editando ? 'Listo' : 'Editar día'}</button></div>`}
    <section><h2>Comidas</h2>
      ${COMIDAS.map((c) => {
        const g = planComida(c);
        const detalle = Object.entries(g).map(([comp, ops]) =>
          `<span class="plan"><span class="comp">${esc(comp)}</span>${ops.map((o) => `<span class="chip">${textoOpcion(o)}</span>`).join('')}</span>`).join('');
        return check(c, cap(c), detalle);
      }).join('')}
    </section>
    <section><h2>Rutina</h2>
      ${check('hipopresivos', 'Hipopresivos')}${lista('hipopresivos')}
      ${check('estiramientos', 'Estiramientos / postura')}${lista('estiramientos')}
    </section>
    <section><h2>Entrenamiento</h2>${entreno}</section>`;
}

async function guardarCampo(input) {
  const campo = input.dataset.campo;
  const fila = { fecha: st.fecha };
  if (input.type === 'checkbox') fila[campo] = input.checked;
  else {
    fila[campo] = input.value === '' ? null : Math.max(0, parseInt(input.value, 10));
    if (fila[campo] > 0) fila.entreno = true; // cargar minutos = hiciste elíptico
  }
  try {
    await q(db.from('dias').upsert(fila));
  } catch {
    if (input.type === 'checkbox') input.checked = !input.checked;
    return;
  }
  render();
}

// ---------- Calendario ----------
async function vistaCalendario() {
  const [a, m] = st.mes;
  const dias = await q(db.from('dias').select('*').gte('fecha', fechaISO(new Date(a, m, 1))).lte('fecha', fechaISO(new Date(a, m + 1, 0))));
  const porFecha = Object.fromEntries(dias.map((d) => [d.fecha, d]));
  const cuenta = (e) => dias.filter((d) => estadoDia(d) === e).length;
  const h = hoy();
  $main.innerHTML = `
    <header class="cab-mes">
      <h1>${cap(new Date(a, m, 1).toLocaleDateString('es-AR', { month: 'long' }))} <span style="color:var(--suave)">${a}</span></h1>
      <div class="flechas">
        <button data-acc="mover-mes" data-delta="-1" aria-label="Mes anterior">‹</button>
        <button data-acc="mover-mes" data-delta="1" aria-label="Mes siguiente">›</button>
      </div>
    </header>
    <div class="cal">
      ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="cab">${d}</span>`).join('')}
      ${celdasMes(a, m).map((f) => (f
        ? `<button data-acc="ir-dia" data-fecha="${f}" class="${estadoDia(porFecha[f])} ${f === h ? 'hoy' : ''}">${deISO(f).getDate()}</button>`
        : '<span></span>')).join('')}
    </div>
    <div class="resumen">
      <div><span class="display">${cuenta('completo')}</span><small><i></i>Días con todo cumplido</small></div>
      <div><span class="display">${cuenta('parcial')}</span><small><i class="parcial"></i>Días con algo pendiente</small></div>
    </div>`;
}

// ---------- Plan (dieta y listas) ----------
function botonesOrden(tabla, id) {
  return `<span class="acciones">
    <button data-acc="subir" data-tabla="${tabla}" data-id="${id}" aria-label="Subir">↑</button>
    <button data-acc="bajar" data-tabla="${tabla}" data-id="${id}" aria-label="Bajar">↓</button>
    <button data-acc="borrar" data-tabla="${tabla}" data-id="${id}" aria-label="Borrar">✕</button></span>`;
}

function vistaPlan() {
  const componentes = [...new Set(st.dieta.map((i) => i.componente))];
  $main.innerHTML = `
    <h1>Plan</h1>
    <datalist id="componentes">${componentes.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
    ${COMIDAS.map((c) => `
      <section><h2>${cap(c)}</h2>
        ${Object.entries(planComida(c)).map(([comp, ops]) => `
          <div class="grupo"><b>${esc(comp)}</b>
            ${ops.map((i) => `<div class="fila">${textoOpcion(i)}${botonesOrden('dieta_items', i.id)}</div>`).join('')}</div>`).join('') || '<p class="vacio">Todavía sin cargar.</p>'}
        <form data-form="dieta" data-comida="${c}" class="alta">
          <input name="componente" placeholder="Grupo (ej: Proteína)" list="componentes" required>
          <input name="opcion" placeholder="Opción (ej: pollo)" required>
          <input name="gramos" type="number" inputmode="decimal" step="any" min="0" placeholder="g">
          <button class="pri">+</button>
        </form>
      </section>`).join('')}
    ${Object.entries(LISTAS).map(([tipo, titulo]) => `
      <section><h2>${titulo}</h2>
        <ol>${st.listas.filter((i) => i.tipo === tipo).map((i) => `<li class="fila">${esc(i.texto)}${botonesOrden('lista_items', i.id)}</li>`).join('')}</ol>
        <form data-form="lista" data-tipo="${tipo}" class="alta">
          <input name="texto" placeholder="Agregar ejercicio" required><button class="pri">+</button>
        </form>
      </section>`).join('')}`;
}

// ---------- Gym ----------
// Mini gráfica de los últimos 12 pesos (de más viejo a más nuevo).
function sparkline(pesos) {
  const v = pesos.slice(-12).map(Number);
  if (v.length < 2) return '';
  const min = Math.min(...v), rango = Math.max(...v) - min || 1;
  const pts = v.map((p, i) => [(i / (v.length - 1)) * 104 + 3, 37 - ((p - min) / rango) * 32]);
  const [ux, uy] = pts.at(-1);
  return `<svg class="spark" viewBox="0 0 110 40" aria-hidden="true">
    <polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${ux}" cy="${uy}" r="3.5" fill="currentColor"/></svg>`;
}

async function vistaGym() {
  const ejercicios = st.ejercicios.filter((e) => e.dia === st.gymDia);
  const registros = ejercicios.length
    ? await q(db.from('registros_ejercicio').select('*').in('ejercicio_id', ejercicios.map((e) => e.id)).order('fecha', { ascending: false }).order('id', { ascending: false }))
    : [];
  const textoReg = (r) => [r.peso != null && `${r.peso} kg`, r.series && r.reps && `${r.series}×${r.reps}`].filter(Boolean).join(', ');
  const marca = (r) => `<div>
      <div class="display peso">${r.peso ?? '–'}<small>kg</small></div>
      <div class="detalle">${r.series && r.reps ? `${r.series} series de ${r.reps}, ` : ''}${fechaCorta(r.fecha)}</div></div>`;
  $main.innerHTML = `
    <h1>Gym</h1>
    <div class="segmentos">${[1, 3, 5].map((d) => `<button data-acc="gym-dia" data-dia="${d}" class="${d === st.gymDia ? 'pri' : 'sec'}">${NOMBRE_DIA[d]}</button>`).join('')}</div>
    ${ejercicios.map((e) => {
      const regs = registros.filter((r) => r.ejercicio_id === e.id);
      return `<section class="ejercicio">
        <div class="fila"><h2>${esc(e.nombre)}</h2>${botonesOrden('ejercicios', e.id)}</div>
        ${regs[0] ? `<div class="marca">${marca(regs[0])}${sparkline(regs.map((r) => r.peso).filter((p) => p != null).reverse())}</div>` : '<p class="vacio">Anotá el primer peso abajo.</p>'}
        <form data-form="registro" data-ejercicio="${e.id}" class="alta registro">
          <input name="fecha" type="date" value="${hoy()}" required>
          <label>kg<input name="peso" type="number" inputmode="decimal" step="any" min="0" value="${regs[0]?.peso ?? ''}"></label>
          <label>series<input name="series" type="number" inputmode="numeric" min="1" value="${regs[0]?.series ?? ''}"></label>
          <label>reps<input name="reps" type="number" inputmode="numeric" min="1" value="${regs[0]?.reps ?? ''}"></label>
          <button class="pri">Anotar</button>
        </form>
        ${regs.length ? `<details><summary>Historial (${regs.length})</summary>
          ${regs.map((r) => `<div class="fila"><span>${fechaCorta(r.fecha)} — ${textoReg(r)}</span>
            <span class="acciones"><button data-acc="borrar" data-tabla="registros_ejercicio" data-id="${r.id}" aria-label="Borrar">✕</button></span></div>`).join('')}
        </details>` : ''}
      </section>`;
    }).join('') || '<p class="vacio">Todavía no cargaste ejercicios para este día.</p>'}
    <form data-form="ejercicio" class="alta">
      <input name="nombre" placeholder="Nuevo ejercicio (Press banca)" required><button class="pri">+</button>
    </form>`;
}

// ---------- Acciones ----------
const TABLA_ESTADO = { dieta_items: 'dieta', lista_items: 'listas', ejercicios: 'ejercicios' };

// Intercambia el orden con el vecino del mismo grupo (misma comida+componente, mismo tipo o mismo día).
async function mover(tabla, id, dir) {
  const todos = st[TABLA_ESTADO[tabla]];
  const yo = todos.find((i) => i.id === id);
  const grupo = todos.filter((i) => (tabla === 'dieta_items' ? i.comida === yo.comida && i.componente === yo.componente : tabla === 'lista_items' ? i.tipo === yo.tipo : i.dia === yo.dia));
  const j = grupo.indexOf(yo) + dir;
  if (j < 0 || j >= grupo.length) return;
  [grupo[j - dir], grupo[j]] = [grupo[j], grupo[j - dir]];
  await Promise.all(grupo.map((i, k) => (i.orden === k ? null : q(db.from(tabla).update({ orden: k }).eq('id', i.id)))));
}

const acciones = {
  'mover-dia': (b) => {
    const d = deISO(st.fecha);
    d.setDate(d.getDate() + Number(b.dataset.delta));
    st.fecha = fechaISO(d);
    st.editando = false;
  },
  'ir-hoy': () => { st.fecha = hoy(); st.editando = false; },
  editar: () => { st.editando = !st.editando; },
  'mover-mes': (b) => {
    const d = new Date(st.mes[0], st.mes[1] + Number(b.dataset.delta), 1);
    st.mes = [d.getFullYear(), d.getMonth()];
  },
  'ir-dia': (b) => { st.fecha = b.dataset.fecha; st.editando = false; st.vista = 'dia'; },
  'gym-dia': (b) => { st.gymDia = Number(b.dataset.dia); },
  subir: async (b) => { await mover(b.dataset.tabla, Number(b.dataset.id), -1); await cargarBase(); },
  bajar: async (b) => { await mover(b.dataset.tabla, Number(b.dataset.id), 1); await cargarBase(); },
  borrar: async (b) => {
    const aviso = b.dataset.tabla === 'ejercicios' ? '¿Borrar el ejercicio y TODO su historial de pesos?' : '¿Borrar?';
    if (!confirm(aviso)) return false;
    await q(db.from(b.dataset.tabla).delete().eq('id', b.dataset.id));
    await cargarBase();
  },
};

const altas = {
  dieta: (f, d) => q(db.from('dieta_items').insert({ comida: f.dataset.comida, componente: d.componente.trim(), opcion: d.opcion.trim(), gramos: d.gramos || null, orden: sigOrden(st.dieta) })),
  lista: (f, d) => q(db.from('lista_items').insert({ tipo: f.dataset.tipo, texto: d.texto.trim(), orden: sigOrden(st.listas) })),
  ejercicio: (f, d) => q(db.from('ejercicios').insert({ dia: st.gymDia, nombre: d.nombre.trim(), orden: sigOrden(st.ejercicios) })),
  registro: (f, d) => q(db.from('registros_ejercicio').insert({ ejercicio_id: Number(f.dataset.ejercicio), fecha: d.fecha, peso: d.peso || null, series: d.series || null, reps: d.reps || null })),
};

document.addEventListener('click', async (e) => {
  const tab = e.target.closest('[data-vista]');
  if (tab) {
    st.vista = tab.dataset.vista;
    if (st.vista === 'dia') { st.fecha = hoy(); st.editando = false; }
    return render();
  }
  const b = e.target.closest('[data-acc]');
  if (!b) return;
  b.disabled = true;
  try {
    if ((await acciones[b.dataset.acc](b)) !== false) await render();
  } finally {
    b.disabled = false;
  }
});

$main.addEventListener('change', (e) => {
  if (e.target.dataset.campo) guardarCampo(e.target);
});

$main.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const boton = f.querySelector('button');
  boton.disabled = true;
  try {
    await altas[f.dataset.form](f, Object.fromEntries(new FormData(f)));
    await cargarBase();
    await render();
  } finally {
    boton.disabled = false;
  }
});

async function render() {
  document.querySelectorAll('[data-vista]').forEach((b) => b.classList.toggle('activa', b.dataset.vista === st.vista));
  await { dia: vistaDia, calendario: vistaCalendario, plan: vistaPlan, gym: vistaGym }[st.vista]();
}

// Si la app quedó abierta de un día para otro, al volver muestra el día nuevo.
let ultimoHoy = hoy();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && hoy() !== ultimoHoy) {
    ultimoHoy = hoy();
    if (st.vista === 'dia') { st.fecha = ultimoHoy; st.editando = false; render(); }
  }
});

if (!SUPABASE_URL) $main.innerHTML = '<p class="vacio">Falta configurar Supabase en config.js</p>';
else cargarBase().then(render);
