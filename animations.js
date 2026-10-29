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
    .from('.hero-eyebrow',  { y: 30, autoAlpha: 0, duration: 0.5 }, 0.2)
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

  /* ── Sección torneos: eyebrow + título ── */
  gsap.from('.sec-eyebrow, .sec-title', {
    y: 30, autoAlpha: 0, stagger: 0.12, duration: 0.65, ease: 'power2.out',
    scrollTrigger: { trigger: '#torneos', start: 'top 82%', once: true }
  });

  /* ── Fases: stagger desde abajo ── */
  gsap.set('.phase', { autoAlpha: 0, y: 52 });
  ScrollTrigger.batch('.phase', {
    start: 'top 88%',
    once: true,
    onEnter: batch => gsap.to(batch, {
      autoAlpha: 1, y: 0,
      duration: 0.65, ease: 'power2.out', stagger: 0.16
    })
  });

  /* ── Fases: hover lift ── */
  document.querySelectorAll('.phase').forEach(card => {
    card.addEventListener('mouseenter', () =>
      gsap.to(card, { y: -6, duration: 0.3, ease: 'power2.out' }));
    card.addEventListener('mouseleave', () =>
      gsap.to(card, { y: 0,  duration: 0.4, ease: 'power2.inOut' }));
  });

  /* ── CTA: entrada dramática ── */
  const ctaTl = gsap.timeline({
    scrollTrigger: { trigger: '.cta', start: 'top 80%', once: true }
  });
  ctaTl
    .from('.cta-title',      { y: 55, autoAlpha: 0, duration: 0.8, ease: 'power3.out' })
    .from('.cta-sub',        { y: 22, autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, '-=0.35')
    .from('.cta .btn-primary', { scale: 0.82, autoAlpha: 0, duration: 0.6, ease: 'back.out(2)' }, '-=0.25');

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
