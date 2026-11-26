/* KNPL-7 YouTube thumbnail renderer (1280x720). Needs a browser canvas. */
(function (root) {
  'use strict';
  const T = {}, W = 1280, H = 720, GOLD = '#F2B544', GOLD2 = '#D9A441', CREAM = '#FFF4DC', MAROON = '#3B0F1A';
  T.ROLES = [
    ['telecast', 'Telecast Sponsor'], ['cosponsor', 'Telecast Co-Sponsor'], ['star', 'Star of the Match Sponsor'],
    ['salute', 'Salute Award Sponsor'], ['match', 'Match Sponsor']
  ];
  T.loadImg = src => new Promise(res => {
    if (!src) return res(null);
    const i = new Image(); if (!/^data:/.test(src)) i.crossOrigin = 'anonymous';
    i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
  });
  T.fonts = async function () {
    try {
      await Promise.all([document.fonts.load('700 40px Cinzel'), document.fonts.load('400 40px "Bebas Neue"'), document.fonts.load('600 20px Poppins'), document.fonts.load('500 20px Poppins')]);
    } catch (e) { }
  };
  const F = { title: 'Cinzel, "Times New Roman", serif', name: '"Bebas Neue", Impact, "Arial Narrow", sans-serif', ui: 'Poppins, "Segoe UI", Arial, sans-serif' };
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function spaced(c, text, x, y, sp, align) {
    const chars = [...text]; let w = 0; chars.forEach(ch => w += c.measureText(ch).width + sp); w -= sp;
    let sx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const old = c.textAlign; c.textAlign = 'left'; chars.forEach(ch => { c.fillText(ch, sx, y); sx += c.measureText(ch).width + sp; }); c.textAlign = old;
  }
  function fit(img, x, y, w, h) { const s = Math.min(w / img.width, h / img.height); const dw = img.width * s, dh = img.height * s; return [x + (w - dw) / 2, y + (h - dh) / 2, dw, dh]; }
  function crest(c, team, img, cx, cy, r, ring) {
    c.save();
    c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 28; c.shadowOffsetY = 10;
    c.beginPath(); c.arc(cx, cy, r + ring + 8, 0, 7); c.fillStyle = '#12050a'; c.fill();
    c.restore();
    const g = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g.addColorStop(0, '#FFE2A0'); g.addColorStop(.5, GOLD); g.addColorStop(1, '#A87420');
    c.beginPath(); c.arc(cx, cy, r + ring, 0, 7); c.fillStyle = g; c.fill();
    c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fillStyle = '#fff'; c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, r - 2, 0, 7); c.clip();
    if (img) { const b = fit(img, cx - r, cy - r, r * 2, r * 2); c.drawImage(img, b[0], b[1], b[2], b[3]); }
    else {
      const gg = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gg.addColorStop(0, team.c1 || '#444'); gg.addColorStop(1, team.c2 || '#222');
      c.fillStyle = gg; c.fillRect(cx - r, cy - r, r * 2, r * 2);
      c.fillStyle = '#fff'; c.font = `400 ${r * .62}px ${F.name}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(team.id, cx, cy + 4);
    }
    c.restore();
  }
  function smallCrest(c, team, img, cx, cy, r) {
    c.beginPath(); c.arc(cx, cy, r + 2.5, 0, 7); c.fillStyle = GOLD; c.fill();
    c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fillStyle = '#fff'; c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, r - 1, 0, 7); c.clip();
    if (img) { const b = fit(img, cx - r, cy - r, r * 2, r * 2); c.drawImage(img, b[0], b[1], b[2], b[3]); }
    else { const gg = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gg.addColorStop(0, team.c1 || '#444'); gg.addColorStop(1, team.c2 || '#222'); c.fillStyle = gg; c.fillRect(cx - r, cy - r, r * 2, r * 2); c.fillStyle = '#fff'; c.font = `400 ${r * .7}px ${F.name}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(team.id, cx, cy + 2); }
    c.restore();
  }
  function wrapName(c, name, maxW, size) {
    c.font = `400 ${size}px ${F.name}`;
    if (c.measureText(name).width <= maxW) return [name];
    const w = name.split(' ');
    let best = null, bd = 1e9;
    for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '); const d = Math.abs(c.measureText(a).width - c.measureText(b).width); if (d < bd) { bd = d; best = [a, b]; } }
    return best;
  }
  function corner(c, x, y, sx, sy) {
    c.save(); c.translate(x, y); c.scale(sx, sy); c.strokeStyle = GOLD; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(0, 46); c.lineTo(0, 0); c.lineTo(46, 0); c.stroke();
    c.lineWidth = 1.2; c.beginPath(); c.moveTo(10, 56); c.lineTo(10, 10); c.lineTo(56, 10); c.stroke();
    c.fillStyle = GOLD; c.save(); c.translate(0, 0); c.rotate(Math.PI / 4); c.fillRect(-5, -5, 10, 10); c.restore();
    c.restore();
  }
  /* d = {settings,title,teams[], A:team, B:team, logos{id:img}, knpl:img, sponsors:{role:{name,img}|null}, partner:{img}|null,
          date,time,ground,matchNo,label} */
  T.draw = function (cv, d) {
    cv.width = W; cv.height = H; const c = cv.getContext('2d');
    // background
    let g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2b0b17'); g.addColorStop(.55, '#1c0710'); g.addColorStop(1, '#10040a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createRadialGradient(W / 2, 330, 40, W / 2, 330, 620); g.addColorStop(0, 'rgba(242,181,68,.26)'); g.addColorStop(.55, 'rgba(160,50,60,.12)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = .05; c.strokeStyle = GOLD; c.lineWidth = 1; for (let i = -H; i < W; i += 22) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + H, H); c.stroke(); } c.restore();
    g = c.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 800); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // frame
    c.strokeStyle = GOLD; c.lineWidth = 2.5; rr(c, 16, 16, W - 32, H - 32, 6); c.stroke();
    c.strokeStyle = 'rgba(242,181,68,.45)'; c.lineWidth = 1; rr(c, 26, 26, W - 52, H - 52, 4); c.stroke();
    corner(c, 16, 16, 1, 1); corner(c, W - 16, 16, -1, 1); corner(c, 16, H - 16, 1, -1); corner(c, W - 16, H - 16, -1, -1);
    // header
    if (d.knpl) { c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 16; c.beginPath(); c.arc(112, 92, 58, 0, 7); c.fillStyle = '#fff'; c.fill(); c.restore(); c.save(); c.beginPath(); c.arc(112, 92, 55, 0, 7); c.clip(); const b = fit(d.knpl, 57, 37, 110, 110); c.drawImage(d.knpl, b[0], b[1], b[2], b[3]); c.restore(); c.strokeStyle = GOLD; c.lineWidth = 3; c.beginPath(); c.arc(112, 92, 58, 0, 7); c.stroke(); }
    if (d.partner) { c.save(); c.beginPath(); c.arc(W - 112, 92, 58, 0, 7); c.fillStyle = '#fff'; c.fill(); c.clip(); const b = fit(d.partner, W - 112 - 46, 92 - 46, 92, 92); c.drawImage(d.partner, b[0], b[1], b[2], b[3]); c.restore(); c.strokeStyle = GOLD; c.lineWidth = 3; c.beginPath(); c.arc(W - 112, 92, 58, 0, 7); c.stroke(); }
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const tg = c.createLinearGradient(0, 50, 0, 110); tg.addColorStop(0, '#FFE9B0'); tg.addColorStop(1, GOLD2);
    c.font = `700 43px ${F.title}`; c.fillStyle = tg; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 10; c.shadowOffsetY = 3;
    const tt = 'KERALA NAMBOODIRIS PREMIER LEAGUE'; let fs = 43; while (c.measureText(tt).width > 800 && fs > 30) { fs--; c.font = `700 ${fs}px ${F.title}`; }
    c.fillText(tt, W / 2, 88); c.shadowColor = 'transparent';
    c.fillStyle = CREAM; c.font = `500 17px ${F.ui}`; spaced(c, `SEASON ${d.settings.season}   ◆   ANGAMALY`, W / 2, 124, 5, 'center');
    // divider
    const dv = c.createLinearGradient(240, 0, W - 240, 0); dv.addColorStop(0, 'rgba(242,181,68,0)'); dv.addColorStop(.5, GOLD); dv.addColorStop(1, 'rgba(242,181,68,0)'); c.fillStyle = dv; c.fillRect(240, 146, W - 480, 2);
    // teams
    const cy = 284, r = 92, lx = 285, rx = W - 285;
    crest(c, d.A, d.logos[d.A.id], lx, cy, r, 7); crest(c, d.B, d.logos[d.B.id], rx, cy, r, 7);
    [[d.A, lx], [d.B, rx]].forEach(([t, x]) => {
      const lines = wrapName(c, t.name.toUpperCase(), 420, 54); const sz = lines.length > 1 ? 50 : 58;
      c.font = `400 ${sz}px ${F.name}`; c.fillStyle = CREAM; c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 8; c.shadowOffsetY = 3; c.textAlign = 'center';
      lines.forEach((ln, i) => c.fillText(ln, x, cy + r + 56 + i * (sz - 4) - (lines.length > 1 ? 8 : 0))); c.shadowColor = 'transparent';
    });
    // centre
    const mx = W / 2;
    const pill = d.matchNo ? `MATCH ${d.matchNo}` : ''; 
    if (pill) { c.font = `600 17px ${F.ui}`; const pw = c.measureText(pill).width + 52; rr(c, mx - pw / 2, 168, pw, 34, 17); c.fillStyle = GOLD; c.fill(); c.fillStyle = MAROON; c.textAlign = 'center'; spaced(c, pill, mx, 191, 3, 'center'); }
    c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 22; c.shadowOffsetY = 8; c.beginPath(); c.arc(mx, 270, 52, 0, 7); const vg = c.createLinearGradient(mx - 50, 220, mx + 50, 320); vg.addColorStop(0, '#FFE9B0'); vg.addColorStop(1, '#C48A26'); c.fillStyle = vg; c.fill(); c.restore();
    c.strokeStyle = MAROON; c.lineWidth = 2; c.beginPath(); c.arc(mx, 270, 44, 0, 7); c.stroke();
    c.fillStyle = MAROON; c.font = `400 58px ${F.name}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('VS', mx, 274); c.textBaseline = 'alphabetic';
    c.fillStyle = tg; c.font = `400 46px ${F.name}`; c.fillText(d.date, mx, 370);
    c.fillStyle = CREAM; c.font = `600 26px ${F.ui}`; c.fillText(d.time, mx, 404);
    c.fillStyle = 'rgba(255,244,220,.85)'; c.font = `500 15px ${F.ui}`; spaced(c, d.ground.toUpperCase(), mx, 434, 3, 'center');
    c.fillStyle = GOLD; c.font = `600 14px ${F.ui}`; spaced(c, (d.label || '').toUpperCase(), mx, 460, 3, 'center');
    // sponsors
    const sy = 508, cw = 214, ch = 96, gap = 22, total = 5 * cw + 4 * gap, sx0 = (W - total) / 2;
    c.fillStyle = dv; c.fillRect(sx0, 490, total, 1.5);
    if (d.sponsorsTBD) {
      c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 14; c.shadowOffsetY = 5; rr(c, sx0, sy, total, ch, 16); c.fillStyle = '#FFF9EC'; c.fill(); c.restore();
      c.strokeStyle = GOLD; c.lineWidth = 2; rr(c, sx0, sy, total, ch, 16); c.stroke();
      c.fillStyle = MAROON; c.textAlign = 'center'; c.font = `400 38px ${F.name}`; spaced(c, 'SPONSORS YET TO BE FINALISED', W / 2, sy + 46, 4, 'center');
      c.fillStyle = 'rgba(59,15,26,.6)'; c.font = `500 13px ${F.ui}`; spaced(c, 'TELECAST  ◆  CO-SPONSOR  ◆  STAR OF THE MATCH  ◆  SALUTE AWARD  ◆  MATCH SPONSOR', W / 2, sy + 74, 2, 'center');
    } else T.ROLES.forEach(([k, lab], i) => {
      const x = sx0 + i * (cw + gap); const s = d.sponsors[k];
      c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 14; c.shadowOffsetY = 5; rr(c, x, sy, cw, ch, 16); c.fillStyle = '#FFF9EC'; c.fill(); c.restore();
      c.strokeStyle = GOLD; c.lineWidth = 2; rr(c, x, sy, cw, ch, 16); c.stroke();
      if (s && s.img) { const b = fit(s.img, x + 14, sy + 10, cw - 28, ch - 20); c.drawImage(s.img, b[0], b[1], b[2], b[3]); }
      else if (s && s.name) { c.fillStyle = MAROON; c.textAlign = 'center'; let f2 = 40; c.font = `400 ${f2}px ${F.name}`; while (c.measureText(s.name).width > cw - 28 && f2 > 18) { f2 -= 2; c.font = `400 ${f2}px ${F.name}`; } c.fillText(s.name.toUpperCase(), x + cw / 2, sy + ch / 2 + f2 / 3); }
      else { c.fillStyle = 'rgba(59,15,26,.25)'; c.font = `500 13px ${F.ui}`; c.textAlign = 'center'; spaced(c, 'AVAILABLE', x + cw / 2, sy + ch / 2 + 5, 3, 'center'); }
      c.fillStyle = CREAM; c.font = `600 12.5px ${F.ui}`; c.textAlign = 'center'; const ws = lab.toUpperCase().split(' ');
      const mid = Math.ceil(ws.length / 2), l1 = ws.slice(0, mid).join(' '), l2 = ws.slice(mid).join(' ');
      spaced(c, l1, x + cw / 2, sy + ch + 22, 1.6, 'center'); if (l2) spaced(c, l2, x + cw / 2, sy + ch + 40, 1.6, 'center');
    });
    // team strip
    const n = d.teams.length, r2 = 15, step = 44, sx = (W - (n - 1) * step) / 2, by = 676;
    d.teams.forEach((t, i) => { const x = sx + i * step + (i >= n / 2 ? 14 : -14); smallCrest(c, t, d.logos[t.id], x, by, r2); });
    return cv;
  };
  root.KT = T;
})(window);
