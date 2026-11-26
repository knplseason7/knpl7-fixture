(function(){
'use strict';
const KE=window.KE,KT=window.KT,CFG=window.KNPL_CONFIG||{};
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let S=null,view='draw',day=1,session=null,busy=false,AUTH={codeRequired:false};
const demoCode=()=>{try{return localStorage.getItem('knpl7_democode')||CFG.DEMO_COMMITTEE_CODE||'';}catch(e){return CFG.DEMO_COMMITTEE_CODE||'';}};
const LS='knpl7_state',LSS='knpl7_session';
const route=()=>location.hash.startsWith('#/yt')?'yt':location.hash.startsWith('#/team')?'team':location.hash.startsWith('#/sim')?'sim':'admin';

/* ---------- storage / api ---------- */
async function api(action,payload){
  if(!CFG.API_URL) throw new Error('API not configured');
  const r=await fetch(CFG.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action,token:session&&session.token},payload||{}))});
  const j=await r.json(); if(!j.ok) throw new Error(j.error||'Server error'); return j;
}
async function load(){
  let st=null;
  if(CFG.API_URL){ try{ const j=await api(route()==='admin'&&session?'getState':'getPublic'); st=j.state; if(st)st.ver=j.version; }catch(e){ console.warn(e); } }
  if(!st){ try{ st=JSON.parse(localStorage.getItem(LS)); }catch(e){} }
  S=st||KE.newState();
}
let saveT=null;
function save(){
  try{localStorage.setItem(LS,JSON.stringify(S));}catch(e){toast('Browser storage full: remove big logos',1);}
  if(CFG.API_URL&&session){ clearTimeout(saveT); saveT=setTimeout(async()=>{try{const j=await api('saveState',{state:S,version:S.ver});S.ver=j.version;}catch(e){if(/CONFLICT/.test(e.message)){toast('Another committee member saved first. Reloading latest data…',1);await load();render();}else toast('Cloud save failed: '+e.message,1);}},600); }
}
function toast(m,err){const t=document.createElement('div');t.className='toast'+(err?' err':'');t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3200);}
function modal(html){const m=$('#modal');m.innerHTML=`<div class="modal-bg" data-act="mclose"><div class="modal">${html}</div></div>`;}
function closeModal(){$('#modal').innerHTML='';}
const crest=(id,big)=>{const t=KE.team(S,id)||{id,c1:'#444',c2:'#222'};const bg=t.logo?'':`background:linear-gradient(135deg,${t.c1},${t.c2})`;return `<span class="crest${big?' big':''}" style="${bg}">${t.logo?`<img src="${t.logo}" alt="">`:esc(t.id)}</span>`;};
const gname=g=>S.settings.grounds[g];
function rnd(n){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n;}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function download(name,text,type){const b=new Blob([text],{type:type||'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
const csv=rows=>rows.map(r=>r.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(',')).join('\n');

/* ---------- shell ---------- */
function shell(){
  const r=route(),tabs=$('#tabs'),who=$('#who');
  if(r==='admin'){
    if(!session){tabs.innerHTML='';who.innerHTML='Committee';return;}
    const T=[['draw','Draw'],['sched','Fixture'],['sim','Simulation lab'],['table','Points table'],['thumbs','Thumbnails'],['teams','Teams & sponsors'],['files','Downloads & links'],['set','Settings']];
    tabs.innerHTML=T.map(t=>`<button class="tab${view===t[0]?' on':''}" data-act="view" data-v="${t[0]}">${t[1]}</button>`).join('');
    who.innerHTML=`${esc(session.name||'Committee')} <button class="btn sm gold" data-act="logout">Logout</button>`;
  } else {tabs.innerHTML='';who.innerHTML=r==='yt'?'YouTube team':r==='sim'?'Practice simulation':'Franchise owners';}
}
async function render(){
  shell();const r=route(),m=$('#main');
  if(r==='sim'){m.innerHTML=psView();return;}
  if(r==='yt')return m.innerHTML=ytView();
  if(r==='team')return m.innerHTML=teamView();
  if(!session)return m.innerHTML=loginView();
  m.innerHTML=({draw:drawView,sched:schedView,sim:simView,table:tableView,thumbs:thumbsView,teams:teamsView,files:filesView,set:setView})[view]();
  if(view==='draw')setTimeout(drawWheel,0);
  if(view==='thumbs')setTimeout(()=>previewSel(),0);
}
function loginView(){const need=CFG.API_URL?AUTH.codeRequired:!!demoCode();return `<div class="card login"><h2>Committee login</h2><p class="muted small">${need?'Enter your name, mobile and the committee access code.':'Enter your name and mobile to continue.'}${CFG.API_URL?'':' (Demo mode: no server linked.)'}</p>
<div class="field"><label>Name</label><input id="ln" autocomplete="name"></div><div class="field"><label>Mobile</label><input id="lm" inputmode="tel" autocomplete="tel"></div>${need?'<div class="field"><label>Access code</label><input id="lc" type="password" autocomplete="current-password"></div>':''}
<button class="btn gold" style="width:100%" data-act="login">Login</button></div>`;}

/* ---------- DRAW ---------- */
let wheel={items:[],angle:0,spinning:false,mode:'group',queue:[],target:null,picks:[]};
function statusCard(){
  const grp=S.draw.groupsDone;
  return `<div class="card"><h2>Tournament status</h2>
  <div class="banner ${S.frozen?'ok':''}"><b>Groups:</b> ${S.frozen?'FROZEN. Practice simulations now use these groups.':grp?'Drawn but not frozen. Freeze after the lot is final.':'Not drawn yet. Participants can still generate their own groups in the practice simulation.'}
  <div class="row" style="margin-top:8px">${S.frozen?'<button class="btn ghost sm" data-act="unfreeze">Unfreeze</button>':`<button class="btn gold sm" data-act="freeze" ${grp?'':'disabled'}>Freeze groups</button>`}</div></div>
  <div class="banner ${S.started?'ok':''}"><b>CricHeroes tournament:</b> ${S.started?'STARTED. Results are fetched from CricHeroes.':'Not started. Click once the tournament and matches are live in CricHeroes.'}
  <div class="row" style="margin-top:8px">${S.started?'<button class="btn ghost sm" data-act="unstart">Undo</button>':`<button class="btn gold sm" data-act="start" ${S.settings.chUrl?'':'disabled'}>Mark tournament started</button>${S.settings.chUrl?'':'<span class="small muted">Add the CricHeroes link in Settings first</span>'}`}</div></div>
  <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="spfin" style="width:auto" data-act="spfin" ${S.sponsorsFinal?'checked':''}> Sponsors finalised (thumbnails show sponsor logos; otherwise “Sponsors yet to be finalised”, planned until 10 Feb)</label></div>`;
}
function drawView(){
  const a=S.groups.A,b=S.groups.B,all=S.teams.map(t=>t.id),left=all.filter(x=>!a.includes(x)&&!b.includes(x));
  let html=statusCard();
  if(!S.draw.groupsDone){
    wheel.mode='group';wheel.items=left;
    html+=`<div class="card"><h2>1 · Group draw (Picker Wheel)</h2><p class="muted small">Each spin picks one team. The first 8 go to Group A, the next 8 to Group B. Group A plays 11, 13, 14 Feb; Group B plays 12, 13, 14 Feb.</p>
<div class="wheelbox"><div><canvas id="wheel" width="440" height="440"></canvas><div class="row" style="justify-content:center;margin-top:10px"><button class="btn gold" data-act="spin" ${wheel.spinning||!left.length?'disabled':''}>🎡 Spin (${left.length} left)</button><button class="btn ghost sm" data-act="quickdraw" ${wheel.spinning||!left.length?'disabled':''}>Auto-finish</button><button class="btn ghost sm" data-act="resetdraw">Reset</button></div></div>
<div class="picks"><div><h3>Group A (${a.length}/8)</h3><ol>${slots(a,8)}</ol></div><div><h3>Group B (${b.length}/8)</h3><ol>${slots(b,8)}</ol></div></div></div></div>`;
  } else {
    html+=`<div class="card"><h2>Groups ✔ ${S.frozen?'':'<button class="btn ghost sm" data-act="resetdraw">Redo draw</button>'}</h2><div class="picks"><div><h3>Group A · 11, 13, 14 Feb</h3><ol>${slots(a,8)}</ol></div><div><h3>Group B · 12, 13, 14 Feb</h3><ol>${slots(b,8)}</ol></div></div></div>`;
    ['A','B'].forEach(g=>{
      const lot=S.lot[g];
      if(lot){html+=`<div class="card"><h2>Group ${g} · Round 1 lot ✔</h2>${lot.map((p,i)=>`<div class="mc-teams">${crest(p[0])}<b>${esc(KE.tname(S,p[0]))}</b><span class="vs">VS</span>${crest(p[1])}<b>${esc(KE.tname(S,p[1]))}</b></div>`).join('')}${S.stages[g+'-R1']?'':`<button class="btn ghost sm" data-act="redolot" data-g="${g}">Redo lot</button>`}</div>`;}
      else {
        if(wheel.target===g){wheel.items=wheel.queue;}
        html+=`<div class="card"><h2>2 · Round 1 lot · Group ${g}</h2><p class="muted small">Spin repeatedly: teams are paired in the order drawn (1st with 2nd, 3rd with 4th, and so on).</p>
<div class="wheelbox"><div>${wheel.target===g?'<canvas id="wheel" width="440" height="440"></canvas>':''}<div class="row" style="justify-content:center;margin-top:10px">${wheel.target===g?`<button class="btn gold" data-act="spin" ${wheel.spinning||!wheel.queue.length?'disabled':''}>🎡 Spin (${wheel.queue.length} left)</button><button class="btn ghost sm" data-act="quickdraw">Auto-finish</button>`:`<button class="btn gold" data-act="startlot" data-g="${g}">Start Group ${g} lot</button>`}</div></div>
<div class="picks"><div><h3>Pairs drawn</h3><ol>${pairsDrawn(g)}</ol></div></div></div></div>`;
      }
    });
  }
  return html;
}
const slots=(arr,n)=>Array.from({length:n},(_,i)=>arr[i]?`<li>${crest(arr[i])}<span>${esc(KE.tname(S,arr[i]))}</span></li>`:`<li class="empty">${i+1}</li>`).join('');
function pairsDrawn(g){const p=wheel.target===g?wheel.picks:[];let h='';for(let i=0;i<4;i++){const a=p[i*2],b=p[i*2+1];h+=`<li>${a?crest(a):''}<span>${a?esc(KE.tname(S,a)):'?'} <b style="color:var(--gold2)">v</b> ${b?esc(KE.tname(S,b)):'?'}</span></li>`;}return h;}
function drawWheel(){
  const cv=$('#wheel');if(!cv)return;const c=cv.getContext('2d'),n=wheel.items.length,R=cv.width/2;c.clearRect(0,0,cv.width,cv.height);
  if(!n){c.fillStyle='#3B0F1A';c.font='20px Poppins';c.textAlign='center';c.fillText('All drawn',R,R);return;}
  const cols=['#3B0F1A','#B3202A','#1F6B66','#D9A441','#5a1a2a','#E8731A','#1F3A7A','#2E8B57'];
  c.save();c.translate(R,R);c.rotate(wheel.angle);
  for(let i=0;i<n;i++){const a0=i*2*Math.PI/n,a1=(i+1)*2*Math.PI/n;c.beginPath();c.moveTo(0,0);c.arc(0,0,R-8,a0,a1);c.closePath();c.fillStyle=cols[i%cols.length];c.fill();c.strokeStyle='#FFF4DC';c.lineWidth=2;c.stroke();
    c.save();c.rotate((a0+a1)/2);c.fillStyle='#fff';c.textAlign='right';c.font=`600 ${n>10?11:13}px Poppins`;const nm=KE.tname(S,wheel.items[i]);c.fillText(nm.length>22?nm.slice(0,21)+'…':nm,R-22,4);c.restore();}
  c.beginPath();c.arc(0,0,26,0,7);c.fillStyle='#F2B544';c.fill();c.restore();
  c.beginPath();c.moveTo(cv.width-2,R);c.lineTo(cv.width-34,R-13);c.lineTo(cv.width-34,R+13);c.closePath();c.fillStyle='#F2B544';c.strokeStyle='#3B0F1A';c.lineWidth=2;c.fill();c.stroke();
}
function spin(done){
  if(wheel.spinning)return;const n=wheel.items.length;if(!n)return;const idx=rnd(n);wheel.spinning=true;
  // pointer is at angle 0 (right). segment idx centre must land at 0 => angle = -(idx+.5)*2PI/n  (+ turns)
  const seg=2*Math.PI/n,target=-(idx+.5)*seg+(Math.random()-.5)*seg*.7;
  const start=wheel.angle%(2*Math.PI),turns=5+rnd(3),end=target-turns*2*Math.PI,dur=3600,t0=performance.now();
  (function f(t){const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3);wheel.angle=start+(end-start)*e;drawWheel();if(k<1)requestAnimationFrame(f);else{wheel.spinning=false;wheel.angle=wheel.angle%(2*Math.PI);done(wheel.items[idx]);}})(t0);
  render_buttons();
}
function render_buttons(){document.querySelectorAll('[data-act=spin],[data-act=quickdraw]').forEach(b=>b.disabled=true);}
function pickGroup(id){
  const a=S.groups.A,b=S.groups.B;(a.length<8?a:b).push(id);S.draw.log.push({t:Date.now(),team:id,group:a.includes(id)?'A':'B'});
  if(a.length+b.length===16)S.draw.groupsDone=true;save();render();toast(`${KE.tname(S,id)} → Group ${a.includes(id)?'A':'B'}`);
}
function pickLot(id){
  wheel.picks.push(id);wheel.queue=wheel.queue.filter(x=>x!==id);
  if(!wheel.queue.length){const p=wheel.picks,g=wheel.target;S.lot[g]=[[p[0],p[1]],[p[2],p[3]],[p[4],p[5]],[p[6],p[7]]];wheel.target=null;wheel.picks=[];save();toast('Group '+g+' Round 1 pairs set');}
  render();
}
/* ---------- SCHEDULE ---------- */
function schedView(){
  let h='';const w=KE.warnings(S);w.forEach(x=>h+=`<div class="warn">⚠ ${esc(x)}</div>`);
  h+=`<div class="card"><h2>Rounds</h2><p class="muted small">A round can be generated only when the previous one has all results. After generating, create the matches in CricHeroes and tick “Created in CricHeroes”. ${S.started?'Results come from CricHeroes (use Fetch).':'Tournament not started: results are not entered here yet. Use the practice simulation to try the full flow.'}</p>`;
  KE.STAGES.forEach(sd=>{
    const gen=S.stages[sd.id],c=KE.canGenerate(S,sd.id),ms=S.matches.filter(m=>m.stage===sd.id),done=ms.filter(m=>m.status==='done').length;
    h+=`<div class="stage"><div class="t">${esc(sd.label)}<small>${gen?`${done}/${ms.length} results in`:esc(c.reason||'')}${(S.notes[sd.id]||[]).map(n=>'<br>ℹ '+esc(n)).join('')}</small></div>
    ${gen?`${S.started&&done<ms.length?`<button class="btn gold sm" data-act="fetchch">⟳ Fetch CricHeroes results</button>`:''}<span class="chip ${done===ms.length?'done':'created'}">${done===ms.length?'Complete':'In progress'}</span>`:c.ok?`<button class="btn gold sm" data-act="gen" data-s="${sd.id}">Generate</button>`:'<span class="chip lock">Locked</span>'}</div>`;
  });
  h+=`</div>`;
  h+=`<div class="daytabs">${[1,2,3,4].map(d=>`<button class="dt${day===d?' on':''}" data-act="day" data-d="${d}">Day ${d} · ${KE.fmtDate(S,d).slice(0,11)}</button>`).join('')}</div>`;
  const ms=S.matches.filter(m=>m.day===day);
  if(!ms.length)h+=`<div class="card muted">No matches generated for this day yet.</div>`;
  else{
    const starts=[...new Set(ms.map(m=>m.start))].sort((a,b)=>a-b);
    h+=`<div class="row small muted" style="margin-bottom:8px"><span class="gtag">${esc(gname(0))}</span><span class="gtag g1">${esc(gname(1))}</span></div>`;
    starts.forEach(s=>{h+=`<div class="slot"><div class="tm">${KE.clock12(S,s)}<small>to ${KE.clock12(S,s+S.settings.matchMins)}</small></div>${[0,1].map(g=>{const m=ms.find(x=>x.start===s&&x.ground===g);return m?mcard(m):`<div class="muted small" style="padding:10px">—</div>`;}).join('')}</div>`;});
  }
  h+=groundCard(S);
  if(S.started)h+=importCard();
  return h;
}
function prevInfo(st,m,team){const ms=st.matches.filter(x=>x.day===m.day&&x.no!==m.no&&(x.a===team||x.b===team)&&x.start<m.start).sort((p,q)=>q.start-p.start);return ms[0]||null;}
function mcard(m,st,act){
  st=st||S;const tv=id=>(m.travel||[]).some(t=>t.team===id);
  const side=id=>{const w=m.result&&m.result.winner===id;return `<span class="side${tv(id)?' tvteam':''}">${crest(id)}<b>${w?'🏆 ':''}${esc(KE.tname(st,id))}</b>${tv(id)?'<span class="tvb">✈ TRAVEL</span>':''}</span>`;};
  const trl=(m.travel||[]).map(t=>{const p=prevInfo(st,m,t.team);return `<div class="trline">✈ ${esc(KE.tname(st,t.team))} travels ${esc(st.settings.grounds[t.from])} → ${esc(st.settings.grounds[m.ground])}${p?` · previous match ends ${KE.clock12(st,p.end)}`:''} · allow ${st.settings.travelMins} min</div>`;}).join('');
  if(act==null){
    act=(m.status==='planned'?`<button class="btn sm" data-act="created" data-n="${m.no}">Created in CricHeroes</button>`:'')+(m.status==='created'?`<button class="btn ghost sm" data-act="uncreate" data-n="${m.no}">Undo</button>`:'')+
    (S.started?`<button class="btn ${m.status==='done'?'ghost':'gold'} sm" data-act="result" data-n="${m.no}">${m.status==='done'?'Edit result':'Manual result'}</button>`:'')+(m.chUrl?`<a class="btn ghost sm" target="_blank" rel="noopener" href="${esc(m.chUrl)}">CricHeroes ↗</a>`:'');
  }
  return `<div class="mc g${m.ground}${m.status==='done'?' done':''}${(m.travel||[]).length?' hastravel':''}"><div class="mc-top"><span class="no">Match ${m.no}</span><span class="gtag g${m.ground}">${esc(st.settings.grounds[m.ground])}</span><span class="chip ${m.status}">${m.status==='done'?'Result in':m.status==='created'?'In CricHeroes':'Planned'}</span></div>
<div class="mc-teams">${side(m.a)}<span class="vs">VS</span>${side(m.b)}</div>
<div class="mc-meta">${esc(KE.matchLabel(st,m))}${m.result?`<br>${m.result.ra!==''&&m.result.ra!=null?`${esc(m.result.ra)}/${esc(m.result.oa||'')} v ${esc(m.result.rb)}/${esc(m.result.ob||'')}`:''} ${m.result.so?'· Super Over':''}`:''}</div>${trl}
<div class="mc-act">${act}</div></div>`;
}
function importCard(){return `<div class="card noprint"><h2>Fetch results from CricHeroes</h2><p class="muted small">Auto-fetch needs the Apps Script backend and the tournament link (Settings). If CricHeroes cannot be read, paste a CSV: <code>match_no,winner_team_id,runs_a,overs_a,runs_b,overs_b</code> (overs like 9.4; leave a team's overs blank if it was all out; 10 is assumed).</p>
<div class="row"><button class="btn gold" data-act="fetchch">⟳ Fetch from CricHeroes</button></div><div class="field" style="margin-top:10px"><textarea id="csvin" rows="4" placeholder="1,KAA,92,10,88,10"></textarea></div><button class="btn ghost" data-act="csvimport">Import CSV results</button></div>`;}
function resultModal(no){
  const m=S.matches.find(x=>x.no===no),r=m.result||{};
  modal(`<h2>Match ${m.no} result</h2><div class="field"><label>Winner</label><select id="rw"><option value="">Select…</option><option value="${m.a}" ${r.winner===m.a?'selected':''}>${esc(KE.tname(S,m.a))}</option><option value="${m.b}" ${r.winner===m.b?'selected':''}>${esc(KE.tname(S,m.b))}</option></select></div>
  <div class="grid2"><div><label>${esc(KE.tname(S,m.a))} runs</label><input id="ra" inputmode="numeric" value="${esc(r.ra)}"></div><div><label>Overs faced</label><input id="oa" inputmode="decimal" value="${esc(r.oa)}" placeholder="10"></div>
  <div><label>${esc(KE.tname(S,m.b))} runs</label><input id="rb" inputmode="numeric" value="${esc(r.rb)}"></div><div><label>Overs faced</label><input id="ob" inputmode="decimal" value="${esc(r.ob)}" placeholder="10"></div></div>
  <div class="field" style="margin-top:8px"><label>Actual finish time (optional, HH:MM)</label><input id="rend" value="${esc(r.endClock)}" placeholder="09:05"></div>
  <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="rso" style="width:auto" ${r.so?'checked':''}> Decided by Super Over</label>
  <div class="field" style="margin-top:8px"><label>CricHeroes match link (optional)</label><input id="rurl" value="${esc(m.chUrl)}"></div>
  <p class="muted small">Overs matter only for NRR. If a team was all out, enter the full 10 overs per the NRR rule.</p>
  <div class="row"><button class="btn gold" data-act="saveresult" data-n="${no}">Save</button>${m.result?`<button class="btn red" data-act="clearresult" data-n="${no}">Clear</button>`:''}<button class="btn ghost" data-act="mclose">Cancel</button></div>`);
}
/* ---------- TABLE ---------- */
function tableView(){
  if(!S.draw.groupsDone)return `<div class="card muted">Run the group draw first.</div>`;
  return ['A','B'].map(g=>{const rows=KE.standings(S,g);return `<div class="card"><h2>Group ${g} points table</h2><div class="scroll"><table class="tbl"><tr><th>#</th><th>Team</th><th class="num">P</th><th class="num">W</th><th class="num">L</th><th class="num">Pts</th><th class="num">NRR</th></tr>${rows.map(r=>`<tr class="${r.pos<=4?'q':''}"><td>${r.pos}</td><td><span class="row" style="flex-wrap:nowrap;gap:8px">${crest(r.id)}${esc(KE.tname(S,r.id))}</span></td><td class="num">${r.p}</td><td class="num">${r.w}</td><td class="num">${r.l}</td><td class="num"><b>${r.pts}</b></td><td class="num">${r.nrr>=0?'+':''}${r.nrr.toFixed(3)}</td></tr>`).join('')}</table></div><p class="muted small">${rows.fromCH?'Order taken from the CricHeroes points table.':'Order calculated here (points, then NRR). Paste the CricHeroes order below to follow CricHeroes exactly.'}</p><div class="field"><label>CricHeroes order for Group ${g} (one team name per line, 1st to 8th)</label><textarea id="cho${g}" rows="4"></textarea></div><button class="btn ghost sm" data-act="chorder" data-g="${g}">Use this order</button> ${S.chOrder&&S.chOrder[g]?`<button class="btn ghost sm" data-act="chclear" data-g="${g}">Use calculated order</button>`:''}</div>`;}).join('');
}
/* ---------- THUMBS ---------- */
let thumbSel=null;
function thumbsView(){
  const ms=S.matches.filter(m=>m.status!=='planned');
  if(!thumbSel||!ms.find(m=>m.no===thumbSel))thumbSel=ms[0]&&ms[0].no;
  return `<div class="card"><h2>Thumbnails</h2><p class="muted small">Only matches marked “Created in CricHeroes” appear here and on the YouTube page.</p>
  ${ms.length?`<div class="field"><label>Match</label><select id="tsel" data-act="tsel">${ms.map(m=>`<option value="${m.no}" ${m.no===thumbSel?'selected':''}>Match ${m.no} · ${esc(KE.tname(S,m.a))} v ${esc(KE.tname(S,m.b))}</option>`).join('')}</select></div><div class="thumbwrap"><canvas id="tc"></canvas></div><div class="row" style="margin-top:10px"><button class="btn gold" data-act="dlthumb">⬇ Download PNG</button></div>`:'<p class="muted">No matches are marked as created in CricHeroes yet.</p>'}</div>`;
}
async function renderThumb(cv,no,st){
  st=st||S;const m=st.matches.find(x=>x.no===no);if(!m)return;await KT.fonts();
  const logos={};await Promise.all(S.teams.map(async t=>{logos[t.id]=await KT.loadImg(t.logo);}));
  const sp={};if(S.sponsorsFinal)for(const [k] of KT.ROLES){const s=(S.matchSponsors[no]&&S.matchSponsors[no][k])||S.sponsorRoles[k];sp[k]=s?{name:s.name,img:await KT.loadImg(s.img)}:null;}
  const d=new Date(st.settings.dates[m.day]+'T00:00:00');
  KT.draw(cv,{settings:st.settings,teams:S.teams,A:KE.team(S,m.a),B:KE.team(S,m.b),sponsorsTBD:!S.sponsorsFinal,logos,knpl:await KT.loadImg('assets/knpl_logo.png'),sponsors:sp,partner:null,
    date:d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase(),time:KE.clock12(st,m.start),ground:st.settings.grounds[m.ground],matchNo:m.no,label:KE.matchLabel(st,m)});
}
function previewSel(){const cv=$('#tc');if(cv&&thumbSel)renderThumb(cv,thumbSel);}
function dlCanvas(cv,name){cv.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);},'image/png');}
/* ---------- TEAMS & SPONSORS ---------- */
function teamsView(){
  return `<div class="card"><h2>Sponsor slots on the thumbnail</h2><p class="muted small">Type the name and/or upload a logo for each slot. Pull from the sponsorship portal when the backend is linked. Slots left empty show “Available”.</p>
  ${KT.ROLES.map(([k,l])=>{const s=S.sponsorRoles[k]||{};return `<div class="row" style="margin-bottom:8px"><div style="flex:1;min-width:150px"><label>${l}</label><input data-sp="${k}" value="${esc(s.name)}" placeholder="Sponsor name"></div><div>${s.img?`<img src="${s.img}" style="height:40px;border-radius:6px;border:1px solid var(--line)">`:''}</div><label class="btn ghost sm" style="margin:16px 0 0">Logo<input type="file" accept="image/*" hidden data-splogo="${k}"></label>${s.img?`<button class="btn ghost sm" style="margin-top:16px" data-act="splogoclear" data-k="${k}">✕</button>`:''}</div>`;}).join('')}
  <div class="row"><button class="btn ghost" data-act="sppull">Pull from sponsorship portal</button></div></div>
  <div class="card"><h2>Teams</h2><p class="muted small">Upload crest logos (PNG, small). Owner codes are for the franchise-owner page.</p><div class="scroll"><table class="tbl"><tr><th></th><th>Team</th><th>Owner</th><th>Owner code</th><th></th></tr>${S.teams.map(t=>`<tr><td>${crest(t.id)}</td><td>${esc(t.name)}</td><td>${esc(t.owner)}</td><td><code>${esc(t.code||'—')}</code></td><td><label class="btn ghost sm">Logo<input type="file" accept="image/*" hidden data-tlogo="${t.id}"></label></td></tr>`).join('')}</table></div>
  <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="gencodes">Generate owner codes</button><button class="btn ghost" data-act="dlcodes">Download codes CSV</button></div></div>`;
}
function shrink(file,max){return new Promise(res=>{const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const s=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*s;c.height=i.height*s;c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL('image/png'));};i.src=r.result;};r.readAsDataURL(file);});}
/* ---------- FILES ---------- */
function filesView(){
  const base=location.href.split('#')[0];
  return `<div class="card"><h2>Share links</h2><div class="field"><label>YouTube streaming team</label><input readonly value="${esc(base+'#/yt')}" onclick="this.select()"></div><div class="field"><label>Practice simulation (committee and franchise owners)</label><input readonly value="${esc(base+'#/sim')}" onclick="this.select()"></div><div class="field"><label>Franchise owners</label><input readonly value="${esc(base+'#/team')}" onclick="this.select()"></div></div>
  <div class="card"><h2>Downloads</h2><div class="row"><button class="btn" data-act="dlgroups">Groups (CSV)</button><button class="btn" data-act="dlsched">Match schedule (CSV)</button><button class="btn" data-act="dlpoints">Points table (CSV)</button><button class="btn ghost" onclick="window.print()">Print schedule</button></div></div>
  <div class="card"><h2>Thumbnail download log</h2>${S.downloads.length?`<div class="scroll"><table class="tbl"><tr><th>When</th><th>Name</th><th>Mobile</th><th>Match</th></tr>${S.downloads.slice().reverse().slice(0,80).map(d=>`<tr><td>${new Date(d.t).toLocaleString('en-GB')}</td><td>${esc(d.name)}</td><td>${esc(d.mobile)}</td><td>${esc(d.match)}</td></tr>`).join('')}</table></div>`:'<p class="muted">No downloads yet.</p>'}</div>`;
}
/* ---------- SETTINGS ---------- */
function setView(){const s=S.settings;
  return `<div class="card"><h2>Tournament settings</h2><div class="grid2"><div class="field"><label>CricHeroes tournament link</label><input id="s_ch" value="${esc(s.chUrl)}" placeholder="https://cricheroes.com/tournament/…"></div><div class="field"><label>Overs per match</label><input id="s_ov" value="${s.overs}"></div>
  <div class="field"><label>First match start</label><input id="s_st" value="${s.startTime}"></div><div class="field"><label>Latest finish (no floodlights)</label><input id="s_ll" value="${s.lastLight}"></div>
  <div class="field"><label>Minutes per match: Days 1, 2, 4</label><input id="s_mm" value="${s.matchMinsDay[1]}"></div><div class="field"><label>Minutes per match: Day 3</label><input id="s_m3" value="${s.matchMinsDay[3]}"></div><div class="field"><label>Max ground changes (whole tournament)</label><input id="s_mc" value="${s.maxChanges}"></div><div class="field"><label>Gap between rounds (min)</label><input id="s_gap" value="${s.gapMins}"></div>
  <div class="field"><label>Ground-change buffer (min)</label><input id="s_tr" value="${s.travelMins}"></div><div class="field"><label>Break before Final (min)</label><input id="s_fb" value="${s.finalBreakMins}"></div></div>
  <p class="muted small">Changing times affects only rounds generated afterwards.</p><div class="row"><button class="btn gold" data-act="saveset">Save settings</button><button class="btn red" data-act="wipe">Reset everything</button></div></div>
  <div class="card"><h2>Access code</h2><p class="muted small">${(CFG.API_URL?AUTH.codeRequired:!!demoCode())?'Committee login is PROTECTED by an access code.':'Committee tools are currently OPEN: anyone with the page link can log in with a name and mobile. Create a code when the tournament nears and share it only with authorised people.'}</p>
  <div class="grid2"><div class="field"><label>New access code (min 6 characters; leave empty to open again)</label><input id="ac_new" type="password" autocomplete="new-password"></div><div class="field"><label>Allowed mobile numbers (optional, comma separated)</label><input id="ac_mob" placeholder="9876543210,9123456780"></div></div>
  <button class="btn gold" data-act="setcode">Save access code</button></div>
  <div class="card"><h2>Backend</h2><p class="muted small">${CFG.API_URL?'Linked to Apps Script: shared data across committee devices.':'Not linked: data stays in this browser only. Set API_URL in config.js after deploying Code.gs (see README).'}</p></div>`;}
