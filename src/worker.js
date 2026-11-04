/* ===================================================================
   WORKER DE CLOUDFLARE: entiende descripciones libres con IA (Gemini).
   La IA solo puede elegir entre partidas reales del arancel (nunca inventa).
   La página (public/) la sirve Cloudflare; este código solo atiende /api/*
   Secreto requerido: GEMINI_API_KEY   ·   Variable opcional: GEMINI_MODEL
   =================================================================== */
import {INDICE, PARTIDAS, CAPS} from "./indice.js";

const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

async function ia(env, sistema, usuario) {
  const modelo = env.GEMINI_MODEL || "gemini-flash-latest";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: {"content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY},
    body: JSON.stringify({
      systemInstruction: {parts: [{text: sistema}]},
      contents: [{role: "user", parts: [{text: usuario}]}],
      generationConfig: {temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json"}
    })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || "Error " + r.status);
  const t = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("La IA no devolvió una respuesta válida");
  return JSON.parse(m[0]);
}

// Busca las partidas que más se parecen a los términos que sugirió la IA
function candidatas(terminos, capitulos = []) {
  const toks = [...new Set(terminos.flatMap(t => norm(String(t)).split(/[^a-z0-9ñ]+/)).filter(x => x.length > 2).map(x => x.replace(/(es|s)$/, "")))];
  if (!toks.length) return [];
  const df = new Array(toks.length).fill(0);
  const hits = INDICE.map(r => toks.map((t, i) => { const h = r[2].includes(t); if (h) df[i]++; return h; }));
  const pesos = df.map(d => Math.log(INDICE.length / (1 + d)));
  const mejor = new Map();
  INDICE.forEach((r, k) => {
    let sc = 0;
    hits[k].forEach((h, i) => { if (h) sc += pesos[i]; });
    if (sc > 0 && capitulos.includes(r[1])) sc += 3;
    if (sc > (mejor.get(r[0])?.sc || 0)) mejor.set(r[0], {p: r[0], c2: r[1], sc});
  });
  return [...mejor.values()].sort((a, b) => b.sc - a.sc).slice(0, 24);
}

async function interpretar(env, texto) {
  const a = await ia(env, `Eres experto en clasificación arancelaria (Sistema Armonizado, Arancel de Aduanas del Perú).
Traduce la descripción de un emprendedor al vocabulario oficial del arancel. Responde SOLO un JSON:
{"terminos":[8 a 14 palabras o frases cortas en español que aparecerían en el texto oficial: nombre técnico, materia, función, sinónimos],"capitulos":[hasta 4 capítulos de 2 dígitos, ej "61"]}`, texto);
  const cand = candidatas(a.terminos || [], (a.capitulos || []).map(String));
  if (!cand.length) return {partidas: []};
  const lista = cand.map(c => `${c.p} | Cap. ${c.c2} ${CAPS[c.c2] || ""} | ${PARTIDAS[c.p]}`).join("\n");
  const b = await ia(env, `Eres experto en clasificación arancelaria. Elige entre las partidas candidatas las que mejor podrían clasificar el producto (máximo 4, de más a menos probable).
Solo puedes usar códigos de la lista. Responde SOLO un JSON: {"partidas":[{"p":"61.09","razon":"frase corta en español de por qué"}]}`,
    `Producto: ${texto}\n\nCandidatas:\n${lista}`);
  const validos = new Set(cand.map(c => c.p));
  return {partidas: (b.partidas || []).filter(x => validos.has(x.p)).slice(0, 4), terminos: a.terminos};
}

const json = (c, o) => new Response(JSON.stringify(o), {status: c, headers: {"Content-Type": "application/json", "Cache-Control": "no-store"}});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/api/estado") return json(200, {ia: !!env.GEMINI_API_KEY});
    if (url.pathname === "/api/interpretar" && req.method === "POST") {
      if (!env.GEMINI_API_KEY) return json(503, {error: "sin_clave"});
      const body = await req.text();
      if (body.length > 5000) return json(413, {error: "demasiado_largo"});
      try {
        const texto = String(JSON.parse(body).texto || "").slice(0, 400);
        if (!texto.trim()) return json(400, {error: "texto_vacio"});
        return json(200, await interpretar(env, texto));
      } catch (e) { console.error("Error IA:", e.message); return json(500, {error: e.message}); }
    }
    if (url.pathname.startsWith("/api/")) return json(404, {error: "no_encontrado"});
    return env.ASSETS.fetch(req);
  }
};
