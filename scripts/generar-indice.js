/* Genera src/indice.js a partir de los datos del arancel (public/js).
   Cloudflare Workers no permite eval/new Function, por eso los datos se
   precalculan una vez aquí y se empaquetan con el Worker.
   Ejecutar solo si cambias public/js/arancel_data.js o estructura_data.js:  npm run indice */
import fs from "node:fs";
const leer = f => fs.readFileSync(new URL("../public/js/" + f, import.meta.url), "utf8");
const {ARANCEL} = new Function(leer("arancel_data.js") + ";return {ARANCEL}")();
const {PARTIDAS, CAPITULOS} = new Function(leer("estructura_data.js") + ";return {PARTIDAS, CAPITULOS}")();
const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const INDICE = ARANCEL.map(r => [r.p, r.c.slice(0, 2), norm(r.t + " " + (PARTIDAS[r.p] || ""))]);
const CAPS = Object.fromEntries(CAPITULOS.map(c => [c.codigo, c.titulo]));
const usadas = [...new Set(INDICE.map(r => r[0]))];
const PART = Object.fromEntries(usadas.map(p => [p, PARTIDAS[p] || ""]));

fs.writeFileSync(new URL("../src/indice.js", import.meta.url),
  "// ARCHIVO GENERADO por scripts/generar-indice.js — no editar a mano\n" +
  `export const INDICE = ${JSON.stringify(INDICE)};\nexport const PARTIDAS = ${JSON.stringify(PART)};\nexport const CAPS = ${JSON.stringify(CAPS)};\n`);
console.log("OK:", INDICE.length, "filas,", usadas.length, "partidas");
