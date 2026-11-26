/**
 * KNPL-7 Fixture Centre backend (Google Apps Script, bound to a Google Sheet).
 * Deploy: Extensions > Apps Script > paste > Project Settings > Script properties (see README) > Deploy > Web app
 *   Execute as: Me   |   Who has access: Anyone
 * Sheet tabs are created automatically: State, Downloads, Log
 */
const SS = SpreadsheetApp.getActiveSpreadsheet();
const P = PropertiesService.getScriptProperties();

function out(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sheet(n, hdr){ let s = SS.getSheetByName(n); if(!s){ s = SS.insertSheet(n); if(hdr) s.appendRow(hdr);} return s; }

function doGet(){ return out({ok:true, service:'KNPL-7 fixture'}); }

function doPost(e){
  try{
    const b = JSON.parse(e.postData.contents), a = b.action;
    if(a==='getPublic') return out({ok:true, state:getPublicState_(), version:getVersion_()});
    if(a==='teamLogin') return out(teamLogin_(b));
    if(a==='authInfo') return out({ok:true, codeRequired:!!P.getProperty('COMMITTEE_CODE')});
    if(a==='login') return out(login_(b));
    if(a==='logDownload'){ const r=b.rec||{}; sheet('Downloads',['When','Name','Mobile','Match']).appendRow([new Date(r.t||Date.now()), r.name, "'"+r.mobile, r.match]); return out({ok:true}); }
    // everything below needs a committee token
    if(!validToken_(b.token)) return out({ok:false,error:'Please login again'});
    if(a==='getState') return out({ok:true, state:getState_(), version:getVersion_()});
    if(a==='saveState') return out(saveState_(b.state, b.version));
    if(a==='setCode') return out(setCode_(b));
    if(a==='sponsors') return out({ok:true, roles:sponsors_()});
    if(a==='fetchCH') return out(fetchCH_(b.url));
    return out({ok:false,error:'Unknown action'});
  }catch(err){ return out({ok:false,error:String(err)}); }
}

/* ---- login: shared committee code + name + mobile; mobile must be on the allowed list ---- */
function login_(b){
  const code = P.getProperty('COMMITTEE_CODE'), allowed = (P.getProperty('COMMITTEE_MOBILES')||'').split(',').map(s=>s.trim()).filter(Boolean);
  const mob = String(b.mobile||'').replace(/\D/g,'').slice(-10);
  if(code && b.code!==code) return {ok:false,error:'Wrong access code'};   // no code set yet = open to anyone with the link
  if(allowed.length && allowed.indexOf(mob)<0) return {ok:false,error:'This mobile is not in the committee list'};
  const tok = Utilities.getUuid(); const c = CacheService.getScriptCache(); c.put('t_'+tok, mob, 21600);
  sheet('Log',['When','Who','Mobile']).appendRow([new Date(), b.name, "'"+mob]);
  return {ok:true, token:tok};
}
/* Committee can create / change / remove the access code from Settings. Empty value = open again. */
function setCode_(b){
  const code = String(b.newCode||'').trim();
  if(code && code.length<6) return {ok:false,error:'Use at least 6 characters'};
  if(code) P.setProperty('COMMITTEE_CODE', code); else P.deleteProperty('COMMITTEE_CODE');
  const mobs = String(b.mobiles||'').replace(/[^0-9,]/g,'');
  if(mobs) P.setProperty('COMMITTEE_MOBILES', mobs); else P.deleteProperty('COMMITTEE_MOBILES');
  return {ok:true, codeRequired:!!code};
}
function validToken_(t){ return !!t && !!CacheService.getScriptCache().get('t_'+t); }

/* ---- state: JSON stored in chunks (cell limit 50k chars). A version number + script lock make saves safe when several committee members work at once:
        a save made from an out-of-date copy is refused with CONFLICT and the page reloads the latest data. ---- */
function getVersion_(){ return Number(P.getProperty('STATE_VERSION')||0); }
function saveState_(st, ver){
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try{
    const cur = getVersion_();
    if(ver!=null && Number(ver)!==cur) return {ok:false, error:'CONFLICT'};
    const s = sheet('State',['chunk','json']); s.clear(); s.appendRow(['chunk','json']);
    delete st.ver; const j = JSON.stringify(st), n = 40000; let i=0;
    for(let p=0;p<j.length;p+=n) s.appendRow([i++, j.substr(p,n)]);
    P.setProperty('STATE_VERSION', String(cur+1)); CacheService.getScriptCache().remove('public_state');
    return {ok:true, version:cur+1};
  } finally { lock.releaseLock(); }
}
function getState_(){
  const s = SS.getSheetByName('State'); if(!s || s.getLastRow()<2) return null;
  const v = s.getRange(2,2,s.getLastRow()-1,1).getValues().map(r=>r[0]).join('');
  try{ return JSON.parse(v);}catch(e){ return null; }
}
/* Public copy: no owner codes, no download log. Read by the practice simulation, YouTube and team pages. Reads are cheap and need no lock, so any number of visitors can use them at once. */
function getPublicState_(){
  const st = getState_(); if(!st) return null;
  st.teams = (st.teams||[]).map(t=>{ const o=Object.assign({},t); delete o.code; return o; }); st.downloads=[]; return st;
}
function teamLogin_(b){
  const st = getState_(); const t = st && (st.teams||[]).filter(x=>x.id===b.team)[0];
  if(!t || !t.code || String(t.code)!==String(b.code)) return {ok:false, error:'Team or code incorrect'};
  return {ok:true};
}

/* ---- sponsorship portal: read the Sheet used by the Cover Drive portal. Edit SPONSOR_SHEET_ID and the column mapping. ---- */
function sponsors_(){
  const id = P.getProperty('SPONSOR_SHEET_ID'); if(!id) throw new Error('SPONSOR_SHEET_ID not set');
  const sh = SpreadsheetApp.openById(id).getSheets()[0], v = sh.getDataRange().getValues(), h = v[0].map(x=>String(x).toLowerCase());
  const col = k => h.findIndex(x=>x.indexOf(k)>=0), roles = {};
  const cn=col('name'), cr=col('role'), cl=col('logo');
  v.slice(1).forEach(r=>{ const role = String(r[cr]||'').toLowerCase(); let key=null;
    if(role.indexOf('co')>=0 && role.indexOf('telecast')>=0) key='cosponsor'; else if(role.indexOf('telecast')>=0) key='telecast';
    else if(role.indexOf('star')>=0) key='star'; else if(role.indexOf('salute')>=0) key='salute'; else if(role.indexOf('match')>=0) key='match';
    if(key) roles[key] = {name:r[cn], img:logoData_(r[cl])}; });
  return roles;
}
function logoData_(url){ try{ if(!url) return ''; const m=String(url).match(/[-\w]{25,}/); if(!m) return '';
  const f=DriveApp.getFileById(m[0]).getBlob(); return 'data:'+f.getContentType()+';base64,'+Utilities.base64Encode(f.getBytes()); }catch(e){ return ''; } }

/* ---- CricHeroes read (EXPERIMENTAL). CricHeroes has no public API; this tries the tournament page. Test with your link.
        Returns [{teamA,teamB,winner,runsA,oversA,runsB,oversB}]. If it returns nothing, use the CSV import on the page. ---- */
function fetchCH_(url){
  if(!url) return {ok:false,error:'No CricHeroes link set'};
  const r = UrlFetchApp.fetch(url,{muteHttpExceptions:true,headers:{'User-Agent':'Mozilla/5.0'}}), html = r.getContentText();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if(!m) return {ok:false,error:'CricHeroes page format not recognised (HTTP '+r.getResponseCode()+'). Use CSV import.'};
  const data = JSON.parse(m[1]), found = [];
  (function walk(o){ if(!o||typeof o!=='object') return;
    if(o.team_a && o.team_b && (o.winning_team||o.winner||o.match_result)){ found.push(o); }
    Object.keys(o).forEach(k=>walk(o[k])); })(data);
  const results = found.map(o=>({teamA:(o.team_a.name||o.team_a), teamB:(o.team_b.name||o.team_b), winner:(o.winning_team&&o.winning_team.name)||o.winning_team||o.winner,
    runsA:o.team_a_summary&&o.team_a_summary.total_run||'', oversA:o.team_a_summary&&o.team_a_summary.overs||'', runsB:o.team_b_summary&&o.team_b_summary.total_run||'', oversB:o.team_b_summary&&o.team_b_summary.overs||''}));
  return {ok:true, results:results};
}
