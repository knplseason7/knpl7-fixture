(function(){
'use strict';
const KE=window.KE,KT=window.KT,CFG=window.KNPL_CONFIG||{};
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let LANG=(function(){try{return localStorage.getItem('knpl7_lang')||'en';}catch(e){return 'en';}})();
const x=(en,ml)=>esc(LANG==='ml'&&ml?ml:en);
let S=null,view='draw',day=1,session=null,busy=false,AUTH={codeRequired:false};
const demoCode=()=>{try{return localStorage.getItem('knpl7_democode')||CFG.DEMO_COMMITTEE_CODE||'';}catch(e){return CFG.DEMO_COMMITTEE_CODE||'';}};
const LS='knpl7_state',LSS='knpl7_session';
const route=()=>{const h=location.hash;return h===''||h==='#'||h==='#/'?'sim':h.startsWith('#/yt')?'yt':h.startsWith('#/team')?'team':h.startsWith('#/sim')?'sim':h.startsWith('#/learn')?'learn':h.startsWith('#/admin')?'admin':'home';};

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
const logoOf=t=>t.logo||('assets/teams/'+t.id+'.png?v=3');
const crest=(id,big)=>{const t=KE.team(S,id)||{id,c1:'#444',c2:'#222'};const fb=`background:linear-gradient(135deg,${t.c1},${t.c2})`;return `<span class="crest${big?' big':''}" style="${fb}"><img src="${esc(logoOf(t))}" alt="${esc(t.id)}" loading="lazy" onerror="this.remove()"><em>${esc(t.id)}</em></span>`;};
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
  } else if(r==='yt'){tabs.innerHTML='';who.innerHTML='YouTube team';}
  else {const T=[['#/sim','Play','sim'],['#/learn','How it works','learn'],['#/team','My team','team']];
    tabs.innerHTML=T.map(t=>`<a class="tab${r===t[2]?' on':''}" href="${t[0]}" style="text-decoration:none">${t[1]}</a>`).join('');who.innerHTML=langSwitch();}
}
function langSwitch(){return `<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm ${LANG==='en'?'gold':'ghost'}" style="${LANG==='en'?'':'color:#e6d6b4;border-color:#e6d6b4'}" data-act="lang" data-l="en">English</button><button class="btn sm ${LANG==='ml'?'gold':'ghost'}" style="${LANG==='ml'?'':'color:#e6d6b4;border-color:#e6d6b4'}" data-act="lang" data-l="ml">മലയാളം</button></span>`;}
async function render(){
  shell();const r=route(),m=$('#main');
  if(r==='home'){m.innerHTML=homeView();return;}
  if(r==='learn'){m.innerHTML=learnView();return;}
  if(r==='sim'){m.innerHTML=psView();if(PS&&!PS.draw.groupsDone)setTimeout(drawWheel,0);return;}
  if(r==='yt')return m.innerHTML=ytView();
  if(r==='team'){m.innerHTML=teamView();if(tp.team&&tp.tab==='sim'&&PS&&!PS.draw.groupsDone)setTimeout(drawWheel,0);return;}
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
  const start=wheel.angle%(2*Math.PI),turns=5+rnd(3),end=target-turns*2*Math.PI,dur=inSim()?2200:3600,t0=performance.now();
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
  return `<div class="mc g${m.ground}${m.status==='done'?' done':''}${(m.travel||[]).length?' hastravel':''}${st.my&&(st.my===m.a||st.my===m.b)?' mine':''}"><div class="mc-top"><span class="no">Match ${m.no}</span><span class="gtag g${m.ground}">${esc(st.settings.grounds[m.ground])}</span><span class="chip ${m.status}">${m.status==='done'?'Result in':m.status==='created'?'In CricHeroes':'Planned'}</span></div>
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
  const logos={};await Promise.all(S.teams.map(async t=>{logos[t.id]=await KT.loadImg(logoOf(t));}));
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
  return `<div class="card"><h2>Share links</h2><div class="field"><label>Home page (share this one with everyone)</label><input readonly value="${esc(base)}" onclick="this.select()"></div><div class="field"><label>Committee login</label><input readonly value="${esc(base+'#/admin')}" onclick="this.select()"></div><div class="field"><label>YouTube streaming team</label><input readonly value="${esc(base+'#/yt')}" onclick="this.select()"></div><div class="field"><label>Practice simulation (committee and franchise owners)</label><input readonly value="${esc(base+'#/sim')}" onclick="this.select()"></div><div class="field"><label>Franchise owners</label><input readonly value="${esc(base+'#/team')}" onclick="this.select()"></div></div>
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
let tp={team:null,tab:'m'};
const inSim=()=>route()==='sim'||(route()==='team'&&tp.team&&tp.tab==='sim');
function teamView(){
  let h='<div class="pub">';
  if(!tp.team)h+=`<div class="card"><h2>Franchise owner page</h2><p class="muted small">${x('Choose your team and enter your owner code to see your matches, grounds, timings and results.','നിങ്ങളുടെ ടീം തിരഞ്ഞെടുത്ത് ഉടമയുടെ കോഡ് നൽകിയാൽ മത്സരങ്ങൾ, ഗ്രൗണ്ട്, സമയം, ഫലങ്ങൾ എന്നിവ കാണാം.')}</p><div class="field"><label>Team</label><select id="tt"><option value="">Select…</option>${S.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Owner code</label><input id="tc2" type="password"></div><button class="btn gold" data-act="teamgo">View</button></div>`;
  else{
    const id=tp.team,ms=S.matches.filter(m=>m.a===id||m.b===id).sort((a,b)=>a.day-b.day||a.start-b.start),g=S.groups.A.includes(id)?'A':'B';
    const row=S.draw.groupsDone?KE.standings(S,g).find(r=>r.id===id):null;
    const ttab=tp.tab||'m';
    const tabs=`<div class="tabs2" style="margin-top:0"><button class="t2${ttab==='m'?' on':''}" data-act="tptab" data-t="m">${x('My matches','എന്റെ മത്സരങ്ങൾ')}</button><button class="t2${ttab==='sim'?' on':''}" data-act="tptab" data-t="sim">▶ Practice simulation</button></div>`;
    if(ttab==='sim'){if(!PS||PS.sigf!==frozenSig())psLoad();return '<div class="pub" style="max-width:1040px">'+tabs+psView()+'</div>';}
    h+=tabs;
    h+=`<div class="card"><h2>${crest(id,1)} ${esc(KE.tname(S,id))}</h2><p class="muted small">${S.draw.groupsDone?'Group '+g:'Group not drawn yet'}${row?` · Position ${row.pos} · ${row.pts} pts · NRR ${row.nrr.toFixed(3)}`:''}</p><button class="btn ghost sm" data-act="teamout">Switch team</button></div>
    <div class="card"><h2>Matches</h2>${ms.length?ms.map(m=>{const opp=m.a===id?m.b:m.a;return `<div class="mrow" style="cursor:default"><div style="flex:1"><b>Match ${m.no}</b> · v ${esc(KE.tname(S,opp))}<div class="small muted">${KE.fmtDate(S,m.day).slice(0,11)} · ${KE.clock12(S,m.start)} · ${esc(gname(m.ground))}</div>${m.result?`<div class="small"><b>${m.result.winner===id?'Won':'Lost'}</b>${m.result.ra!==''&&m.result.ra!=null?` · ${esc(m.result.ra)}/${esc(m.result.oa||'')} v ${esc(m.result.rb)}/${esc(m.result.ob||'')}`:''}</div>`:''}</div><span class="chip ${m.status}">${m.status==='done'?'Result':'Scheduled'}</span></div>`;}).join(''):`<p class="muted">${x('Your schedule appears here once Round 1 is generated.','റൗണ്ട് 1 ഫിക്സ്ചർ വന്നാൽ നിങ്ങളുടെ മത്സരക്രമം ഇവിടെ കാണാം.')}</p>`}</div>`;
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
const PSKEY='knpl7_psim_v3';
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

const STAGE_HELP={
 'A-R1':['Round 1 pairs are drawn by lot. Win and you get 2 points. Everyone plays, so the ladder can start from Round 2.','റൗണ്ട് 1 ജോടികൾ നറുക്കെടുപ്പിലൂടെയാണ്. ജയിച്ചാൽ 2 പോയിന്റ്. എല്ലാവരും കളിക്കുന്നതിനാൽ ലാഡർ റൗണ്ട് 2 മുതൽ തുടങ്ങും.'],
 'A-R2':['The ladder begins. Teams are ranked by points (then net run rate). 1st plays 2nd, 3rd plays 4th, 5th plays 6th, 7th plays 8th.','ലാഡർ തുടങ്ങുന്നു. ടീമുകളെ പോയിന്റ് (പിന്നെ നെറ്റ് റൺ റേറ്റ്) അനുസരിച്ച് റാങ്ക് ചെയ്യും. 1-ാം സ്ഥാനം 2-ാമനോടും, 3-ാം സ്ഥാനം 4-ാമനോടും, 5-ാം സ്ഥാനം 6-ാമനോടും, 7-ാം സ്ഥാനം 8-ാമനോടും കളിക്കും.'],
 'A-R3':['Same ladder again on the updated table. If a pair has already met, the matches are shuffled inside the same half of the table.','പുതുക്കിയ പട്ടിക അനുസരിച്ച് വീണ്ടും ലാഡർ. ഒരു ജോടി നേരത്തെ കളിച്ചിട്ടുണ്ടെങ്കിൽ, പട്ടികയുടെ അതേ പകുതിക്കുള്ളിൽ മത്സരങ്ങൾ മാറ്റിയിടും.'],
 'B-R1':['Group B plays on Friday. Round 1 is drawn by lot, just like Group A.','ഗ്രൂപ്പ് B വെള്ളിയാഴ്ച കളിക്കും. ഗ്രൂപ്പ് A പോലെ റൗണ്ട് 1 നറുക്കെടുപ്പിലൂടെയാണ്.'],
 'B-R2':['The ladder for Group B: rank by points then net run rate, then 1v2, 3v4, 5v6, 7v8.','ഗ്രൂപ്പ് B യുടെ ലാഡർ: പോയിന്റ്, പിന്നെ നെറ്റ് റൺ റേറ്റ് അനുസരിച്ച് റാങ്ക്; തുടർന്ന് 1-2, 3-4, 5-6, 7-8.'],
 'B-R3':['Group B Round 3: no repeat opponents if it can be avoided.','ഗ്രൂപ്പ് B റൗണ്ട് 3: സാധ്യമെങ്കിൽ എതിരാളികൾ ആവർത്തിക്കില്ല.'],
 'R4':['Saturday: both groups play Round 4 on the table so far. Top half meets top half, bottom half meets bottom half.','ശനിയാഴ്ച: ഇതുവരെയുള്ള പട്ടിക അനുസരിച്ച് രണ്ട് ഗ്രൂപ്പും റൗണ്ട് 4 കളിക്കും. മുകളിലെ പകുതി മുകളിലെ പകുതിയോടും, താഴത്തെ പകുതി താഴത്തെ പകുതിയോടും കളിക്കും.'],
 'R5':['The last league round. The final table decides who qualifies. The 8th placed team plays on Sunday morning.','ലീഗിലെ അവസാന റൗണ്ട്. അവസാന പട്ടിക ആരൊക്കെ യോഗ്യത നേടും എന്ന് തീരുമാനിക്കും. 8-ാം സ്ഥാനത്തുള്ള ടീം ഞായറാഴ്ച രാവിലെ കളിക്കും.'],
 'QF':['The top 4 of each group qualify. Quarter-finals cross the groups: A1 v B4, A2 v B3, B1 v A4, B2 v A3.','ഓരോ ഗ്രൂപ്പിലെയും മികച്ച 4 ടീമുകൾ യോഗ്യത നേടും. ക്വാർട്ടർ ഫൈനലിൽ ഗ്രൂപ്പുകൾ പരസ്പരം കളിക്കും: A1-B4, A2-B3, B1-A4, B2-A3.'],
 'SF':['Semi-finals: winner of QF1 plays winner of QF4, winner of QF2 plays winner of QF3.','സെമി ഫൈനൽ: QF1 വിജയി QF4 വിജയിയോടും, QF2 വിജയി QF3 വിജയിയോടും കളിക്കും.'],
 'F':['The Grand Final is at FISAT after a 45 minute break. If a finalist is at the other ground, that is when it travels.','45 മിനിറ്റ് ഇടവേളയ്ക്കു ശേഷം ഗ്രാൻഡ് ഫൈനൽ ഫിസാറ്റിൽ നടക്കും. ഫൈനലിസ്റ്റ് മറ്റേ ഗ്രൗണ്ടിലായിരുന്നെങ്കിൽ ആ സമയത്താണ് യാത്ര ചെയ്യേണ്ടത്.']
};
const baseName=sd=>sd.label.replace(' · both groups','');
/* ---------- simple game-style practice simulation ---------- */
const PSTEPS=[
 {id:'R1',name:'Round 1',stages:['A-R1','B-R1']},{id:'R2',name:'Round 2',stages:['A-R2','B-R2']},{id:'R3',name:'Round 3',stages:['A-R3','B-R3']},
 {id:'R4',name:'Round 4',stages:['R4']},{id:'R5',name:'Round 5',stages:['R5']},{id:'QF',name:'Quarter-finals',stages:['QF']},{id:'SF',name:'Semi-finals',stages:['SF']},{id:'F',name:'Final',stages:['F']}];
const stDone=(st,sd)=>sd.stages.every(s=>KE.stageDone(st,s));
const stGen=(st,sd)=>sd.stages.every(s=>st.stages[s]);
function psSteps(st){return [{id:'G',label:'Groups',done:st.draw.groupsDone}].concat(PSTEPS.map(sd=>({id:sd.id,label:sd.name.replace('Quarter-finals','Quarter-finals').replace('Semi-finals','Semi-finals'),done:stDone(st,sd)})));}
function psNextStep(st){
  if(!st.draw.groupsDone)return null;
  for(const sd of PSTEPS){
    if(stDone(st,sd))continue;
    if(!stGen(st,sd)){const ok=sd.stages.every(s=>st.stages[s]||KE.canGenerate(st,s).ok);if(ok)return {kind:'gen',act:'psgen',s:sd.id,sd,label:'⚡ Generate '+sd.name+' fixture'};return null;}
    return {kind:'play',act:'psres',s:sd.id,sd,label:'▶ Play '+sd.name+' (auto results)'};
  }
  return null;
}
function psPlay(st,stageId){
  const str=STR();
  st.matches.filter(m=>m.stage===stageId&&m.status!=='done').forEach(m=>{
    let r=KE.simResult(st,m,str);
    if(st.my&&(m.a===st.my||m.b===st.my)&&r.winner!==st.my){const base=95+rnd(30),aw=st.my===m.a;r={winner:st.my,ra:aw?base+8:base-8,oa:'10',rb:aw?base-8:base+8,ob:'10',sim:true};}
    KE.setResult(st,m.no,r);
  });
}
function psPick(id){
  const a=PS.groups.A,b=PS.groups.B;(a.length<8?a:b).push(id);
  if(a.length+b.length===16){PS.draw.groupsDone=true;psLot(PS);}
  psSave();render();
}
function psPosMap(st){const o={};['A','B'].forEach(g=>{if(!st.groups[g].length)return;o[g]={};KE.standings(st,g).forEach(r=>o[g][r.id]=r.pos);});return o;}
function psLiveDay(st){const p=st.matches.filter(m=>m.status!=='done').sort((a,b)=>a.day-b.day||a.start-b.start)[0];if(p)return p.day;const all=st.matches.slice().sort((a,b)=>b.day-a.day)[0];return all?all.day:1;}
const gshort=(st,g)=>String(st.settings.grounds[g]).split(' ')[0].toUpperCase();
const short=(m)=>m?(m.kind==='league'?'Round '+m.round+(m.day>=3?' · Grp '+m.group:''):m.kind==='Final'?'FINAL':m.label):'';
const ordn=n=>n+(['st','nd','rd'][n-1]||'th');
function ladderCap(st,m){
  if(m.kind!=='league')return '';
  if(m.round===1)return `🎲 ${x('Drawn by lot','നറുക്കെടുപ്പ്')}`;
  const sn=(st.snap||{})[m.stage];if(!sn||!sn[m.group])return '';
  const pa=sn[m.group][m.a],pb=sn[m.group][m.b];if(!pa||!pb)return '';
  const lo=Math.min(pa,pb),hi=Math.max(pa,pb),std=lo%2===1&&hi===lo+1;
  return `🪜 ${ordn(lo)} v ${ordn(hi)}${std?'':' · '+x('shuffled, already met','മാറ്റിയിട്ടു, നേരത്തെ കളിച്ചു')}`;
}
function mcx(st,r){
  const m=r.match,mine=m&&st.my&&(m.a===st.my||m.b===st.my),cls=!m?'blank':m.status==='done'?'done':'live';
  const team=id=>{
    if(!id)return `<div class="tb"><span class="crest big q">?</span><b>?</b></div>`;
    const w=m.result&&m.result.winner===id,l=m.result&&!w,me=id===st.my,tv=(m.travel||[]).some(t=>t.team===id);
    return `<div class="tb${w?' win':''}${l?' lose':''}${me?' me':''}${tv?' tv':''}">${w?'<span class="crown">👑</span>':''}${crest(id,true)}<b>${me?'⭐ ':''}${esc(KE.tname(st,id))}</b>${tv?'<span class="tvb">✈ TRAVEL</span>':''}</div>`;
  };
  const dl=m&&m.delay>0;
  const when=dl?`<s class="was">${KE.clock12(st,m.plan)}</s> → <b class="chg">${KE.clock12(st,m.start)}</b> <small class="late">+${m.delay} min</small>`:KE.clock12(st,m?m.start:r.start);
  const trv=m?(m.travel||[]).map(t=>{const pm=st.matches.find(q=>q.no===t.prevNo)||prevInfo(st,m,t.team),pe=pm?KE.clock12(st,pm.end):'';
    return `<div class="trbar${t.team===st.my?' me':''}">✈ <b>${esc(KE.tname(st,t.team))}</b> ${x('travels from','യാത്ര ചെയ്യണം:')} ${esc(gshort(st,t.from))}${pe?` · ${x('last match ended','കഴിഞ്ഞ മത്സരം തീർന്നത്')} <b>${pe}</b>`:''}${t.delay?`<div class="trchg">⏱ ${x('Start moved '+KE.clock12(st,m.plan)+' → '+KE.clock12(st,m.start)+' (30 min ground-change time)',KE.clock12(st,m.plan)+' → '+KE.clock12(st,m.start)+' ആയി മാറ്റി (30 മിനിറ്റ് ഗ്രൗണ്ട് മാറ്റ സമയം)')}</div>`:''}</div>`;}).join(''):'';
  const cap=m?ladderCap(st,m):'';
  return `<div class="mcx ${cls}${mine?' mine':''}${dl?' timechg':''}${m&&(st.fresh||[]).includes(m.no)?' fresh':''}"><div class="mh"><span class="n">#${r.no}</span><span class="gtag g${r.ground}">${esc(gshort(st,r.ground))}</span><span class="rdl">${m?esc(short(m)):esc(r.roundName)}</span>${m?`<button class="ico" title="Thumbnail" data-act="psthumb" data-n="${m.no}">🖼</button>`:''}</div>
  <div class="vsr">${team(m&&m.a)}<span class="vsb">VS</span>${team(m&&m.b)}</div>
  ${m?`<div class="mf"><span class="wh">🕒 ${when}</span>${cap?`<span class="cap">${cap}</span>`:''}</div>`:`<div class="mf"><span>🕒 ~${KE.clock12(st,r.start)}</span><span class="cap">🔒 ${x('opens when this round is generated','ഈ റൗണ്ട് ഉണ്ടാക്കുമ്പോൾ തുറക്കും')}</span></div>`}${trv}</div>`;
}
function fxTable(st,day){
  const rows=KE.grid(st).filter(r=>r.day===day),by=[];
  rows.forEach(r=>{let g=by[by.length-1];if(!g||g.sid!==r.stage){g={sid:r.stage,slots:[]};by.push(g);}let sl=g.slots[g.slots.length-1];if(!sl||sl.slot!==r.slot){sl={slot:r.slot,rows:[]};g.slots.push(sl);}sl.rows.push(r);});
  const head=(sid,done,ms)=>{const sd=KE.STAGES.find(q=>q.id===sid),stat=!ms.length?`<span class="chip lock">🔒 ${x('Not generated yet','ഇതുവരെ ഉണ്ടാക്കിയിട്ടില്ല')}</span>`:done?`<span class="chip done">✓ ${x('Completed (tap to see)','കഴിഞ്ഞു (കാണാൻ അമർത്തൂ)')}</span>`:`<span class="chip ready">● ${x('Live','ലൈവ്')}</span>`;return `<b>${esc(KE.STAGE_NAME[sid])}${sd.group?' · Group '+sd.group:''}</b>${stat}`;};
  return '<div class="lvls">'+by.map(g=>{
    const ms=st.matches.filter(m=>m.stage===g.sid),done=ms.length&&ms.every(m=>m.status==='done');
    const cards=g.slots.map(sl=>`<div class="slotg">${sl.rows.map(r=>mcx(st,r)).join('')}</div>`).join('');
    return done?`<details class="lvl donegrp"><summary class="lvl-h">${head(g.sid,true,ms)}</summary>${cards}</details>`:`<div class="lvl"><div class="lvl-h">${head(g.sid,false,ms)}</div>${cards}</div>`;
  }).join('')+'</div>';
}
/* ---------- followed team: ladder journey + PDF report ---------- */
const myGroup=st=>st.my?(st.groups.A.includes(st.my)?'A':st.groups.B.includes(st.my)?'B':null):null;
const LGR=['R1','R2','R3','R4','R5'];
function journeyView(st){
  const g=myGroup(st);if(!g)return '';
  const hist=st.hist||{},pos=LGR.map(id=>hist[id]&&hist[id][g]?hist[id][g][st.my]:null),py=p=>18+(p-1)*(100/7),px=i=>46+i*58;
  let svg=`<svg viewBox="0 0 340 158" class="jsvg"><rect x="30" y="${py(1)-12}" width="300" height="${py(4)-py(1)+24}" rx="8" fill="#e1f2e7"/>`;
  [1,4,8].forEach(p=>svg+=`<text x="4" y="${py(p)+4}" font-size="10" fill="#6f6366">${ordn(p)}</text>`);
  LGR.forEach((id,i)=>svg+=`<text x="${px(i)}" y="152" font-size="10" text-anchor="middle" fill="#6f6366">${id}</text>`);
  const pts=pos.map((p,i)=>p?[px(i),py(p),p]:null).filter(Boolean);
  if(pts.length>1)svg+=`<polyline points="${pts.map(q=>q[0]+','+q[1]).join(' ')}" fill="none" stroke="#6b3fb0" stroke-width="3" stroke-linejoin="round"/>`;
  pts.forEach(q=>svg+=`<circle cx="${q[0]}" cy="${q[1]}" r="11" fill="#6b3fb0"/><text x="${q[0]}" y="${q[1]+4}" font-size="11" font-weight="700" text-anchor="middle" fill="#fff">${q[2]}</text>`);
  svg+='</svg>';
  const last=[...pos].reverse().find(Boolean),ko=['QF','SF','Final'].map(k=>{const m=st.matches.find(q=>(q.kind===k||q.label&&q.label.startsWith(k))&&(q.a===st.my||q.b===st.my));return m?{k,m}:null;}).filter(Boolean);
  const fin=st.matches.find(m=>m.kind==='Final'&&m.status==='done'&&m.result.winner===st.my);
  const ms=st.matches.filter(m=>m.a===st.my||m.b===st.my).sort((a,b)=>a.day-b.day||a.start-b.start);
  let h=`<div class="card"><h2>${crest(st.my)} ${esc(KE.tname(st,st.my))} · ${x('Ladder journey','ലാഡർ യാത്ര')}</h2><p class="muted small">${x('This line shows where your team stood on the ladder after each round. The green band is the top 4, the quarter-final places.','ഓരോ റൗണ്ടിനു ശേഷവും ലാഡറിൽ നിങ്ങളുടെ ടീം എവിടെയായിരുന്നു എന്ന് ഈ രേഖ കാണിക്കുന്നു. പച്ച ഭാഗം ആദ്യ 4 സ്ഥാനങ്ങൾ (ക്വാർട്ടർ ഫൈനൽ).')}</p>${last?svg:`<p class="muted">${x('Play Round 1 to start your journey.','യാത്ര തുടങ്ങാൻ റൗണ്ട് 1 കളിക്കൂ.')}</p>`}
  ${ko.length||fin?`<div class="koRow">${['QF','SF','Final'].map(k=>{const f=ko.find(q=>q.k===k);const w=f&&f.m.result&&f.m.result.winner===st.my;return `<span class="chip ${f?(w?'done':'planned'):'lock'}">${k==='Final'?'Final':k}${f?(w?' ✓':' …'):''}</span>`;}).join('')}${fin?'<span class="chip ready">🏆 Champions</span>':''}</div>`:''}</div>`;
  h+=`<div class="card"><h2>${x('My matches','എന്റെ മത്സരങ്ങൾ')}</h2><div class="resl">${ms.length?ms.map(m=>{const opp=m.a===st.my?m.b:m.a,tv=(m.travel||[]).find(t=>t.team===st.my);return `<div class="rs"><div><div class="rs-t"><b>${esc(short(m))}</b> v ${esc(KE.tname(st,opp))}</div><div class="small muted">#${m.no} · ${KE.fmtDate(st,m.day).slice(0,11)} · ${KE.clock12(st,m.start)} · ${esc(gshort(st,m.ground))}${tv?` · <span class="trav">✈ ${x('travel from','യാത്ര:')} ${esc(gshort(st,tv.from))}${tv.delay?' (+'+tv.delay+' min)':''}</span>`:''}</div></div>${m.result?`<span class="chip ${m.result.winner===st.my?'done':'planned'}">${m.result.winner===st.my?'WON':'LOST'}</span>`:'<span class="chip created">Upcoming</span>'}</div>`;}).join(''):`<p class="muted">${x('Your matches appear as rounds are generated.','റൗണ്ടുകൾ ഉണ്ടാക്കുന്നതിനനുസരിച്ച് നിങ്ങളുടെ മത്സരങ്ങൾ ഇവിടെ കാണാം.')}</p>`}</div></div>`;
  return h;
}
/* ground changes per day, and how many were straight after the previous match */
function groundStats(st){
  const tr=st.settings.travelMins,days=[1,2,3,4].map(d=>({day:d,matches:st.matches.filter(m=>m.day===d).length,changes:0,b2bChanges:0,b2bSame:0})),ev=[];
  st.teams.forEach(t=>{for(let d=1;d<=4;d++){
    const seq=st.matches.filter(m=>m.day===d&&(m.a===t.id||m.b===t.id)).sort((a,b)=>a.start-b.start);
    for(let i=1;i<seq.length;i++){const a=seq[i-1],b=seq[i],rest=b.start-a.end,row=days[d-1];
      if(a.ground!==b.ground){row.changes++;const bb=rest<60&&b.kind!=='Final';if(bb)row.b2bChanges++;ev.push({day:d,no:b.no,team:t.id,from:a.ground,to:b.ground,rest,delay:b.delay||0,b2b:bb,kind:b.kind});}
      else if(rest<tr)row.b2bSame++;}
  }});
  return {days,ev:ev.sort((p,q)=>p.no-q.no)};
}
async function psPdf(){
  if(!window.PDFLib)return toast('PDF tool is still loading, try again in a moment',1);
  const st=PS;if(!st.matches.length)return toast('Generate and play a round first',1);
  const {PDFDocument,StandardFonts,rgb}=window.PDFLib,doc=await PDFDocument.create(),F=await doc.embedFont(StandardFonts.Helvetica),B=await doc.embedFont(StandardFonts.HelveticaBold);
  const PW=842,PH=595,M=36,CW=PW-2*M,san=s=>String(s==null?'':s).replace(/[^\x20-\x7E -ÿ]/g,'').replace(/·/g,'-');
  const C={maroon:rgb(.23,.06,.1),gold:rgb(.95,.71,.27),cream:rgb(1,.96,.86),grey:rgb(.45,.4,.4),line:rgb(.88,.84,.74),mine:rgb(.89,.84,.98),green:rgb(.88,.95,.9),red:rgb(.7,.12,.16),white:rgb(1,1,1),ink:rgb(.14,.1,.11),amber:rgb(1,.95,.82)};
  let page,y;
  const np=()=>{page=doc.addPage([PW,PH]);y=PH-M;};
  const need=h=>{if(y-h<M+14)np();};
  const fit=(s,w,sz,f)=>{s=san(s);if(f.widthOfTextAtSize(s,sz)<=w)return s;while(s.length>1&&f.widthOfTextAtSize(s+'..',sz)>w)s=s.slice(0,-1);return s+'..';};
  const T=(s,x0,y0,o)=>{o=o||{};page.drawText(san(s),{x:x0,y:y0,size:o.size||9,font:o.bold?B:F,color:o.color||C.ink});};
  const H=(s,sub)=>{need(40);y-=8;T(s,M,y-14,{size:14,bold:1,color:C.maroon});if(sub)T(sub,M,y-27,{size:8.5,color:C.grey});y-=(sub?36:24);};
  const table=(cols,rows,o)=>{
    o=o||{};const rh=o.rh||15,sz=o.size||8.5,tw=cols.reduce((a,c)=>a+c.w,0);
    const head=()=>{need(rh*2);page.drawRectangle({x:M,y:y-rh,width:tw,height:rh,color:C.maroon});let cx=M;cols.forEach(c=>{const hh=fit(c.h,c.w-8,sz,B);page.drawText(hh,{x:c.r?cx+c.w-4-B.widthOfTextAtSize(hh,sz):cx+4,y:y-rh+4.5,size:sz,font:B,color:C.cream});cx+=c.w;});y-=rh;};
    head();
    rows.forEach(r=>{if(y-rh<M+14){np();head();}
      if(r.fill)page.drawRectangle({x:M,y:y-rh,width:tw,height:rh,color:r.fill});
      page.drawLine({start:{x:M,y:y-rh},end:{x:M+tw,y:y-rh},thickness:.4,color:C.line});
      let cx=M;cols.forEach((c,i)=>{const v=r.c[i],cell=(v&&typeof v==='object')?v:{t:v};const f=(r.bold||cell.bold)?B:F;const txt=fit(cell.t,c.w-8,sz,f),tx=c.r?cx+c.w-4-f.widthOfTextAtSize(txt,sz):cx+4;
        if(cell.fill)page.drawRectangle({x:cx+1,y:y-rh+1,width:c.w-2,height:rh-2,color:cell.fill});
        page.drawText(txt,{x:tx,y:y-rh+4.5,size:sz,font:f,color:cell.color||C.ink});cx+=c.w;});
      y-=rh;});
    y-=8;
  };
  const mt=id=>KE.tname(st,id),gs=g=>gshort(st,g),my=st.my,mine=m=>my&&(m.a===my||m.b===my);
  /* title */
  np();page.drawRectangle({x:0,y:PH-64,width:PW,height:64,color:C.maroon});
  T('KNPL-7 Dynamic Ladder - Practice Simulation',M,PH-30,{size:20,bold:1,color:C.gold});
  T('Practice results only. Not the real tournament.  Generated '+new Date().toLocaleString('en-GB'),M,PH-50,{size:9,color:C.cream});y=PH-64-14;
  const fin=st.matches.find(m=>m.kind==='Final'&&m.status==='done'),g0=myGroup(st);
  if(fin){need(30);page.drawRectangle({x:M,y:y-26,width:CW,height:26,color:C.gold});T('Champions: '+mt(fin.result.winner)+(fin.result.winner===my?'   (the team you followed!)':''),M+10,y-18,{size:13,bold:1,color:C.maroon});y-=34;}
  if(my){need(26);page.drawRectangle({x:M,y:y-22,width:CW,height:22,color:C.mine});T('Team followed: '+mt(my)+(g0?' (Group '+g0+')':'')+'.  Rows of this team are shaded purple in every table.',M+8,y-15,{size:10,bold:1,color:rgb(.36,.18,.63)});y-=30;}
  /* ground change summary */
  const gst=groundStats(st),tot=gst.days.reduce((a,d)=>({m:a.m+d.matches,c:a.c+d.changes,b:a.b+d.b2bChanges,s:a.s+d.b2bSame}),{m:0,c:0,b:0,s:0});
  H('1. Ground changes by day','A ground change = a team plays its next match of the day at the other ground. Back-to-back = it starts right after its last match, so it gets '+st.settings.travelMins+' minutes of ground-change time.');
  table([{h:'Day',w:50},{h:'Date',w:130},{h:'Matches',w:70,r:1},{h:'Ground changes',w:110,r:1},{h:'Of which back-to-back',w:140,r:1},{h:'Back-to-back, same ground',w:160,r:1}],
    gst.days.map(d=>({c:['Day '+d.day,KE.fmtDate(st,d.day),d.matches,d.changes,d.b2bChanges,d.b2bSame]})).concat([{c:['Total','',tot.m,tot.c,tot.b,tot.s],bold:1,fill:C.amber}]),{rh:16});
  if(gst.ev.length){
    H('Every ground change','Match number is the match the team travels for.');
    table([{h:'Day',w:36},{h:'Match',w:44},{h:'Team',w:190},{h:'From',w:70},{h:'To',w:70},{h:'Rest before (min)',w:100,r:1},{h:'Start delayed (min)',w:110,r:1},{h:'Back-to-back?',w:100}],
      gst.ev.map(e=>({fill:e.team===my?C.mine:(e.b2b?C.amber:null),c:[e.day,'#'+e.no,mt(e.team),gs(e.from),gs(e.to),e.rest,e.delay?'+'+e.delay:'0',e.b2b?'Yes':(e.kind==='Final'?'No (final break)':'No')]})),{rh:14,size:8});
  }
  /* journey */
  if(my&&g0){
    const mm=st.matches.filter(mine).sort((a,b)=>a.day-b.day||a.start-b.start),hist=st.hist||{};
    H('2. Journey of '+mt(my),'Ladder position of the team after each league round, then its matches.');
    table([{h:'After',w:80},{h:'Ladder position (Group '+g0+')',w:180}].concat([]),LGR.filter(id=>hist[id]&&hist[id][g0]).map(id=>({c:[id.replace('R','Round '),ordn(hist[id][g0][my])+' of 8'+(hist[id][g0][my]<=4?'  (in the top 4)':'')],fill:hist[id][g0][my]<=4?C.green:null})),{rh:15});
    table([{h:'#',w:34},{h:'Round',w:90},{h:'Opponent',w:200},{h:'Result',w:60},{h:'Day / time',w:130},{h:'Ground',w:70},{h:'Travel',w:170}],
      mm.map(m=>{const o=m.a===my?m.b:m.a,tv=(m.travel||[]).find(t=>t.team===my);return {c:['#'+m.no,short(m),mt(o),m.result?(m.result.winner===my?'WON':'LOST'):'-','Day '+m.day+' '+KE.clock12(st,m.start),gs(m.ground),tv?'from '+gs(tv.from)+(tv.delay?' (+'+tv.delay+' min)':''):'-'],fill:m.result&&m.result.winner===my?C.green:null};}),{rh:15});
  }
  /* ladder movement */
  H((my?'3':'2')+'. Ladder movement','Position of each team after each league round. Green = top 4 (quarter-final places).');
  ['A','B'].forEach(g=>{
    const fin5=(hist=>hist.R5&&hist.R5[g]||null)(st.hist||{}),order=fin5?Object.keys(fin5).sort((a,b)=>fin5[a]-fin5[b]):KE.standings(st,g).map(r=>r.id),pts={};KE.standings(st,g).forEach(r=>pts[r.id]=r);
    const done=LGR.filter(id=>(st.hist||{})[id]&&st.hist[id][g]);
    if(!done.length)return;
    table([{h:'Group '+g+' - Team',w:200}].concat(done.map(id=>({h:id.replace('R','Round '),w:70,r:1}))).concat([{h:'Pts',w:50,r:1},{h:'W',w:40,r:1},{h:'NRR',w:60,r:1}]),
      order.map(id=>{const p=pts[id]||{};return {fill:id===my?C.mine:null,c:[mt(id)].concat(done.map(h=>{const v=st.hist[h][g][id];return {t:ordn(v),fill:id===my?null:(v<=4?C.green:null)};})).concat([p.pts,p.w,(p.nrr>=0?'+':'')+(p.nrr||0).toFixed(2)])};}),{rh:14.5,size:8.5});
  });
  /* all matches */
  H((my?'4':'3')+'. All matches and results','Winner is marked (W). Travel shows the team that changed ground and where it came from.');
  [1,2,3,4].forEach(d=>{
    const ms=st.matches.filter(m=>m.day===d).sort((a,b)=>a.no-b.no);if(!ms.length)return;
    need(30);T('Day '+d+' - '+KE.fmtDate(st,d),M,y-11,{size:10,bold:1,color:C.maroon});y-=16;
    table([{h:'#',w:30},{h:'Time',w:56},{h:'Ground',w:60},{h:'Round',w:84},{h:'Match',w:238},{h:'Winner',w:120},{h:'Score',w:62},{h:'Travel',w:122}],
      ms.map(m=>{const w=m.result&&m.result.winner,tv=(m.travel||[]).map(t=>mt(t.team)+' from '+gs(t.from)+(t.delay?' +'+t.delay:'')).join('; ');
        return {fill:mine(m)?C.mine:null,c:['#'+m.no,KE.clock12(st,m.start)+(m.delay?'*':''),gs(m.ground),short(m),mt(m.a)+' v '+mt(m.b),w?mt(w)+' (W)':'-',m.result&&m.result.ra!==''&&m.result.ra!=null?m.result.ra+' v '+m.result.rb:'-',tv||'-'],bold:0};}),{rh:14.5,size:8});
  });
  T('* start time moved later because the team had just played at the other ground (ground change time).',M,y-8,{size:8,color:C.grey});
  doc.getPages().forEach((p,i,a)=>p.drawText('KNPL-7 Fixture Centre - practice simulation   |   page '+(i+1)+' of '+a.length,{x:M,y:18,size:8,font:F,color:C.grey}));
  const bytes=await doc.save(),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));a.download='KNPL7_Practice_Simulation'+(my?'_'+mt(my).replace(/\W+/g,'_'):'')+'.pdf';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);
  toast('PDF downloaded');
}
function resultsList(st){
  const ds=st.matches.filter(m=>m.status==='done').sort((a,b)=>b.day-a.day||b.start-a.start||b.no-a.no);
  if(!ds.length)return `<div class="card muted">${x('No results yet. Play a round first.','ഫലങ്ങൾ ഇതുവരെ ഇല്ല. ആദ്യം ഒരു റൗണ്ട് കളിക്കൂ.')}</div>`;
  return `<div class="card"><div class="resl">${ds.map(m=>{const w=m.result.winner,l=w===m.a?m.b:m.a,r=m.result,mine=st.my&&(m.a===st.my||m.b===st.my);
    return `<div class="rs${mine?' mine':''}"><div class="rs-t"><b>${w===st.my?'⭐ ':''}${esc(KE.tname(st,w))}</b> <span class="muted">beat</span> ${l===st.my?'⭐ ':''}${esc(KE.tname(st,l))}</div><div class="small muted">#${m.no} · ${esc(short(m))} · ${KE.fmtDate(st,m.day).slice(0,11)} · ${KE.clock12(st,m.start)} · ${esc(st.settings.grounds[m.ground])}${r.ra!==''&&r.ra!=null?` · ${esc(r.ra)} v ${esc(r.rb)}`:''}</div><button class="ico" data-act="psthumb" data-n="${m.no}" title="Thumbnail">🖼</button></div>`;}).join('')}</div></div>`;
}
function ladderView(st){
  const L=st.ladder||null;let h='';
  if(L){h+=`<div class="banner ok"><b>${esc(L.name)} ${x('results are in. The ladder has changed!','ഫലങ്ങൾ വന്നു. ലാഡർ മാറി!')}</b><br>${x('In the real tournament these results come automatically from CricHeroes and the ladder updates the same way.','യഥാർത്ഥ ടൂർണമെന്റിൽ ഈ ഫലങ്ങൾ CricHeroes-ൽ നിന്ന് ഓട്ടോമാറ്റിക്കായി വരും; ലാഡറും ഇതേപോലെ മാറും.')}</div>`;
    (st.news||[]).forEach(n=>{h+=`<div class="news">${newsText(n)}</div>`;});}
  h+=`<div class="ladders">`+['A','B'].map(g=>{const rows=KE.standings(st,g),bef=L&&L.before&&L.before[g]&&L.name!=='Round 1'?L.before[g]:null;
    return `<div class="card"><h2>Group ${g} ladder</h2><div class="scroll"><table class="tbl"><tr><th>#</th><th></th><th>Team</th><th class="num">P</th><th class="num">W</th><th class="num">Pts</th><th class="num">NRR</th></tr>${rows.map(r=>{const mv=bef&&bef[r.id]?bef[r.id]-r.pos:0,me=r.id===st.my;
      return `<tr class="${r.pos<=4?'q':''}${me?' me':''}"><td>${r.pos}</td><td class="mv ${mv>0?'up':mv<0?'dn':''}">${mv>0?'▲'+mv:mv<0?'▼'+(-mv):''}</td><td><span class="row" style="flex-wrap:nowrap;gap:6px">${crest(r.id)}${me?'⭐ ':''}${esc(KE.tname(st,r.id))}</span></td><td class="num">${r.p}</td><td class="num">${r.w}</td><td class="num"><b>${r.pts}</b></td><td class="num">${r.nrr>=0?'+':''}${r.nrr.toFixed(2)}</td></tr>`;}).join('')}</table></div></div>`;}).join('')+`</div><p class="muted small">${x('Green rows are the top 4 and qualify for the quarter-finals. ▲▼ show the places moved since the last round.','പച്ച വരികൾ ആദ്യ 4 സ്ഥാനക്കാർ; അവർ ക്വാർട്ടർ ഫൈനലിൽ എത്തും. ▲▼ കഴിഞ്ഞ റൗണ്ടിനു ശേഷം മാറിയ സ്ഥാനം കാണിക്കുന്നു.')}</p>`;
  return h;
}
function newsText(n){
  if(n.t==='mine')return n.g?x(`⭐ ${n.team} beat ${n.opp} and are now ${n.pos}${['st','nd','rd'][n.pos-1]||'th'} in Group ${n.g}.`,`⭐ ${n.team} ${n.opp}-നെ തോൽപ്പിച്ചു; ഇപ്പോൾ ഗ്രൂപ്പ് ${n.g}-ൽ ${n.pos}-ാം സ്ഥാനത്ത്.`):x(`⭐ ${n.team} beat ${n.opp} and move on!`,`⭐ ${n.team} ${n.opp}-നെ തോൽപ്പിച്ച് മുന്നേറി!`);
  if(n.t==='upset')return x(`⚡ Upset: ${n.w} beat higher-placed ${n.l}.`,`⚡ അട്ടിമറി: ${n.w}, മുകളിലെ സ്ഥാനത്തുള്ള ${n.l}-നെ തോൽപ്പിച്ചു.`);
  if(n.t==='lead')return x(`Group ${n.g} leader: ${n.team} (${n.pts} pts)`,`ഗ്രൂപ്പ് ${n.g} മുന്നിൽ: ${n.team} (${n.pts} പോയിന്റ്)`);
  return '';
}
function psNews(st,sd,before){
  const out=[];const ms=st.matches.filter(m=>sd.stages.includes(m.stage));
  if(st.my){const m=ms.find(q=>q.a===st.my||q.b===st.my);if(m){const opp=m.a===st.my?m.b:m.a,g=m.kind==='league'?m.group:null,pos=g?(KE.standings(st,g).find(r=>r.id===st.my)||{}).pos:0;out.push({t:'mine',team:KE.tname(st,st.my),opp:KE.tname(st,opp),g,pos});}}
  const up=ms.find(m=>{if(m.kind!=='league'||!before[m.group])return false;const w=m.result.winner,l=w===m.a?m.b:m.a;return sd.id!=='R1'&&before[m.group][w]-before[m.group][l]>=3;});
  if(up){const w=up.result.winner,l=w===up.a?up.b:up.a;out.push({t:'upset',w:KE.tname(st,w),l:KE.tname(st,l)});}
  if(sd.stages.some(s=>/R/.test(s))&&sd.id!=='F')['A','B'].forEach(g=>{const r=KE.standings(st,g)[0];if(r&&r.p)out.push({t:'lead',g,team:KE.tname(st,r.id),pts:r.pts});});
  return out;
}
function psMyStrip(st){
  if(!st.my)return '';
  const ms=st.matches.filter(m=>m.a===st.my||m.b===st.my).sort((a,b)=>a.day-b.day||a.start-b.start),nx=ms.find(m=>m.status!=='done'),won=ms.filter(m=>m.status==='done').length;
  const fin=st.matches.find(m=>m.kind==='Final'&&m.status==='done'&&m.result.winner===st.my);
  let line;
  if(fin)line=`<b>${x('You did it! Champions!','നിങ്ങൾ ചാമ്പ്യന്മാർ!')}</b>`;
  else if(nx){const opp=nx.a===st.my?nx.b:nx.a,tv=(nx.travel||[]).find(t=>t.team===st.my);line=`<b>${x('Next','അടുത്തത്')}:</b> ${esc(short(nx))} v ${esc(KE.tname(st,opp))} · ${KE.fmtDate(st,nx.day).slice(0,11)} · ${KE.clock12(st,nx.start)} · ${esc(st.settings.grounds[nx.ground])}${tv?` <span class="tvb">✈ TRAVEL from ${esc(st.settings.grounds[tv.from])}</span>`:''}`;}
  else line=ms.length?x('Waiting for the next round to be generated.','അടുത്ത റൗണ്ട് ഉണ്ടാക്കാൻ കാത്തിരിക്കുന്നു.'):x('Your first match appears when Round 1 is generated.','റൗണ്ട് 1 ഫിക്സ്ചർ വരുമ്പോൾ നിങ്ങളുടെ ആദ്യ മത്സരം ഇവിടെ കാണാം.');
  return `<div class="mystrip">${crest(st.my)}<div><div class="small muted">⭐ ${esc(KE.tname(st,st.my))} · ${won} ${x('won','ജയം')}</div><div>${line}</div></div></div>`;
}
function psWheelCard(){
  const a=PS.groups.A,b=PS.groups.B,left=S.teams.map(t=>t.id).filter(i=>!a.includes(i)&&!b.includes(i));
  wheel.mode='ps';wheel.items=left;
  return `<div class="card"><h2>Step 1 · Draw the groups</h2><p class="muted small">${x('Spin the wheel. The first 8 teams go to Group A, the next 8 to Group B.','ചക്രം കറക്കൂ. ആദ്യത്തെ 8 ടീം ഗ്രൂപ്പ് A-യിലേക്ക്, അടുത്ത 8 ടീം ഗ്രൂപ്പ് B-യിലേക്ക്.')}</p>
  <div class="wheelbox"><div><canvas id="wheel" width="440" height="440"></canvas><div class="row" style="justify-content:center;margin-top:10px"><button class="btn gold big" data-act="spin" ${wheel.spinning||!left.length?'disabled':''}>🎡 Spin (${left.length} left)</button><button class="btn ghost sm" data-act="quickdraw" ${wheel.spinning||!left.length?'disabled':''}>Finish quickly</button></div></div>
  <div class="picks"><div><h3>Group A (${a.length}/8)</h3><ol>${slots(a,8)}</ol></div><div><h3>Group B (${b.length}/8)</h3><ol>${slots(b,8)}</ol></div></div></div></div>`;
}
function psView(){
  if(!PS||PS.sigf!==frozenSig())psLoad();
  const st=PS,nx=psNextStep(st);let h='<div class="pub game">';
  const fin=st.matches.find(m=>m.kind==='Final'&&m.status==='done');
  const sel=`<select id="psmy" data-act="psmy"><option value="">⭐ ${x('Follow my team (optional)','എന്റെ ടീം (ഓപ്ഷണൽ)')}</option>${S.teams.map(t=>`<option value="${t.id}" ${st.my===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>`;
  if(!st.draw.groupsDone)h+=`<div class="card top"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><h2 style="margin:0">${x('Practice mode','പ്രാക്ടീസ് മോഡ്')} <span class="chip ready">Not real</span></h2></div>
  <p class="muted small" style="margin:6px 0 10px">${x('Play the whole tournament in a few taps. Nothing here is real and nobody else can see it.','ഏതാനും ടാപ്പുകൾ കൊണ്ട് ടൂർണമെന്റ് മുഴുവൻ കളിച്ചു നോക്കൂ. ഇതൊന്നും യഥാർത്ഥമല്ല, മറ്റാരും ഇത് കാണില്ല.')}</p>
  ${sel}<p class="small muted" style="margin-top:6px">${x('Pick your team and it wins every match and lifts the trophy!','നിങ്ങളുടെ ടീമിനെ തിരഞ്ഞെടുത്താൽ അത് എല്ലാ കളിയും ജയിച്ച് കപ്പ് നേടും!')}</p></div>`;
  else h+=`<div class="row topbar" style="flex-wrap:nowrap;margin-bottom:10px">${sel}<button class="btn ghost sm" data-act="pspdf">⬇ PDF</button><button class="btn ghost sm" data-act="psreset">↺ Reset</button></div>`;
  if(!st.draw.groupsDone){return h+psWheelCard()+'</div>';}
  h+=`<div class="prog">${psSteps(st).map((s,i,arr)=>{const cur=!s.done&&(i===0||arr[i-1].done);return `<span class="${s.done?'done':cur?'cur':''}">${s.done?'✓ ':''}${esc(s.label)}</span>`;}).join('')}</div>`;
  if(fin){const w=fin.result.winner;h+=`<div class="champ">🏆 ${x(`${KE.tname(st,w)} are the CHAMPIONS!`,`${KE.tname(st,w)} ചാമ്പ്യന്മാർ!`)}${w===st.my?'<div class="small">⭐ '+x('Your team won it all!','നിങ്ങളുടെ ടീം കപ്പ് നേടി!')+'</div>':''}</div>`;}
  h+=psMyStrip(st);
  if(nx){const hp=STAGE_HELP[nx.sd.stages[0]];h+=`<div class="card coach"><h2>${nx.kind==='gen'?'Next: '+esc(nx.sd.name):esc(nx.sd.name)+': fixture ready'}</h2><p>${nx.kind==='gen'?x(...hp):x('Fixture is ready. Tap Play to get the results automatically. Then watch how the ladder changes.','ഫിക്സ്ചർ തയ്യാർ. Play അമർത്തിയാൽ ഫലങ്ങൾ ഓട്ടോമാറ്റിക്കായി വരും. എന്നിട്ട് ലാഡർ എങ്ങനെ മാറുന്നു എന്ന് കാണൂ.')}</p></div>`;}
  const tab=st.tab||'fx',day=st.day||psLiveDay(st);
  h+=`<div class="tabs2">${[['fx','Fixture'],['res','Results'],['lad','Ladder']].concat(st.my?[['me','My team']]:[]).map(t=>`<button class="t2${tab===t[0]?' on':''}" data-act="pstab" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>`;
  if(tab==='fx'){
    const live=psLiveDay(st);
    h+=`<div class="daytabs">${[1,2,3,4].map(d=>`<button class="dt${day===d?' on':''}" data-act="psday" data-d="${d}">${KE.fmtDate(st,d).slice(0,11)}${live===d&&st.matches.length?' •':''}</button>`).join('')}</div>`;
    h+=`<div class="small muted legend"><span class="tvb">✈ TRAVEL</span> ${x('= this team must change ground. If its last match just ended, its match starts 30 min after that (ground change time).','= ഈ ടീം ഗ്രൗണ്ട് മാറണം. അവസാന മത്സരം കഴിഞ്ഞ ഉടനെയാണെങ്കിൽ, 30 മിനിറ്റ് കഴിഞ്ഞേ ഈ മത്സരം തുടങ്ങൂ (ഗ്രൗണ്ട് മാറ്റ സമയം).')} <span class="muted">${x('Locked cards open when that round is generated. Times shown are reference times.','പൂട്ടിയ കാർഡുകൾ ആ റൗണ്ട് ഉണ്ടാക്കുമ്പോൾ തുറക്കും. കാണിച്ചിരിക്കുന്നത് സാധാരണ സമയമാണ്.')}</span></div>`;
    h+=fxTable(st,day);
  } else if(tab==='res')h+=resultsList(st); else if(tab==='me'&&st.my)h+=journeyView(st); else h+=ladderView(st);
  if(nx)h+=`<div class="fabbar"><button class="btn gold big" data-act="${nx.act}" data-s="${nx.s}">${esc(nx.label)}</button></div>`;
  else if(fin)h+=`<div class="fabbar"><button class="btn gold big" data-act="psreset">🔁 Play again</button></div>`;
  return h+'</div>';
}
function homeView(){
  return `<div class="pub" style="max-width:980px"><div class="hero"><h1>KNPL-7 Dynamic Ladder</h1><p>${x('Win and climb, lose and slide. Every match is against a team of similar strength.','ജയിച്ചാൽ മുകളിലേക്ക്, തോറ്റാൽ താഴേക്ക്. ഓരോ മത്സരവും ഏതാണ്ട് സമാന കരുത്തുള്ള ടീമിനോടാണ്.')}</p><p>${x('Learn how the league works in two minutes, then play the whole tournament yourself.','രണ്ട് മിനിറ്റിൽ ലീഗ് എങ്ങനെ പ്രവർത്തിക്കുന്നു എന്ന് മനസ്സിലാക്കൂ, എന്നിട്ട് ടൂർണമെന്റ് മുഴുവൻ സ്വയം കളിച്ചു നോക്കൂ.')}</p>
  <div class="facts"><span>16 teams</span><span>2 groups of 8</span><span>5 ladder rounds</span><span>Top 4 qualify</span><span>11–14 Feb 2027 · Angamaly</span></div></div>
  <div class="bigcards"><a class="bigcard" href="#/learn"><div class="n">1</div><h3>How it works</h3><p>${x('A simple, picture-style guide to groups, rounds, the ladder and the knockouts.','ഗ്രൂപ്പുകൾ, റൗണ്ടുകൾ, ലാഡർ, നോക്കൗട്ട് എന്നിവയെക്കുറിച്ചുള്ള ലളിതമായ ചിത്ര ഗൈഡ്.')}</p></a>
  <a class="bigcard" href="#/sim"><div class="n">2</div><h3>Try the simulation</h3><p>${x('Draw groups, play every round to the Final with one button, and follow your own team.','ഗ്രൂപ്പുകൾ നറുക്കെടുക്കൂ, ഒരു ബട്ടൺ കൊണ്ട് ഫൈനൽ വരെ എല്ലാ റൗണ്ടും കളിക്കൂ, നിങ്ങളുടെ സ്വന്തം ടീമിനെ പിന്തുടരൂ.')}</p></a>
  <a class="bigcard" href="#/team"><div class="n">3</div><h3>Franchise owners</h3><p>${x('See your own matches, grounds, timings and results once the real fixtures are out.','യഥാർത്ഥ ഫിക്സ്ചർ വന്നാൽ നിങ്ങളുടെ മത്സരങ്ങൾ, ഗ്രൗണ്ട്, സമയം, ഫലങ്ങൾ എന്നിവ കാണാം.')}</p></a></div>
  <p class="muted small" style="text-align:center">${x('Practice results are not real.','പരിശീലന ഫലങ്ങൾ യഥാർത്ഥമല്ല.')} <a href="#/admin" style="color:var(--mute)">Committee login</a></p></div>`;
}
function learnView(){
  const ord=n=>['1st','2nd','3rd','4th','5th','6th','7th','8th'][n-1],mo=n=>n+'-ാം';
  const rung=(n,o,low)=>`<div class="rung ${low?'low':''}"><b>${n}</b>${x('plays '+ord(o),'കളിക്കുന്നത്: '+mo(o)+' സ്ഥാനക്കാരോട്')}</div>`;
  return `<div class="pub" style="max-width:860px"><div class="crumbs"><a href="#/sim">▶ Play the simulation</a></div>
  <div class="sec"><h2><span class="n">★</span>The big picture</h2><p>${x('16 teams, two groups, five rounds, then knockouts. Every team plays 5 league matches.','16 ടീമുകൾ, രണ്ട് ഗ്രൂപ്പ്, അഞ്ച് റൗണ്ട്, അതിനു ശേഷം നോക്കൗട്ട്. ഓരോ ടീമും 5 ലീഗ് മത്സരങ്ങൾ കളിക്കും.')}</p>
  <div class="tl"><span class="st">Group draw</span><span class="ar">→</span><span class="st">5 ladder rounds</span><span class="ar">→</span><span class="st">Quarter-finals</span><span class="ar">→</span><span class="st">Semi-finals</span><span class="ar">→</span><span class="st">Grand Final</span></div></div>
  <div class="sec"><h2><span class="n">1</span>Two groups</h2><p>${x('Teams are drawn by lot into Group A and Group B, 8 teams each.','ടീമുകളെ നറുക്കെടുപ്പിലൂടെ ഗ്രൂപ്പ് A, ഗ്രൂപ്പ് B എന്നിങ്ങനെ 8 വീതം തിരിക്കും.')}</p><p>${x('Group A plays on Thu 11 Feb, Sat 13 Feb and Sun 14 Feb. Group B plays on Fri 12 Feb, Sat 13 Feb and Sun 14 Feb.','ഗ്രൂപ്പ് A ഫെബ്രുവരി 11 (വ്യാഴം), 13 (ശനി), 14 (ഞായർ) തീയതികളിൽ കളിക്കും. ഗ്രൂപ്പ് B ഫെബ്രുവരി 12 (വെള്ളി), 13 (ശനി), 14 (ഞായർ) തീയതികളിൽ കളിക്കും.')}</p></div>
  <div class="sec"><h2><span class="n">2</span>Round 1: by lot</h2><p>${x('The first round pairs are drawn by lot (this is the Rising Star Marque match). A win is worth 2 points. Every match must have a winner; a tie goes to a Super Over.','ആദ്യ റൗണ്ടിലെ ജോടികൾ നറുക്കെടുപ്പിലൂടെ നിശ്ചയിക്കും (ഇതാണ് റൈസിംഗ് സ്റ്റാർ മാർക്വി മത്സരം). ജയത്തിന് 2 പോയിന്റ്. ഓരോ മത്സരത്തിനും ഒരു വിജയി വേണം; ടൈ ആയാൽ സൂപ്പർ ഓവർ.')}</p></div>
  <div class="sec"><h2><span class="n">3</span>The ladder (Round 2 onwards)</h2><p>${x('After every round the table is updated: points first, then net run rate. Then the ladder pairs teams next to each other:','ഓരോ റൗണ്ടിനു ശേഷവും പട്ടിക പുതുക്കും: ആദ്യം പോയിന്റ്, പിന്നെ നെറ്റ് റൺ റേറ്റ്. തുടർന്ന് ലാഡർ അടുത്തടുത്തുള്ള ടീമുകളെ ജോടിയാക്കും:')}</p>
  <div class="ladder">${rung(1,2)}${rung(2,1)}${rung(3,4)}${rung(4,3)}${rung(5,6,1)}${rung(6,5,1)}${rung(7,8,1)}${rung(8,7,1)}</div>
  <p>${x('Top half (1–4) only plays the top half. Bottom half (5–8) only plays the bottom half. So you always meet a team that is doing about as well as you. Win and climb; lose and slide.','മുകളിലെ പകുതി (1–4) മുകളിലെ പകുതിയോട് മാത്രമേ കളിക്കൂ. താഴത്തെ പകുതി (5–8) താഴത്തെ പകുതിയോട് മാത്രം. അതിനാൽ നിങ്ങളോളം മികച്ച പ്രകടനമുള്ള ടീമിനെയാണ് എപ്പോഴും നേരിടുക. ജയിച്ചാൽ മുകളിലേക്ക്, തോറ്റാൽ താഴേക്ക്.')}</p></div>
  <div class="sec"><h2><span class="n">4</span>No repeat opponents</h2><p>${x('If the ladder pair has already met in this league, we shuffle inside the same half:','ലാഡർ ജോടി ഇതിനകം ഈ ലീഗിൽ കളിച്ചിട്ടുണ്ടെങ്കിൽ, അതേ പകുതിക്കുള്ളിൽ തന്നെ മാറ്റിയിടും:')}</p>
  <div class="pairbox"><div class="opt"><b>Standard</b><br>1 v 2 and 3 v 4</div><div class="opt"><b>Shuffle 1</b><br>1 v 3 and 2 v 4</div><div class="opt"><b>Shuffle 2</b><br>1 v 4 and 2 v 3</div><div class="opt no"><b>Still repeats?</b><br>${x('Back to the original schedule (1 v 2, 3 v 4, 5 v 6, 7 v 8). A rematch is then allowed.','ആദ്യത്തെ ക്രമത്തിലേക്ക് (1-2, 3-4, 5-6, 7-8) മടങ്ങും. അപ്പോൾ വീണ്ടും കളിക്കാൻ അനുവദിക്കും.')}</div></div>
  <p class="small muted">${x('The same rule applies to positions 5–8. Teams from the top half never play the bottom half.','5–8 സ്ഥാനങ്ങൾക്കും ഇതേ നിയമം. മുകളിലെ പകുതിയിലെ ടീമുകൾ താഴത്തെ പകുതിയോട് ഒരിക്കലും കളിക്കില്ല.')}</p></div>
  <div class="sec"><h2><span class="n">5</span>Knockouts</h2><p>${x('The top 4 of each group qualify.','ഓരോ ഗ്രൂപ്പിലെയും മികച്ച 4 ടീമുകൾ യോഗ്യത നേടും.')}</p>
  <div class="pairbox"><div class="opt"><b>Quarter-finals</b><br>QF1: A1 v B4<br>QF2: A2 v B3<br>QF3: B1 v A4<br>QF4: B2 v A3</div><div class="opt"><b>Semi-finals</b><br>${x('SF1: QF1 winner v QF4 winner','SF1: QF1 വിജയി v QF4 വിജയി')}<br>${x('SF2: QF2 winner v QF3 winner','SF2: QF2 വിജയി v QF3 വിജയി')}</div></div>
  <p>${x('The Grand Final is at FISAT on Sunday 14 Feb.','ഗ്രാൻഡ് ഫൈനൽ ഫെബ്രുവരി 14 ഞായറാഴ്ച ഫിസാറ്റിൽ (FISAT) നടക്കും.')}</p></div>
  <div class="sec"><h2><span class="n">6</span>Two grounds</h2><p>${x('Matches are played at FISAT and Boundary Grounds, which are not close. The fixture has fixed times for all 47 matches and tries to keep every team at one ground. When a team must change ground, it shows a red TRAVEL tag with the team name and the ground it comes from. The team is given a later slot so it has time to travel. All play ends by 6 PM.','മത്സരങ്ങൾ ഫിസാറ്റ്, ബൗണ്ടറി ഗ്രൗണ്ട്സ് എന്നീ രണ്ട് ഗ്രൗണ്ടുകളിലാണ്; ഇവ തമ്മിൽ അകലമുണ്ട്. 47 മത്സരങ്ങൾക്കും സമയം മുൻകൂട്ടി നിശ്ചയിച്ചിട്ടുണ്ട്; ഓരോ ടീമിനെയും കഴിയുന്നത്ര ഒരേ ഗ്രൗണ്ടിൽ നിർത്താൻ ശ്രമിക്കും. ഒരു ടീമിന് ഗ്രൗണ്ട് മാറേണ്ടി വന്നാൽ ടീമിന്റെ പേരും എവിടെ നിന്നാണ് വരേണ്ടത് എന്നതും ചുവന്ന TRAVEL ടാഗിൽ കാണിക്കും. യാത്രയ്ക്ക് സമയം കിട്ടാൻ ആ ടീമിന് പിന്നീടുള്ള സമയം നൽകും. എല്ലാ കളിയും വൈകിട്ട് 6 മണിക്ക് മുമ്പ് അവസാനിക്കും.')}</p></div>
  <div class="sec" style="text-align:center"><h2 style="justify-content:center">Ready?</h2><a class="btn gold" href="#/sim" style="text-decoration:none">▶ Play the simulation</a></div></div>`;
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
    if(inSim()){spin(id=>psPick(id));break;}
    if(S.draw.groupsDone&&wheel.target)spin(id=>pickLot(id));else spin(id=>pickGroup(id));break;
  case 'quickdraw':
    if(inSim()){const left=shuffle(S.teams.map(t=>t.id).filter(i=>!PS.groups.A.includes(i)&&!PS.groups.B.includes(i)));left.forEach(i=>(PS.groups.A.length<8?PS.groups.A:PS.groups.B).push(i));PS.draw.groupsDone=true;psLot(PS);psSave();render();break;}
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
  case 'lang':LANG=el.dataset.l;try{localStorage.setItem('knpl7_lang',LANG);}catch(e){}render();break;
  case 'psreset':if(confirm('Reset your practice simulation?')){PS=psNew();psDay=1;psSave();render();}break;
  case 'psgroups':{const ids=shuffle(S.teams.map(t=>t.id));PS=psNew();PS.groups={A:ids.slice(0,8),B:ids.slice(8)};PS.draw.groupsDone=true;psLot(PS);psSave();render();break;}
  case 'psgen':{const sd=PSTEPS.find(q=>q.id===el.dataset.s);PS.snap=PS.snap||{};PS.fresh=[];sd.stages.forEach(id=>{if(!PS.stages[id]){if(id!=='A-R1'&&id!=='B-R1')PS.snap[id]=psPosMap(PS);KE.generate(PS,id);PS.matches.filter(m=>m.stage===id).forEach(m=>PS.fresh.push(m.no));}});PS.tab='fx';PS.day=psLiveDay(PS);psSave();render();window.scrollTo({top:0,behavior:'smooth'});break;}
  case 'psres':{const sd=PSTEPS.find(q=>q.id===el.dataset.s),before=psPosMap(PS);PS.fresh=[];sd.stages.forEach(id=>{psPlay(PS,id);PS.matches.filter(m=>m.stage===id).forEach(m=>PS.fresh.push(m.no));});if(['R1','R2','R3','R4','R5'].includes(sd.id)){PS.hist=PS.hist||{};PS.hist[sd.id]=psPosMap(PS);}PS.ladder={name:sd.name,before};PS.news=psNews(PS,sd,before);PS.tab='lad';PS.day=psLiveDay(PS);psSave();render();window.scrollTo({top:0,behavior:'smooth'});break;}
  case 'psday':PS.day=+el.dataset.d;psSave();render();break;
  case 'pspdf':psPdf();break;
  case 'pstab':PS.tab=el.dataset.t;psSave();render();break;
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
  case 'teamout':tp.team=null;tp.tab='m';render();break;
  case 'tptab':{tp.tab=el.dataset.t;if(tp.tab==='sim'){if(!PS||PS.sigf!==frozenSig())psLoad();PS.my=tp.team;psSave();}render();break;}
  }}catch(err){toast(err.message||String(err),1);}
});
document.addEventListener('change',async e=>{
  const t=e.target;
  if(t.dataset.act==='tsel'){thumbSel=+t.value;previewSel();}
  if(t.dataset.act==='psmy'){PS.my=t.value||null;psSave();render();}
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
