/* Tournament artwork: live HTML scoreboards and full-resolution PNG exports. */
window.TournamentGraphics = (() => {
  const { esc, sortRows, total, teamLogo, generalRows } = PYROCORE;
  const colors = { bg: '#090c14', panel: '#121b28', cyan: '#00b4d8', ink: '#f1e5d2', muted: '#a4b6c6' };
  const nameOf = (r) => r.name || r.team;
  const logoOf = (teams, row) => teamLogo(teams, nameOf(row)) || 'logo.png';
  const scored = (rows) => rows.some(r => Number(r.kills) || Number(r.placement) || Number(r.penalty));
  const leaders = (rows) => [...rows].filter(r => Number(r.kills) > 0)
    .sort((a, b) => Number(b.kills) - Number(a.kills) || total(b) - total(a) || a.team.localeCompare(b.team)).slice(0, 4);
  const rowsFor = (data, group) => group.kind === 'general'
    ? generalRows(data.results, group.phase)
    : sortRows((group.rows || []).filter(r => (r.team || '').trim()));
  function matchStats(data, group) {
    const rows = rowsFor(data, group);
    const kills = rows.reduce((sum, row) => sum + (Number(row.kills) || 0), 0);
    const detail = data.tournament?.resultDetails?.[group.id]?.rows || [];
    const byRoom = new Map();
    let valid = detail.length > 0;
    rows.forEach(row => {
      const entries = detail.filter(entry => entry.rowId === row.id);
      const detailedKills = entries.flatMap(entry => entry.rooms).reduce((sum, room) => sum + room.kills, 0);
      if (detailedKills !== (Number(row.kills) || 0)) valid = false;
    });
    if (valid) detail.forEach(entry => entry.rooms.forEach(room => {
      byRoom.set(room.room, (byRoom.get(room.room) || 0) + room.kills);
    }));
    return [...[...byRoom].sort((a, b) => a[0] - b[0]).map(([room, kills]) => ({ label: `Sala ${room}`, kills })),
      { label: 'Total de kills', kills }];
  }
  const imageHtml = (teams, row, cls = '') => `<img class="${cls}" src="${esc(logoOf(teams, row))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='logo.png'">`;
  const downloadIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></svg>';
  const dateLabel = (date) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Fecha por confirmar';
  const timeLabel = (time) => {
    if (!time) return 'Hora por confirmar';
    const [h, m] = time.split(':').map(Number);
    return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'} MX`;
  };

  function mountResults(data) {
    const tabs = document.getElementById('resTabs');
    const body = document.getElementById('resBody');
    if (!tabs || !body) return;
    const groups = data.results || [];
    const teams = data.teams || [];
    const phases = PYROCORE.PHASES.filter(p => groups.some(g => g.phase === p));
    if (!phases.length) { body.innerHTML = '<p class="res-empty">Aún no hay resultados publicados.</p>'; return; }
    let phase = phases[0];
    let groupId;
    function render() {
      const phaseGroups = groups.filter(g => g.phase === phase);
      const active = phaseGroups.find(g => g.id === groupId)
        || phaseGroups.find(g => g.kind !== 'general' && rowsFor(data, g).length) || phaseGroups[0];
      groupId = active?.id;
      tabs.innerHTML = phases.map(p => `<button class="res-tab ${p === phase ? 'active' : ''}" data-phase="${esc(p)}" aria-pressed="${p === phase}">${esc(p)}</button>`).join('');
      const rows = active ? rowsFor(data, active) : [];
      const topKills = leaders(rows);
      const hasScores = scored(rows);
      const schedule = (data.schedule || []).find(s => s.phase === phase && s.group?.toLowerCase() === active?.title?.toLowerCase());
      body.innerHTML = `<div class="score-group-picker" role="group" aria-label="Grupo de resultados">${phaseGroups.map(g => `<button data-score-group="${esc(g.id)}" aria-pressed="${g.id === groupId}">${esc(g.title || 'Grupo')}</button>`).join('')}</div>
        <article class="scoreboard" data-gid="${esc(groupId)}">
          <header class="score-header">
            <img class="score-brand" src="logo.png" alt="Aliens Tournaments">
            <div><h3>RESULTADOS</h3><p>${esc(data.tournament?.name || 'Aliens Championship')} · ${esc(phase)} · ${esc(active?.title || '')}</p></div>
            <button class="score-download" ${!rows.length ? 'disabled' : ''} aria-label="Descargar resultados de ${esc(active?.title || 'grupo')}">${downloadIcon}<span>Descargar PNG</span></button>
          </header>
          ${hasScores ? `<div class="score-match-stats">${matchStats(data, active).map(stat => `<div><span>${esc(stat.label)}</span><strong>${stat.kills}</strong></div>`).join('')}</div>` : ''}
          <div class="score-kills-heading"><h4>Los más letales</h4><span>TOP 4 · KILLS POR EQUIPO</span></div>
          ${topKills.length ? `<div class="score-killers">${topKills.map((r, i) => `<div class="score-killer">
            <span class="score-killer-rank">${String(i + 1).padStart(2, '0')}</span>${imageHtml(teams, r)}
            <div class="score-killer-count"><strong>${Number(r.kills) || 0}</strong><span>KILLS</span></div><b>${esc(r.team)}</b>
          </div>`).join('')}</div>` : '<p class="score-pending">El top de kills aparecerá cuando se registren eliminaciones.</p>'}
          <div class="score-table-wrap"><table class="score-table">
            <caption class="score-caption">Clasificación de ${esc(active?.title || 'grupo')} · ${esc(phase)}</caption>
            <thead><tr><th scope="col">POS.</th><th scope="col">EQUIPO</th><th scope="col"><abbr title="Puntos de posición">P. POS.</abbr></th><th scope="col">KILLS</th><th scope="col"><abbr title="Sanciones">SANC.</abbr></th><th scope="col">TOTAL</th></tr></thead>
            <tbody>${rows.map((r, i) => `<tr class="${i === 0 && hasScores ? 'score-first' : ''}">
              <td>${String(i + 1).padStart(2, '0')}</td><th scope="row"><div class="score-team">${imageHtml(teams, r)}<span>${esc(r.team)}${i === 0 && hasScores ? '<small>LÍDER DE LA TABLA</small>' : ''}</span></div></th>
              <td>${Number(r.placement) || 0}</td><td>${Number(r.kills) || 0}</td><td>${Number(r.penalty) || 0}</td><td class="score-total">${total(r)}</td>
            </tr>`).join('')}</tbody></table></div>
          ${!rows.length ? '<p class="score-pending">Este grupo aún no tiene equipos registrados.</p>' : ''}
          <footer class="score-footer"><span>${hasScores ? 'Puntos de posición + kills − sanciones' : 'Equipos registrados · Resultados pendientes'}</span><span>${schedule?.date ? esc(dateLabel(schedule.date)) : 'FREE FIRE · LATAM'}</span></footer>
        </article><p class="score-export-status" role="status"></p>`;
    }
    tabs.onclick = e => {
      const button = e.target.closest('[data-phase]');
      if (button) { phase = button.dataset.phase; groupId = null; render(); }
    };
    body.onclick = async e => {
      const pick = e.target.closest('[data-score-group]');
      if (pick) { groupId = pick.dataset.scoreGroup; render(); return; }
      const button = e.target.closest('.score-download');
      if (!button) return;
      const group = groups.find(g => g.id === button.closest('[data-gid]').dataset.gid);
      button.disabled = true;
      const status = body.querySelector('[role="status"]');
      status.textContent = 'Preparando imagen…';
      try { await downloadResults(data, group); status.textContent = 'Imagen descargada.'; }
      catch (_) { status.textContent = 'No se pudo descargar. Intenta de nuevo.'; }
      finally { button.disabled = false; }
    };
    render();
  }

  async function assets(teams, rows) {
    await Promise.all([document.fonts.load('900 100px "Barlow Condensed"'), document.fonts.load('700 30px "Barlow Condensed"')]);
    const paths = [...new Set(['logo.png', 'alien-bg.png', ...rows.map(r => logoOf(teams, r))])];
    const images = {};
    await Promise.all(paths.map(src => new Promise(resolve => {
      const img = new Image();
      img.onload = () => { images[src] = img; resolve(); };
      img.onerror = () => resolve();
      img.src = src;
    })));
    return images;
  }
  function text(ctx, value, x, y, size, color = colors.ink, maxWidth, align = 'left', weight = 700) {
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px "Barlow Condensed", sans-serif`;
    const label = String(value);
    if (maxWidth) {
      while (ctx.measureText(label).width > maxWidth && size > 18) {
        size--; ctx.font = `${weight} ${size}px "Barlow Condensed", sans-serif`;
      }
    }
    ctx.fillText(label, x, y, maxWidth);
  }
  function contain(ctx, img, x, y, w, h) {
    if (!img) return;
    const scale = Math.min(w / img.width, h / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }
  function background(ctx, width, height, images) {
    ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, width, height);
    if (images['alien-bg.png']) {
      ctx.save(); ctx.globalAlpha = .18;
      ctx.drawImage(images['alien-bg.png'], 0, 0, 1080, 590); ctx.restore();
    }
    ctx.fillStyle = colors.cyan;
    ctx.beginPath(); ctx.moveTo(width - 130, 0); ctx.lineTo(width, 0); ctx.lineTo(width, 550); ctx.lineTo(width - 40, 490); ctx.closePath(); ctx.fill();
    ctx.fillRect(48, height - 86, width - 96, 2);
    text(ctx, 'ALIENS TOURNAMENTS', 48, height - 38, 24, colors.ink);
    text(ctx, 'FREE FIRE / LATAM', width - 48, height - 38, 22, colors.muted, undefined, 'right');
  }
  async function save(canvas, filename) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo generar la imagen');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const slug = value => String(value || 'torneo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  async function downloadGeneralResults(data, group, rows) {
    const teams = data.teams || [];
    const images = await assets(teams, rows);
    const pageSize = 72;
    const pageCount = Math.ceil(rows.length / pageSize);
    const top = leaders(rows);
    const hasScores = scored(rows);
    for (let page = 0; page < pageCount; page++) {
      const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);
      const columnCount = pageRows.length > 36 ? 3 : 2;
      const rowsPerColumn = Math.ceil(pageRows.length / columnCount);
      const columnWidth = 860;
      const columnGap = 28;
      const tableY = 390;
      const rowHeight = 48;
      const canvas = document.createElement('canvas');
      canvas.width = 96 + columnCount * columnWidth + (columnCount - 1) * columnGap;
      canvas.height = tableY + 48 + rowsPerColumn * rowHeight + 110;
      const ctx = canvas.getContext('2d');
      background(ctx, canvas.width, canvas.height, images);
      contain(ctx, images['logo.png'], 48, 36, 86, 86);
      text(ctx, 'TABLA GENERAL', 160, 114, 88, colors.ink, canvas.width - 360, 'left', 900);
      text(ctx, `${data.tournament?.name || 'Aliens Championship'} · ${group.phase}`, 50, 165, 28, colors.muted, canvas.width - 96);
      text(ctx, `${rows.length} EQUIPOS${pageCount > 1 ? ` · PÁGINA ${page + 1}/${pageCount}` : ''}`, canvas.width - 48, 108, 24, colors.muted, 300, 'right');
      const topWidth = (canvas.width - 96 - 48) / 4;
      top.forEach((row, index) => {
        const x = 48 + index * (topWidth + 16);
        ctx.fillStyle = colors.panel;
        ctx.fillRect(x, 205, topWidth, 140);
        contain(ctx, images[logoOf(teams, row)] || images['logo.png'], x + 16, 216, 90, 90);
        text(ctx, row.team, x + 124, 245, 28, colors.ink, topWidth - 144);
        text(ctx, `${Number(row.kills) || 0} KILLS`, x + 124, 303, 44, colors.ink, topWidth - 144, 'left', 900);
        ctx.fillStyle = colors.cyan;
        ctx.fillRect(x, 342, topWidth, 3);
      });
      if (!top.length) text(ctx, 'RESULTADOS PENDIENTES', 48, 280, 36, colors.muted);
      const numericColumns = [610, 684, 756, 838];
      for (let column = 0; column < columnCount; column++) {
        const x = 48 + column * (columnWidth + columnGap);
        ctx.fillStyle = '#1b2737';
        ctx.fillRect(x, tableY, columnWidth, 40);
        text(ctx, 'POS.', x + 12, tableY + 27, 18, colors.muted);
        text(ctx, 'EQUIPO', x + 106, tableY + 27, 18, colors.muted);
        ['P. POS.', 'KILLS', 'SANC.', 'TOTAL'].forEach((label, index) =>
          text(ctx, label, x + numericColumns[index], tableY + 27, 18, colors.muted, undefined, 'right'));
        const entries = pageRows.slice(column * rowsPerColumn, (column + 1) * rowsPerColumn);
        entries.forEach((row, index) => {
          const rank = page * pageSize + column * rowsPerColumn + index + 1;
          const y = tableY + 48 + index * rowHeight;
          const first = rank === 1 && hasScores;
          const ink = first ? colors.bg : colors.ink;
          ctx.fillStyle = first ? colors.ink : index % 2 ? '#101722' : '#141e2b';
          ctx.fillRect(x, y, columnWidth, rowHeight - 1);
          text(ctx, String(rank).padStart(2, '0'), x + 12, y + 32, 25, ink);
          contain(ctx, images[logoOf(teams, row)] || images['logo.png'], x + 58, y + 5, 36, 36);
          text(ctx, row.team, x + 106, y + 32, 25, ink, 410);
          [Number(row.placement) || 0, Number(row.kills) || 0, Number(row.penalty) || 0, total(row)].forEach((value, index) =>
            text(ctx, value, x + numericColumns[index], y + 32, index === 3 ? 30 : 25, ink, 68, 'right', index === 3 ? 900 : 600));
        });
      }
      const suffix = pageCount > 1 ? `-${page + 1}de${pageCount}` : '';
      await save(canvas, `tabla-general-${slug(group.phase)}${suffix}.png`);
    }
  }

  async function downloadResults(data, group) {
    if (!group) return;
    const rows = rowsFor(data, group);
    if (!rows.length) return;
    if (group.kind === 'general' && rows.length > 12) return downloadGeneralResults(data, group, rows);
    const teams = data.teams || [];
    const images = await assets(teams, rows);
    const top = leaders(rows);
    const stats = scored(rows) ? matchStats(data, group) : [];
    const statsHeight = stats.length ? 84 : 0;
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 630 + statsHeight + rows.length * 70;
    const ctx = canvas.getContext('2d');
    background(ctx, canvas.width, canvas.height, images);
    contain(ctx, images['logo.png'], 48, 48, 90, 90);
    text(ctx, 'RESULTADOS', 165, 132, 100, colors.ink, 770, 'left', 900);
    text(ctx, `${data.tournament?.name || 'Aliens Championship'} · ${group.phase} · ${group.title}`, 50, 184, 28, colors.muted, 970);
    stats.forEach((stat, index) => {
      const x = 48 + index * (984 / stats.length);
      text(ctx, stat.label.toUpperCase(), x, 220, 19, colors.muted, 984 / stats.length - 16);
      text(ctx, `${stat.kills} KILLS`, x, 258, 32, colors.ink, 984 / stats.length - 16);
    });
    text(ctx, 'LOS MÁS LETALES', 48, 242 + statsHeight, 30);
    text(ctx, 'TOP 4 / KILLS POR EQUIPO', 1032, 242 + statsHeight, 22, colors.muted, undefined, 'right');
    top.forEach((r, i) => {
      const x = 48 + i * 250;
      ctx.save(); ctx.translate(0, statsHeight);
      ctx.fillStyle = colors.panel; ctx.fillRect(x, 264, 234, 192);
      text(ctx, `0${i + 1}`, x + 12, 291, 22, colors.muted);
      contain(ctx, images[logoOf(teams, r)] || images['logo.png'], x + 12, 301, 115, 105);
      text(ctx, Number(r.kills) || 0, x + 218, 359, 66, colors.ink, 90, 'right', 900);
      text(ctx, 'KILLS', x + 218, 385, 22, colors.muted, undefined, 'right');
      text(ctx, r.team, x + 12, 434, 25, colors.ink, 210);
      ctx.fillStyle = colors.cyan; ctx.fillRect(x, 453, 234, 3);
      ctx.restore();
    });
    if (!top.length) text(ctx, 'El top de kills estará disponible al registrar eliminaciones.', 48, 350 + statsHeight, 30, colors.muted, 970);
    const columns = [80, 156, 706, 806, 910, 1008];
    ['POS.', 'EQUIPO', 'P. POS.', 'KILLS', 'SANC.', 'TOTAL'].forEach((label, i) => text(ctx, label, columns[i], 503 + statsHeight, 22, colors.muted, undefined, i < 2 ? 'left' : 'right'));
    const hasScores = scored(rows);
    rows.forEach((r, i) => {
      const y = 526 + statsHeight + i * 70;
      const first = i === 0 && hasScores;
      const ink = first ? colors.bg : colors.ink;
      ctx.fillStyle = first ? colors.ink : i % 2 ? '#101722' : '#141e2b';
      ctx.fillRect(48, y, 984, 69);
      text(ctx, String(i + 1).padStart(2, '0'), 68, y + 45, 30, ink);
      contain(ctx, images[logoOf(teams, r)] || images['logo.png'], 130, y + 8, 52, 52);
      text(ctx, r.team, 198, y + (first ? 31 : 44), 30, ink, 420);
      if (first) text(ctx, 'LÍDER DE LA TABLA', 198, y + 54, 17, '#344350');
      [Number(r.placement) || 0, Number(r.kills) || 0, Number(r.penalty) || 0, total(r)].forEach((value, j) => text(ctx, value, columns[j + 2], y + 45, j === 3 ? 36 : 30, ink, undefined, 'right', j === 3 ? 900 : 600));
    });
    await save(canvas, `resultados-${slug(group.phase)}-${slug(group.title)}.png`);
  }

  async function downloadMatchDay(data, { phase, group, date, time, rooms }, rows) {
    const teams = data.teams || [];
    const images = await assets(teams, rows);
    const cols = 4, cellW = 234, cellH = 238, gap = 16;
    const count = Math.max(1, Math.ceil(rows.length / cols));
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = Math.max(1350, 434 + count * (cellH + gap) + 120);
    const ctx = canvas.getContext('2d');
    background(ctx, canvas.width, canvas.height, images);
    text(ctx, 'MATCH', 48, 142, 126, colors.ink, 750, 'left', 900);
    text(ctx, 'DAY', 48, 252, 126, colors.ink, 750, 'left', 900);
    contain(ctx, images['logo.png'], 826, 60, 148, 148);
    text(ctx, `${phase} / ${group || 'Grupo'}`, 50, 306, 36, colors.ink, 975);
    ctx.fillStyle = colors.cyan; ctx.fillRect(48, 332, 984, 60);
    text(ctx, dateLabel(date), 68, 373, 32, colors.bg, 600);
    text(ctx, `${timeLabel(time)}${rooms > 1 ? ` · ${rooms} salas` : ''}`, 1012, 373, 30, colors.bg, 360, 'right');
    rows.forEach((r, i) => {
      const x = 48 + (i % cols) * (cellW + gap), y = 424 + Math.floor(i / cols) * (cellH + gap);
      ctx.fillStyle = colors.panel; ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = '#285264'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, cellW - 1, cellH - 1);
      text(ctx, String(i + 1).padStart(2, '0'), x + 14, y + 28, 23, '#9bb4c5');
      contain(ctx, images[logoOf(teams, r)] || images['logo.png'], x + 36, y + 38, 162, 142);
      text(ctx, r.team, x + cellW / 2, y + 216, 27, colors.ink, cellW - 22, 'center');
      ctx.fillStyle = colors.cyan; ctx.fillRect(x, y + cellH - 3, cellW, 3);
    });
    if (!rows.length) text(ctx, 'EQUIPOS POR CONFIRMAR', 540, 730, 42, colors.muted, 950, 'center');
    await save(canvas, `matchday-${slug(phase)}-${slug(group)}-${date || 'por-confirmar'}.png`);
  }
  async function downloadRules(tournament = {}) {
    const rules = PYROCORE.getRules(tournament);
    const images = await assets([], []);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    let ctx = canvas.getContext('2d');
    const blocks = [];
    let y = 260;
    function paragraph(value, size, color, weight = 600, spacing = 12) {
      ctx.font = `${weight} ${size}px "Barlow Condensed", sans-serif`;
      const words = String(value).split(/\s+/);
      const lines = [];
      let line = '';
      words.forEach(word => {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > 940) { lines.push(line); line = word; }
        else line = candidate;
      });
      if (line) lines.push(line);
      lines.forEach(line => { blocks.push({ line, y, size, color, weight }); y += size * 1.4; });
      y += spacing;
    }
    rules.rules.forEach(rule => {
      if (rule.title) paragraph(rule.title.toUpperCase(), 32, colors.ink, 700, 2);
      paragraph(rule.text, 28, '#c1d0dc', 500, 30);
    });
    [{ title: 'ACLARACIONES', items: rules.clarifications }, { title: 'PROHIBIDO', items: rules.prohibited }].forEach(section => {
      y += 14;
      paragraph(section.title, 34, colors.cyan, 700, 10);
      section.items.forEach(item => paragraph(`• ${item}`, 28, '#c1d0dc', 500, 2));
      y += 20;
    });
    if (rules.note) paragraph(rules.note, 28, colors.ink);
    canvas.height = Math.ceil(y + 110);
    ctx = canvas.getContext('2d');
    background(ctx, canvas.width, canvas.height, images);
    contain(ctx, images['logo.png'], 48, 48, 80, 80);
    text(ctx, 'REGLAS DEL TORNEO', 158, 118, 70, colors.ink, 870, 'left', 900);
    text(ctx, tournament.name || 'Aliens Championship', 50, 176, 30, colors.muted, 960);
    ctx.fillStyle = colors.cyan; ctx.fillRect(48, 206, 984, 2);
    blocks.forEach(block => text(ctx, block.line, 60, block.y, block.size, block.color, 940, 'left', block.weight));
    await save(canvas, `reglas-${slug(tournament.name || 'aliens-championship')}.png`);
  }
  return { mountResults, downloadMatchDay, downloadResults, downloadRules, leaders, rowsFor };
})();
