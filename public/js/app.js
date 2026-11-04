/* ===================================================================
   Buscador de partidas. Sin inteligencia artificial: usa el propio
   arancel. 1) busca las partidas más parecidas al texto, 2) las preguntas
   salen de las ramas del arancel (De algodón / De fibras sintéticas...),
   3) lo que ya dijiste en tu descripción se deduce solo.
   =================================================================== */
const $ = id => document.getElementById(id);
const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

/* Jerga -> palabra del arancel. Puedes agregar más líneas aquí. */
const SINONIMOS = {
  /* Ropa */ polo: ["camiseta", "camisa"], playera: ["camiseta"], remera: ["camiseta"], chompa: ["sueter", "jersey"], polera: ["sueter", "jersey"],
  casaca: ["chaqueta", "abrigo", "prendas de vestir"], jean: ["pantalon"], short: ["pantalon"], buzo: ["chandal", "conjunto"], media: ["calcetin", "media"],
  gorra: ["sombrero", "tocado", "gorro"], gorro: ["sombrero", "tocado", "gorro"], pañal: ["panal"],
  /* Calzado y accesorios */ zapatilla: ["calzado"], zapato: ["calzado"], sandalia: ["calzado"], lente: ["gafa", "anteojo"],
  cartera: ["bolso", "bolsos de mano"], billetera: ["billetera", "cartera"], mochila: ["mochila"],
  /* Tecnología */ celular: ["telefono"], smartphone: ["telefono"], laptop: ["computadora", "automatica"], tablet: ["automatica", "portatil"],
  audifono: ["auricular"], parlante: ["altavoz"], foco: ["lampara", "bombilla"], dron: ["no tripulada", "aeronave"], bateria: ["acumulador"],
  solar: ["fotovoltaic"], tele: ["televisor"],
  /* Vehículos */ llanta: ["neumatico"], moto: ["motocicleta"], auto: ["automovil"], camioneta: ["automovil", "vehiculo"],
  /* Hogar y oficina */ escritorio: ["mueble", "oficina"], tela: ["tejido"],
  /* Belleza y juguetes */ shampoo: ["champu"], labial: ["labios", "maquillaje"], peluche: ["juguete"],
  /* Alimentos */ palta: ["aguacate"], choclo: ["maiz"], camote: ["batata"], aji: ["pimiento", "capsicum"], pisco: ["orujo de uva"], cafe: ["cafe"]
};
const RUIDO = new Set(["para", "con", "del", "los", "las", "una", "uno", "por", "sin", "manga", "corta", "larga", "nuevo", "nueva", "tipo", "marca", "producto"]);

ARANCEL.forEach(r => { r.s = r.t.split(" › "); r.n = norm(r.t); r.pt = norm(PARTIDAS[r.p] || ""); r.c2 = r.c.slice(0, 2); });
let grupos = [], cands = [], hist = [], deducidos = [], texto = "", inicial = 1, dudoso = false, otras = [], iaNota = "", IA_ACTIVA = false, yaRegistrado = false;

function leerConsulta(t) {
  const toks = norm(t).replace(/[^a-z0-9ñ ]/g, " ").split(/\s+/).filter(x => x.length > 2 && !RUIDO.has(x));
  return toks.map(x => {
    const base = x.replace(/(es|s)$/, ""), alts = [base.length > 2 ? base : x, ...(SINONIMOS[base] || [])];
    const df = ARANCEL.filter(r => alts.some(a => r.n.includes(a))).length;
    return {alts, w: Math.max(0.3, Math.log(ARANCEL.length / (1 + df)))};
  }).filter(g => g.w > 0.3 || g.alts.length > 1);
}
const coincide = (g, txt) => g.alts.some(a => txt.includes(a));

const interpretar = t => fetch("/api/interpretar", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({texto: t})})
  .then(r => { if (!r.ok) throw 0; return r.json(); });

