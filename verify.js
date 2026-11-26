(function(root){
 const E=root.KE;
 // per team per day ground-change report from st.matches
 E.groundReport=function(st){
  const rows=[];let maxChg=0,multi=0,finalChg=0,otherChg=0;
  st.teams.forEach(t=>{for(let d=1;d<=4;d++){
    const ms=st.matches.filter(m=>m.day===d&&(m.a===t.id||m.b===t.id)).sort((x,y)=>x.start-y.start);
    if(!ms.length)continue;let c=0,fin=false,wm=0,minGap=999;const seq=ms.map(m=>m.ground);
    for(let i=1;i<ms.length;i++)if(ms[i].ground!==ms[i-1].ground){c++;if(ms[i].kind==='Final')fin=true;minGap=Math.min(minGap,ms[i].start-ms[i-1].end);if(ms[i-1].topRank)wm++;}
    if(c){ if(fin)finalChg++;else otherChg++; }
    if(c>1)multi++;maxChg=Math.max(maxChg,c);rows.push({team:t.id,day:d,n:ms.length,changes:c,seq,final:fin,winnerMoves:wm,minGap});
  }});
  return {rows,maxChg,multi,finalChg,otherChg,changed:rows.filter(r=>r.changes)};
 };
 E.simResult=function(st,m,strength){
  const sa=strength[m.a]||1,sb=strength[m.b]||1,w=Math.random()<sa/(sa+sb)?m.a:m.b;
  const ra=70+Math.floor(Math.random()*70),rb=70+Math.floor(Math.random()*70);
  const aw=w===m.a;return {winner:w,ra:aw?Math.max(ra,rb+1):Math.min(ra,rb-1),oa:'10',rb:aw?Math.min(rb,ra-1):Math.max(rb,ra+1),ob:'10',sim:true};
 };
 E.simStage=function(st,id,strength){st.matches.filter(m=>m.stage===id&&m.status!=='done').forEach(m=>E.setResult(st,m.no,E.simResult(st,m,strength)));};
})(typeof window!=='undefined'?window:globalThis);
if(typeof module!=='undefined')module.exports=null;
