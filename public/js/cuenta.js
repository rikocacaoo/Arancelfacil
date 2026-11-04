/* ===================================================================
   CUENTAS DE USUARIO (versión demostración, guardada en tu navegador)
   - Crear cuenta, iniciar y cerrar sesión. La clave se guarda cifrada (PBKDF2).
   - Cada usuario tiene: productos guardados, historial y cotizaciones.
   - OJO: los datos viven en este navegador. Para cuentas reales (varios
     dispositivos, recuperar clave) hará falta un servidor con base de datos.
   =================================================================== */
const Cuenta = (() => {
  const leer = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const poner = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const usuarios = () => leer("af_usuarios") || {};
  const enc = new TextEncoder(), hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");

  async function cifrar(clave, sal) {
    if (!(window.crypto && crypto.subtle)) return btoa(sal + clave);            // respaldo si el navegador no cifra
    const k = await crypto.subtle.importKey("raw", enc.encode(clave), "PBKDF2", false, ["deriveBits"]);
    return hex(await crypto.subtle.deriveBits({name: "PBKDF2", salt: enc.encode(sal), iterations: 100000, hash: "SHA-256"}, k, 256));
  }
  const usuario = () => { const e = leer("af_sesion"); return e ? usuarios()[e] || null : null; };
  const avisar = () => { pintarNav(); document.dispatchEvent(new Event("cuenta")); };

  async function registrar(nombre, email, clave) {
    email = email.trim().toLowerCase(); nombre = nombre.trim();
    if (!nombre) throw "Escribe tu nombre.";
    if (!/^\S+@\S+\.\S+$/.test(email)) throw "Escribe un correo válido.";
    if (clave.length < 6) throw "La clave debe tener al menos 6 caracteres.";
    const us = usuarios(); if (us[email]) throw "Ese correo ya tiene una cuenta.";
    const sal = hex(crypto.getRandomValues(new Uint8Array(12)));
    us[email] = {nombre, email, sal, hash: await cifrar(clave, sal), creado: Date.now(), datos: {productos: [], historial: [], cotizaciones: []}};
    poner("af_usuarios", us); poner("af_sesion", email); avisar();
  }
  async function entrar(email, clave) {
    email = email.trim().toLowerCase(); const u = usuarios()[email];
    if (!u || (await cifrar(clave, u.sal)) !== u.hash) throw "Correo o clave incorrectos.";
    poner("af_sesion", email); avisar();
  }
  const salir = () => { localStorage.removeItem("af_sesion"); avisar(); };

  /* ---- datos del usuario: "productos", "historial", "cotizaciones" ---- */
  const lista = t => (usuario() && usuario().datos[t]) || [];
  function guardarLista(t, arr) { const us = usuarios(), e = leer("af_sesion"); us[e].datos[t] = arr; poner("af_usuarios", us); }
  function agregar(t, item) {
    if (!usuario()) return false;
    const arr = lista(t).filter(x => !(t === "productos" && x.codigo === item.codigo));        // sin repetidos
    arr.unshift({...item, id: Date.now() + Math.random().toString(36).slice(2, 6), fecha: new Date().toISOString()});
    guardarLista(t, arr.slice(0, 100)); return true;
  }
  const quitar = (t, id) => guardarLista(t, lista(t).filter(x => x.id !== id));

  /* ---- ventana de acceso (estilo hoja de Apple) ---- */
  let modal, pendiente = null, modo = "entrar";
  const q = id => modal.querySelector(id);
  function construir() {
    modal = document.createElement("div"); modal.className = "modal";
    modal.innerHTML = `<div class="hoja" role="dialog" aria-modal="true">
      <button class="cerrar" type="button" aria-label="Cerrar">✕</button>
      <h2 id="m-titulo"></h2><p class="m-msg" id="m-msg"></p>
      <div class="seg"><button type="button" data-m="entrar">Iniciar sesión</button><button type="button" data-m="crear">Crear cuenta</button></div>
      <form id="m-form">
        <input id="m-nombre" placeholder="Tu nombre" autocomplete="name">
        <input id="m-email" type="email" placeholder="Correo electrónico" autocomplete="email" required>
        <input id="m-clave" type="password" placeholder="Clave (mínimo 6 caracteres)" autocomplete="current-password" required>
        <p class="m-error" id="m-error"></p>
        <button class="btn" type="submit" id="m-ok"></button>
      </form>
      <p class="m-pie">Modo demostración: tu cuenta se guarda solo en este navegador.</p></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal || e.target.closest(".cerrar")) cerrar(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") cerrar(); });
    modal.querySelectorAll(".seg button").forEach(b => b.onclick = () => pintarModo(b.dataset.m));
    q("#m-form").onsubmit = async e => {
      e.preventDefault(); q("#m-error").textContent = "";
      try {
        if (modo === "crear") await registrar(q("#m-nombre").value, q("#m-email").value, q("#m-clave").value);
        else await entrar(q("#m-email").value, q("#m-clave").value);
        cerrar(); const f = pendiente; pendiente = null; if (f) f();
      } catch (err) { q("#m-error").textContent = typeof err === "string" ? err : "Ocurrió un error. Inténtalo de nuevo."; }
    };
  }
  function pintarModo(m) {
    modo = m; const crear = m === "crear";
    q("#m-titulo").textContent = crear ? "Crea tu cuenta gratis" : "Bienvenido de nuevo";
    q("#m-nombre").hidden = !crear; q("#m-ok").textContent = crear ? "Crear cuenta" : "Entrar";
    q("#m-clave").autocomplete = crear ? "new-password" : "current-password";
    modal.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.m === m));
  }
  function abrir(msg, m = "entrar") {
    if (!modal) construir();
    pintarModo(m); q("#m-msg").textContent = msg || "Guarda productos, historial y cotizaciones."; q("#m-error").textContent = "";
    requestAnimationFrame(() => { modal.classList.add("abierto"); q("#m-email").focus(); });
  }
  const cerrar = () => { if (modal) modal.classList.remove("abierto"); pendiente = null; };
  const requiere = (fn, msg) => { if (usuario()) fn(); else { abrir(msg, "crear"); pendiente = fn; } };

  function aviso(texto) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = texto; t.classList.add("on"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("on"), 2400);
  }

  /* ---- botón de la barra superior + candados ---- */
  function pintarNav() {
    const nav = document.querySelector(".top nav"); if (!nav) return;
    let b = nav.querySelector(".nav-cuenta");
    if (!b) { b = document.createElement("a"); b.className = "nav-cuenta"; nav.appendChild(b); }
    const u = usuario();
    b.textContent = u ? "👤 " + u.nombre.split(" ")[0] : "Iniciar sesión"; b.href = u ? "cuenta.html" : "#";
    b.onclick = u ? null : e => { e.preventDefault(); abrir("Accede para guardar y exportar tus datos."); };
    document.querySelectorAll("[data-pro]").forEach(el => el.classList.toggle("bloqueado", !u));
  }
  pintarNav();
  return {usuario, registrar, entrar, salir, lista, agregar, quitar, requiere, abrir, aviso, refrescar: pintarNav};
})();
