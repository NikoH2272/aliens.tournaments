/* ── MOBILE MENU TOGGLE ──────────────────── */
const burgerBtn = document.getElementById('burgerBtn');
const hdrNav = document.getElementById('hdrNav');

if (burgerBtn && hdrNav) {
  burgerBtn.addEventListener('click', () => {
    hdrNav.classList.toggle('active');
  });
  
  // Cerrar menú al hacer clic en un enlace en móviles
  hdrNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hdrNav.classList.remove('active');
    });
  });
}

/* ── COUNTDOWN ───────────────────────────── */
(function() {
  const pad = n => String(n).padStart(2,'0');
  function tick() {
    const target = window._cdTarget;
    if (!target) return;
    const diff = target - Date.now();
    if (diff <= 0) {
      ['cdD','cdH','cdM','cdS'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.textContent = '00';
      });
      window._cdTarget = null;
      window.dispatchEvent(new Event('countdown:expired'));
      return;
    }
    const dEl = document.getElementById('cdD');
    const hEl = document.getElementById('cdH');
    const mEl = document.getElementById('cdM');
    const sEl = document.getElementById('cdS');
    if(dEl) dEl.textContent = pad(Math.floor(diff/86400000));
    if(hEl) hEl.textContent = pad(Math.floor(diff%86400000/3600000));
    if(mEl) mEl.textContent = pad(Math.floor(diff%3600000/60000));
    if(sEl) sEl.textContent = pad(Math.floor(diff%60000/1000));
  }
  tick(); setInterval(tick, 1000);
})();

/* Two equal, non-shrinking sets make the logo loop seamless at every width. */
let countdownLogoObserver;
function renderCountdownLogos(container, rows, teams) {
  countdownLogoObserver?.disconnect();
  container.replaceChildren();
  if (!rows.length) return;
  container.innerHTML = '<div class="cd-logo-window"><div class="cd-logos-track"></div></div><button type="button" class="cd-pause" aria-label="Pausar logos" aria-pressed="false"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 3h3v10H4zm5 0h3v10H9z"/></svg></button>';
  const viewport = container.querySelector('.cd-logo-window');
  const track = container.querySelector('.cd-logos-track');
  const toggle = container.querySelector('button');
  let paused = false;
  toggle.addEventListener('click', () => {
    paused = !paused;
    track.style.animationPlayState = paused ? 'paused' : 'running';
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Reanudar logos' : 'Pausar logos');
    toggle.innerHTML = paused ? '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="m5 2 9 6-9 6z"/></svg>' : '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 3h3v10H4zm5 0h3v10H9z"/></svg>';
  });
  function fill() {
    const itemWidth = matchMedia('(max-width:600px)').matches ? 35 : 50;
    const repeats = Math.max(1, Math.ceil(viewport.clientWidth / (rows.length * itemWidth)));
    const sequence = Array.from({length:repeats}, (_, repeat) => rows.map(r => `<img src="${PYROCORE.esc(PYROCORE.teamLogo(teams, r.team) || 'logo.png')}" alt="${repeat ? '' : PYROCORE.esc(r.team)}" ${repeat ? 'aria-hidden="true"' : ''} title="${PYROCORE.esc(r.team)}" onerror="this.onerror=null;this.src='logo.png'">`).join('')).join('');
    track.innerHTML = `<div class="cd-logo-set">${sequence}</div><div class="cd-logo-set" aria-hidden="true">${sequence}</div>`;
    track.style.setProperty('--cd-dur', `${Math.max(14, rows.length * repeats * 2)}s`);
    track.style.animationPlayState = paused ? 'paused' : 'running';
  }
  fill();
  countdownLogoObserver = new ResizeObserver(fill);
  countdownLogoObserver.observe(viewport);
}

