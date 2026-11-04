/* "Mi espacio": productos guardados, historial y cotizaciones del usuario */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const usd = n => "$" + Number(n).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
const fecha = f => new Date(f).toLocaleDateString("es-PE", {day: "numeric", month: "short", year: "numeric"});
let tab = "productos";

const tarjeta = x => ({
  productos: () => `<div class="item"><div><span class="cod">${x.codigo}</span><p>${esc(x.ruta.split(" › ").pop())}</p><small>Ad Valorem ${x.av}% · ${fecha(x.fecha)}${x.consulta ? " · “" + esc(x.consulta) + "”" : ""}</small></div><button class="x" data-del="${x.id}" title="Quitar">✕</button></div>`,
  historial: () => `<div class="item"><div><b>“${esc(x.texto)}”</b><p><span class="cod">${x.codigo}</span> · Ad Valorem ${x.av}%</p><small>${fecha(x.fecha)}</small></div><button class="x" data-del="${x.id}" title="Quitar">✕</button></div>`,
  cotizaciones: () => `<div class="item col"><div class="fila-i"><div><b>${esc(x.titulo)}</b> <span class="badge">${x.tipo}</span><p>Total ${usd(x.total)} · por unidad ${usd(x.unit)}</p><small>${fecha(x.fecha)}</small></div>
    <span><button class="btn-sec" data-print="${x.id}">Imprimir</button> <button class="x" data-del="${x.id}" title="Quitar">✕</button></span></div>
    <details><summary>Ver detalle</summary><table>${x.filas.map(f => `<tr><td>${f[0]}</td><td>${usd(f[1])}</td></tr>`).join("")}</table></details></div>`
}[tab])();

function pintar() {
  const u = Cuenta.usuario();
  $("bloqueo").hidden = !!u; $("contenido").hidden = !u;
  $("saludo").textContent = u ? "Hola, " + u.nombre.split(" ")[0] : "Mi espacio";
  $("sub").textContent = u ? u.email : "Guarda tus productos, tu historial y tus cotizaciones.";
  if (!u) return;
  document.querySelectorAll("#tabs button").forEach(b => { b.classList.toggle("on", b.dataset.t === tab); b.querySelector("i").textContent = Cuenta.lista(b.dataset.t).length; });
  const items = Cuenta.lista(tab);
  $("lista").innerHTML = items.length ? items.map(tarjeta).join("")
    : `<div class="vacio">Aún no hay nada aquí.<br><a href="${tab === "cotizaciones" ? "calculadora.html" : "index.html"}">${tab === "cotizaciones" ? "Hacer una cotización" : "Buscar una partida"} →</a></div>`;
  $("lista").querySelectorAll("[data-del]").forEach(b => b.onclick = () => { Cuenta.quitar(tab, b.dataset.del); pintar(); });
  $("lista").querySelectorAll("[data-print]").forEach(b => b.onclick = () => imprimir(items.find(x => x.id === b.dataset.print)));
}

function imprimir(c) {
  const w = window.open("", "_blank"); if (!w) return Cuenta.aviso("Permite las ventanas emergentes para imprimir.");
  w.document.write(`<title>${esc(c.titulo)}</title><body style="font-family:system-ui;max-width:640px;margin:40px auto"><h1>Cotización de ${c.tipo.toLowerCase()}</h1><h3>${esc(c.titulo)}</h3><p>${fecha(c.fecha)}</p>
    <table style="width:100%;border-collapse:collapse">${c.filas.map(f => `<tr><td style="padding:7px;border-bottom:1px solid #ddd">${f[0]}</td><td style="text-align:right;border-bottom:1px solid #ddd">${usd(f[1])}</td></tr>`).join("")}</table>
    <p style="color:#777;font-size:12px">Cálculo referencial generado con ArancelFácil. No reemplaza la liquidación oficial de SUNAT.</p>`);
  w.document.close(); w.print();
}

function exportarCSV() {                                   // se abre directo en Excel
  const items = Cuenta.lista(tab);
  const cab = {productos: ["Código", "Descripción", "Ad Valorem %", "Consulta", "Fecha"], historial: ["Búsqueda", "Código", "Ad Valorem %", "Fecha"], cotizaciones: ["Tipo", "Título", "Total USD", "Por unidad USD", "Fecha"]}[tab];
  const fila = x => ({productos: [x.codigo, x.ruta, x.av, x.consulta || "", x.fecha], historial: [x.texto, x.codigo, x.av, x.fecha], cotizaciones: [x.tipo, x.titulo, x.total.toFixed(2), x.unit.toFixed(2), x.fecha]}[tab]);
  const celda = v => '"' + String(v).replace(/"/g, '""') + '"';
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + [cab, ...items.map(fila)].map(f => f.map(celda).join(";")).join("\r\n")], {type: "text/csv;charset=utf-8"}));
  a.download = "arancelfacil-" + tab + ".csv"; a.click();
}

document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => { tab = b.dataset.t; pintar(); });
$("b-csv").onclick = () => Cuenta.lista(tab).length ? exportarCSV() : Cuenta.aviso("No hay datos para exportar.");
$("b-salir").onclick = () => Cuenta.salir();
$("b-entrar").onclick = () => Cuenta.abrir("Accede para ver tu espacio.");
document.addEventListener("cuenta", pintar);
pintar();
