const PYROCORE = (() => {
  const ICONS = {
    instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>`,
    whatsapp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21l1.6-4.6A9 9 0 1 1 8 19.6z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2z" fill="currentColor" stroke="none"/></svg>`,
    discord: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7c3-1.3 7-1.3 10 0l2 9c-1.6 1.4-3.3 2.2-5 2.5l-1-2M11 16.5l-1 2c-1.7-.3-3.4-1.1-5-2.5l2-9"/><circle cx="9.5" cy="12" r="1" fill="currentColor"/><circle cx="14.5" cy="12" r="1" fill="currentColor"/></svg>`,
    trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 20h8"/></svg>`,
    globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>`,
    users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg>`,
    form: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`,
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
  const safeImg = (u) => (/^(https?:\/\/|data:image\/|assets\/)/i.test(u || "") ? u : "");

  const sb = (() => {
    const c = window.PYROCORE_CONFIG || {};
    if (!c.supabaseUrl || !c.supabaseAnonKey || !window.supabase) return null;
    try {
      const role = JSON.parse(atob(c.supabaseAnonKey.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role;
      if (role === "service_role") {
        console.error("config.js tiene la clave service_role. Usa la clave anon/publishable.");
        return null;
      }
    } catch (_) {}
    return window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, { auth: { persistSession: false } });
  })();

  const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

  async function fetchFromSupabase(scheduleQuery) {
    const [settings, schedule, groups, rows, sponsors] = await Promise.all([
      sb.from("settings").select("*").eq("id", 1).maybeSingle().then(must),
      (scheduleQuery || sb.from("schedule").select("*").order("position")).then(must),
      sb.from("result_groups").select("*").order("position").then(must),
      sb.from("result_rows").select("*").order("position").then(must),
      sb.from("sponsors").select("*").order("position").then(must),
    ]);
    const fmt = (d) => (d ? new Date(d).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" }) : "");
    return {
      tournament: settings?.tournament || {},
      links: settings?.links || {},
      prizes: settings?.prizes || [],
      schedule: schedule.map((m) => ({
        id: m.id, phase: m.phase, group: m.group_name, date: m.date || "", time: m.time || "",
        rooms: m.rooms, status: m.status, visible: m.visible, note: m.note,
      })),
      results: groups.map((g) => ({
        id: g.id, phase: g.phase, title: g.title, kind: g.kind, qualify: g.qualify, updated: fmt(g.updated_at),
        rows: rows.filter((r) => r.group_id === g.id)
          .map((r) => ({ id: r.id, team: r.team, kills: r.kills, placement: r.placement, penalty: r.penalty })),
      })),
      sponsors: sponsors.map((s) => ({ id: s.id, name: s.name, logo: s.logo_url, url: s.url })),
    };
  }

  async function loadData() {
    if (sb) return fetchFromSupabase();
    const res = await fetch(`data.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar data.json");
    return res.json();
  }

  const PHASES = ["Octavos de final", "Cuartos de final", "Semifinal", "Final"];
  const STATES = {
    abierto: "Inscripciones abiertas",
    cerrado: "Cerrado",
    en_juego: "En juego",
    finalizado: "Finalizado",
  };
  const COUNTRIES = [["mx", "México", 0], ["co", "Colombia", 1], ["do", "Rep. Dominicana", 2], ["ar", "Argentina", 3]];
  const localTimes = (time) => {
    const [h, m] = (time || "").split(":").map(Number);
    if (isNaN(h)) return [];
    return COUNTRIES.map(([code, name, off]) => {
      const hh = (h + off) % 24;
      return { code, name, label: `${hh % 12 || 12}:${String(m || 0).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}` };
    });
  };

  const total = (r) => (Number(r.kills) || 0) + (Number(r.placement) || 0) - (Number(r.penalty) || 0);
  const sortRows = (rows) =>
    [...rows].sort((a, b) => total(b) - total(a) || (b.placement || 0) - (a.placement || 0) || (b.kills || 0) - (a.kills || 0));
  const hasTeam = (r) => (r.team || "").trim() !== "";

  const groupTag = (title) => {
    const m = (title || "").trim().match(/^grupo\s+(\S+)/i);
    return m ? `G${m[1].toUpperCase()}` : (title || "").trim().slice(0, 1).toUpperCase();
  };

  const generalRows = (results, phase) => {
    const entries = [];
    results.filter((g) => g.phase === phase && g.kind !== "general").forEach((g) => {
      g.rows.filter(hasTeam).forEach((r) => {
        entries.push({
          name: r.team.trim(), group: g.title, tag: groupTag(g.title),
          kills: Number(r.kills) || 0, placement: Number(r.placement) || 0, penalty: Number(r.penalty) || 0,
        });
      });
    });
    const groupsByName = new Map();
    entries.forEach((e) => {
      const key = e.name.toLowerCase();
      groupsByName.set(key, (groupsByName.get(key) || new Set()).add(e.group));
    });
    entries.forEach((e) => {
      e.dupGroups = [...groupsByName.get(e.name.toLowerCase())];
      e.dup = e.dupGroups.length > 1;
      e.team = e.dup ? `${e.name} ${e.tag}` : e.name;
    });
    return sortRows(entries);
  };

  const DEFAULT_RULES = {
    rulesText: [
      "Nivel mínimo: Todos los jugadores pertenecientes a la región norte deben de tener un nivel de cuenta +40, para jugadores de otras regiones no aplica.",
      "Equipos incompletos: La organización no se hace responsable de jugadores que no ingresen a la sala ni por fallas de conexión.",
      "Sistema de comunicación: Se utilizará Discord desde la primera fase, de no ingresar tendrán una sanción en la puntuación.",
      "Tag o iniciales: Los equipos deben de tener un mínimo de jugadores 3/4 con tag en fases y para la final 4/4, de lo contrario habrá sanción en la puntuación.",
      "Jugadores FFWS: Equipo con jugador de liga sin registrar desde fase de octavos se le descontarán los puntos del jugador.",
      "Revisiones: Mantener activas las grabaciones de juego, en caso de solicitarse revisión, si el jugador demora o se niega a esta será descalificación del equipo y serán vetados de futuros o eventos enlazados.",
    ].join("\n"),
    clarificationsText: [
      "Respetar casillas asignadas.",
      "Torneo solo móvil.",
      "3/4 tag obligatorio en fases, 4/4 final.",
      "Se permite 1 FFWS con registro desde 8vos.",
      "Válido lista de eliminación.",
      "Discord obligatorio.",
    ].join("\n"),
    prohibitedText: ["Hacks o bugs.", "Emuladores.", "Faltas de respeto."].join("\n"),
    rulesNote: "Jugador FFWS no registrado no tendrá derecho a jugar en las demás fases.",
  };
  const lines = (txt) => (txt || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const getRules = (t = {}) => {
    const pick = (k) => (typeof t[k] === "string" && t[k].trim() ? t[k] : DEFAULT_RULES[k]);
    return {
      rules: lines(pick("rulesText")).map((l) => {
        const i = l.indexOf(":");
        return i > 0 && i < 40 ? { title: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { title: "", text: l };
      }),
      clarifications: lines(pick("clarificationsText")),
      prohibited: lines(pick("prohibitedText")),
      note: typeof t.rulesNote === "string" ? t.rulesNote.trim() : DEFAULT_RULES.rulesNote,
    };
  };

  return { DEFAULT_RULES, getRules, sb, must, fetchFromSupabase, ICONS, esc, safeUrl, safeImg, loadData, total, sortRows, hasTeam, generalRows, groupTag, PHASES, STATES, localTimes };
})();