/* ---------- YOUTUBE ---------- */
let yt={name:'',mobile:'',ground:null,match:null,ok:false};
function ytView(){
  let h=`<div class="pub">`;
  if(!yt.ok)h+=`<div class="card"><h2>YouTube thumbnail download</h2><div class="step"><span class="n">1</span><b>Your details</b></div><div class="field"><label>Name</label><input id="yn" value="${esc(yt.name)}"></div><div class="field"><label>Mobile</label><input id="ym" inputmode="tel" value="${esc(yt.mobile)}"></div><button class="btn gold" data-act="ytgo">Continue</button></div>`;
  else if(yt.ground==null)h+=`<div class="card"><h2>Hi ${esc(yt.name)}</h2><div class="step"><span class="n">2</span><b>Select ground</b></div>${[0,1].map(g=>`<button class="gbtn" data-act="ytg" data-g="${g}">📍 ${esc(gname(g))}</button>`).join('')}</div>`;
  else{
    const ms=S.matches.filter(m=>m.ground===yt.ground).sort((a,b)=>a.day-b.day||a.start-b.start);
    h+=`<div class="card"><h2>${esc(gname(yt.ground))} <button class="btn ghost sm" data-act="ytback">Change ground</button></h2><div class="step"><span class="n">3</span><b>Select match</b></div>${ms.length?ms.map(m=>{const ok=m.status!=='planned';return `<div class="mrow ${yt.match===m.no?'on':''} ${ok?'':'off'}" ${ok?`data-act="ytm" data-n="${m.no}"`:''}><div style="flex:1"><b>Match ${m.no}</b> · ${esc(KE.tname(S,m.a))} v ${esc(KE.tname(S,m.b))}<div class="small muted">${KE.fmtDate(S,m.day).slice(0,11)} · ${KE.clock12(S,m.start)} · ${esc(KE.matchLabel(S,m))}</div></div>${ok?'':'<span class="chip lock">Not scheduled yet</span>'}</div>`;}).join(''):'<p class="muted">No matches generated yet.</p>'}</div>`;
    if(yt.match)h+=`<div class="card"><div class="step"><span class="n">4</span><b>Thumbnail</b></div><div class="thumbwrap"><canvas id="tc"></canvas></div><div class="row" style="margin-top:10px"><button class="btn gold" data-act="ytdl">⬇ Download thumbnail</button></div></div>`;
  }
  return h+'</div>';
}
/* ---------- TEAM PAGE ---------- */
let tp={team:null};
function teamView(){
  let h='<div class="pub">';
  if(!tp.team)h+=`<div class="card"><h2>Franchise owner page</h2><div class="field"><label>Team</label><select id="tt"><option value="">Select…</option>${S.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Owner code</label><input id="tc2" type="password"></div><button class="btn gold" data-act="teamgo">View</button></div>`;
  else{
    const id=tp.team,ms=S.matches.filter(m=>m.a===id||m.b===id).sort((a,b)=>a.day-b.day||a.start-b.start),g=S.groups.A.includes(id)?'A':'B';
    const row=S.draw.groupsDone?KE.standings(S,g).find(r=>r.id===id):null;
    h+=`<div class="card"><h2>${crest(id,1)} ${esc(KE.tname(S,id))}</h2><p class="muted small">${S.draw.groupsDone?'Group '+g:'Group not drawn yet'}${row?` · Position ${row.pos} · ${row.pts} pts · NRR ${row.nrr.toFixed(3)}`:''}</p><button class="btn ghost sm" data-act="teamout">Switch team</button></div>
    <div class="card"><h2>Matches</h2>${ms.length?ms.map(m=>{const opp=m.a===id?m.b:m.a;return `<div class="mrow" style="cursor:default"><div style="flex:1"><b>Match ${m.no}</b> · v ${esc(KE.tname(S,opp))}<div class="small muted">${KE.fmtDate(S,m.day).slice(0,11)} · ${KE.clock12(S,m.start)} · ${esc(gname(m.ground))}</div>${m.result?`<div class="small"><b>${m.result.winner===id?'Won':'Lost'}</b>${m.result.ra!==''&&m.result.ra!=null?` · ${esc(m.result.ra)}/${esc(m.result.oa||'')} v ${esc(m.result.rb)}/${esc(m.result.ob||'')}`:''}</div>`:''}</div><span class="chip ${m.status}">${m.status==='done'?'Result':'Scheduled'}</span></div>`;}).join(''):'<p class="muted">Your schedule appears here once Round 1 is generated.</p>'}</div>`;
  }
  return h+'</div>';
}

