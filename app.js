import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { COMIDAS, CHECKS, fechaISO, deISO, esGym, estadoDia, celdasMes } from './logica.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const $main = document.querySelector('main');
const hoy = () => fechaISO(new Date());
const NOMBRE_DIA = { 1: 'Lunes', 3: 'Miércoles', 5: 'Viernes' };
const LISTAS = { hipopresivos: 'Hipopresivos', estiramientos: 'Estiramientos / postura' };
const ORDEN_VISTAS = ['dia', 'calendario', 'gym', 'plan'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const fechaCorta = (f) => deISO(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const porOrden = (a, b) => a.orden - b.orden || a.id - b.id;
const sigOrden = (items) => Math.max(0, ...items.map((i) => i.orden)) + 1;
const textoProgreso = (n) => (n === CHECKS.length ? 'Todo cumplido' : `${n} de ${CHECKS.length}`);

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

// Agrupa las opciones de una comida por grupo: { Carbohidrato: [papa, arroz, fideos], ... }. Se come una por grupo.
// Los grupos van en orden de creación; las ↑↓ solo reordenan opciones dentro de su grupo.
function planComida(comida) {
  const items = st.dieta.filter((i) => i.comida === comida);
  const grupos = {};
  for (const i of [...items].sort((a, b) => a.id - b.id)) grupos[i.componente] ??= [];
  for (const i of items) grupos[i.componente].push(i);
  return grupos;
}
const textoOpcion = (i) => esc(i.opcion) + (i.gramos ? ` ${i.gramos} g` : '');
// Elemento que se anima solo (se mueve/aparece/desaparece) cuando cambia una lista.
const vt = (nombre) => `class="vt" style="--vt:${nombre}"`;

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

  return `
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
    <div class="progreso ${hechos === CHECKS.length ? 'completo' : ''}">
      <div class="barra">${CHECKS.map((k, i) => `<span class="${dia[k] ? 'on' : ''}" style="--i:${i}"></span>`).join('')}</div>
      <output aria-live="polite">${textoProgreso(hechos)}</output>
    </div>
    ${esHoy ? '' : `<div class="barra-editar">
      <button data-acc="ir-hoy" class="sec">Ir a hoy</button>
      <button data-acc="editar" class="${st.editando ? 'pri' : 'sec'}">${st.editando ? 'Listo' : 'Editar día'}</button></div>`}
    <section><h2>Comidas</h2>
      ${COMIDAS.map((c) => {
        const detalle = Object.entries(planComida(c)).map(([grupo, ops]) =>
          `<span class="plan"><span class="comp">${esc(grupo)}</span>${ops.map((o) => `<span class="chip">${textoOpcion(o)}</span>`).join('<span class="o">o</span>')}</span>`).join('');
        return check(c, cap(c), detalle);
      }).join('')}
    </section>
    <section><h2>Rutina</h2>
      ${check('hipopresivos', 'Hipopresivos')}${lista('hipopresivos')}
      ${check('estiramientos', 'Estiramientos / postura')}${lista('estiramientos')}
    </section>
    <section><h2>Entrenamiento</h2>${entreno}</section>`;
}

// Refleja los checks en la barra sin re-renderizar (así las animaciones no se reinician).
function actualizarProgreso() {
  const marcados = CHECKS.map((k) => $main.querySelector(`input[data-campo="${k}"]`)?.checked);
  const n = marcados.filter(Boolean).length;
  $main.querySelectorAll('.barra span').forEach((s, i) => {
    s.style.setProperty('--i', 0);
    s.classList.toggle('on', marcados[i]);
  });
  const p = $main.querySelector('.progreso');
  p.classList.toggle('completo', n === CHECKS.length);
  const out = p.querySelector('output');
  out.textContent = textoProgreso(n);
  out.classList.remove('cambio');
  void out.offsetWidth; // reinicia la animación
  out.classList.add('cambio');
}

async function guardarCampo(input) {
  const campo = input.dataset.campo;
  const fila = { fecha: st.fecha };
  if (input.type === 'checkbox') fila[campo] = input.checked;
  else {
    fila[campo] = input.value === '' ? null : Math.max(0, parseInt(input.value, 10));
    if (fila[campo] > 0) $main.querySelector('[data-campo="entreno"]').checked = fila.entreno = true; // minutos = hiciste elíptico
  }
  actualizarProgreso();
  try {
    await q(db.from('dias').upsert(fila));
  } catch {
    render(); // vuelve a mostrar lo que quedó guardado de verdad
  }
}

// ---------- Calendario ----------
async function vistaCalendario() {
  const [a, m] = st.mes;
  const dias = await q(db.from('dias').select('*').gte('fecha', fechaISO(new Date(a, m, 1))).lte('fecha', fechaISO(new Date(a, m + 1, 0))));
  const porFecha = Object.fromEntries(dias.map((d) => [d.fecha, d]));
  const cuenta = (e) => dias.filter((d) => estadoDia(d) === e).length;
  const h = hoy();
  return `
    <header class="cab-mes">
      <h1>${cap(new Date(a, m, 1).toLocaleDateString('es-AR', { month: 'long' }))} <span class="anio">${a}</span></h1>
      <div class="flechas">
        <button data-acc="mover-mes" data-delta="-1" aria-label="Mes anterior">‹</button>
        <button data-acc="mover-mes" data-delta="1" aria-label="Mes siguiente">›</button>
      </div>
    </header>
    <div class="cal">
      ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="cab">${d}</span>`).join('')}
      ${celdasMes(a, m).map((f, i) => (f
        ? `<button data-acc="ir-dia" data-fecha="${f}" class="${estadoDia(porFecha[f])} ${f === h ? 'hoy' : ''}" style="--i:${i}">${deISO(f).getDate()}</button>`
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

const inputGramos = '<input name="gramos" type="number" inputmode="decimal" step="any" min="0" placeholder="g">';

function vistaPlan() {
  const grupos = [...new Set(st.dieta.map((i) => i.componente))];
  return `
    <h1>Plan</h1>
    <datalist id="grupos">${grupos.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
    ${COMIDAS.map((c) => `
      <section><h2>${cap(c)}</h2>
        ${Object.entries(planComida(c)).map(([grupo, ops]) => `
          <div ${vt(`g-${c}-${ops[0].id}`)}>
            <div class="grupo-cab"><b>${esc(grupo)}</b>${ops.length > 1 ? `<small>Elegís una de ${ops.length}</small>` : ''}</div>
            ${ops.map((i) => `<div class="fila"><span>${textoOpcion(i)}</span>${botonesOrden('dieta_items', i.id)}</div>`).join('')}
            <form data-form="opcion" data-comida="${c}" data-grupo="${esc(grupo)}" class="alta mini">
              <input name="opcion" placeholder="Otra opción" required>${inputGramos}
              <button class="pri" aria-label="Agregar opción a ${esc(grupo)}">+</button>
            </form>
          </div>`).join('') || '<p class="vacio">Todavía sin cargar. Empezá creando un grupo, por ejemplo Carbohidrato.</p>'}
        <details class="nuevo">
          <summary>Nuevo grupo</summary>
          <form data-form="grupo" data-comida="${c}" class="alta grupo-nuevo">
            <input name="grupo" placeholder="Grupo (ej: Carbohidrato)" list="grupos" required>
            <input name="opcion" placeholder="Primera opción (ej: papa)" required>${inputGramos}
            <button class="pri">Crear</button>
          </form>
        </details>
      </section>`).join('')}
    ${Object.entries(LISTAS).map(([tipo, titulo]) => `
      <section><h2>${titulo}</h2>
        <ol>${st.listas.filter((i) => i.tipo === tipo).map((i) => `<li ${vt(`l${i.id}`)}><div class="fila"><span>${esc(i.texto)}</span>${botonesOrden('lista_items', i.id)}</div></li>`).join('')}</ol>
        <form data-form="lista" data-tipo="${tipo}" class="alta">
          <input name="texto" placeholder="Agregar ejercicio" required><button class="pri" aria-label="Agregar">+</button>
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
    <polyline pathLength="1" points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
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
  return `
    <h1>Gym</h1>
    <div class="segmentos">${[1, 3, 5].map((d) => `<button data-acc="gym-dia" data-dia="${d}" class="${d === st.gymDia ? 'pri' : ''}">${NOMBRE_DIA[d]}</button>`).join('')}</div>
    ${ejercicios.map((e) => {
      const regs = registros.filter((r) => r.ejercicio_id === e.id);
      return `<section ${vt(`e${e.id}`)}>
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
      <input name="nombre" placeholder="Nuevo ejercicio (Press banca)" required><button class="pri" aria-label="Agregar ejercicio">+</button>
    </form>`;
}

// ---------- Acciones ----------
const TABLA_ESTADO = { dieta_items: 'dieta', lista_items: 'listas', ejercicios: 'ejercicios' };

// Intercambia el orden con el vecino del mismo grupo (misma comida+grupo, mismo tipo o mismo día).
async function mover(tabla, id, dir) {
  const todos = st[TABLA_ESTADO[tabla]];
  const yo = todos.find((i) => i.id === id);
  const grupo = todos.filter((i) => (tabla === 'dieta_items' ? i.comida === yo.comida && i.componente === yo.componente : tabla === 'lista_items' ? i.tipo === yo.tipo : i.dia === yo.dia));
  const j = grupo.indexOf(yo) + dir;
  if (j < 0 || j >= grupo.length) return;
  [grupo[j - dir], grupo[j]] = [grupo[j], grupo[j - dir]];
  await Promise.all(grupo.map((i, k) => (i.orden === k ? null : q(db.from(tabla).update({ orden: k }).eq('id', i.id)))));
}

// Cada acción devuelve el tipo de transición ('adelante', 'atras', 'zoom', 'seg', 'lista') o false para no re-renderizar.
const acciones = {
  'mover-dia': (b) => {
    const d = deISO(st.fecha);
    d.setDate(d.getDate() + Number(b.dataset.delta));
    st.fecha = fechaISO(d);
    st.editando = false;
    return b.dataset.delta > 0 ? 'adelante' : 'atras';
  },
  'ir-hoy': () => {
    const dir = hoy() > st.fecha ? 'adelante' : 'atras';
    st.fecha = hoy();
    st.editando = false;
    return dir;
  },
  editar: (b) => {
    st.editando = !st.editando;
    $main.querySelectorAll('[data-campo]').forEach((i) => (i.disabled = !st.editando));
    b.textContent = st.editando ? 'Listo' : 'Editar día';
    b.className = st.editando ? 'pri' : 'sec';
    return false;
  },
  'mover-mes': (b) => {
    const d = new Date(st.mes[0], st.mes[1] + Number(b.dataset.delta), 1);
    st.mes = [d.getFullYear(), d.getMonth()];
    return b.dataset.delta > 0 ? 'adelante' : 'atras';
  },
  'ir-dia': (b) => {
    st.fecha = b.dataset.fecha;
    st.editando = false;
    st.vista = 'dia';
    b.style.viewTransitionName = 'numdia'; // el círculo del calendario se transforma en el número grande
    return 'zoom';
  },
  'gym-dia': (b) => {
    st.gymDia = Number(b.dataset.dia);
    return 'seg';
  },
  subir: async (b) => { await mover(b.dataset.tabla, Number(b.dataset.id), -1); await cargarBase(); return 'lista'; },
  bajar: async (b) => { await mover(b.dataset.tabla, Number(b.dataset.id), 1); await cargarBase(); return 'lista'; },
  borrar: async (b) => {
    const aviso = b.dataset.tabla === 'ejercicios' ? '¿Borrar el ejercicio y TODO su historial de pesos?' : '¿Borrar?';
    if (!confirm(aviso)) return false;
    await q(db.from(b.dataset.tabla).delete().eq('id', b.dataset.id));
    await cargarBase();
    return 'lista';
  },
};

const altas = {
  grupo: (f, d) => q(db.from('dieta_items').insert({ comida: f.dataset.comida, componente: d.grupo.trim(), opcion: d.opcion.trim(), gramos: d.gramos || null, orden: sigOrden(st.dieta) })),
  opcion: (f, d) => q(db.from('dieta_items').insert({ comida: f.dataset.comida, componente: f.dataset.grupo, opcion: d.opcion.trim(), gramos: d.gramos || null, orden: sigOrden(st.dieta) })),
  lista: (f, d) => q(db.from('lista_items').insert({ tipo: f.dataset.tipo, texto: d.texto.trim(), orden: sigOrden(st.listas) })),
  ejercicio: (f, d) => q(db.from('ejercicios').insert({ dia: st.gymDia, nombre: d.nombre.trim(), orden: sigOrden(st.ejercicios) })),
  registro: (f, d) => q(db.from('registros_ejercicio').insert({ ejercicio_id: Number(f.dataset.ejercicio), fecha: d.fecha, peso: d.peso || null, series: d.series || null, reps: d.reps || null })),
};

document.addEventListener('click', async (e) => {
  const tab = e.target.closest('[data-vista]');
  if (tab) {
    const antes = ORDEN_VISTAS.indexOf(st.vista);
    st.vista = tab.dataset.vista;
    if (st.vista === 'dia') { st.fecha = hoy(); st.editando = false; }
    const despues = ORDEN_VISTAS.indexOf(st.vista);
    return render(despues > antes ? 'adelante' : despues < antes ? 'atras' : '');
  }
  const b = e.target.closest('[data-acc]');
  if (!b) return;
  b.disabled = true;
  try {
    const dir = await acciones[b.dataset.acc](b);
    if (dir !== false) await render(dir);
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
    await render('lista');
  } finally {
    boton.disabled = false;
  }
});

const VISTAS = { dia: vistaDia, calendario: vistaCalendario, plan: vistaPlan, gym: vistaGym };
const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)');
let ultimoRender = 0;

// Primero trae los datos y después cambia la pantalla dentro de una View Transition
// (así la animación no se congela esperando la red). Sin soporte, cambia directo.
async function render(dir = '') {
  const id = ++ultimoRender;
  const html = await VISTAS[st.vista]();
  if (id !== ultimoRender) return; // otro toque más nuevo ganó
  const aplicar = () => {
    $main.innerHTML = html;
    const activa = document.querySelector(`[data-vista="${st.vista}"]`);
    document.querySelectorAll('[data-vista]').forEach((b) => b.classList.toggle('activa', b === activa));
    activa.prepend(document.querySelector('.pildora'));
  };
  if (!dir || !document.startViewTransition || sinMovimiento.matches) return aplicar();
  document.documentElement.dataset.dir = dir;
  await document.startViewTransition(aplicar).finished.catch(() => {});
  delete document.documentElement.dataset.dir;
}

// Si la app quedó abierta de un día para otro, al volver muestra el día nuevo.
let ultimoHoy = hoy();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && hoy() !== ultimoHoy) {
    ultimoHoy = hoy();
    if (st.vista === 'dia') { st.fecha = ultimoHoy; st.editando = false; render('adelante'); }
  }
});

if (!SUPABASE_URL) $main.innerHTML = '<p class="vacio">Falta configurar Supabase en config.js</p>';
else cargarBase().then(() => render());
