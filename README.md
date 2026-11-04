# ArancelFácil en Cloudflare (IA con Gemini)

## Probar en tu PC
1. `npm install`
2. Copia `.dev.vars.example` a `.dev.vars` y pega tu clave de Gemini.
3. `npm run dev` → abre http://localhost:8787

## Publicar
1. `npx wrangler login`
2. `npx wrangler secret put GEMINI_API_KEY`   (pega tu clave cuando la pida)
3. `npm run deploy`

Modelo de Gemini: variable `GEMINI_MODEL` en `wrangler.jsonc` (por defecto `gemini-flash-latest`).
Si cambias `public/js/arancel_data.js` o `estructura_data.js`, ejecuta `npm run indice` antes de desplegar.
