/* Match player readings to lobby slots before calculating any tournament points. */
window.FFCalculator = (() => {
  const playerKey = name => String(name || "").normalize("NFKD")
    .replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

  function distance(a, b) {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const current = [i];
      for (let j = 1; j <= b.length; j++) {
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      previous = current;
    }
    return previous[b.length];
  }

  function calculate(roster, lobby, rooms) {
    const registered = roster.filter(team => team.team);
    const players = [];
    lobby.forEach(team => {
      if (!Number.isInteger(team.slot) || !Array.isArray(team.players)) return;
      team.players.forEach(name => {
        const key = playerKey(name);
        if (key) players.push({ slot: team.slot, key, name });
      });
    });

    function identify(name) {
      const key = playerKey(name);
      if (!key) return null;
      const exact = players.filter(player => player.key === key);
      if (new Set(exact.map(player => player.slot)).size === 1) return { ...exact[0], exact: true };
      if (exact.length) return null;
      const candidates = players.map(player => ({ ...player, distance: distance(key, player.key) }))
        .filter(player => Math.min(key.length, player.key.length) >= 6 &&
          player.distance <= Math.max(1, Math.floor(Math.max(key.length, player.key.length) * .15)))
        .sort((a, b) => a.distance - b.distance);
      if (!candidates.length || (candidates[1] && candidates[1].distance === candidates[0].distance &&
          candidates[1].slot !== candidates[0].slot)) return null;
      return { ...candidates[0], exact: false };
    }

    const totals = new Map(registered.map(team => [team.id, {
      team: team.team, rowId: team.id, slot: team.slot,
      kills: 0, placement: 0, penalty: 0, rooms: [],
    }]));

    rooms.forEach((readings, roomIndex) => {
      const byPosition = new Map();
      readings.forEach((reading, index) => {
        if (!Array.isArray(reading.players)) throw new Error(`Sala ${roomIndex + 1}: faltan los jugadores de la captura.`);
        const parsed = Number(reading.position);
        const position = Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : "X";
        const key = position === "X" ? `unknown-${index}` : position;
        const entry = byPosition.get(key) || { position, players: new Map(), review: new Set() };
        reading.players.forEach(player => {
          if (typeof player?.name !== "string" || !player.name.trim()) return;
          const match = identify(player.name);
          const identity = match ? `${match.slot}:${match.key}` : playerKey(player.name);
          const kills = Number.isSafeInteger(player.kills) && player.kills >= 0 ? player.kills : 0;
          if (!Number.isSafeInteger(player.kills) || player.kills < 0) entry.review.add(`revisar kills de ${player.name}`);
          const previous = entry.players.get(identity);
          if (previous && previous.kills !== kills) entry.review.add(`kills distintas de ${player.name}`);
          entry.players.set(identity, { name: player.name, kills: Math.max(previous?.kills || 0, kills), match });
        });
        byPosition.set(key, entry);
      });

      const byTeam = new Map();
      byPosition.forEach((entry, positionKey) => {
        const observed = [...entry.players.values()];
        if (!observed.length) return;
        const exactSlots = new Set(observed.filter(player => player.match?.exact).map(player => player.match.slot));
        const fuzzySlots = observed.filter(player => player.match && !player.match.exact).map(player => player.match.slot);
        let slot = null;
        if (exactSlots.size === 1) slot = [...exactSlots][0];
        else if (!exactSlots.size && fuzzySlots.length >= 2 && new Set(fuzzySlots).size === 1) slot = fuzzySlots[0];
        if (exactSlots.size > 1) entry.review.add("jugadores de casillas distintas en la misma fila");
        const assigned = registered.find(team => team.slot === slot);
        const key = assigned?.id || `unassigned:${roomIndex}:${positionKey}`;
        const team = byTeam.get(key) || {
          assigned, players: new Map(), positions: new Set(), review: new Set(),
        };
        if (entry.position !== "X") team.positions.add(entry.position);
        observed.forEach(player => {
          const identity = player.match ? `${player.match.slot}:${player.match.key}` : playerKey(player.name);
          const previous = team.players.get(identity);
          team.players.set(identity, { ...player, kills: Math.max(previous?.kills || 0, player.kills) });
        });
        entry.review.forEach(note => team.review.add(note));
        if (!assigned) team.review.add("asignar casilla manualmente");
        byTeam.set(key, team);
      });

      byTeam.forEach((team, key) => {
        const observed = [...team.players.values()];
        const position = team.positions.size === 1 ? [...team.positions][0] : "X";
        const placement = position === "X" ? 0 : PYROCORE.placementPoints(position);
        const kills = observed.reduce((sum, player) => sum + player.kills, 0);
        if (team.positions.size > 1) team.review.add("puestos contradictorios");
        if (observed.length > 4) team.review.add("más de cuatro jugadores identificados");
        const total = totals.get(key) || {
          team: observed.map(player => player.name).join(" / "), rowId: "", slot: null,
          kills: 0, placement: 0, penalty: 0, rooms: [],
        };
        total.kills += kills;
        total.placement += placement;
        total.rooms.push({ room: roomIndex + 1, position, kills, placement,
          players: observed.map(({ name, kills }) => ({ name, kills })), review: [...team.review].join("; ") });
        totals.set(key, total);
      });
      registered.filter(team => !byTeam.has(team.id)).forEach(team => {
        totals.get(team.id).rooms.push({ room: roomIndex + 1, position: "X", kills: 0,
          placement: 0, absent: true, players: [] });
      });
    });
    return [...totals.values()];
  }
  return { calculate, playerKey };
})();
