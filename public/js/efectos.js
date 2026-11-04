/* Efectos estilo Apple: aparición al hacer scroll, parallax, historia pegajosa y contadores */
(() => {
  const $$ = s => document.querySelectorAll(s);
  const obs = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("visible"); obs.unobserve(e.target);
    setTimeout(() => e.target.style.transitionDelay = "", 1500);          // el hover no queda con retraso
  }), {threshold: .12});
  $$(".pasos article, .como h2, .calc .card, .tile, .cifra, .bento h2").forEach((el, i) => {
    el.classList.add("reveal"); el.style.transitionDelay = (i % 3) * 100 + "ms"; obs.observe(el);
  });

  const hero = document.querySelector(".hero:not(.mini)"), story = document.getElementById("historia"), mock = document.getElementById("mock");
  const pasos = $$(".story-text li");
  function alScroll() {
    if (hero) { hero.style.setProperty("--py", Math.min(scrollY, 900) * .25 + "px"); hero.style.setProperty("--hp", Math.min(1, scrollY / 700)); }
    if (!story) return;
    const p = Math.max(0, Math.min(.999, (54 - story.getBoundingClientRect().top) / (story.offsetHeight - innerHeight + 54)));
    const i = Math.floor(p * 3);                                           // 0, 1 o 2: paso activo
    mock.dataset.estado = i; pasos.forEach((li, k) => li.classList.toggle("activo", k === i));
  }
  addEventListener("scroll", alScroll, {passive: true}); alScroll();

  if (typeof ARANCEL !== "undefined" && typeof CAPITULOS !== "undefined") {                                    // contadores de la sección de cifras
    const meta = {subpartidas: ARANCEL.length, capitulos: CAPITULOS.length, secciones: SECCIONES.length};
    $$("[data-n]").forEach(el => new IntersectionObserver((es, o) => {
      if (!es[0].isIntersecting) return; o.disconnect();
      const t0 = performance.now(), fin = meta[el.dataset.n];
      (function paso(t) { const k = Math.min(1, (t - t0) / 1600); el.textContent = Math.round(fin * (1 - Math.pow(1 - k, 3))).toLocaleString("es-PE"); if (k < 1) requestAnimationFrame(paso); })(t0);
    }).observe(el));
  }
})();
