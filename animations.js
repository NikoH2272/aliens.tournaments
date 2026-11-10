/* ── animations.js — GSAP + ScrollTrigger ── */
gsap.registerPlugin(ScrollTrigger);

const mm = gsap.matchMedia();

mm.add('(prefers-reduced-motion: no-preference)', () => {

  /* ── Header: desliza desde arriba ── */
  gsap.from('.hdr', {
    y: -80, autoAlpha: 0,
    duration: 0.8, ease: 'power2.out'
  });

  /* ── Hero: entrada en cascada ── */
  const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  heroTl
    .from('.hero-title',    { y: 70, autoAlpha: 0, duration: 0.9, ease: 'power4.out' }, 0.45)
    .from('.hero-sub',      { y: 24, autoAlpha: 0, duration: 0.5 }, 0.9)
    .from('.hero-btns > *', { y: 20, autoAlpha: 0, stagger: 0.13, duration: 0.5 }, 1.05)
    .from('.hero-stat',     { y: 28, autoAlpha: 0, stagger: 0.1,  duration: 0.5 }, 1.2);

  /* ── Hero bg: parallax sutil ── */
  gsap.to('.hero-img', {
    yPercent: 22, ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: true
    }
  });

  /* ── Countdown bar ── */
  gsap.from('.cd-bar', {
    y: 40, autoAlpha: 0, duration: 0.7, ease: 'power2.out',
    scrollTrigger: { trigger: '.cd-bar', start: 'top 90%', once: true }
  });

  // Los títulos y el contenido funcional permanecen visibles al navegar por anclas.

  /* ── Footer: columnas stagger ── */
  ScrollTrigger.batch('.ft-brand, .ft-col', {
    start: 'top 92%', once: true,
    onEnter: batch => gsap.from(batch, {
      y: 30, autoAlpha: 0, stagger: 0.1, duration: 0.55, ease: 'power2.out'
    })
  });

  /* ── Stats: contador animado ── */
  document.querySelectorAll('.stat-n em').forEach(el => {
    const num = parseInt(el.textContent);
    if (isNaN(num) || num <= 1) return;
    const proxy = { val: 0 };
    gsap.to(proxy, {
      val: num, duration: 1.6, ease: 'power1.out',
      onUpdate: () => { el.textContent = Math.round(proxy.val); },
      scrollTrigger: { trigger: el, start: 'top 85%', once: true }
    });
  });

});