/* ---------- GROUND CHANGE REPORT ---------- */
function groundCard(st){
  const r=KE.groundReport(st);if(!st.matches.length)return '';
  const gl=g=>g===0?'F':'B';
  const head=`<div class="row small" style="margin-bottom:8px;gap:14px"><span><b>F</b> = ${esc(st.settings.grounds[0])}</span><span><b>B</b> = ${esc(st.settings.grounds[1])}</span><span class="chip ${r.multi?'planned':'done'}">${r.multi?r.multi+' team-day(s) with more than one change':'No team changes ground more than once in a day'}</span><span class="chip ${r.rows.reduce((q,x)=>q+x.changes,0)>st.settings.maxChanges?'planned':'done'}">Total changes: ${r.rows.reduce((q,x)=>q+x.changes,0)} (limit ${st.settings.maxChanges})</span></div>`;
  const rows=st.teams.map(t=>`<tr><td><span class="row" style="flex-wrap:nowrap;gap:6px">${crest(t.id).replace('class="crest"','class="crest"')}${esc(t.id)}</span></td>${[1,2,3,4].map(d=>{const x=r.rows.find(q=>q.team===t.id&&q.day===d);if(!x)return '<td class="muted">–</td>';return `<td style="${x.changes>1?'background:#fde8e8':x.changes?'background:#fff4d6':''}">${x.seq.map(gl).join(' ')}${x.changes?` <b>(${x.changes}${x.final?' Final':''})</b>`:''}</td>`;}).join('')}</tr>`).join('');
  return `<div class="card"><h2>Ground-change check</h2>${head}<div class="scroll"><table class="tbl"><tr><th>Team</th><th>Day 1</th><th>Day 2</th><th>Day 3</th><th>Day 4</th></tr>${rows}</table></div><p class="muted small">Each letter is a match in order. Amber = one change, red = more than one.</p></div>`;
}
/* ---------- SIMULATION (sandbox, never touches real data) ---------- */
let SIM=null,simDay=1,simBatch=null;
function simNew(){
  const st=KE.newState();st.teams=S.teams.map(t=>({id:t.id,name:t.name,owner:t.owner,c1:t.c1,c2:t.c2,logo:t.logo}));
  st.settings=JSON.parse(JSON.stringify(S.settings));
  const ids=shuffle(st.teams.map(t=>t.id));st.groups.A=ids.slice(0,8);st.groups.B=ids.slice(8);st.draw.groupsDone=true;
  ['A','B'].forEach(g=>{const x=shuffle(st.groups[g]);st.lot[g]=[[x[0],x[1]],[x[2],x[3]],[x[4],x[5]],[x[6],x[7]]];});return st;
}
const STR=()=>{const o={};S.teams.forEach(t=>o[t.id]=.6+Math.random()*.8);return o;};
function simView(){
  if(!SIM)SIM=simNew();
  const st=SIM;let h=`<div class="card"><h2>Simulation <span class="chip ready">Sandbox · real data untouched</span></h2><p class="muted small">Try any combination of results. The check below shows every team's grounds per day. Fixtures are generated by the same engine as the live page.</p>
  <div class="row"><button class="btn gold" data-act="simnew">New random draw</button><button class="btn" data-act="simnext">Generate + random results: next round</button><button class="btn" data-act="simall">Run whole tournament</button></div>
  <div class="row" style="margin-top:10px"><select id="simn" style="width:auto"><option>20</option><option selected>50</option><option>100</option></select><button class="btn ghost" data-act="simbatch">Run many tournaments &amp; summarise</button></div>${simBatch?simBatchHtml():''}</div>`;
  h+=`<div class="card"><h2>Rounds</h2>`;
  KE.STAGES.forEach(sd=>{const gen=st.stages[sd.id],c=KE.canGenerate(st,sd.id),ms=st.matches.filter(m=>m.stage===sd.id),done=ms.filter(m=>m.status==='done').length;
    h+=`<div class="stage"><div class="t">${esc(sd.label)}<small>${gen?done+'/'+ms.length+' results':esc(c.reason||'')}</small></div>${gen?(done<ms.length?`<button class="btn ghost sm" data-act="simrand" data-s="${sd.id}">Random results</button>`:'<span class="chip done">Complete</span>'):c.ok?`<button class="btn gold sm" data-act="simgen" data-s="${sd.id}">Generate</button>`:'<span class="chip lock">Locked</span>'}</div>`;});
  h+=`</div><div class="daytabs">${[1,2,3,4].map(d=>`<button class="dt${simDay===d?' on':''}" data-act="simday" data-d="${d}">Day ${d}</button>`).join('')}</div>`;
  const ms=st.matches.filter(m=>m.day===simDay).sort((a,b)=>a.start-b.start||a.ground-b.ground);
  h+=ms.length?`<div class="card"><div class="scroll"><table class="tbl"><tr><th>#</th><th>Time</th><th>Ground</th><th>Match</th><th>Result</th></tr>${ms.map(m=>`<tr><td>${m.no}</td><td>${KE.clock12(st,m.start)}</td><td><span class="gtag g${m.ground}">${esc(st.settings.grounds[m.ground])}</span></td><td>${esc(KE.tname(st,m.a))} v ${esc(KE.tname(st,m.b))}<div class="small muted">${esc(KE.matchLabel(st,m))}${m.travel&&m.travel.length?' · <span class="trav">⇄ '+m.travel.map(t=>esc(t.team)).join(', ')+'</span>':''}</div></td><td>${m.status==='done'?'<b>'+esc(KE.tname(st,m.result.winner))+'</b> won <button class="btn ghost sm" data-act="simclr" data-n="'+m.no+'">undo</button>':`<button class="btn sm" data-act="simwin" data-n="${m.no}" data-w="${m.a}">${esc(m.a)} wins</button> <button class="btn sm" data-act="simwin" data-n="${m.no}" data-w="${m.b}">${esc(m.b)} wins</button>`}</td></tr>`).join('')}</table></div></div>`:'<div class="card muted">Nothing generated for this day yet.</div>';
  h+=groundCard(st);
  return h;
}
function simBatchHtml(){const b=simBatch;if(!b.done)return `<p class="muted small">Running… ${b.i}/${b.n}</p>`;
  return `<div class="scroll" style="margin-top:10px"><table class="tbl"><tr><th>Tournaments</th><th>Total ground changes (avg / min / max)</th><th>Within the limit of ${S.settings.maxChanges}</th><th>Team-days with 2+ changes</th><th>Latest finish D1 / D2 / D3 / D4</th></tr><tr><td>${b.n}</td><td><b>${(b.chg/b.n).toFixed(1)}</b> / ${b.min} / ${b.max}</td><td><b>${b.le}</b> of ${b.n}</td><td>${b.multi}</td><td>${[1,2,3,4].map(d=>KE.clock(SIM,b.maxEnd[d])).join(' / ')}</td></tr></table></div><p class="muted small">Every change of ground by a team counts once, including the Final.</p>`;}
