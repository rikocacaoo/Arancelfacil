/* ===================================================================
   Calculadora de exportación
   Costo hasta FOB = costo fábrica x cantidad + gastos hasta puerto
   FOB = costo hasta FOB x (1 + margen)   |   CFR = FOB + flete   |   CIF = CFR + seguro
   =================================================================== */
const $ = id => document.getElementById(id);
const num = id => Math.max(0, parseFloat($(id).value) || 0);
const usd = n => "$" + n.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});

let ultimo = null;

function calcular() {
  const cant = num("cant") || 1, fabrica = cant * num("costo"), gastos = num("g1") + num("g2") + num("g3") + num("g4");
  const costoFob = fabrica + gastos, ganancia = costoFob * num("margen") / 100, fob = costoFob + ganancia;
  const inco = $("inco").value, flete = inco === "FOB" ? 0 : num("flete"), seguro = inco === "CIF" ? num("seguro") : 0;
  const cotizar = fob + flete + seguro, draw = fob * num("draw") / 100;
  $("r-nombre").textContent = "Precio a cotizar (" + inco + ")";
  $("r-total").textContent = usd(cotizar);
  $("r-unit").textContent = usd(fob / cant);
  const filas = [["Costo de fábrica", fabrica], ["Gastos hasta el puerto", gastos], ["Costo hasta FOB", costoFob, 1], ["Ganancia", ganancia],
    ["Precio FOB total", fob, 1], ["Flete (" + inco + ")", flete], ["Seguro", seguro], ["Precio a cotizar", cotizar, 1],
    ["Restitución estimada", draw], ["Ganancia con restitución", ganancia + draw, 1]];
  ultimo = {total: cotizar, unit: fob / cant, filas: filas.map(f => [f[0], f[1]]), inco};
  $("tabla").innerHTML = filas.map(f => `<tr class="${f[2] ? "sub" : ""}"><td>${f[0]}</td><td>${usd(f[1])}</td></tr>`).join("");
  const partes = [["Costo de fábrica", fabrica, "#0B1F4B"], ["Gastos al puerto", gastos, "#12D6A5"], ["Ganancia", ganancia, "#FFB020"], ["Flete y seguro", flete + seguro, "#2563FF"]];
  $("barra-c").innerHTML = partes.map(p => `<i style="width:${cotizar ? p[1] / cotizar * 100 : 0}%;background:${p[2]}" title="${p[0]}"></i>`).join("");
  $("leyenda").innerHTML = partes.filter(p => p[1] > 0).map(p => `<span style="--c:${p[2]}">${p[0]}</span>`).join("");
}
document.querySelectorAll("#datos input, #datos select").forEach(el => el.addEventListener("input", calcular));
calcular();

$("b-guardar").onclick = () => Cuenta.requiere(() => {
  Cuenta.agregar("cotizaciones", {tipo: "Exportación", titulo: "Precio " + ultimo.inco + " · " + (num("cant") || 1) + " unidades", total: ultimo.total, unit: ultimo.unit, filas: ultimo.filas});
  Cuenta.aviso("Cotización guardada en Mi espacio ✓");
}, "Crea una cuenta gratis para guardar tus cotizaciones.");
$("b-imprimir").onclick = () => Cuenta.requiere(() => window.print(), "Inicia sesión para imprimir o guardar en PDF.");