async function empezar(t) {
  texto = t; hist = []; deducidos = []; dudoso = false; iaNota = ""; yaRegistrado = false;
  grupos = leerConsulta(t);
  ARANCEL.forEach(r => r.sc = grupos.reduce((s, g) => s + (coincide(g, r.n) ? g.w : 0) + (coincide(g, r.pt) ? g.w * 0.5 : 0), 0));
  $("panel").hidden = false;
  let ia = null;
  if (IA_ACTIVA) {                                   // 1) intenta entender la descripción con IA
    $("resultado").hidden = true; $("pregunta").hidden = false; $("opciones").innerHTML = ""; $("contador").textContent = "";
    $("pregunta-texto").textContent = "✨ Interpretando tu descripción…"; $("barra").style.width = "8%";
    try { ia = await interpretar(t); } catch (e) { ia = null; }
  }
  let top;
  if (ia && ia.partidas && ia.partidas.length) {
    top = ia.partidas;
    ia.partidas.forEach((x, i) => ARANCEL.forEach(r => { if (r.p === x.p) r.sc += (ia.partidas.length - i) * 100; }));
    iaNota = "✨ La IA interpretó tu producto así: " + ia.partidas[0].razon;
  } else {                                           // 2) si no hay IA, búsqueda por palabras clave
    const mejor = {};
    ARANCEL.forEach(r => { if (!mejor[r.p] || r.sc > mejor[r.p].sc) mejor[r.p] = r; });
    const orden = Object.values(mejor).sort((a, b) => b.sc - a.sc);
    if (!orden.length || orden[0].sc === 0) return sinResultado();
    top = orden.filter(r => r.sc >= orden[0].sc * 0.6).slice(0, 4);
  }
  otras = top;
  cands = ARANCEL.filter(r => top.some(x => x.p === r.p));
  inicial = cands.length;
  paso();
  $("panel").scrollIntoView({behavior: "smooth", block: "start"});
}

function nivelDiferente() {
  for (let k = 0; k < 10; k++) if (new Set(cands.map(r => r.s.slice(0, Math.min(k, r.s.length - 1) + 1).join("›"))).size > 1) return k;
  return -1;
}
function agrupar(k) {
  const m = new Map();
  cands.forEach(r => {
    const i = Math.min(k, r.s.length - 1), key = r.s.slice(0, i + 1).join("›");
    if (!m.has(key)) m.set(key, {seg: r.s[i], p: r.p, items: [], best: 0});
    const g = m.get(key); g.items.push(r); g.best = Math.max(g.best, r.sc);
  });
  return [...m.values()].sort((a, b) => b.best - a.best);
}

function paso() {
  for (;;) {
    const k = nivelDiferente();
    if (k < 0 || cands.length === 1) return resultado();
    const gs = agrupar(k), sc = gs.map(g => grupos.filter(q => coincide(q, norm(g.seg))).length), max = Math.max(...sc);
    if (max > 0 && sc.filter(x => x === max).length === 1) {          // el texto del usuario ya lo respondió
      deducidos.push(gs[sc.indexOf(max)].seg); cands = gs[sc.indexOf(max)].items; continue;
    }
    return preguntar(gs, k);
  }
}

function preguntar(gs, k) {
  $("resultado").hidden = true; $("pregunta").hidden = false;
  $("ia-nota").hidden = !iaNota; $("ia-nota").textContent = iaNota;
  const c = $("pregunta"); c.style.animation = "none"; void c.offsetWidth; c.style.animation = "";
  $("barra").style.width = Math.max(10, Math.min(92, 100 - 100 * Math.log(cands.length) / Math.log(Math.max(inicial, 2)))) + "%";
  $("contador").textContent = `${cands.length} subpartidas posibles`;
  $("pregunta-texto").textContent = k === 0 ? "¿Cuál de estas describe mejor tu producto?" : "¿Cuál describe mejor tu producto?";
  const cont = $("opciones"); cont.innerHTML = "";
  const elegir = g => { hist.push({cands, deducidos: [...deducidos], dudoso}); cands = g.items; paso(); };
  gs.slice(0, 12).forEach(g => {
    const b = document.createElement("button");
    b.textContent = (k === 0 ? g.p + " · " : "") + (g.seg.length > 190 ? g.seg.slice(0, 190) + "…" : g.seg);
    b.onclick = () => elegir(g); cont.appendChild(b);
  });
  const ns = document.createElement("button"); ns.className = "nose"; ns.textContent = "No estoy seguro";
  ns.onclick = () => { dudoso = true; elegir(gs[0]); }; cont.appendChild(ns);
  if (hist.length) {
    const at = document.createElement("button"); at.className = "nose"; at.textContent = "← Volver a la pregunta anterior";
    at.onclick = () => { const h = hist.pop(); cands = h.cands; deducidos = h.deducidos; dudoso = h.dudoso; paso(); }; cont.appendChild(at);
  }
}

