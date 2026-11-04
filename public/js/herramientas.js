/* Herramientas: carga/CBM, precio de venta, Incoterms 2020 y validadores */
const $ = id => document.getElementById(id), num = id => Math.max(0, parseFloat($(id).value) || 0);
const f2 = n => n.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
const fila = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;

/* ---- 1. Carga: volumen, peso volumétrico y contenedores (valores referenciales; varían por naviera) ---- */
const CONT = [["20' estándar", 33.2, 28000], ["40' estándar", 67.7, 26500], ["40' High Cube", 76.4, 26500]];   // nombre, m³ internos, carga útil kg
function carga() {
  const l = num("l"), a = num("a"), h = num("h"), kg = num("kg"), n = num("n") || 1, ef = (num("ef") || 85) / 100;
  const v1 = l * a * h / 1e6, vol = v1 * n, peso = kg * n, vw = l * a * h / 6000 * n;
  const filas = CONT.map(([nom, cap, pay]) => {
    const need = Math.max(1, Math.ceil(Math.max(vol / (cap * ef), peso / pay) - 1e-9)), limita = vol / (cap * ef) >= peso / pay ? "volumen" : "peso";
    return `<tr><td>${nom}</td><td>${v1 ? Math.floor(cap * ef / v1) : 0}</td><td>${need}</td><td>${Math.round(vol / (need * cap) * 100)}%</td><td>${limita}</td></tr>`; }).join("");
  $("r-carga").innerHTML = `<div class="grande">${f2(vol)} m³</div><table><tr><th>Dato</th><th></th></tr>${fila("Peso total", f2(peso) + " kg")}${fila("Peso volumétrico aéreo (6000 cm³/kg)", f2(vw) + " kg")}${fila("Peso cobrable por avión", f2(Math.max(peso, vw)) + " kg")}</table>
    <table style="margin-top:14px"><tr><th>Contenedor</th><th>Cajas por contenedor</th><th>Necesitas</th><th>Ocupación de volumen</th><th>Limita por</th></tr>${filas}</table>
    <p class="consejo">${vol < 15 ? "Con menos de ~15 m³ suele convenir carga consolidada (LCL)." : "Desde ~15 m³ suele convenir contenedor completo (FCL)."} Es una regla práctica: compara cotizaciones. Los volúmenes y cargas útiles son aproximados.</p>`;
}

/* ---- 2. Precio de venta ---- */
function precio() {
  const c = num("c"), m = num("m") / 100, cm = num("cm") / 100, ig = num("ig") / 100, gf = num("gf"), u = num("u");
  if (m + cm >= 1) return $("r-precio").innerHTML = `<span class="mal">El margen más las comisiones deben sumar menos de 100%.</span>`;
  const p = c / (1 - m - cm), util = p * m, pe = util > 0 ? Math.ceil(gf / util) : 0;
  $("r-precio").innerHTML = `<div class="grande">${f2(p * (1 + ig))}</div><p class="consejo" style="margin:0 0 8px">Precio al público con IGV</p><table>
    ${fila("Precio sin IGV", f2(p))}${fila("Utilidad por unidad", f2(util))}${fila("Markup sobre el costo", f2((p - c) / (c || 1) * 100) + "%")}
    ${fila("Utilidad con " + u + " unidades", f2(util * u - gf))}${fila("Punto de equilibrio", pe + " unidades")}</table>`;
}

/* ---- 3. Incoterms 2020 ---- */
const V = '<span class="v">Vendedor</span>', C = '<span class="c">Comprador</span>';
const INCO = [["EXW", "En fábrica", "Cualquiera", C, C, C, C, "En el local del vendedor"], ["FCA", "Franco transportista", "Cualquiera", V, C, C, C, "Al entregar al transportista"],
  ["FAS", "Al costado del buque", "Marítimo", V, C, C, C, "Junto a la nave"], ["FOB", "Libre a bordo", "Marítimo", V, C, C, C, "A bordo del buque"],
  ["CFR", "Costo y flete", "Marítimo", V, V, C, C, "A bordo en origen"], ["CIF", "Costo, seguro y flete", "Marítimo", V, V, V, C, "A bordo en origen"],
  ["CPT", "Transporte pagado hasta", "Cualquiera", V, V, C, C, "Al primer transportista"], ["CIP", "Transporte y seguro pagados", "Cualquiera", V, V, V, C, "Al primer transportista"],
  ["DAP", "Entregado en lugar", "Cualquiera", V, V, "Opcional", C, "En destino, sin descargar"], ["DPU", "Entregado y descargado", "Cualquiera", V, V, "Opcional", C, "En destino, descargado"],
  ["DDP", "Entregado derechos pagados", "Cualquiera", V, V, "Opcional", V, "En destino"]];
$("t-inco").innerHTML = `<tr><th>Sigla</th><th>Nombre</th><th>Modo</th><th>Exportación</th><th>Flete</th><th>Seguro</th><th>Importación</th><th>El riesgo pasa…</th></tr>` +
  INCO.map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td><td>${r[7]}</td></tr>`).join("");

/* ---- 4. Validadores (dígito verificador) ---- */
const VAL = (() => { const m = {}; let v = 10; for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") { if (v % 11 === 0) v++; m[c] = v++; } return m; })();
const contenedorOk = c => { let s = 0; for (let i = 0; i < 10; i++) s += (i < 4 ? VAL[c[i]] : +c[i]) * Math.pow(2, i); return (s % 11) % 10 === +c[10]; };
function rucOk(r) {
  const p = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < 10; i++) s += p[i] * +r[i];
  let d = 11 - (s % 11); d = d === 10 ? 0 : d === 11 ? 1 : d; return d === +r[10];
}
function valida() {
  const r = $("ruc").value.replace(/\D/g, ""), c = $("cont").value.replace(/[\s-]/g, "").toUpperCase(), out = [];
  if (r) out.push(!/^(10|15|17|20)\d{9}$/.test(r) ? `<span class="mal">RUC ${r}: formato inválido (11 dígitos, empieza con 10, 15, 17 o 20).</span>`
    : rucOk(r) ? `<span class="ok">RUC ${r}: dígito verificador correcto.</span> ${{10: "Persona natural.", 20: "Persona jurídica u otra entidad."}[r.slice(0, 2)] || ""}` : `<span class="mal">RUC ${r}: el dígito verificador no coincide. Revisa la digitación.</span>`);
  if (c) out.push(!/^[A-Z]{3}[UJZ]\d{7}$/.test(c) ? `<span class="mal">Contenedor ${c}: formato inválido (4 letras, la última U, J o Z, y 7 dígitos).</span>`
    : contenedorOk(c) ? `<span class="ok">Contenedor ${c}: dígito verificador correcto (ISO 6346).</span>` : `<span class="mal">Contenedor ${c}: el dígito verificador no coincide. Revisa la digitación.</span>`);
  $("r-valida").innerHTML = out.join("<br><br>") || "Escribe un RUC o un número de contenedor.";
}

document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => {
  document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll(".panel-h").forEach(p => p.classList.toggle("on", p.id === "p-" + b.dataset.t));
});
[["l", "a", "h", "kg", "n", "ef"], ["c", "m", "cm", "ig", "gf", "u"], ["ruc", "cont"]].forEach((g, i) => g.forEach(id => $(id).addEventListener("input", [carga, precio, valida][i])));
carga(); precio();
