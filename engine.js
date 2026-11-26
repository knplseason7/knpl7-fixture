/* KNPL-7 fixture engine: pure logic, no DOM. Works in browser (window.KE) and Node (module.exports). */
(function (root) {
  'use strict';
  const E = {};
  E.TEAMS = [
    ['DOC', 'Devils Of Chitrakoot', 'Balamurali E', '#B3202A', '#1a1a1a'],
    ['AYW', 'Ayodhya Warriors', 'Deepu M', '#E8731A', '#7a1b1b'],
    ['SON', 'Spartans Of Nalanda', 'Dileep Mampally', '#1F3A7A', '#E0B040'],
    ['MIM', 'Mighty Mithilas', 'Hareesh Govind', '#F2C230', '#1F3A7A'],
    ['KAA', 'Kalinga Adhipans', 'Hareesh Kumar G N', '#D8DCE6', '#C8102E'],
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

  /* ---------- scheduler ---------- */
  const dayBase = st => { const b = {}; let t = 0; for (let d = 1; d <= 4; d++) { b[d] = t; t += st.settings.caps[d][0] + st.settings.caps[d][1]; } return b; };
  function dayState(st, day) {
    const free = [0, 0], used = [0, 0], last = {}, chg = {}, won = {};
    st.matches.filter(m => m.day === day).sort((a, b) => a.start - b.start).forEach(m => {
      free[m.ground] = Math.max(free[m.ground], m.end); used[m.ground]++;
      [m.a, m.b].forEach(t => { if (m.result) won[t] = m.result.winner === t; if (last[t] && last[t].g !== m.ground) chg[t] = (chg[t] || 0) + 1; last[t] = { end: m.end, g: m.ground }; });
    });
    return { free, used, last, chg, won, day };
  }
  function evalAssign(st, F, B, ds, ready) {
    const dur = E.dur(st, ds.day), tr = st.settings.travelMins, free = ds.free.slice(), res = [];
    let sw = 0, delay = 0, end = 0, viol = 0, pen = 0; const cc = Object.assign({}, ds.chg), lg = {}; Object.keys(ds.last).forEach(k => lg[k] = ds.last[k].g);
    [[0, F], [1, B]].forEach(([g, lst]) => {
      let t = free[g];
      lst.forEach(p => {
        let s = Math.max(t, ready); const ideal = s; const trav = [];
        [p[0], p[1]].forEach(tm => {
          const ls = ds.last[tm];
          if (ls) { if (ls.g !== g) { sw++; trav.push({ team: tm, from: ls.g }); s = Math.max(s, ls.end + tr); } else s = Math.max(s, ls.end); }
          const pg = lg[tm]; if (pg != null && pg !== g) { cc[tm] = (cc[tm] || 0) + 1; if (cc[tm] > 1) viol++; pen += ds.rank && ds.rank[tm] ? (9 - ds.rank[tm]) / 8 : (ds.won[tm] ? 1 : 0); } lg[tm] = g;
        });
        delay += s - ideal;
        res.push({ p, g, start: s, end: s + dur, trav }); t = s + dur; end = Math.max(end, t);
      });
      free[g] = t;
    });
    const lim = E.minFromClock(st, st.settings.lastLight); return { end, sw, delay, viol, pen, late: Math.max(0, end - lim), res };
  }
  const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  function allCands(st, pairs, ds, ready, capLeft) {
    const m = pairs.length;
    if (m > 6) { const F = pairs.filter(p => p.group === 'A'), B = pairs.filter(p => p.group !== 'A'); return [evalAssign(st, F, B, ds, ready)]; }
    const out = {}, idx = pairs.map((_, i) => i);
    (function perm(arr, rest) {
      if (!rest.length) {
        for (let k = 0; k <= arr.length; k++) {
          if (k > capLeft[0] || arr.length - k > capLeft[1]) continue;
          const r = evalAssign(st, arr.slice(0, k).map(i => pairs[i]), arr.slice(k).map(i => pairs[i]), ds, ready);
          const sig = r.res.map(x => pairs.indexOf(x.p) + ':' + x.g).sort().join('|');
          if (!out[sig] || cmp(key4(r), key4(out[sig])) < 0) out[sig] = r;
        }
        return;
      }
      rest.forEach((x, i) => perm(arr.concat(x), rest.slice(0, i).concat(rest.slice(i + 1))));
    })([], idx);
    return Object.values(out);
  }
  function key4(r) { return [r.late > 0 ? 1 : 0, r.sw, r.viol, E.WPEN ? r.pen : 0, r.end, r.delay]; }
  function bestOf(list) { return list.slice().sort((a, b) => cmp(key4(a), key4(b)))[0]; }
  /* ---- look-ahead: simulate the rest of the day for each candidate and pick the one with fewest expected double changes ---- */
  E.LOOK = { M: 24, on: true }; E.WPEN = 0.15; E.EPS = 1.0;
  const CHAIN = { 'A-R1': ['A-R2', 'A-R3'], 'A-R2': ['A-R3'], 'B-R1': ['B-R2', 'B-R3'], 'B-R2': ['B-R3'], 'R5': ['QF', 'SF', 'F'], 'QF': ['SF', 'F'], 'SF': ['F'] };
  function miniClone(st) {
    return { v: 1, settings: st.settings, teams: st.teams.map(t => ({ id: t.id, name: t.name })), draw: st.draw, groups: st.groups, lot: st.lot,
      matches: st.matches.map(m => Object.assign({}, m, { result: m.result ? Object.assign({}, m.result) : null })), stages: Object.assign({}, st.stages), notes: {}, sponsorRoles: {}, matchSponsors: {}, downloads: [] };
  }
  function rollScore(st, day) {
    let ex = 0, tot = 0, pen = 0;
    const by = {}, won = {};
    st.matches.filter(m => m.day === day).sort((a, b) => a.start - b.start).forEach(m => {
      [m.a, m.b].forEach(t => { const l = by[t]; if (l && l.g !== m.ground) { l.c++; tot++; if (won[t]) pen++; } by[t] = l ? { g: m.ground, c: l.c } : { g: m.ground, c: 0 }; });
      if (m.result) { won[m.a] = m.result.winner === m.a; won[m.b] = m.result.winner === m.b; }
    });
    Object.values(by).forEach(v => { if (v.c > 1) ex += v.c - 1; });
    const e = Math.max(0, ...st.matches.filter(m => m.day === day).map(m => m.end)), lim = E.minFromClock(st, st.settings.lastLight);
    return tot + ex * 2 + pen * E.WPEN + Math.max(0, e - lim) / 5;
  }
  function rollout(st, day, r, batchMeta, stageId, chain) {
    const c = miniClone(st), base = dayBase(st)[day] + st.matches.filter(m => m.day === day).length;
    r.res.slice().sort((x, y) => x.start - y.start || x.g - y.g).forEach((x, i) => c.matches.push({ no: base + i + 1, stage: x.p.stage, round: x.p.round || null, group: x.p.group, kind: x.p.kind, label: x.p.label, day, ground: x.g, start: x.start, end: x.end, a: x.p[0], b: x.p[1], travel: x.trav, status: 'planned', result: null, actualEnd: null }));
    c.stages[stageId] = { at: 0 }; E._roll = true;
    try {
      const sim = id => c.matches.filter(m => m.stage === id && m.status !== 'done').forEach(m => { const aw = Math.random() < .5, ra = 70 + Math.floor(Math.random() * 70), rb = 70 + Math.floor(Math.random() * 70); m.result = { winner: aw ? m.a : m.b, ra: aw ? Math.max(ra, rb + 1) : Math.min(ra, rb - 1), oa: '10', rb: aw ? Math.min(rb, ra - 1) : Math.max(rb, ra + 1), ob: '10' }; m.status = 'done'; });
      sim(stageId);
      for (const id of chain) { E.generate(c, id); sim(id); }
    } catch (e) { E._roll = false; return null; }
    E._roll = false; return rollScore(c, day);
  }
  function chooseLook(st, day, cands, stageId) {
    const chain = CHAIN[stageId]; if (!E.LOOK.on || E._roll || !chain || cands.length < 2) return bestOf(cands);
    const ok0 = cands.filter(c => !c.late); if (ok0.length) cands = ok0;
    const ms = Math.min(...cands.map(c => c.sw));
    let pool = cands.filter(c => c.sw <= ms + 4).sort((a, b) => cmp(key4(a), key4(b))).slice(0, 60);
    if (pool.length < 2) return pool[0] || bestOf(cands);
    const scored = pool.map(c => {
      let sum = 0, n = 0; for (let i = 0; i < E.LOOK.M; i++) { const v = rollout(st, day, c, null, stageId, chain); if (v != null) { sum += v; n++; } }
      return { c, sc: n ? sum / n : 9 };
    });
    const bestSc = Math.min(...scored.map(x => x.sc));
    const near = scored.filter(x => x.sc <= bestSc + (E.WPEN ? E.EPS : 0));
    near.sort((x, y) => (E.WPEN ? x.c.pen - y.c.pen : 0) || x.sc - y.sc || x.c.sw - y.c.sw || x.c.end - y.c.end);
    const best = near[0];
    return best.c;
  }

  /* batch: [{a,b,group,kind,label,round,stage}] */
  E.scheduleBatch = function (st, day, batch, opts) {
    opts = opts || {};
    const ds = dayState(st, day), caps = st.settings.caps[day];
    ds.rank = {}; if (st.draw.groupsDone) ['A', 'B'].forEach(g => E.standings(st, g).forEach(r => ds.rank[r.id] = r.pos));
    const finalReserve = day === 4 && !opts.final ? 1 : 0;
    const capLeft = [caps[0] - ds.used[0] - finalReserve, caps[1] - ds.used[1]];
    const dayMs = st.matches.filter(m => m.day === day);
    let ready = 0;
    if (dayMs.length) ready = Math.max(...dayMs.map(m => (m.actualEnd != null ? m.actualEnd : m.end))) + (opts.breakMins != null ? opts.breakMins : st.settings.gapMins);
    let r;
    if (opts.pickFinal) { const r0 = evalAssign(st, batch, [], ds, ready), r1 = evalAssign(st, [], batch, ds, ready); r = (r1.sw < r0.sw) ? r1 : r0; }
    else if (opts.fixedGround != null) r = evalAssign(st, opts.fixedGround === 0 ? batch : [], opts.fixedGround === 1 ? batch : [], ds, ready);
    else r = chooseLook(st, day, allCands(st, batch, ds, ready, capLeft), opts.stageId);
    const base = dayBase(st)[day] + dayMs.length;
    const out = r.res.slice().sort((x, y) => x.start - y.start || x.g - y.g);
    const made = out.map((x, i) => {
      const p = x.p;
      return {
        no: base + i + 1, stage: p.stage, round: p.round || null, group: p.group, kind: p.kind, label: p.label, day, ground: x.g,
        start: x.start, end: x.end, a: p[0], b: p[1], travel: x.trav, status: 'planned', chUrl: '', result: null, actualEnd: null
      };
    });
    st.matches.push(...made);
    return made;
  };

  /* ---------- stage generation ---------- */
  E.generate = function (st, id) {
    const c = E.canGenerate(st, id); if (!c.ok) throw new Error(c.reason);
    const sd = E.STAGES.find(s => s.id === id);
    const mk = (a, b, group, kind, label, round, stage) => { const p = [a, b]; Object.assign(p, { group, kind, label, round, stage }); return p; };
    let created = [], notes = [];
    if (['A-R1', 'B-R1'].includes(id)) {
      const g = sd.group, pairs = st.lot[g].map(p => mk(p[0], p[1], g, 'league', 'Round 1 · RSM match', 1, id));
      created = E.scheduleBatch(st, sd.day, pairs, { stageId: id }); notes.push('Round 1 pairs are from the lot draw');
    } else if (/^[AB]-R[23]$/.test(id)) {
      const g = sd.group, r = E.pairGroup(st, g); notes = r.notes;
      created = E.scheduleBatch(st, sd.day, r.pairs.map(p => mk(p[0], p[1], g, 'league', 'Round ' + sd.round, sd.round, id)), { stageId: id });
    } else if (id === 'R4') {
      const all = [];
      ['A', 'B'].forEach(g => { const r = E.pairGroup(st, g); notes.push(...r.notes.map(n => `Group ${g} ${n}`)); r.pairs.forEach(p => all.push(mk(p[0], p[1], g, 'league', 'Round 4', 4, id))); });
      created = E.scheduleBatch(st, 3, all);
    } else if (id === 'R5') {
      const day3 = [], spill = [];
      ['A', 'B'].forEach(g => {
        const tb = E.standings(st, g).map(r => r.id), r = E.pairGroup(st, g); notes.push(...r.notes.map(n => `Group ${g} ${n}`));
        const e8 = tb[7];
        r.pairs.forEach(p => { const m = mk(p[0], p[1], g, 'league', 'Round 5', 5, id); if (p.includes(e8)) { m.label = 'Round 5 · Sunday morning'; spill.push(m); } else day3.push(m); });
      });
      created = E.scheduleBatch(st, 3, day3).concat(E.scheduleBatch(st, 4, spill, { breakMins: 0, stageId: 'R5' }));
      notes.push('The match with each group\'s 8th-placed team is played on Sunday morning');
    } else if (id === 'QF') {
      const A = E.standings(st, 'A').map(r => r.id), B = E.standings(st, 'B').map(r => r.id);
      const q = [['QF1', A[0], B[3]], ['QF2', A[1], B[2]], ['QF3', B[0], A[3]], ['QF4', B[1], A[2]]];
      created = E.scheduleBatch(st, 4, q.map(x => mk(x[1], x[2], 'K', 'QF', x[0], null, id)), { stageId: id });
      created.forEach(m => m.qf = m.label); notes.push('QF1 A1 v B4 · QF2 A2 v B3 · QF3 B1 v A4 · QF4 B2 v A3');
    } else if (id === 'SF') {
      const w = n => st.matches.find(m => m.stage === 'QF' && m.label === n).result.winner;
      const q = [['SF1', w('QF1'), w('QF4')], ['SF2', w('QF2'), w('QF3')]];
      created = E.scheduleBatch(st, 4, q.map(x => mk(x[1], x[2], 'K', 'SF', x[0], null, id)), { stageId: id });
      notes.push('SF1: QF1 v QF4 winners · SF2: QF2 v QF3 winners');
    } else if (id === 'F') {
      const w = n => st.matches.find(m => m.stage === 'SF' && m.label === n).result.winner;
      created = E.scheduleBatch(st, 4, [mk(w('SF1'), w('SF2'), 'K', 'Final', 'Grand Final', null, id)], { final: true, fixedGround: 0, breakMins: st.settings.finalBreakMins });
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
