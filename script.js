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
  const target = new Date('2026-11-09T18:00:00-06:00').getTime();
  const pad = n => String(n).padStart(2,'0');
  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) {
      ['cdD','cdH','cdM','cdS'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.textContent = '00';
      });
      return;
    }
    const d = document.getElementById('cdD');
    const h = document.getElementById('cdH');
    const m = document.getElementById('cdM');
    const s = document.getElementById('cdS');

    if(d) d.textContent = pad(Math.floor(diff/86400000));
    if(h) h.textContent = pad(Math.floor(diff%86400000/3600000));
    if(m) m.textContent = pad(Math.floor(diff%3600000/60000));
    if(s) s.textContent = pad(Math.floor(diff%60000/1000));
  }
  tick(); setInterval(tick, 1000);
})();

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