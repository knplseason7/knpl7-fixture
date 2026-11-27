/* KNPL-7 fixture engine: pure logic, no DOM. Works in browser (window.KE) and Node (module.exports). */
(function (root) {
  'use strict';
  const E = {};
  E.TEAMS = [
    ['DOC', 'Devils Of Chithrakoot', 'Balamurali E', '#B3202A', '#1a1a1a'],
    ['AYW', 'Ayodhya Warriors', 'Deepu M', '#E8731A', '#7a1b1b'],
    ['SON', 'Spartans Of Nalanda', 'Dileep Mampally', '#1F3A7A', '#E0B040'],
    ['MIM', 'Mighty Mithilas', 'Hareesh Govind', '#F2C230', '#1F3A7A'],
    ['KAA', 'Kalinga United', 'Hareesh Kumar G N', '#D8DCE6', '#C8102E'],
    ['KUY', 'Kurukshetra Yodhas', 'Hari Govind N', '#1a1a1a', '#D4A62A'],
    ['JOJ', 'Jaguars Of Jhansi', 'Hari T R', '#F28A1B', '#1a1a1a'],
    ['KOK', 'Knights Of Kanchi', 'Haridas CMP', '#5B2C83', '#D4A62A'],
    ['KOP', 'Kombans Of Pataleeputhra', 'Ivish Kumar', '#E9E4D4', '#C9A227'],
    ['KOD', 'Kaaliyanz Of Dwaraka', 'Jithin Narayanan', '#4B2A7B', '#C9A227'],
    ['MMV', 'Madhura Mavericks', 'Krishnadas M N', '#C8102E', '#F2B544'],
    ['PAP', 'Panchaala Panthers', 'Midhun Panthavoor', '#1a1a1a', '#C9A227'],
    ['GAG', 'Gandhara Giants', 'Nikhil S', '#B3202A', '#1a1a1a'],
    ['VAV', 'Vamos Vrindavan', 'Praveen Kumar M', '#E8731A', '#4B2A7B'],
    ['GOK', 'Guardians Of Kamboja', 'Sunil Narayanan', '#101820', '#1F9E8F'],
    ['VOV', 'Varahas Of Vijayanagara', 'Umesh Krishna', '#2E8B57', '#E8731A']
  ].map(t => ({ id: t[0], name: t[1], owner: t[2], c1: t[3], c2: t[4], logo: '', code: '' }));

  E.defaultSettings = function () {
    return {
      season: '7', overs: 10,
      startTime: '07:30', matchMins: 85, matchMinsDay: { 1: 85, 2: 85, 3: 80, 4: 85 }, maxChanges: 12, gapMins: 15, travelMins: 30, finalBreakMins: 45, lastLight: '18:00',
      dates: { 1: '2027-02-11', 2: '2027-02-12', 3: '2027-02-13', 4: '2027-02-14' },
      grounds: ['FISAT', 'Boundary Grounds'],
      caps: { 1: [6, 6], 2: [6, 6], 3: [7, 7], 4: [5, 4] },
      chUrl: ''
    };
  };
  E.newState = function () {
    return {
      v: 1, frozen: false, started: false, sponsorsFinal: false, settings: E.defaultSettings(),
      teams: JSON.parse(JSON.stringify(E.TEAMS)),
      draw: { groupsDone: false, log: [] }, groups: { A: [], B: [] },
      lot: { A: null, B: null }, matches: [], stages: {}, notes: {},
      sponsorRoles: {}, matchSponsors: {}, downloads: []
    };
  };

  /* ---------- helpers ---------- */
  E.dur = (st, day) => (st.settings.matchMinsDay && st.settings.matchMinsDay[day]) || st.settings.matchMins;
  E.parseHM = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  E.clock = (st, min) => { const t = E.parseHM(st.settings.startTime) + min; return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  E.clock12 = (st, min) => { const t = E.parseHM(st.settings.startTime) + min; let h = Math.floor(t / 60) % 24; const m = t % 60; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ' ' + ap; };
  E.minFromClock = (st, hhmm) => E.parseHM(hhmm) - E.parseHM(st.settings.startTime);
  E.team = (st, id) => st.teams.find(t => t.id === id);
  E.tname = (st, id) => (E.team(st, id) || { name: id }).name;
  E.ovToBalls = s => { s = String(s).trim(); if (!s) return 0; const p = s.split('.'); return (parseInt(p[0], 10) || 0) * 6 + (parseInt(p[1] || '0', 10) || 0); };
  E.fmtDate = (st, day) => { const d = new Date(st.settings.dates[day] + 'T00:00:00'); return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }); };

  /* ---------- standings ---------- */
  E.standings = function (st, group) {
    const rows = {};
    (st.groups[group] || []).forEach(id => rows[id] = { id, p: 0, w: 0, l: 0, pts: 0, rf: 0, bf: 0, ra: 0, ba: 0 });
    st.matches.filter(m => m.group === group && m.kind === 'league' && m.status === 'done' && m.result).forEach(m => {
      const r = m.result, A = rows[m.a], B = rows[m.b];
      if (!A || !B) return;
      A.p++; B.p++;
      if (r.winner === m.a) { A.w++; A.pts += 2; B.l++; } else { B.w++; B.pts += 2; A.l++; }
      const full = st.settings.overs * 6;
      if (r.ra != null && r.rb != null && r.ra !== '' && r.rb !== '') {
        const ba = r.aOut ? full : (E.ovToBalls(r.oa) || full), bb = r.bOut ? full : (E.ovToBalls(r.ob) || full);
        A.rf += +r.ra; A.bf += ba; A.ra += +r.rb; A.ba += bb;
        B.rf += +r.rb; B.bf += bb; B.ra += +r.ra; B.ba += ba;
      }
    });
    const out = Object.values(rows);
    out.forEach(r => { r.nrr = (r.bf ? r.rf / (r.bf / 6) : 0) - (r.ba ? r.ra / (r.ba / 6) : 0); });
    out.sort((x, y) => y.pts - x.pts || y.nrr - x.nrr || x.id.localeCompare(y.id));
    const co = st.chOrder && st.chOrder[group];
    if (co && co.order.length === out.length && co.done === E.doneCount(st, group)) { const ix = {}; co.order.forEach((id, i) => ix[id] = i); out.sort((x, y) => ix[x.id] - ix[y.id]); out.fromCH = true; }
    out.forEach((r, i) => r.pos = i + 1);
    return out;
  };
  E.doneCount = (st, group) => st.matches.filter(m => m.group === group && m.kind === 'league' && m.status === 'done').length;
  E.met = (st, group) => {
    const s = new Set();
    st.matches.filter(m => m.group === group && m.kind === 'league').forEach(m => s.add([m.a, m.b].sort().join('|')));
    return s;
  };
  const key = (a, b) => [a, b].sort().join('|');

  /* ---------- pairing rule: standard, shuffle 1, shuffle 2, then original (standard) ---------- */
  E.pairGroup = function (st, group) {
    const tb = E.standings(st, group).map(r => r.id), met = E.met(st, group), pairs = [], notes = [];
    [[0, 'top four'], [4, 'bottom four']].forEach(([o, label]) => {
      const h = tb.slice(o, o + 4);
      const opts = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]], names = ['standard', 'shuffle 1', 'shuffle 2'];
      let chosen = null, used = -1;
      for (let i = 0; i < 3; i++) {
        const ps = opts[i].map(([x, y]) => [h[x], h[y]]);
        if (ps.every(p => !met.has(key(p[0], p[1])))) { chosen = ps; used = i; break; }
      }
      if (!chosen) { chosen = opts[0].map(([x, y]) => [h[x], h[y]]); notes.push(`${label}: all combinations already met, original schedule used (rematch)`); }
      else if (used > 0) notes.push(`${label}: ${names[used]} used, standard pairing had already met`);
      pairs.push(...chosen);
    });
    return { pairs, notes, order: tb };
  };

  /* ---------- stage definitions ---------- */
  E.STAGES = [
    { id: 'A-R1', label: 'Group A · Round 1', day: 1, group: 'A', round: 1 },
    { id: 'A-R2', label: 'Group A · Round 2', day: 1, group: 'A', round: 2, needs: ['A-R1'] },
    { id: 'A-R3', label: 'Group A · Round 3', day: 1, group: 'A', round: 3, needs: ['A-R2'] },
    { id: 'B-R1', label: 'Group B · Round 1', day: 2, group: 'B', round: 1 },
    { id: 'B-R2', label: 'Group B · Round 2', day: 2, group: 'B', round: 2, needs: ['B-R1'] },
    { id: 'B-R3', label: 'Group B · Round 3', day: 2, group: 'B', round: 3, needs: ['B-R2'] },
    { id: 'R4', label: 'Round 4 · both groups', day: 3, round: 4, needs: ['A-R3', 'B-R3'] },
    { id: 'R5', label: 'Round 5 · both groups', day: 3, round: 5, needs: ['R4'] },
    { id: 'QF', label: 'Quarterfinals', day: 4, needs: ['R5'] },
    { id: 'SF', label: 'Semifinals', day: 4, needs: ['QF'] },
    { id: 'F', label: 'Grand Final', day: 4, needs: ['SF'] }
  ];
  E.stageMatches = (st, id) => st.matches.filter(m => m.stage === id || (id === 'R5' && m.stage === 'R5'));
  E.stageDone = (st, id) => st.stages[id] && st.matches.filter(m => m.stage === id).every(m => m.status === 'done');
  E.canGenerate = function (st, id) {
    const sd = E.STAGES.find(s => s.id === id);
    if (st.stages[id]) return { ok: false, reason: 'Already generated' };
    if (!st.draw.groupsDone) return { ok: false, reason: 'Run the group draw first' };
    if (sd.round === 1 && !(st.lot[sd.group])) return { ok: false, reason: `Run the Round 1 lot draw for Group ${sd.group}` };
    for (const n of (sd.needs || [])) if (!E.stageDone(st, n)) { const nl = E.STAGES.find(s => s.id === n).label; return { ok: false, reason: `Waiting for results: ${nl}` }; }
    return { ok: true };
  };

  /* ---------- fixed fixture grid (same layout as the committee's Excel sheet) ----------
     47 numbered matches, each with a fixed day, time and ground. Teams are filled in round by round.
     Odd numbers are FISAT, even numbers are Boundary; two matches share every time slot. */
  E.slotMins = st => st.settings.slotMins || 90;
  E.STAGE_POS = {
    'A-R1': [[1, 0], [1, 1]], 'A-R2': [[1, 2], [1, 3]], 'A-R3': [[1, 4], [1, 5]],
    'B-R1': [[2, 0], [2, 1]], 'B-R2': [[2, 2], [2, 3]], 'B-R3': [[2, 4], [2, 5]],
    'R4': [[3, 0], [3, 1], [3, 2], [3, 3]], 'R5': [[3, 4], [3, 5], [3, 6], [4, 0]],
    'QF': [[4, 1], [4, 2]], 'SF': [[4, 3]], 'F': [[4, 4]]
  };
  E.STAGE_NAME = { 'A-R1': 'Round 1', 'A-R2': 'Round 2', 'A-R3': 'Round 3', 'B-R1': 'Round 1', 'B-R2': 'Round 2', 'B-R3': 'Round 3', R4: 'Round 4', R5: 'Round 5', QF: 'Quarter-final', SF: 'Semi-final', F: 'FINAL' };
  const dayBase = st => { const b = {}; let t = 0; for (let d = 1; d <= 4; d++) { b[d] = t; t += st.settings.caps[d][0] + st.settings.caps[d][1]; } return b; };
  E.slotStart = (st, day, slot) => (day === 4 && slot === 4) ? 4 * E.slotMins(st) + st.settings.finalBreakMins : slot * E.slotMins(st);
  E.matchNo = (st, d, s, g) => dayBase(st)[d] + s * 2 + g + 1;
  E.positions = function (st, id) {
    const out = [];
    (E.STAGE_POS[id] || []).forEach(([d, s]) => [0, 1].forEach(g => { if (id === 'F' && g === 1) return; out.push({ day: d, slot: s, ground: g, no: E.matchNo(st, d, s, g), start: E.slotStart(st, d, s) }); }));
    return out;
  };
  /* every row of the fixture, filled or blank */
  E.grid = function (st) {
    const rows = [];
    E.STAGES.forEach(sd => E.positions(st, sd.id).forEach(p => rows.push(Object.assign({ stage: sd.id, roundName: E.STAGE_NAME[sd.id], group: sd.group || null, end: p.start + E.dur(st, p.day) }, p, { match: null }))));
    rows.sort((a, b) => a.no - b.no);
    const by = {}; st.matches.forEach(m => by[m.no] = m);
    rows.forEach(r => r.match = by[r.no] || null);
    return rows;
  };

  /* ---------- scheduler: choose which pair goes into which fixed slot ----------
     The Excel times are the reference times (no ground change). If a team must change ground and its last match
     ended less than 30 minutes before, that match starts later (30 minutes ground-change time), and the other
     matches on that ground follow it. A team that has a free slot in between needs no extra time. */
  E.WB = 0.5;     // weight of a back-to-back match, compared with one ground change
  E.WDEL = 0.1;   // weight of a match that starts late for the 30 min ground-change time (allowed, shown highlighted)
  E.WPEN = 0.15;  // weight that makes the lower-ranked / losing team the one that travels
  function context(st) {
    const gfree = {}, lastm = {}, chg = {}, last = {}, rank = {};
    st.matches.slice().sort((a, b) => a.start - b.start).forEach(m => {
      const gk = m.day + '|' + m.ground; gfree[gk] = Math.max(gfree[gk] || 0, m.end);
      [m.a, m.b].forEach(t => { const k = t + '|' + m.day, l = lastm[k]; if (l && l.g !== m.ground) chg[k] = (chg[k] || 0) + 1; lastm[k] = { end: m.end, g: m.ground }; if (m.result) last[k] = m.result.winner === t; });
    });
    if (st.draw.groupsDone) ['A', 'B'].forEach(g => E.standings(st, g).forEach(r => rank[r.id] = r.pos));
    return { gfree, lastm, chg, last, rank };
  }
  /* work out the real start times of one way of filling the slots, and score it. Lower is better. */
  function layout(st, assign, ctx) {
    const tr = st.settings.travelMins, lim = E.minFromClock(st, st.settings.lastLight);
    const ord = assign.slice().sort((a, b) => a.pos.start - b.pos.start || a.pos.ground - b.pos.ground);
    const gfree = Object.assign({}, ctx.gfree), last = Object.assign({}, ctx.lastm), chg = Object.assign({}, ctx.chg), laid = [];
    let sw = 0, viol = 0, b2b = 0, delayed = 0, late = 0, pen = 0;
    ord.forEach(({ p, pos }) => {
      const dur = E.dur(st, pos.day), gk = pos.day + '|' + pos.ground; let s = Math.max(pos.start, gfree[gk] || 0);
      [p[0], p[1]].forEach(t => { const l = last[t + '|' + pos.day]; if (l) s = Math.max(s, l.g !== pos.ground ? l.end + tr : l.end); });
      [p[0], p[1]].forEach(t => {
        const k = t + '|' + pos.day, l = last[k];
        if (l) {
          if (l.g !== pos.ground) { sw++; chg[k] = (chg[k] || 0) + 1; if (chg[k] > 1) viol++; pen += ctx.rank[t] ? (9 - ctx.rank[t]) / 8 : (ctx.last[k] ? 1 : 0); }
          if (s - l.end < tr) b2b++;
        }
        last[k] = { end: s + dur, g: pos.ground };
      });
      if (s > pos.start) delayed++;
      if (s - pos.start > tr) viol++;   // a match may never start more than the ground-change time (30 min) after its planned time
      gfree[gk] = s + dur; if (s + dur > lim) late += s + dur - lim;
      laid.push({ p, pos, start: s, end: s + dur });
    });
    return { sw, viol, b2b, delayed, late, pen, cost: sw + E.WB * b2b + E.WDEL * delayed, laid };
  }
  const cmpv = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  const skey = r => [r.late > 0 ? 1 : 0, r.viol, r.cost, E.WPEN ? r.pen : 0];
  function allAssign(st, id, pairs, ctx) {
    const pos = E.positions(st, id), n = pairs.length, out = [];
    if (pos.length < n) throw new Error('No free slots for ' + id);
    const used = new Array(pos.length).fill(false), cur = [];
    (function rec(i) {
      if (i === n) { out.push(layout(st, cur.slice(), ctx)); return; }
      for (let j = 0; j < pos.length; j++) {
        if (used[j]) continue; const p = pairs[i]; if (p.onlyDay && p.onlyDay !== pos[j].day) continue;
        used[j] = true; cur.push({ p, pos: pos[j] }); rec(i + 1); cur.pop(); used[j] = false;
      }
    })(0);
    return out;
  }
  /* look-ahead: play the rest of the chain at random several times and keep the choice with the fewest expected changes */
  E.LOOK = { M: 24, on: true }; E.EPS = 1.0;
  const CHAIN = { 'A-R1': ['A-R2', 'A-R3'], 'A-R2': ['A-R3'], 'B-R1': ['B-R2', 'B-R3'], 'B-R2': ['B-R3'], R4: ['R5'], R5: ['QF', 'SF', 'F'], QF: ['SF', 'F'], SF: ['F'] };
  function miniClone(st) {
    return { v: 1, settings: st.settings, teams: st.teams.map(t => ({ id: t.id, name: t.name })), draw: st.draw, groups: st.groups, lot: st.lot,
      matches: st.matches.map(m => Object.assign({}, m, { result: m.result ? Object.assign({}, m.result) : null })), stages: Object.assign({}, st.stages), notes: {}, sponsorRoles: {}, matchSponsors: {}, downloads: [] };
  }
  /* post-hoc metrics of a whole fixture (used by the look-ahead and by the ground report) */
  E.metrics = function (st) {
    const tr = st.settings.travelMins, lim = E.minFromClock(st, st.settings.lastLight); let sw = 0, viol = 0, b2b = 0, pen = 0, delayed = 0, late = 0;
    st.matches.forEach(m => { if (m.delay > 0) delayed++; if (m.delay > tr) viol++; if (m.end > lim) late += m.end - lim; });
    st.teams.forEach(t => { for (let d = 1; d <= 4; d++) {
      const seq = st.matches.filter(m => m.day === d && (m.a === t.id || m.b === t.id)).sort((a, b) => a.start - b.start); let ch = 0;
      for (let i = 1; i < seq.length; i++) { const a = seq[i - 1], b = seq[i];
        if (a.ground !== b.ground) { ch++; sw++; if (a.result && a.result.winner === t.id) pen++; }
        if (b.start - a.end < tr) b2b++; }
      if (ch > 1) viol += ch - 1;
    } });
    return { sw, viol, b2b, pen, delayed, late };
  };
  const rollScore = st => { const m = E.metrics(st); return m.sw + 2 * m.viol + E.WB * m.b2b + E.WDEL * m.delayed + m.late / 5 + E.WPEN * m.pen; };
  function rollout(st, id, cand, chain) {
    const c = miniClone(st); E._roll = true;
    try {
      place(c, id, cand.laid); c.stages[id] = { at: 0 };
      const sim = sid => c.matches.filter(m => m.stage === sid && m.status !== 'done').forEach(m => { const aw = Math.random() < .5, ra = 70 + Math.floor(Math.random() * 70), rb = 70 + Math.floor(Math.random() * 70); m.result = { winner: aw ? m.a : m.b, ra: aw ? Math.max(ra, rb + 1) : Math.min(ra, rb - 1), oa: '10', rb: aw ? Math.min(rb, ra - 1) : Math.max(rb, ra + 1), ob: '10' }; m.status = 'done'; });
      sim(id);
      for (const nid of chain) { E.generate(c, nid); sim(nid); }
    } catch (e) { E._roll = false; return null; }
    E._roll = false; return rollScore(c);
  }
  function choose(st, id, cands) {
    cands.sort((a, b) => cmpv(skey(a), skey(b)));
    const chain = CHAIN[id]; if (!E.LOOK.on || E._roll || !chain || cands.length < 2) return cands[0];
    const okc = cands.filter(c => !c.late), ok = okc.length ? okc : cands;
    const ms = Math.min(...ok.map(c => c.cost));
    const pool = ok.filter(c => c.cost <= ms + 3).slice(0, id === 'R4' ? 14 : 48);
    if (pool.length < 2) return pool[0];
    const M = id === 'R4' ? 6 : E.LOOK.M;
    const scored = pool.map(c => { let s = 0, n = 0; for (let i = 0; i < M; i++) { const v = rollout(st, id, c, chain); if (v != null) { s += v; n++; } } return { c, sc: n ? s / n : 99 }; });
    const bs = Math.min(...scored.map(x => x.sc));
    const near = scored.filter(x => x.sc <= bs + (E.WPEN ? E.EPS : 0));
    near.sort((x, y) => (E.WPEN ? x.c.pen - y.c.pen : 0) || x.sc - y.sc || x.c.cost - y.c.cost);
    return near[0].c;
  }
  /* turn a chosen layout into match records (with Travel for / back-to-back / delay info) */
  function place(st, id, laid) {
    const tr = st.settings.travelMins, made = [];
    laid.slice().sort((x, y) => x.pos.no - y.pos.no).forEach(({ p, pos, start, end }) => {
      const travel = [], b2b = [], delay = start - pos.start;
      [p[0], p[1]].forEach(t => {
        const prev = st.matches.filter(m => m.day === pos.day && (m.a === t || m.b === t) && m.start < start).sort((a, b) => b.start - a.start)[0];
        if (!prev) return; const rest = start - prev.end;
        if (prev.ground !== pos.ground) travel.push({ team: t, from: prev.ground, prevNo: prev.no, rest, delay: delay > 0 && rest <= tr ? delay : 0, tight: delay > 0 && rest <= tr });
        else if (rest < tr) b2b.push(t);
      });
      const m = { no: pos.no, stage: p.stage, round: p.round || null, group: p.group, kind: p.kind, label: p.label, day: pos.day, slot: pos.slot, ground: pos.ground,
        plan: pos.start, delay, start, end, a: p[0], b: p[1], travel, b2b, status: 'planned', chUrl: '', result: null, actualEnd: null };
      st.matches.push(m); made.push(m);
    });
    return made;
  }
  /* pairs: [a,b] arrays carrying group/kind/label/round/stage (and optional onlyDay) */
  E.scheduleBatch = function (st, id, pairs) {
    const ctx = context(st), cands = allAssign(st, id, pairs, ctx), best = choose(st, id, cands);
    return place(st, id, best.laid);
  };

  /* ---------- stage generation ---------- */
  E.generate = function (st, id) {
    const c = E.canGenerate(st, id); if (!c.ok) throw new Error(c.reason);
    const sd = E.STAGES.find(s => s.id === id);
    const mk = (a, b, group, kind, label, round, stage) => { const p = [a, b]; Object.assign(p, { group, kind, label, round, stage }); return p; };
    let created = [], notes = [];
    if (['A-R1', 'B-R1'].includes(id)) {
      const g = sd.group, pairs = st.lot[g].map(p => mk(p[0], p[1], g, 'league', 'Round 1 · RSM match', 1, id));
      created = E.scheduleBatch(st, id, pairs); notes.push('Round 1 pairs are from the lot draw');
    } else if (/^[AB]-R[23]$/.test(id)) {
      const g = sd.group, r = E.pairGroup(st, g); notes = r.notes;
      created = E.scheduleBatch(st, id, r.pairs.map(p => mk(p[0], p[1], g, 'league', 'Round ' + sd.round, sd.round, id)));
    } else if (id === 'R4') {
      const all = [];
      ['A', 'B'].forEach(g => { const r = E.pairGroup(st, g); notes.push(...r.notes.map(n => `Group ${g} ${n}`)); r.pairs.forEach(p => all.push(mk(p[0], p[1], g, 'league', 'Round 4', 4, id))); });
      created = E.scheduleBatch(st, id, all);
    } else if (id === 'R5') {
      const day3 = [];
      ['A', 'B'].forEach(g => {
        const tb = E.standings(st, g).map(r => r.id), r = E.pairGroup(st, g); notes.push(...r.notes.map(n => `Group ${g} ${n}`));
        const e8 = tb[7];
        r.pairs.forEach(p => { const m = mk(p[0], p[1], g, 'league', 'Round 5', 5, id); if (p.includes(e8)) { m.label = 'Round 5 · Sunday morning'; m.onlyDay = 4; day3.push(m); } else { m.onlyDay = 3; day3.push(m); } });
      });
      created = E.scheduleBatch(st, id, day3);
      notes.push('The match with each group\'s 8th-placed team is played on Sunday morning');
    } else if (id === 'QF') {
      const A = E.standings(st, 'A').map(r => r.id), B = E.standings(st, 'B').map(r => r.id);
      const q = [['QF1', A[0], B[3]], ['QF2', A[1], B[2]], ['QF3', B[0], A[3]], ['QF4', B[1], A[2]]];
      created = E.scheduleBatch(st, id, q.map(x => mk(x[1], x[2], 'K', 'QF', x[0], null, id)));
      created.forEach(m => m.qf = m.label); notes.push('QF1 A1 v B4 · QF2 A2 v B3 · QF3 B1 v A4 · QF4 B2 v A3');
    } else if (id === 'SF') {
      const w = n => st.matches.find(m => m.stage === 'QF' && m.label === n).result.winner;
      const q = [['SF1', w('QF1'), w('QF4')], ['SF2', w('QF2'), w('QF3')]];
      created = E.scheduleBatch(st, id, q.map(x => mk(x[1], x[2], 'K', 'SF', x[0], null, id)));
      notes.push('SF1: QF1 v QF4 winners · SF2: QF2 v QF3 winners');
    } else if (id === 'F') {
      const w = n => st.matches.find(m => m.stage === 'SF' && m.label === n).result.winner;
      created = E.scheduleBatch(st, id, [mk(w('SF1'), w('SF2'), 'K', 'Final', 'Grand Final', null, id)]);
      notes.push('Grand Final at ' + st.settings.grounds[0] + ' (always); the ' + st.settings.finalBreakMins + ' minute break after the semifinals covers any finalist travelling');
    }
    st.stages[id] = { at: Date.now() }; st.notes[id] = notes;
    return { created, notes };
  };

  /* ---------- results ---------- */
  E.setResult = function (st, no, res) {
    const m = st.matches.find(x => x.no === no); if (!m) throw new Error('No such match');
    if (!res.winner) throw new Error('Pick the winner');
    if (![m.a, m.b].includes(res.winner)) throw new Error('Winner must be one of the two teams');
    m.result = res; m.status = 'done';
    if (res.endClock) m.actualEnd = E.minFromClock(st, res.endClock);
    return m;
  };
  E.clearResult = (st, no) => { const m = st.matches.find(x => x.no === no); m.result = null; m.status = m.chUrl || m.chCreated ? 'created' : 'planned'; m.actualEnd = null; };
  E.markCreated = (st, no, url) => { const m = st.matches.find(x => x.no === no); m.chCreated = true; m.chUrl = url || m.chUrl || ''; if (m.status === 'planned') m.status = 'created'; };
  E.unmarkCreated = (st, no) => { const m = st.matches.find(x => x.no === no); if (m.status !== 'done') { m.chCreated = false; m.status = 'planned'; } };

  /* ---------- warnings ---------- */
  E.warnings = function (st) {
    const w = [], lim = E.minFromClock(st, st.settings.lastLight);
    for (let d = 1; d <= 4; d++) {
      const ms = st.matches.filter(m => m.day === d); if (!ms.length) continue;
      const e = Math.max(...ms.map(m => m.end));
      if (e > lim) w.push(`Day ${d}: last match ends ${E.clock(st, e)}, after ${st.settings.lastLight}`);
    }
    return w;
  };
  E.matchLabel = (st, m) => m.kind === 'league' ? `${m.label}${m.group ? ' · Group ' + m.group : ''}` : m.label;
  E.sample = function (seedStr) { // demo: pick result deterministically-random
    return Math.random();
  };
  root.KE = E; if (typeof module !== 'undefined') module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