async function simBatchRun(n){
  simBatch={n,i:0,bad:0,multi:0,chg:0,le:0,min:99,max:0,maxEnd:{1:0,2:0,3:0,4:0},done:false};render();
  for(let i=0;i<n;i++){const st=simNew(),str=STR();for(const s of KE.STAGES){KE.generate(st,s.id);KE.simStage(st,s.id,str);}
    const r=KE.groundReport(st);simBatch.i=i+1;if(r.multi)simBatch.bad++;simBatch.multi+=r.multi;const tc=r.rows.reduce((a,x)=>a+x.changes,0);simBatch.chg+=tc;simBatch.min=Math.min(simBatch.min,tc);simBatch.max=Math.max(simBatch.max,tc);if(tc<=S.settings.maxChanges)simBatch.le++;
    for(let d=1;d<=4;d++)simBatch.maxEnd[d]=Math.max(simBatch.maxEnd[d],Math.max(...st.matches.filter(m=>m.day===d).map(m=>m.end)));
    if(i%5===4){render();await new Promise(r=>setTimeout(r,0));}}
  simBatch.done=true;render();
}
function simNextStage(){const st=SIM;for(const sd of KE.STAGES){if(!st.stages[sd.id]&&KE.canGenerate(st,sd.id).ok){KE.generate(st,sd.id);KE.simStage(st,sd.id,STR());simDay=st.matches.find(m=>m.stage===sd.id).day;return true;}}return false;}