function resultado() {
  $("pregunta").hidden = true; $("resultado").hidden = false;
  const r = cands[0], cap = CAPITULOS.find(c => c.codigo === r.c2), sec = SECCIONES.find(s => s.numero === cap.seccion);
  const alt = otras.filter(o => o.p !== r.p).slice(0, 3);
  $("resultado").innerHTML = `<div class="card">
    <span class="badge ${dudoso ? "media" : ""}">Confianza ${dudoso ? "media" : "alta"}</span>
    <p class="mini">Para: “${esc(texto)}”</p>
    <div><span class="codigo">${r.c}</span><button class="copiar" id="copiar">Copiar</button></div>
    <p><b>Derecho Ad Valorem: ${r.a}%</b> <span class="mini">(además se aplican IGV e IPM)</span> · <a href="calculadora.html?c=${r.c}">Calcular costo de importación →</a></p>
    <ol class="camino">${r.s.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
    <p class="mini">Capítulo ${cap.codigo}: ${esc(cap.titulo)}<br>Sección ${sec.numero}: ${esc(sec.titulo)}</p>
    ${cap.notas ? (Cuenta.usuario() ? `<details><summary>Ver notas legales del capítulo ${cap.codigo}</summary><pre>${esc(cap.notas)}</pre></details>`
      : `<div class="candado" data-abrir>🔒 Notas legales del capítulo ${cap.codigo}: <b>desbloquéalas con una cuenta gratis</b></div>`) : ""}
    ${alt.length ? `<div class="alt"><h3>Otras partidas parecidas</h3>${alt.map(o => `<div><b>${o.p}</b>${esc(PARTIDAS[o.p])}</div>`).join("")}</div>` : ""}
    <div class="acciones"><button class="guardar" id="b-guardar" data-pro>Guardar producto</button><button class="nuevo" onclick="reiniciar()">Nueva búsqueda</button></div></div>`;
  $("copiar").onclick = e => { navigator.clipboard.writeText(r.c); e.target.textContent = "¡Copiado!"; };
  $("b-guardar").onclick = () => Cuenta.requiere(() => {
    Cuenta.agregar("productos", {codigo: r.c, ruta: r.t, av: r.a, consulta: texto}); Cuenta.aviso("Guardado en Mis productos ✓");
  }, "Crea una cuenta gratis para guardar tus productos.");
  document.querySelectorAll("[data-abrir]").forEach(el => el.onclick = () => Cuenta.abrir("Crea una cuenta gratis para leer las notas legales.", "crear"));
  if (!yaRegistrado && Cuenta.usuario()) { yaRegistrado = true; Cuenta.agregar("historial", {texto, codigo: r.c, av: r.a, ruta: r.t}); }
  Cuenta.refrescar();
}

function sinResultado() {
  $("pregunta").hidden = true; $("resultado").hidden = false;
  $("resultado").innerHTML = `<div class="card"><h2>No encontramos coincidencias</h2><p>Prueba con otras palabras: el material, el uso o el nombre técnico del producto.</p><button class="nuevo" onclick="reiniciar()">Nueva búsqueda</button></div>`;
}
function reiniciar() { $("panel").hidden = true; $("q").value = ""; $("buscador").scrollIntoView({behavior: "smooth"}); $("q").focus(); }

$("form").addEventListener("submit", e => { e.preventDefault(); empezar($("q").value.trim()); });
document.querySelectorAll(".ejemplos button").forEach(b => b.onclick = () => { $("q").value = b.dataset.q; empezar(b.dataset.q); });

fetch("/api/estado").then(r => r.json()).then(j => { IA_ACTIVA = !!j.ia; $("ia-estado").hidden = !IA_ACTIVA; }).catch(() => {});

document.addEventListener("cuenta", () => { if (!$("resultado").hidden && $("resultado").querySelector(".codigo")) resultado(); });   // al entrar/salir se actualiza el resultado
