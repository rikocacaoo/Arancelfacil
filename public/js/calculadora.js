/* ===================================================================
   Calculadora de importación.
   CIF = FOB + flete + seguro
   Ad Valorem = CIF x %    |  IGV e IPM se calculan sobre (CIF + Ad Valorem)
   Percepción = % x (CIF + Ad Valorem + IGV + IPM)
   =================================================================== */
const $ = id => document.getElementById(id);
const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const num = id => Math.max(0, parseFloat($(id).value) || 0);
const usd = n => "$" + n.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
let indice = null;

function buscar(q) {
  if (!indice) indice = ARANCEL.map(r => ({r, n: norm(r.c + " " + r.t)}));
  const digitos = q.replace(/\./g, ""), toks = norm(q).split(/\s+/).filter(Boolean);
  const esCodigo = /^[\d.]+$/.test(q);
  return indice.filter(x => esCodigo ? x.r.c.replace(/\./g, "").startsWith(digitos) : toks.every(t => x.n.includes(t))).slice(0, 8).map(x => x.r);
}

function elegir(r) {
  $("av").value = r.a; $("bus").value = r.c; $("lista").hidden = true;
  $("elegido").className = "elegido ok";
  $("elegido").innerHTML = `<b>${r.c}</b> · Ad Valorem ${r.a}%<br>${r.t.split(" › ").pop()}`;
  calcular();
}

$("bus").addEventListener("input", e => {
  const q = e.target.value.trim(), l = $("lista");
  if (q.length < 2) { l.hidden = true; return; }
  const res = buscar(q);
  l.innerHTML = res.map((r, i) => `<li data-i="${i}"><b>${r.c}</b>${r.t.split(" › ").pop().slice(0, 90)}</li>`).join("") || "<li>Sin resultados</li>";
  l.hidden = false;
  l.querySelectorAll("li[data-i]").forEach(li => li.onclick = () => elegir(res[li.dataset.i]));
});
document.addEventListener("click", e => { if (!e.target.closest(".buscar")) $("lista").hidden = true; });

let ultimo = null;

function calcular() {
  const cant = num("cant") || 1, fob = cant * num("precio"), flete = num("flete"), seguro = num("seguro"), otros = num("otros");
  const cif = fob + flete + seguro, av = cif * num("av") / 100;
  const isc = (cif + av) * num("isc") / 100, ad = fob * num("adump") / 100;
  const base = cif + av + isc + ad;                                   // base del IGV e IPM
  const igv = base * num("igv") / 100, ipm = base * num("ipm") / 100;
  const perc = (base + igv + ipm) * num("perc") / 100;
  const tributos = av + isc + ad + igv + ipm, total = cif + tributos + perc + otros;
  $("r-total").textContent = usd(total);
  $("r-unit").textContent = usd((cif + av + isc + ad + ipm + otros) / cant);   // sin IGV ni percepción (se recuperan)
  const filas = [["Valor FOB", fob], ["Flete + seguro", flete + seguro], ["Valor CIF (base aduanera)", cif, 1], ["Ad Valorem", av],
    ["ISC", isc], ["Antidumping / compensatorio", ad], ["IGV", igv], ["IPM", ipm], ["Total tributos", tributos, 1],
    ["Percepción IGV", perc], ["Otros gastos", otros], ["Desembolso total", total, 1]];
  ultimo = {total, unit: (cif + av + isc + ad + ipm + otros) / cant, filas: filas.map(f => [f[0], f[1]])};
  $("tabla").innerHTML = filas.map(f => `<tr class="${f[2] ? "sub" : ""}"><td>${f[0]}</td><td>${usd(f[1])}</td></tr>`).join("");
  const partes = [["FOB", fob, "#2563FF"], ["Flete y seguro", flete + seguro, "#12D6A5"], ["Ad Valorem", av, "#FFB020"], ["ISC + antidumping", isc + ad, "#ff7a3d"],
    ["IGV + IPM", igv + ipm, "#FF3D7F"], ["Percepción", perc, "#7c3aed"], ["Otros", otros, "#0B1F4B"]];
  $("barra-c").innerHTML = partes.map(p => `<i style="width:${total ? p[1] / total * 100 : 0}%;background:${p[2]}" title="${p[0]}"></i>`).join("");
  $("leyenda").innerHTML = partes.filter(p => p[1] > 0).map(p => `<span style="--c:${p[2]}">${p[0]}</span>`).join("");
}

document.querySelectorAll("#datos input, #datos select").forEach(el => el.addEventListener("input", calcular));
const qs = new URLSearchParams(location.search);
const pre = qs.get("c");       // viene del buscador: calculadora.html?c=6109.10.00.31
const hit = pre && ARANCEL.find(r => r.c === pre);
hit ? elegir(hit) : calcular();

$("b-guardar").onclick = () => Cuenta.requiere(() => {
  Cuenta.agregar("cotizaciones", {tipo: "Importación", titulo: $("bus").value || "Importación sin partida", total: ultimo.total, unit: ultimo.unit, filas: ultimo.filas});
  Cuenta.aviso("Cotización guardada en Mi espacio ✓");
}, "Crea una cuenta gratis para guardar tus cotizaciones.");
$("b-imprimir").onclick = () => Cuenta.requiere(() => window.print(), "Inicia sesión para imprimir o guardar en PDF.");