/* ---------- PRACTICE SIMULATION (public, runs entirely in the visitor's browser: any number of people at once, nothing shared or saved on the server) ---------- */
let PS=null,psDay=1;
const PSKEY='knpl7_psim_v2';
const frozenSig=()=>S.frozen?JSON.stringify(S.groups):'free';
function psLot(st){['A','B'].forEach(g=>{if(st.groups[g].length===8&&!st.lot[g]){const x=shuffle(st.groups[g]);st.lot[g]=[[x[0],x[1]],[x[2],x[3]],[x[4],x[5]],[x[6],x[7]]];}});return st;}
function psNew(){
  const st=KE.newState();st.teams=S.teams;st.settings=JSON.parse(JSON.stringify(S.settings));st.sigf=frozenSig();
  if(S.frozen){st.groups={A:S.groups.A.slice(),B:S.groups.B.slice()};st.draw.groupsDone=true;psLot(st);}
  return st;
}
function psLoad(){
  try{const raw=JSON.parse(localStorage.getItem(PSKEY));if(raw&&raw.sigf===frozenSig()){raw.teams=S.teams;PS=raw;return;}}catch(e){}
  PS=psNew();
}
function psSave(){try{localStorage.setItem(PSKEY,JSON.stringify(Object.assign({},PS,{teams:[]})));}catch(e){}}
function psStageLabel(sd,kind){const base=sd.label.replace(' · both groups','');return `${kind==='fx'?'Generate':'Generate'} ${base} ${kind==='fx'?'Fixture':'Results'}`;}
function psView(){
  if(!PS||PS.sigf!==frozenSig())psLoad();
  const st=PS;let h='<div class="pub" style="max-width:980px">';
  h+=`<div class="card"><h2>Practice simulation <span class="chip ready">Practice only</span></h2><p class="muted small">Try the Dynamic Ladder from the group draw to the Final. Results here are random or picked by you, are kept only on this device, and never affect the real tournament. Other people using this page do not see or change your simulation.</p>
  <div class="banner ${S.frozen?'ok':''}">${S.frozen?'Groups are the official frozen draw.':'Official groups are not frozen yet. Generate your own groups to practise.'}</div>
  <div class="row"><button class="btn red" data-act="psreset">Reset simulation</button></div></div>`;
  if(!st.draw.groupsDone){h+=`<div class="card"><h2>Step 1 · Groups</h2><button class="btn gold" data-act="psgroups">🎲 Generate groups</button></div></div>`;return h;}
  h+=`<div class="card"><h2>Groups</h2><div class="picks"><div><h3>Group A · 11, 13, 14 Feb</h3><ol>${slots(st.groups.A,8)}</ol></div><div><h3>Group B · 12, 13, 14 Feb</h3><ol>${slots(st.groups.B,8)}</ol></div></div>${S.frozen?'':'<button class="btn ghost sm" data-act="psgroups">Regenerate groups</button>'}</div>`;
  h+=`<div class="card"><h2>Rounds</h2><p class="muted small">Fixture first, then its results. The next fixture opens when every result of the previous round is in. Real results will come from CricHeroes once the tournament starts.</p>`;
  KE.STAGES.forEach(sd=>{
    const gen=st.stages[sd.id],c=KE.canGenerate(st,sd.id),ms=st.matches.filter(m=>m.stage===sd.id),done=ms.filter(m=>m.status==='done').length;
    h+=`<div class="stage"><div class="t">${esc(sd.label)}<small>${gen?done+'/'+ms.length+' results':esc(c.reason||'')}</small></div>
    <button class="btn ${gen?'ghost':'gold'} sm" data-act="psgen" data-s="${sd.id}" ${c.ok?'':'disabled'}>${psStageLabel(sd,'fx')}</button>
    <button class="btn ${gen&&done<ms.length?'gold':'ghost'} sm" data-act="psres" data-s="${sd.id}" ${gen&&done<ms.length?'':'disabled'}>${psStageLabel(sd,'res')}</button></div>`;
  });
  h+='</div>';
  h+=`<div class="daytabs">${[1,2,3,4].map(d=>`<button class="dt${psDay===d?' on':''}" data-act="psday" data-d="${d}">Day ${d} · ${KE.fmtDate(st,d).slice(0,11)}</button>`).join('')}</div>`;
  const ms=st.matches.filter(m=>m.day===psDay);
  if(!ms.length)h+='<div class="card muted">No matches generated for this day yet.</div>';
  else{
    const starts=[...new Set(ms.map(m=>m.start))].sort((p,q)=>p-q);
    h+=`<div class="row small muted" style="margin-bottom:8px"><span class="gtag">${esc(gname(0))}</span><span class="gtag g1">${esc(gname(1))}</span><span class="tvb">✈ TRAVEL</span><span>= team that has to change ground</span></div>`;
    starts.forEach(s=>{h+=`<div class="slot"><div class="tm">${KE.clock12(st,s)}<small>to ${KE.clock12(st,s+KE.dur(st,psDay))}</small></div>${[0,1].map(g=>{const m=ms.find(x=>x.start===s&&x.ground===g);return m?mcard(m,st,psActions(m)):'<div class="muted small" style="padding:10px">—</div>';}).join('')}</div>`;});
  }
  h+=['A','B'].map(g=>{const rows=KE.standings(st,g);return `<div class="card"><h2>Group ${g} points table</h2><div class="scroll"><table class="tbl"><tr><th>#</th><th>Team</th><th class="num">P</th><th class="num">W</th><th class="num">Pts</th><th class="num">NRR</th></tr>${rows.map(r=>`<tr class="${r.pos<=4?'q':''}"><td>${r.pos}</td><td>${esc(KE.tname(st,r.id))}</td><td class="num">${r.p}</td><td class="num">${r.w}</td><td class="num"><b>${r.pts}</b></td><td class="num">${r.nrr>=0?'+':''}${r.nrr.toFixed(3)}</td></tr>`).join('')}</table></div></div>`;}).join('');
  h+=groundCard(st);
  return h+'</div>';
}
function psActions(m){
  const w=m.status==='done'?`<span class="chip done">${esc(m.result.winner)} won</span> <button class="btn ghost sm" data-act="psclr" data-n="${m.no}">Undo</button>`:`<button class="btn sm" data-act="pswin" data-n="${m.no}" data-w="${m.a}">${esc(m.a)} wins</button> <button class="btn sm" data-act="pswin" data-n="${m.no}" data-w="${m.b}">${esc(m.b)} wins</button>`;
  return w+` <button class="btn gold sm" data-act="psthumb" data-n="${m.no}">🖼 Thumbnail</button>`;
}
function psThumbModal(no){
  modal(`<h2>Match ${no} thumbnail (practice)</h2><div class="thumbwrap"><canvas id="tcm"></canvas></div><div class="row" style="margin-top:10px"><button class="btn gold" data-act="psthumbdl" data-n="${no}">⬇ Download PNG</button><button class="btn ghost" data-act="mclose">Close</button></div>`);
  setTimeout(()=>{const c=$('#tcm');if(c)renderThumb(c,no,PS);},0);
}
/* ---------- fetch / import ---------- */
function applyResults(list){
  let n=0,miss=[];
  list.forEach(r=>{
    const m=r.no?S.matches.find(x=>x.no===+r.no):S.matches.find(x=>x.status!=='done'&&((x.a===r.a&&x.b===r.b)||(x.a===r.b&&x.b===r.a)));
    if(!m||!r.winner||![m.a,m.b].includes(r.winner)){miss.push(r.no||(r.a+' v '+r.b));return;}
    try{KE.setResult(S,m.no,{winner:r.winner,ra:r.ra,oa:r.oa,rb:r.rb,ob:r.ob});n++;}catch(e){miss.push(m.no);}
  });
  save();render();toast(`${n} result(s) applied${miss.length?', skipped: '+miss.join(', '):''}`,miss.length&&!n);
}
const nameToId=nm=>{nm=String(nm||'').trim().toLowerCase();const t=S.teams.find(t=>t.name.toLowerCase()===nm||t.id.toLowerCase()===nm);return t&&t.id;};
/* ---------- events ---------- */
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-act]');if(!el)return;const a=el.dataset.act,n=+el.dataset.n;
  try{
  switch(a){
  case 'mclose':if(e.target===el||el.tagName==='BUTTON')closeModal();break;
  case 'view':view=el.dataset.v;render();break;
  case 'day':day=+el.dataset.d;render();break;
  case 'login':{const name=$('#ln').value.trim(),mobile=$('#lm').value.trim(),code=$('#lc')?$('#lc').value:'';
    if(!name||!/^\d{10}$/.test(mobile.replace(/\D/g,'').slice(-10)))return toast('Enter your name and a 10-digit mobile',1);
    if(CFG.API_URL){const j=await api('login',{name,mobile,code});session={name,mobile,token:j.token};await load();}
    else{if(demoCode()&&code!==demoCode())return toast('Wrong code',1);session={name,mobile,token:'demo'};}
    sessionStorage.setItem(LSS,JSON.stringify(session));render();break;}
  case 'logout':session=null;sessionStorage.removeItem(LSS);render();break;
  case 'spin':
    if(S.draw.groupsDone&&wheel.target)spin(id=>pickLot(id));else spin(id=>pickGroup(id));break;
  case 'quickdraw':
    if(S.draw.groupsDone&&wheel.target){while(wheel.queue.length){wheel.picks.push(wheel.queue.splice(rnd(wheel.queue.length),1)[0]);}const p=wheel.picks,g=wheel.target;S.lot[g]=[[p[0],p[1]],[p[2],p[3]],[p[4],p[5]],[p[6],p[7]]];wheel.target=null;wheel.picks=[];save();render();}
    else{const left=shuffle(S.teams.map(t=>t.id).filter(x=>!S.groups.A.includes(x)&&!S.groups.B.includes(x)));left.forEach(id=>(S.groups.A.length<8?S.groups.A:S.groups.B).push(id));S.draw.groupsDone=true;save();render();}break;
  case 'resetdraw':if(S.frozen)return toast('Groups are frozen. Unfreeze first.',1);if(S.matches.length)return toast('Fixtures already exist. Use Settings → Reset everything.',1);if(!confirm('Reset the group draw?'))return;S.groups={A:[],B:[]};S.draw={groupsDone:false,log:[]};S.lot={A:null,B:null};save();render();break;
  case 'startlot':wheel.target=el.dataset.g;wheel.queue=S.groups[wheel.target].slice();wheel.picks=[];render();break;
  case 'redolot':S.lot[el.dataset.g]=null;save();render();break;
  case 'gen':{const r=KE.generate(S,el.dataset.s);day=S.matches.find(m=>m.stage===el.dataset.s).day;save();render();toast(`${r.created.length} match(es) scheduled. Now create them in CricHeroes.`);break;}
  case 'created':KE.markCreated(S,n);save();render();break;
  case 'uncreate':KE.unmarkCreated(S,n);save();render();break;
  case 'result':resultModal(n);break;
  case 'saveresult':{const g=id=>$('#'+id).value.trim();const m=S.matches.find(x=>x.no===n);
    KE.setResult(S,n,{winner:g('rw'),ra:g('ra'),oa:g('oa'),rb:g('rb'),ob:g('ob'),endClock:g('rend'),so:$('#rso').checked});m.chUrl=g('rurl');save();closeModal();render();break;}
  case 'clearresult':KE.clearResult(S,n);save();closeModal();render();break;
  case 'csvimport':{const rows=$('#csvin').value.split(/\n/).map(l=>l.trim()).filter(Boolean).map(l=>l.split(',').map(x=>x.trim()));
    applyResults(rows.filter(r=>!/^match/i.test(r[0])).map(r=>({no:r[0],winner:nameToId(r[1])||r[1],ra:r[2],oa:r[3],rb:r[4],ob:r[5]})));break;}
  case 'fetchch':{if(!CFG.API_URL)return toast('Backend not linked yet. Use CSV import for now.',1);if(!S.settings.chUrl)return toast('Add the CricHeroes tournament link in Settings',1);
    toast('Fetching…');const j=await api('fetchCH',{url:S.settings.chUrl});applyResults((j.results||[]).map(r=>({a:nameToId(r.teamA),b:nameToId(r.teamB),winner:nameToId(r.winner),ra:r.runsA,oa:r.oversA,rb:r.runsB,ob:r.oversB})));break;}
  case 'dlthumb':dlCanvas($('#tc'),`KNPL7_Match_${thumbSel}.png`);break;
  case 'splogoclear':delete (S.sponsorRoles[el.dataset.k]||{}).img;save();render();break;
  case 'sppull':{if(!CFG.API_URL)return toast('Backend not linked yet',1);const j=await api('sponsors');Object.assign(S.sponsorRoles,j.roles||{});save();render();toast('Sponsor data pulled');break;}
  case 'gencodes':S.teams.forEach(t=>{if(!t.code)t.code=String(1000+rnd(9000));});save();render();break;
  case 'dlcodes':download('KNPL7_owner_codes.csv',csv([['Team','Owner','Code']].concat(S.teams.map(t=>[t.name,t.owner,t.code]))));break;
  case 'dlgroups':download('KNPL7_groups.csv',csv([['Group','Team','Owner']].concat(['A','B'].flatMap(g=>S.groups[g].map(id=>[g,KE.tname(S,id),KE.team(S,id).owner])))));break;
  case 'dlsched':download('KNPL7_schedule.csv',csv([['Match','Date','Start','End','Ground','Stage','Team A','Team B','Status','Winner']].concat(S.matches.slice().sort((a,b)=>a.no-b.no).map(m=>[m.no,S.settings.dates[m.day],KE.clock(S,m.start),KE.clock(S,m.end),gname(m.ground),KE.matchLabel(S,m),KE.tname(S,m.a),KE.tname(S,m.b),m.status,m.result?KE.tname(S,m.result.winner):'']))));break;
  case 'dlpoints':download('KNPL7_points.csv',csv([['Group','Pos','Team','P','W','L','Pts','NRR']].concat(['A','B'].flatMap(g=>KE.standings(S,g).map(r=>[g,r.pos,KE.tname(S,r.id),r.p,r.w,r.l,r.pts,r.nrr.toFixed(3)])))));break;
  case 'saveset':{const s=S.settings,v=id=>$('#'+id).value.trim();s.chUrl=v('s_ch');s.overs=+v('s_ov')||10;s.startTime=v('s_st');s.lastLight=v('s_ll');s.matchMinsDay={1:+v('s_mm')||85,2:+v('s_mm')||85,3:+v('s_m3')||80,4:+v('s_mm')||85};s.matchMins=s.matchMinsDay[1];s.maxChanges=+v('s_mc')||5;s.gapMins=+v('s_gap')||0;s.travelMins=+v('s_tr')||0;s.finalBreakMins=+v('s_fb')||0;save();toast('Saved');break;}
  case 'setcode':{const nc=$('#ac_new').value.trim(),mb=$('#ac_mob').value.trim();if(nc&&nc.length<6)return toast('Use at least 6 characters',1);
    if(!confirm(nc?'Protect committee login with this code? Share it only with authorised people.':'Open committee login to anyone with the link?'))return;
    if(CFG.API_URL){const j=await api('setCode',{newCode:nc,mobiles:mb});AUTH={codeRequired:!!j.codeRequired};}else{try{localStorage.setItem('knpl7_democode',nc);}catch(e){}}
    toast(nc?'Access code saved':'Login is open again');render();break;}
  case 'wipe':if(confirm('Erase the draw, fixtures and results?')&&prompt('Type RESET to confirm')==='RESET'){const keep={t:S.teams,sr:S.sponsorRoles,se:S.settings};S=KE.newState();S.teams=keep.t;S.sponsorRoles=keep.sr;S.settings=keep.se;save();render();}break;

  case 'chorder':{const g=el.dataset.g,names=$('#cho'+g).value.split(/\n/).map(x=>x.trim()).filter(Boolean),ids=names.map(nameToId);if(ids.length!==8||ids.some(x=>!x||!S.groups[g].includes(x)))return toast('Enter all 8 Group '+g+' teams by exact name',1);S.chOrder=S.chOrder||{};S.chOrder[g]={order:ids,done:KE.doneCount(S,g)};save();render();break;}
  case 'chclear':if(S.chOrder)delete S.chOrder[el.dataset.g];save();render();break;
  case 'psreset':if(confirm('Reset your practice simulation?')){PS=psNew();psDay=1;psSave();render();}break;
  case 'psgroups':{const ids=shuffle(S.teams.map(t=>t.id));PS=psNew();PS.groups={A:ids.slice(0,8),B:ids.slice(8)};PS.draw.groupsDone=true;psLot(PS);psSave();render();break;}
  case 'psgen':{const id=el.dataset.s,sd=KE.STAGES.find(s=>s.id===id);KE.generate(PS,id);psDay=PS.matches.find(m=>m.stage===id).day;psSave();render();break;}
  case 'psres':KE.simStage(PS,el.dataset.s,STR());psSave();render();break;
  case 'psday':psDay=+el.dataset.d;render();break;
  case 'pswin':{const m=PS.matches.find(x=>x.no===n),w=el.dataset.w,aw=w===m.a;KE.setResult(PS,n,{winner:w,ra:aw?100:90,oa:'10',rb:aw?90:100,ob:'10'});psSave();render();break;}
  case 'psclr':KE.clearResult(PS,n);psSave();render();break;
  case 'psthumb':psThumbModal(n);break;
  case 'psthumbdl':dlCanvas($('#tcm'),`KNPL7_Practice_Match_${n}.png`);break;
  case 'freeze':if(!S.draw.groupsDone)return;if(!confirm('Freeze the groups? Practice simulations will start using them.'))return;S.frozen=true;save();render();break;
  case 'unfreeze':if(S.matches.length)return toast('Fixtures exist. Reset everything in Settings first.',1);if(confirm('Unfreeze the groups?')){S.frozen=false;save();render();}break;
  case 'start':if(!confirm('Mark the tournament as started? Results will then come from CricHeroes.'))return;S.started=true;S.frozen=true;save();render();break;
  case 'unstart':if(confirm('Undo tournament started?')){S.started=false;save();render();}break;
  case 'spfin':S.sponsorsFinal=el.checked;save();break;
  case 'simnew':SIM=simNew();simBatch=null;simDay=1;render();break;
  case 'simnext':if(!simNextStage())toast('Tournament complete');render();break;
  case 'simall':{let g=0;while(simNextStage()&&g++<20);render();break;}
  case 'simgen':{KE.generate(SIM,el.dataset.s);simDay=SIM.matches.find(m=>m.stage===el.dataset.s).day;render();break;}
  case 'simrand':KE.simStage(SIM,el.dataset.s,STR());render();break;
  case 'simday':simDay=+el.dataset.d;render();break;
  case 'simwin':{const m=SIM.matches.find(x=>x.no===n),w=el.dataset.w,aw=w===m.a;KE.setResult(SIM,n,{winner:w,ra:aw?100:90,oa:'10',rb:aw?90:100,ob:'10'});render();break;}
  case 'simclr':KE.clearResult(SIM,n);render();break;
  case 'simbatch':simBatchRun(+$('#simn').value);break;
  /* youtube */
  case 'ytgo':{const nm=$('#yn').value.trim(),mb=$('#ym').value.replace(/\D/g,'').slice(-10);if(!nm||mb.length!==10)return toast('Enter your name and a 10-digit mobile',1);yt.name=nm;yt.mobile=mb;yt.ok=true;render();break;}
  case 'ytg':yt.ground=+el.dataset.g;yt.match=null;render();break;
  case 'ytback':yt.ground=null;yt.match=null;render();break;
  case 'ytm':yt.match=n;render();setTimeout(()=>{const c=$('#tc');if(c)renderThumb(c,n);},0);break;
  case 'ytdl':{const m=S.matches.find(x=>x.no===yt.match);dlCanvas($('#tc'),`KNPL7_Match_${m.no}.png`);const rec={t:Date.now(),name:yt.name,mobile:yt.mobile,match:`Match ${m.no} ${KE.tname(S,m.a)} v ${KE.tname(S,m.b)}`};
    S.downloads.push(rec);try{localStorage.setItem(LS,JSON.stringify(S));}catch(_){}if(CFG.API_URL)api('logDownload',{rec}).catch(()=>{});break;}
  /* team */
  case 'teamgo':{const id=$('#tt').value,code=$('#tc2').value.trim();if(CFG.API_URL){const j=await api('teamLogin',{team:id,code});tp.team=id;tp.data=j;}else{const t=KE.team(S,id);if(!t||!t.code||t.code!==code)return toast('Team or code incorrect',1);tp.team=id;tp.data=null;}render();break;}
  case 'teamout':tp.team=null;render();break;
  }}catch(err){toast(err.message||String(err),1);}
});
document.addEventListener('change',async e=>{
  const t=e.target;
  if(t.dataset.act==='tsel'){thumbSel=+t.value;previewSel();}
  if(t.dataset.splogo){const k=t.dataset.splogo;S.sponsorRoles[k]=S.sponsorRoles[k]||{};S.sponsorRoles[k].img=await shrink(t.files[0],400);save();render();}
  if(t.dataset.tlogo){KE.team(S,t.dataset.tlogo).logo=await shrink(t.files[0],300);save();render();}
  if(t.dataset.sp){const k=t.dataset.sp;S.sponsorRoles[k]=S.sponsorRoles[k]||{};S.sponsorRoles[k].name=t.value.trim();save();}
});
window.addEventListener('hashchange',render);
(async function init(){
  try{session=JSON.parse(sessionStorage.getItem(LSS));}catch(e){}
  if(CFG.API_URL){try{AUTH=await api('authInfo');}catch(e){}}
  await load();render();
  window.__KNPL={get S(){return S;},render};
})();
})();