/* ── TEAMS RENDER ────────────────────────── */
(function() {
  const teams = [
    { name:'NOVA GALAXY',    region:'LATAM Sur',   pts:4280, trend:'+3', cls:'up' },
    { name:'STELLAR FORCE',  region:'LATAM Norte', pts:3950, trend:'+1', cls:'up' },
    { name:'VOID HUNTERS',   region:'México',      pts:3720, trend:'—',  cls:'eq' },
    { name:'PUMAS ESPORTS',  region:'Colombia',    pts:3405, trend:'-2', cls:'dn' },
    { name:'COSMOS ELITE',   region:'Argentina',   pts:3190, trend:'+5', cls:'up' },
    { name:'DARK MATTER',    region:'Brasil',      pts:2980, trend:'-1', cls:'dn' },
    { name:'ECLIPSE GG',     region:'Chile',       pts:2740, trend:'+2', cls:'up' },
    { name:'ORION SQUAD',    region:'Perú',        pts:2510, trend:'—',  cls:'eq' },
  ];
  const list = document.getElementById('teamsList');
  if (!list) return;
  
  teams.forEach((t, i) => {
    const r = document.createElement('div');
    r.className = 'team-row' + (i===0?' r1':i===1?' r2':i===2?' r3':'');
    r.innerHTML = `
      <div class="team-rank">${String(i+1).padStart(2,'0')}</div>
      <div><div class="team-name">${t.name}</div><div class="team-region">${t.region}</div></div>
      <div class="team-pts"><div class="pts-n">${t.pts.toLocaleString()}</div><div class="pts-l">Puntos</div></div>
      <div class="team-trend ${t.cls}">${t.trend}</div>`;
    list.appendChild(r);
  });
})();

/* ── GAMES GRID & CANVAS BACKGROUNDS ─────── */
(function() {
  const games = [
    { name:'FREE FIRE',    tag:'BATTLE ROYALE', mode:'12v12 · PC / Móvil', color:'#00B4D8' },
    { name:'VALORANT',     tag:'FPS TÁCTICO',   mode:'5v5 · PC',           color:'#7B2FBE' },
    { name:'CALL OF DUTY', tag:'SHOOTER',       mode:'5v5 · PC / PS5',     color:'#F87171' },
    { name:'APEX LEGENDS', tag:'BATTLE ROYALE', mode:'3v3 · PC / Consola', color:'#00B4D8' },
  ];
  const grid = document.getElementById('gamesGrid');
  if (!grid) return;

  games.forEach(g => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `
      <canvas class="game-bg" width="200" height="267"></canvas>
      <div class="game-overlay"></div>
      <div class="game-body">
        <span class="game-tag">${g.tag}</span>
        <div class="game-name">${g.name}</div>
        <div class="game-mode">${g.mode}</div>
      </div>`;
    grid.appendChild(card);
    drawGameBg(card.querySelector('canvas'), g.color);
  });
})();

function drawGameBg(cv, accent) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const t0 = performance.now();
  function draw() {
    const t = (performance.now()-t0)/1000;
    ctx.clearRect(0,0,W,H);
    const bg = ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,'#0D1E38'); bg.addColorStop(1,'#0A1628');
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
    ctx.save();
    ctx.globalAlpha = .08;
    ctx.strokeStyle = accent; ctx.lineWidth = .8;
    const hs = 18;
    for (let r=-2; r<=14; r++) for (let c=-2; c<=10; c++) {
      const hx = c*hs*1.73+(r%2)*hs*.865, hy = r*hs*1.5;
      ctx.beginPath();
      for (let i=0;i<6;i++) {
        const a=(Math.PI/180)*(60*i-30);
        i===0?ctx.moveTo(hx+(hs-1)*Math.cos(a),hy+(hs-1)*Math.sin(a)):ctx.lineTo(hx+(hs-1)*Math.cos(a),hy+(hs-1)*Math.sin(a));
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
    const gw = ctx.createRadialGradient(W*.5,H*.28,0,W*.5,H*.28,W*.55);
    gw.addColorStop(0,accent+'22'); gw.addColorStop(1,'transparent');
    ctx.fillStyle = gw; ctx.fillRect(0,0,W,H);
    const pr = 44+Math.sin(t*1.5)*5;
    ctx.beginPath(); ctx.arc(W*.5,H*.28,pr,0,Math.PI*2);
    ctx.strokeStyle = accent+'55'; ctx.lineWidth=1.5; ctx.stroke();
    requestAnimationFrame(draw);
  }
  draw();
}
