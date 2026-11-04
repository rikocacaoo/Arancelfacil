/* ===================================================================
   EXPLORADOR DEL ARANCEL: Secciones > Capítulos > Partidas > Subpartidas
   La dirección (#s=XI, #c=61, #p=61.09, #b=texto) permite compartir enlaces.
   =================================================================== */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
let indice = null, conteo = null;

function pintar() {
  const h = decodeURIComponent(location.hash.slice(1)), i = h.indexOf("="), k = i > -1 ? h.slice(0, i) : "", v = i > -1 ? h.slice(i + 1) : "";
  const migas = [["Arancel", "#"]]; let html = "";
  if (k === "s") {
    const s = SECCIONES.find(x => x.numero === v); if (!s) return location.hash = "";
    migas.push(["Sección " + s.numero, ""]);
    html = `<h2 class="t">Sección ${s.numero}</h2><p class="st">${esc(s.titulo)}</p>` + notas(s.notas, "la sección " + s.numero) +
      CAPITULOS.filter(c => c.seccion === v).map(c => `<a class="fila" href="#c=${c.codigo}"><b>${c.codigo}</b><span>${esc(c.titulo)}</span></a>`).join("");
  } else if (k === "c") {
    const c = CAPITULOS.find(x => x.codigo === v); if (!c) return location.hash = "";
    migas.push(["Sección " + c.seccion, "#s=" + c.seccion], ["Capítulo " + c.codigo, ""]);
    if (!conteo) { conteo = {}; ARANCEL.forEach(r => conteo[r.p] = (conteo[r.p] || 0) + 1); }
    html = `<h2 class="t">Capítulo ${c.codigo}</h2><p class="st">${esc(c.titulo)}</p>` + notas(c.notas, "el capítulo " + c.codigo) +
      Object.keys(PARTIDAS).filter(p => p.startsWith(c.codigo + ".")).sort().map(p => `<a class="fila" href="#p=${p}"><b>${p}</b><span>${esc(PARTIDAS[p])}</span><i>${conteo[p] || 0} subpartidas</i></a>`).join("");
  } else if (k === "p") {
    const cap = CAPITULOS.find(x => x.codigo === v.slice(0, 2));
    migas.push(["Sección " + cap.seccion, "#s=" + cap.seccion], ["Capítulo " + cap.codigo, "#c=" + cap.codigo], ["Partida " + v, ""]);
    html = `<h2 class="t">Partida ${v}</h2><p class="st">${esc(PARTIDAS[v] || "")}</p>` + ARANCEL.filter(r => r.p === v).map(fila).join("");
  } else if (k === "b") {
    migas.push(["Búsqueda: " + v, ""]); const r = buscar(v);
    html = `<h2 class="t">Resultados para “${esc(v)}”</h2><p class="st">${r.length ? r.length + (r.length === 60 ? "+" : "") + " subpartidas" : "Sin resultados. Prueba con otra palabra o un código."}</p>` + r.map(fila).join("");
    $("q").value = v;
  } else {
    html = `<div class="bloques">` + SECCIONES.map(s => { const cs = CAPITULOS.filter(c => c.seccion === s.numero);
      return `<a class="bloque" href="#s=${s.numero}"><small>Sección ${s.numero}</small><b>${esc(s.titulo)}</b><span>Capítulos ${cs[0].codigo}–${cs[cs.length - 1].codigo}</span></a>`; }).join("") + `</div>`;
  }
  $("migas").innerHTML = migas.map(m => m[1] ? `<a href="${m[1]}">${esc(m[0])}</a>` : `<span>${esc(m[0])}</span>`).join(" › ");
  $("vista").innerHTML = html; scrollTo({top: 0});
  $("vista").querySelectorAll("[data-g]").forEach(b => b.onclick = () => { const r = ARANCEL.find(x => x.c === b.dataset.g);
    Cuenta.requiere(() => { Cuenta.agregar("productos", {codigo: r.c, ruta: r.t, av: r.a, consulta: "Explorador"}); Cuenta.aviso("Guardado en Mis productos ✓"); }, "Crea una cuenta gratis para guardar productos."); });
  $("vista").querySelectorAll("[data-abrir]").forEach(b => b.onclick = () => Cuenta.abrir("Crea una cuenta gratis para leer las notas legales.", "crear"));
  Cuenta.refrescar();
}
const notas = (t, que) => !t ? "" : Cuenta.usuario() ? `<details><summary>Notas legales de ${que}</summary><pre>${esc(t)}</pre></details>` : `<div class="candado" data-abrir>🔒 Notas legales de ${que}: <b>desbloquéalas con una cuenta gratis</b></div>`;
function fila(r) {
  const s = r.t.split(" › "), ant = s.slice(0, -1).filter(x => x !== (PARTIDAS[r.p] || ""));
  return `<div class="sr"><div><span class="cod">${r.c}</span> <span class="chip">${r.a}% Ad Valorem</span><p>${esc(s[s.length - 1])}</p>${ant.length ? `<small>${esc(ant.join(" › "))}</small>` : ""}</div>
    <div class="acc"><a class="btn-sec" href="calculadora.html?c=${r.c}">Calcular</a> <button class="btn-sec" data-pro data-g="${r.c}">Guardar</button></div></div>`;
}
/* Jerga -> palabra del arancel (agrega más aquí) */
const SIN = {polo: ["camiseta", "camisa"], playera: ["camiseta"], chompa: ["sueter", "jersey"], polera: ["sueter", "jersey"], casaca: ["chaqueta", "abrigo"], jean: ["pantalon"],
  zapatilla: ["calzado"], zapato: ["calzado"], celular: ["telefono"], laptop: ["computadora", "automatica"], audifono: ["auricular"], llanta: ["neumatico"], palta: ["aguacate"],
  shampoo: ["champu"], deportiva: ["deporte"], deportivo: ["deporte"], pisco: ["orujo de uva"], moto: ["motocicleta"], auto: ["automovil"], lente: ["gafa", "anteojo"], bateria: ["acumulador"]};
function buscar(q) {
  if (!indice) indice = ARANCEL.map(r => ({r, n: norm(r.c + " " + r.t)}));
  const dig = q.replace(/\./g, ""), esCodigo = /^[\d.]+$/.test(q.trim()), toks = norm(q).split(/\s+/).filter(x => x.length > 1);
  if (esCodigo) return indice.filter(x => x.r.c.replace(/\./g, "").startsWith(dig)).slice(0, 60).map(x => x.r);
  const res = [];
  indice.forEach(x => {
    let sc = 0;
    for (const t of toks) {                                  // cada palabra puede coincidir completa, por raíz o por sinónimo
      const b0 = t.replace(/(es|s)$/, ""), b = b0.length > 4 ? b0.replace(/[aeo]$/, "") : b0;
      if (x.n.includes(t)) sc += 3; else if (x.n.includes(b)) sc += 2; else if ((SIN[b0] || []).some(a => x.n.includes(a))) sc += 1; else return;
    }
    if (toks.length) res.push([sc, x.r]);
  });
  return res.sort((a, b) => b[0] - a[0]).slice(0, 60).map(x => x[1]);
}
$("f").onsubmit = e => { e.preventDefault(); const q = $("q").value.trim(); if (q) location.hash = "b=" + encodeURIComponent(q); };
addEventListener("hashchange", pintar); document.addEventListener("cuenta", pintar); pintar();
