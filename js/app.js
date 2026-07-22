/* ============================================================
   SkillPlan — Yanfeng Planá nad Lužnicí
   Matice dovedností dle projektů + týdenní rozpis směn
   Struktura odpovídá internímu rozpisu:
   projekt → pozice → operátoři · směny Ranní/Odpolední/Noční
   ============================================================ */

const LS_KEY = 'skillplan_yanfeng_v2';
const PLAN_SHIFTS = [
  {id:'R', name:'Ranní'},
  {id:'O', name:'Odpolední'},
  {id:'N', name:'Noční'}
];

/* Projekty a pozice — extrahováno z interních rozpisů CW29 */
const DEFAULT_PROJECTS = [
  {id:'prefix', name:'Prefix', positions:['TL','TR','Spacer','Roll coater','Glue Spray','Prefix — 1. stůl','Prefix — 2. stůl','Prefix — 3. stůl','Prefix — 4. stůl','Prefix — 5. stůl','Prefix — 6. stůl','Lami','EDGW — 1. stůl','EDGW — 2. stůl','EDGW — 3. stůl','EDGW — 4. stůl','EDGW — 5. stůl','EDGW — 6. stůl','EDGW — 7. stůl','EDGW — 8. stůl','Balení']},
  {id:'g463',   name:'G463',   positions:['TL','TR','Sklad','Sequence','Světýlko','Předmontáž','Montáž','Cobot','HB','Rework','Antisqueek','3Con','Montáž zacvik']},
  {id:'gbdp',   name:'GBDP',   positions:['TL','TR','Sklad','Sequence','Světýlko','Předmontáž','Montáž','Cobot','HB','Rework','Antisqueek','3Con','Montáž zacvik']},
  {id:'sk336',  name:'SK336 / W206', positions:['TL','TR','Punching','Milling','Vibrační svařování','US Welding','Cliping','Montáž','Rework']},
  {id:'w177',   name:'W177 (MFA2)',  positions:['TL','TR','Rework','Fleece + Punching','Milling','Banan','IP Lower','Vibrační svařování','Montáž']},
  {id:'w247',   name:'W247 (MFA2)',  positions:['TL','TR','Rework','Punching','Milling','Banan','IP Lower','Vibrační svařování','Montáž']},
  {id:'mbeam',  name:'Mbeam X540',   positions:['TL','TR','Punching','Laser','US Welding 1','US Welding 2','Assy fleece','Final assy','Montáž CUN']},
  {id:'ov',     name:'OV 51/64',     positions:['TL','TR','Punching','Milling','Welding','Assy Airbag','Preassy','Station 1','Station 2','Station 3','Station 4','Station 5','Station 6','Station 7','Rework']},
  {id:'foam',   name:'Foam',         positions:['TL','TR','Pec','Sequence','Manipulant','Rework','Karusel','Scoring']},
  {id:'slush',  name:'Slush / Sewing', positions:['TL','TR','Slush 1','Slush 2','Sewing MFA — Manual','Sealing MFA — Podlep','Sewing AUDI — Manual','Manipulant']},
];

/* Migrace starých názvů pozic na sjednocené */
const RENAME_MAP = {
  'Wib':'Vibrační svařování', 'VIB':'Vibrační svařování',
  'Us.Wel':'US Welding', 'Usw1':'US Welding 1', 'Usw2':'US Welding 2',
  'RW':'Rework', 'PNCH':'Punching', 'Fleece + PNCH':'Fleece + Punching'
};

/* Oficiální pozice G463 (zdroj pravdy — šablona skill matrix) */
const G463_OFFICIAL = ['SKLAD','SEQ PREASSY','PREASSY RR','PREASSY FRT','SVÁŘEČKA',
  'ASSEMBLY RR','ASSEMBLY FRT','REWORK','ANTISQEEK','HB PREASSY','HB KONTROLA','3CON','ROLLCOATER TPO'];

/* Jednorázová migrace: sladí uložené pozice G463 s oficiální maticí.
   Staré pozice z rozpisu (Sklad, Sequence, Cobot…) se odstraní, pokud nenesou
   data; případná case-insensitive duplicita (Sklad vs SKLAD) se přemigruje na
   oficiální pravopis. Pozice s daty bez oficiální shody zůstanou na konci. */
function migrateG463Positions(db){
  if(db.migrations && db.migrations.g463Positions) return db;
  const proj = (db.projects||[]).find(p=>p.id==='g463');
  if(proj){
    const target = [], byNorm = new Map();
    ['TL','TR'].forEach(p=>{ target.push(p); byNorm.set(posNorm(p), p); });
    G463_OFFICIAL.forEach(st=>{ const k=posNorm(st); if(!byNorm.has(k)){ target.push(st); byNorm.set(k, st); } });

    const kept = [];
    proj.positions.forEach(oldPos=>{
      const match = byNorm.get(posNorm(oldPos));
      if(match){ if(match!==oldPos) migratePositionData(db, 'g463', oldPos, match); }
      else if(positionHasData(db, 'g463', oldPos)) kept.push(oldPos);
      else removePositionData(db, 'g463', oldPos);
    });
    proj.positions = target.concat(kept);
  }
  if(!db.migrations) db.migrations = {};
  db.migrations.g463Positions = true;
  return db;
}

function migrateNames(db){
  db.projects.forEach(pr=>{
    pr.positions = pr.positions.map(p=>RENAME_MAP[p]||p);
  });
  db.operators.forEach(o=>{
    if(o.active===undefined) o.active = true;   // zpětná kompat.: staří operátoři jsou aktivní
    if(!o.skills) return;
    const ns = {};
    Object.keys(o.skills).forEach(k=>{
      const [pid, pos] = k.split('::');
      ns[pid+'::'+(RENAME_MAP[pos]||pos)] = o.skills[k];
    });
    o.skills = ns;
  });
  Object.values(db.plans||{}).forEach(w=>Object.values(w).forEach(pr=>{
    Object.keys(pr).forEach(pos=>{
      const np = RENAME_MAP[pos];
      if(np && !pr[np]){ pr[np]=pr[pos]; delete pr[pos]; }
    });
  }));
  migrateG463Positions(db);
  if(!db.history) db.history={};   // zpětná kompat.: historie trendu
  return db;
}

let DB = load();
let mxProj = DB.projects[0] ? DB.projects[0].id : null;
let planProj = DB.projects[0] ? DB.projects[0].id : null;
let weekOffset = 0;
let pickerEl = null;
let mxShowAll = false;   // matice: false = jen operátoři s kvalifikací, true = celý pool

function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      const d = JSON.parse(raw);
      if(d.projects) return migrateNames(d);
    }
  }catch(e){}
  return {
    projects: JSON.parse(JSON.stringify(DEFAULT_PROJECTS)),
    operators: [],   // {id, name, skills:{ 'projId::position': level }}
    plans: {},       // plans[cwKey][projId][position][shiftId] = [opId,...]
    notes: {},       // notes[cwKey][projId] = text (dovolená, nemoc, poznámky)
    history: {}      // history['YYYY-MM'] = snímek připravenosti (trend)
  };
}
function save(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(DB)); }
  catch(e){ toast('Chyba ukládání — localStorage nedostupný'); }
}
function uid(p){ return (p||'op')+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function projById(id){ return DB.projects.find(a=>a.id===id); }
function skillKey(projId, pos){ return projId+'::'+pos; }

/* ============ WEEK HELPERS ============ */
function mondayOf(d){
  const x = new Date(d);
  const day = (x.getDay()+6)%7;
  x.setDate(x.getDate()-day);
  x.setHours(0,0,0,0);
  return x;
}
function currentMonday(){
  const m = mondayOf(new Date());
  m.setDate(m.getDate()+weekOffset*7);
  return m;
}
function weekKey(mon){ return mon.toISOString().slice(0,10); }
function isoWeek(d){
  const x = new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const dayNum = x.getUTCDay()||7;
  x.setUTCDate(x.getUTCDate()+4-dayNum);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(),0,1));
  return Math.ceil((((x-y0)/86400000)+1)/7);
}
function fmtD(d){ return d.getDate()+'.'+(d.getMonth()+1)+'.'; }

/* ============ NAV ============ */
function go(v){
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('on'));
  document.getElementById('v-'+v).classList.add('on');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  closePicker();
  render();
}

/* ============ SELECTORS ============ */
function buildProjSelect(elId, current){
  const el = document.getElementById(elId);
  el.innerHTML = DB.projects.map(a=>
    `<option value="${a.id}" ${a.id===current?'selected':''}>${a.name}</option>`
  ).join('');
}
function setMxArea(a){ mxProj=a; render(); }
function setMxShowAll(v){ mxShowAll=!!v; renderMatrix(); }
function setPlanArea(a){ planProj=a; closePicker(); render(); }

/* ============ SKILL HELPERS ============ */
function skillOf(op, projId, pos){ return (op.skills&&op.skills[skillKey(projId,pos)])||0; }
function allOps(){ return [...DB.operators].sort((a,b)=>a.name.localeCompare(b.name,'cs')); }
function isActive(op){ return op.active !== false; }        // undefined = aktivní (zpětná kompat.)
function activeOps(){ return allOps().filter(isActive); }   // pracující pool
function endedOps(){ return allOps().filter(o=>!isActive(o)); }
function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function quadHtml(level, cls){
  return `<span class="quad ${cls||''}" data-l="${level}"><i></i><i></i><i></i><i></i></span>`;
}

function coverage(projId, pos){
  let tr=0, it=0;
  DB.operators.forEach(o=>{
    if(!isActive(o)) return;   // neaktivní se nepočítají do pokrytí ani rizik
    const l = skillOf(o,projId,pos);
    if(l>=2) tr++;
    else if(l===1) it++;
  });
  return {tr,it,tot:tr+it};
}
function pct(tr,tot){ return tot>0?Math.round(tr/tot*100):0; }
function colOf(v){ return v>=90?'var(--ok)':v>=70?'var(--warn)':'var(--risk)'; }
function colHex(v){ return v>=90?'#1E7A3C':v>=70?'#B36B00':'#C22E2E'; }

/* ============ HISTORIE / TREND PŘIPRAVENOSTI ============ */
function monthKey(d){ d=d||new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function monthLabel(mk){ const p=mk.split('-'); return p[1]+'/'+p[0].slice(2); }
function computeReadiness(){
  let tr=0,it=0,tot=0; const projects={};
  DB.projects.forEach(a=>{
    let ptr=0,pit=0;
    a.positions.forEach(pos=>{ const c=coverage(a.id,pos); ptr+=c.tr; pit+=c.it; });
    const ptot=ptr+pit;
    if(ptot>0) projects[a.id]={name:a.name, tr:ptr, it:pit, tot:ptot};
    tr+=ptr; it+=pit; tot+=ptot;
  });
  return { overall:{tr, it, tot}, projects, ops: activeOps().length };
}
/* zapiš/přepiš snímek AKTUÁLNÍHO měsíce; minulé měsíce zůstávají zmražené */
function captureSnapshot(){
  if(!DB.history) DB.history={};
  DB.history[monthKey()] = computeReadiness();
}
function saveSnapshot(){
  captureSnapshot(); save(); renderDash();
  toast('Snímek připravenosti uložen ('+monthLabel(monthKey())+')');
}

/* ============ RENDER: DASHBOARD ============ */
function renderDash(){
  const el = document.getElementById('dashBody');
  if(DB.operators.length===0){
    el.innerHTML = `<div class="card"><div class="empty">
      ${quadHtml(4,'lg')}
      <h3>Začni přidáním operátorů</h3>
      <p>Vlož seznam jmen v Nastavení (zkopíruj sloupec z Excelu), potom nastav úrovně v matici dovedností pro jednotlivé projekty.</p>
      <button class="btn" onclick="go('set')">Otevřít nastavení</button>
    </div></div>`;
    return;
  }

  let allTr=0, allTot=0, allIt=0;
  const projTotals = [];
  DB.projects.forEach(a=>{
    let tr=0,it=0;
    a.positions.forEach(pos=>{
      const c=coverage(a.id,pos); tr+=c.tr; it+=c.it;
    });
    if(tr+it>0){
      projTotals.push({a,tr,it,tot:tr+it});
      allTr+=tr; allIt+=it; allTot+=tr+it;
    }
  });
  const allPct = pct(allTr,allTot);

  const risks = [];
  DB.projects.forEach(a=>{
    a.positions.forEach(pos=>{
      if(pos==='TL'||pos==='TR') return;
      const c = coverage(a.id,pos);
      if(c.tot===0) return;
      if(c.tr===0) risks.push({t:'r', txt:`<b>${a.name} · ${pos}</b>`, sub:'Žádný samostatný operátor (úroveň ≥2)'});
      else if(c.tr===1) risks.push({t:'w', txt:`<b>${a.name} · ${pos}</b>`, sub:'Jen 1 samostatný operátor — riziko při absenci'});
    });
  });

  let h = `<div class="kpi-grid">
    <div class="kpi-card ${allPct>=90?'a-ok':allPct>=70?'a-warn':'a-risk'}">
      <div class="kpi-lbl">Celková připravenost</div>
      <div class="kpi-num" style="color:${allTot>0?colOf(allPct):'var(--ink3)'}">${allTot>0?allPct+'%':'—'}</div>
      <div class="kpi-sub">${allTr} samostatných z ${allTot} kvalifikací</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">Operátorů celkem</div>
      <div class="kpi-num">${activeOps().length}</div>
      <div class="kpi-sub">jeden společný pool${endedOps().length?` · ${endedOps().length} ukončených`:''}</div>
    </div>
    <div class="kpi-card a-warn">
      <div class="kpi-lbl">V zaškolování</div>
      <div class="kpi-num" style="color:var(--warn)">${allIt}</div>
      <div class="kpi-sub">úroveň 1 — pod dohledem</div>
    </div>
    <div class="kpi-card ${risks.filter(r=>r.t==='r').length?'a-risk':'a-ok'}">
      <div class="kpi-lbl">Rizika pokrytí</div>
      <div class="kpi-num" style="color:${risks.filter(r=>r.t==='r').length?'var(--risk)':'var(--ok)'}">${risks.length}</div>
      <div class="kpi-sub">${risks.filter(r=>r.t==='r').length} kritických · ${risks.filter(r=>r.t==='w').length} varování</div>
    </div>
  </div>`;

  if(projTotals.length>0){
    h+=`<div class="sec-title" style="margin-top:4px">Připravenost dle projektů</div>
    <div class="shift-strip" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr));margin-bottom:20px">`;
    projTotals.forEach(({a,tr,it,tot})=>{
      const p2 = pct(tr,tot);
      h+=`<div class="shift-card">
        <div class="shift-card-hdr" style="background:var(--navy)">${a.name}<small>${a.positions.length} pozic</small></div>
        <div class="shift-card-body">
          <div class="shift-pct" style="color:${colOf(p2)}">${p2}%</div>
          <div class="shift-mini">${tr} samost. · ${it} v zášk.</div>
        </div>
      </div>`;
    });
    h+=`</div>`;
  }

  // Trend připravenosti po měsících
  {
    const hist = DB.history||{};
    const cm = monthKey();
    const liveCM = computeReadiness();
    const mset = new Set(Object.keys(hist)); mset.add(cm);
    const months = [...mset].sort().slice(-12);   // posledních 12 měsíců
    const snapOf = m => (m===cm ? liveCM : hist[m]);
    h+=`<div class="card card-pad" style="margin-bottom:20px">
      <div class="sec-title">Trend připravenosti (po měsících)
        <button class="btn sm sec no-print" style="float:right;margin-top:-4px" onclick="saveSnapshot()">Uložit snímek</button></div>`;
    if(months.length<2){
      h+=`<p class="hint">Zaznamenán zatím jen aktuální měsíc (${monthLabel(cm)}). Trend se zobrazí v dalších měsících — snímek se ukládá automaticky při otevření aplikace, nebo tlačítkem „Uložit snímek".</p>`;
    }
    h+=`<div class="trend-chart">`;
    months.forEach((m,i)=>{
      const s=snapOf(m); const p=pct(s.overall.tr,s.overall.tot);
      const prev = i>0?snapOf(months[i-1]):null;
      const d = prev? p-pct(prev.overall.tr,prev.overall.tot) : null;
      h+=`<div class="trend-col ${m===cm?'cur':''}" title="${monthLabel(m)}: ${s.overall.tot>0?p+'% · '+s.overall.tr+' samostatných z '+s.overall.tot:'bez dat'}">
        <div class="trend-val" style="color:${s.overall.tot>0?colHex(p):'var(--ink3)'}">${s.overall.tot>0?p+'%':'—'}</div>
        <div class="trend-bar-wrap"><div class="trend-bar" style="height:${s.overall.tot>0?Math.max(3,p):0}%;background:${s.overall.tot>0?colHex(p):'var(--line)'}"></div></div>
        <div class="trend-m">${monthLabel(m)}${m===cm?' •':''}</div>
        <div class="trend-d ${d>0?'up':d<0?'down':''}">${d===null?'':d>0?'▲'+d:d<0?'▼'+Math.abs(d):'–'}</div>
      </div>`;
    });
    h+=`</div></div>`;
  }

  h+=`<div class="card card-pad">
    <div class="sec-title">Rizika pokrytí — celý závod</div>`;
  if(risks.length===0){
    h+=`<div class="risk-item g"><span class="risk-dot"></span><div class="risk-txt"><b>Vše v pořádku</b><small>Každá aktivní pozice má min. 2 samostatné operátory</small></div></div>`;
  } else {
    risks.slice(0,14).forEach(r=>{
      h+=`<div class="risk-item ${r.t}"><span class="risk-dot"></span><div class="risk-txt">${r.txt}<small>${r.sub}</small></div></div>`;
    });
    if(risks.length>14) h+=`<div class="hint">…a dalších ${risks.length-14}. Detail v matici dovedností.</div>`;
  }
  h+=`</div>`;

  el.innerHTML = h;
}

/* ============ RENDER: MATRIX ============ */
function renderMatrix(){
  buildProjSelect('mxArea', mxProj);
  const el = document.getElementById('matrixBody');
  const proj = projById(mxProj);
  if(!proj){ el.innerHTML=''; return; }

  const filterEl = document.getElementById('mxFilter');
  const filter = filterEl ? filterEl.value.trim().toLowerCase() : '';

  // operátor má na projektu kvalifikaci, pokud má úroveň ≥1 na některé pozici
  const hasQual = op => proj.positions.some(pos=>skillOf(op,proj.id,pos)>=1);
  const pool = activeOps();   // neaktivní (ukončení) se v matici nezobrazují
  const poolCount = pool.length;
  const qualifiedCount = pool.filter(hasQual).length;

  // sync přepínače (mohl se překreslit)
  const toggleEl = document.getElementById('mxShowAll');
  if(toggleEl) toggleEl.checked = mxShowAll;

  let ops = pool;
  if(!mxShowAll) ops = ops.filter(hasQual);   // výchozí: jen s kvalifikací
  if(filter) ops = ops.filter(o=>o.name.toLowerCase().includes(filter));

  if(DB.operators.length===0){
    el.innerHTML=`<div class="card"><div class="empty">
      ${quadHtml(2,'lg')}
      <h3>Zatím žádní operátoři</h3>
      <p>Přidej je v Nastavení — hromadné vložení ze seznamu je nejrychlejší.</p>
      <button class="btn" onclick="go('set')">Přidat operátory</button>
    </div></div>`;
    return;
  }
  if(proj.positions.length===0){
    el.innerHTML=`<div class="card"><div class="empty">
      ${quadHtml(1,'lg')}
      <h3>${proj.name} nemá definované pozice</h3>
      <p>Přidej pozice v Nastavení.</p>
      <button class="btn" onclick="go('set')">Otevřít nastavení</button>
    </div></div>`;
    return;
  }

  const countHdr = `<div class="mx-count">${proj.name} — <b>${qualifiedCount}</b> operátorů s kvalifikací / ${poolCount} v poolu</div>`;

  if(ops.length===0 && !mxShowAll && !filter){
    el.innerHTML = countHdr + `<div class="card"><div class="empty">
      ${quadHtml(0,'lg')}
      <h3>Žádný operátor nemá kvalifikaci na ${proj.name}</h3>
      <p>Zapni „Zobrazit všechny operátory" a přiřaď kvalifikace z poolu.</p>
    </div></div>`;
    return;
  }

  let h=countHdr+`<div class="matrix-wrap"><table class="mx"><thead><tr><th>Operátor</th>`;
  proj.positions.forEach(pos=>h+=`<th>${pos}</th>`);
  h+=`<th>Ø</th><th></th></tr></thead><tbody>`;

  ops.forEach(op=>{
    let sum=0, cnt=0;
    h+=`<tr><td>${op.name}</td>`;
    proj.positions.forEach(pos=>{
      const l = skillOf(op,proj.id,pos);
      if(l>0){sum+=l;cnt++;}
      h+=`<td><span class="mx-cell" onclick="cycleSkill('${op.id}','${proj.id}','${pos.replace(/'/g,"\\'")}')" title="${op.name} · ${pos} · úroveň ${l}">${quadHtml(l)}</span></td>`;
    });
    h+=`<td class="mx-avg">${cnt>0?(sum/cnt).toFixed(1):'—'}</td>`;
    h+=`<td class="op-actions"><button class="op-del" title="Odebrat operátora" onclick="delOperator('${op.id}')">✕</button></td></tr>`;
  });

  h+=`<tr style="background:#F5F8FC"><td style="font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--navy)">Pokrytí ≥2</td>`;
  proj.positions.forEach(pos=>{
    const c = coverage(proj.id,pos);
    const p2 = pct(c.tr,c.tot);
    h+=`<td style="font-size:12px;font-weight:800;color:${c.tot>0?colHex(p2):'var(--ink3)'}">${c.tot>0?c.tr+'/'+c.tot:'—'}</td>`;
  });
  h+=`<td></td><td></td></tr>`;
  h+=`</tbody></table></div>`;
  el.innerHTML = h;
}

function cycleSkill(opId, projId, pos){
  const op = DB.operators.find(o=>o.id===opId);
  if(!op) return;
  if(!op.skills) op.skills={};
  const k = skillKey(projId, pos);
  op.skills[k] = ((op.skills[k]||0)+1)%5;
  save(); renderMatrix();
}

/* ============ RENDER: PLAN (rozpis směn) ============ */
function renderPlan(){
  buildProjSelect('planArea', planProj);
  const mon = currentMonday();
  const wk = weekKey(mon);
  const sun = new Date(mon.getTime()+6*86400000);
  document.getElementById('weekLbl').textContent = `CW ${isoWeek(mon)} · ${fmtD(mon)} – ${fmtD(sun)}`;

  const el = document.getElementById('planBody');
  const proj = projById(planProj);
  if(!proj){ el.innerHTML=''; return; }

  if(DB.operators.length===0){
    el.innerHTML=`<div class="card"><div class="empty">
      ${quadHtml(3,'lg')}
      <h3>Zatím žádní operátoři</h3>
      <p>Nejprve přidej operátory v Nastavení a nastav jejich kvalifikace v matici.</p>
    </div></div>`;
    return;
  }
  if(proj.positions.length===0){
    el.innerHTML=`<div class="card"><div class="empty">
      ${quadHtml(1,'lg')}
      <h3>${proj.name} nemá definované pozice</h3>
      <p>Nejprve je přidej v Nastavení.</p>
    </div></div>`;
    return;
  }

  if(!DB.plans[wk]) DB.plans[wk]={};
  if(!DB.plans[wk][proj.id]) DB.plans[wk][proj.id]={};
  const plan = DB.plans[wk][proj.id];
  if(!DB.notes[wk]) DB.notes[wk]={};

  // tisková hlavička (jen pro tisk / PDF pro TL)
  let h=`<div class="print-head">
    <div class="ph-brand">SkillPlan · Yanfeng Automotive Interiors — Planá nad Lužnicí</div>
    <div class="ph-row">
      <span class="ph-title">${proj.name} — Rozpis směn</span>
      <span class="ph-cw">CW ${isoWeek(mon)} · ${fmtD(mon)} – ${fmtD(sun)}</span>
    </div>
    <div class="ph-sub">Vytištěno ${todayISO()}</div>
  </div>`;
  h+=`<div class="plan-wrap"><table class="plan-t"><thead><tr><th>${proj.name} — CW ${isoWeek(mon)}</th>`;
  PLAN_SHIFTS.forEach(s=>h+=`<th style="min-width:220px">${s.name}</th>`);
  h+=`</tr></thead><tbody>`;

  proj.positions.forEach(pos=>{
    if(!plan[pos]) plan[pos]={};
    h+=`<tr><td>${pos}</td>`;
    PLAN_SHIFTS.forEach(s=>{
      const assigned = plan[pos][s.id]||[];
      h+=`<td>`;
      assigned.forEach(opId=>{
        const op = DB.operators.find(o=>o.id===opId);
        if(!op){return;}
        const l = skillOf(op,proj.id,pos);
        const ended = !isActive(op);
        const cls = ended?'p-ended':l===0?'lvl0':l===1?'lvl1':'';
        const endNote = ended?` — ukončen${op.endDate?' '+op.endDate:''}`:'';
        h+=`<div class="p-chip ${cls}" title="${op.name} · úroveň ${l}${ended?endNote:(l===0?' — NENÍ ZAŠKOLEN':l===1?' — pouze pod dohledem':'')}">
          ${quadHtml(l,'sm')}
          <span>${op.name}${ended?' <small class="p-ended-tag">ukončen</small>':''}</span>
          <button class="x" onclick="unassign('${wk}','${pos.replace(/'/g,"\\'")}','${s.id}','${opId}')">✕</button>
        </div>`;
      });
      if(assigned.length>0){
        const levels = assigned.map(id=>{const o=DB.operators.find(x=>x.id===id);return o?skillOf(o,proj.id,pos):0;});
        const hasTrained = levels.some(l=>l>=2);
        const hasZero = levels.some(l=>l===0);
        const dc = hasZero?'dc-risk':hasTrained?'dc-ok':'dc-warn';
        const dcTxt = hasZero?'⚠ nezaškolen':hasTrained?'✓ pokryto':'jen dohled';
        h+=`<span class="day-cover ${dc}">${dcTxt}</span>`;
      }
      h+=`<button class="p-add" onclick="openPicker(event,'${wk}','${pos.replace(/'/g,"\\'")}','${s.id}')">+ přiřadit</button>`;
      h+=`</td>`;
    });
    h+=`</tr>`;
  });
  h+=`</tbody></table></div>`;

  // Notes (Dovolená / Nemoc / Poznámky)
  const noteVal = (DB.notes[wk][proj.id]||'').replace(/</g,'&lt;');
  h+=`<div class="card card-pad" style="margin-top:14px">
    <div class="sec-title">Dovolená · Nemoc · Poznámky (CW ${isoWeek(mon)})</div>
    <textarea class="bulk" style="min-height:70px;margin-top:0" placeholder="Např.: Novák Jan — dovolená 14.–18.7. · Svobodová — nemoc"
      onchange="saveNote('${wk}','${proj.id}',this.value)">${noteVal}</textarea>
    <div class="note-print">${noteVal || '—'}</div>
  </div>
  <div class="print-legend">
    Úrovně kvalifikace: <b>0</b> nezaškolen · <b>1</b> pod dohledem · <b>2</b> samostatný · <b>3</b> plná efektivita · <b>4</b> odborník &nbsp;|&nbsp;
    ✓ pokryto samostatným operátorem · jen dohled = jen operátor pod dohledem · ⚠ nezaškolen = přiřazen nezaškolený
  </div>
  <p class="hint no-print" style="margin-top:10px">Zelená = pokryto samostatným operátorem · oranžová = jen operátor pod dohledem · červená = přiřazen nezaškolený. „PDF pro TL" otevře tiskový dialog — vyber „Uložit jako PDF".</p>`;
  el.innerHTML = h;
}

function saveNote(wk, projId, val){
  if(!DB.notes[wk]) DB.notes[wk]={};
  DB.notes[wk][projId]=val;
  save();
  toast('Poznámka uložena');
}

function weekShift(dir){ weekOffset+=dir; closePicker(); renderPlan(); }

/* Export rozpisu pro TL — otevře tiskový dialog (Uložit jako PDF).
   Zajistí aktivní záložku Plán a zavře picker, ať se netiskne. */
function printPlan(){
  closePicker();
  if(!document.getElementById('v-plan').classList.contains('on')) go('plan');
  else renderPlan();
  setTimeout(()=>window.print(), 60);
}

function openPicker(ev, wk, pos, shiftId){
  closePicker();
  const proj = projById(planProj);
  const ops = activeOps();   // ukončení operátoři se v pickeru nenabízejí
  const planPos = (DB.plans[wk][proj.id]||{})[pos];
  const assignedArr = (planPos&&planPos[shiftId])||[];

  // Operators already assigned elsewhere this week+shift (any position, this project)
  const busy = new Set();
  const projPlan = DB.plans[wk][proj.id]||{};
  Object.keys(projPlan).forEach(p2=>{
    (projPlan[p2][shiftId]||[]).forEach(id=>busy.add(id));
  });

  const sorted = [...ops].sort((a,b)=>skillOf(b,proj.id,pos)-skillOf(a,proj.id,pos));

  const p = document.createElement('div');
  p.className='picker';
  const shiftName = PLAN_SHIFTS.find(s=>s.id===shiftId).name;
  let h=`<div class="picker-hdr">${pos} · ${shiftName}</div>`;
  if(sorted.length===0){
    h+=`<div class="picker-empty">Žádní operátoři</div>`;
  }
  sorted.forEach(op=>{
    const l = skillOf(op,proj.id,pos);
    const dis = assignedArr.includes(op.id);
    const isBusy = busy.has(op.id) && !dis;
    h+=`<div class="picker-item ${dis?'dis':''}" ${dis?'':`onclick="assign('${wk}','${pos.replace(/'/g,"\\'")}','${shiftId}','${op.id}')"`}>
      ${quadHtml(l,'sm')}
      <span>${op.name}${isBusy?' ⚠':''}</span>
      <small>${l===0?'nezaškolen':l===1?'dohled':'úr. '+l}${isBusy?' · již v rozpisu':''}</small>
    </div>`;
  });
  p.innerHTML=h;
  document.body.appendChild(p);
  pickerEl=p;
  const r = ev.target.getBoundingClientRect();
  const ph = Math.min(320, p.offsetHeight);
  let top = r.bottom+4;
  if(top+ph>window.innerHeight) top = Math.max(8, r.top-ph-4);
  let left = Math.min(r.left, window.innerWidth-p.offsetWidth-12);
  p.style.top=top+'px';
  p.style.left=left+'px';
  setTimeout(()=>document.addEventListener('click', outsidePicker),0);
}
function outsidePicker(e){
  if(pickerEl && !pickerEl.contains(e.target)) closePicker();
}
function closePicker(){
  if(pickerEl){ pickerEl.remove(); pickerEl=null; document.removeEventListener('click', outsidePicker); }
}
function assign(wk, pos, shiftId, opId){
  const proj = projById(planProj);
  const plan = DB.plans[wk][proj.id];
  if(!plan[pos]) plan[pos]={};
  if(!plan[pos][shiftId]) plan[pos][shiftId]=[];
  if(!plan[pos][shiftId].includes(opId)) plan[pos][shiftId].push(opId);
  const op = DB.operators.find(o=>o.id===opId);
  const l = op?skillOf(op,proj.id,pos):0;
  if(l===0) toast('⚠ Pozor: operátor není na tuto pozici zaškolen');
  else if(l===1) toast('Operátor smí pracovat pouze pod dohledem (úroveň 1)');
  save(); closePicker(); renderPlan();
}
function unassign(wk, pos, shiftId, opId){
  const proj = projById(planProj);
  const p2 = (((DB.plans[wk]||{})[proj.id]||{})[pos]||{});
  if(p2[shiftId]) p2[shiftId]=p2[shiftId].filter(x=>x!==opId);
  save(); renderPlan();
}
function copyPrevWeek(){
  const proj = projById(planProj);
  const mon = currentMonday();
  const prev = new Date(mon.getTime()-7*86400000);
  const wkPrev = weekKey(mondayOf(prev)), wk = weekKey(mon);
  const src = (DB.plans[wkPrev]||{})[proj.id];
  if(!src){ toast('Minulý týden nemá pro tento projekt žádný rozpis'); return; }
  if(!DB.plans[wk]) DB.plans[wk]={};
  DB.plans[wk][proj.id]=JSON.parse(JSON.stringify(src));
  const srcNote = (DB.notes[wkPrev]||{})[proj.id];
  if(srcNote){ if(!DB.notes[wk]) DB.notes[wk]={}; DB.notes[wk][proj.id]=srcNote; }
  save(); renderPlan();
  toast('Rozpis zkopírován z minulého týdne');
}

/* ============ RENDER: SETTINGS ============ */
function renderSet(){
  const ops = activeOps();
  document.getElementById('opTags').innerHTML = ops.length
    ? ops.map(o=>`<span class="tag">${o.name}<button class="tag-end" onclick="endOperator('${o.id}')" title="Ukončit — odchod ze závodu">Ukončit</button><button onclick="delOperator('${o.id}')" title="Smazat natrvalo (omyl / duplicita)">✕</button></span>`).join('')
    : `<span class="hint">Zatím žádní aktivní operátoři. Nejrychlejší je hromadné vložení — zkopíruj sloupec jmen z Excelu.</span>`;

  // sekce Ukončení operátoři
  const ended = endedOps();
  const endedWrap = document.getElementById('endedWrap');
  if(endedWrap){
    endedWrap.style.display = ended.length ? '' : 'none';
    const cnt = document.getElementById('endedCount');
    if(cnt) cnt.textContent = ended.length ? `(${ended.length})` : '';
    const et = document.getElementById('endedTags');
    if(et) et.innerHTML = ended.map(o=>
      `<span class="tag tag-ended">${o.name}<small class="tag-date">ukončen ${o.endDate||'—'}</small><button class="tag-restore" onclick="restoreOperator('${o.id}')" title="Obnovit — návrat do poolu">Obnovit</button></span>`
    ).join('');
  }

  const el = document.getElementById('areaList');
  el.innerHTML = DB.projects.map(a=>`
    <div style="border:1.5px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px">
        <b style="font-size:13.5px">${a.name}</b>
        <span class="hint" style="margin:0">${a.positions.length} pozic</span>
        <button class="op-del" style="margin-left:auto" title="Odebrat projekt" onclick="delArea('${a.id}')">✕</button>
      </div>
      <div class="tag-list" style="margin-top:8px">
        ${a.positions.map((s,i)=>`<span class="tag">${s}<button onclick="delAreaStation('${a.id}',${i})">✕</button></span>`).join('')}
      </div>
      <div class="add-row" style="margin-top:8px">
        <input type="text" id="st_${a.id}" placeholder="Nová pozice pro ${a.name}" onkeydown="if(event.key==='Enter')addAreaStation('${a.id}')">
        <button class="btn sm sec" onclick="addAreaStation('${a.id}')">Přidat</button>
      </div>
    </div>
  `).join('');
}
function addOperator(){
  const inp = document.getElementById('newOpName');
  const name = inp.value.trim();
  if(!name) return;
  DB.operators.push({id:uid(), name, skills:{}, active:true});
  inp.value='';
  save(); renderSet();
}
function bulkAdd(){
  const ta = document.getElementById('bulkOps');
  const names = ta.value.split('\n').map(x=>x.trim()).filter(x=>x.length>1);
  if(names.length===0) return;
  const existing = new Set(DB.operators.map(o=>o.name.toLowerCase()));
  let added=0, skipped=0;
  names.forEach(name=>{
    if(existing.has(name.toLowerCase())){ skipped++; return; }
    DB.operators.push({id:uid(), name, skills:{}, active:true});
    existing.add(name.toLowerCase());
    added++;
  });
  ta.value='';
  save(); renderSet();
  toast(`Přidáno ${added} operátorů${skipped?` · ${skipped} duplicit přeskočeno`:''}`);
}
function delOperator(id){
  const op = DB.operators.find(o=>o.id===id);
  if(!op) return;
  if(!confirm(`Smazat operátora ${op.name} NATRVALO? Odstraní se i jeho kvalifikace a přiřazení v rozpisech.\n\n(Pro běžný odchod ze závodu použij „Ukončit" — data zůstanou zachována.)`)) return;
  DB.operators = DB.operators.filter(o=>o.id!==id);
  Object.values(DB.plans).forEach(w=>Object.values(w).forEach(pr=>Object.values(pr).forEach(posObj=>{
    Object.keys(posObj).forEach(sh=>{ posObj[sh]=posObj[sh].filter(x=>x!==id); });
  })));
  save(); render();
}
function endOperator(id){
  const op = DB.operators.find(o=>o.id===id);
  if(!op) return;
  if(!confirm(`Ukončit operátora ${op.name}? Přesune se mezi ukončené — zmizí z matice, pickeru rozpisu i výpočtu pokrytí. V historických rozpisech zůstane viditelný, kvalifikace se zachovají.`)) return;
  op.active = false;
  op.endDate = todayISO();
  save(); render();
  toast(`${op.name} ukončen (${op.endDate})`);
}
function restoreOperator(id){
  const op = DB.operators.find(o=>o.id===id);
  if(!op) return;
  op.active = true;
  delete op.endDate;
  save(); render();
  toast(`${op.name} obnoven — zpět v poolu`);
}
function addArea(){
  const inp = document.getElementById('newArea');
  const name = inp.value.trim();
  if(!name) return;
  DB.projects.push({id:uid('pr'), name, positions:['TL','TR']});
  inp.value='';
  save(); renderSet();
}
function delArea(id){
  const a = projById(id);
  if(!a) return;
  if(!confirm(`Odebrat projekt „${a.name}"? Odstraní se i kvalifikace operátorů a rozpisy pro tento projekt.`)) return;
  DB.projects = DB.projects.filter(x=>x.id!==id);
  DB.operators.forEach(o=>{
    if(o.skills) Object.keys(o.skills).forEach(k=>{ if(k.startsWith(id+'::')) delete o.skills[k]; });
  });
  Object.values(DB.plans).forEach(w=>{ delete w[id]; });
  Object.values(DB.notes).forEach(w=>{ delete w[id]; });
  if(mxProj===id) mxProj = DB.projects[0]?DB.projects[0].id:null;
  if(planProj===id) planProj = DB.projects[0]?DB.projects[0].id:null;
  save(); render();
}
function addAreaStation(projId){
  const inp = document.getElementById('st_'+projId);
  const name = inp.value.trim();
  const a = projById(projId);
  if(!name || !a || a.positions.includes(name)) return;
  a.positions.push(name);
  inp.value='';
  save(); renderSet();
}
function delAreaStation(projId, i){
  const a = projById(projId);
  if(!a) return;
  const pos = a.positions[i];
  if(!confirm(`Odebrat pozici „${pos}" z projektu ${a.name}?`)) return;
  a.positions.splice(i,1);
  DB.operators.forEach(o=>{ if(o.skills) delete o.skills[skillKey(projId,pos)]; });
  Object.values(DB.plans).forEach(w=>{ if(w[projId]) delete w[projId][pos]; });
  save(); render();
}

/* ============ DATA EXPORT / IMPORT ============ */
function exportData(){
  const blob = new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `skillplan_zaloha_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  toast('Záloha stažena');
}
function importData(inp){
  const f = inp.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = e=>{
    try{
      const data = JSON.parse(e.target.result);
      if(!data.projects || !data.operators) throw new Error('Neplatný formát');
      if(!data.notes) data.notes={};
      DB = data;
      mxProj = DB.projects[0]?DB.projects[0].id:null;
      planProj = mxProj;
      save(); render();
      toast('Data importována');
    }catch(err){ toast('Chyba importu: '+err.message); }
  };
  r.readAsText(f);
  inp.value='';
}
function resetAll(){
  if(!confirm('Opravdu smazat VŠECHNA data (operátoři, matice, rozpisy)? Doporučujeme nejdřív export zálohy.')) return;
  if(!confirm('Poslední potvrzení — akce je nevratná.')) return;
  DB = {projects:JSON.parse(JSON.stringify(DEFAULT_PROJECTS)), operators:[], plans:{}, notes:{}};
  mxProj = DB.projects[0].id; planProj = mxProj;
  save(); render();
}


/* ============ IMPORT OFICIÁLNÍ SKILL MATRIX (.xlsx) ============ */
function normName(s){ return String(s||'').trim().replace(/\s+/g,' '); }

function importMatrix(inp){
  const f = inp.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = e=>{
    try{
      if(typeof XLSX==='undefined') throw new Error('Knihovna XLSX se nenačetla');
      const wb = XLSX.read(e.target.result, {type:'array'});
      const result = parseOfficialMatrix(wb);
      if(!result) throw new Error('V souboru nebyl nalezen formát skill matrix (hledám řádek „Jméno / Operace")');
      applyMatrixImport(result);
    }catch(err){ toast('Chyba importu: '+err.message); }
  };
  reader.onerror = ()=>toast('Chyba čtení souboru');
  reader.readAsArrayBuffer(f);
  inp.value='';
}

function parseOfficialMatrix(wb){
  let procName = null;
  let stations = null;
  const employees = new Map(); // normName -> {name, pozice, skills:{station:level}}

  wb.SheetNames.forEach(sn=>{
    const ws = wb.Sheets[sn];
    // normalizace rozsahu: list může mít !ref např. B2:DD223 — bez normalizace
    // by se sloupce posunuly (r[1] by nebylo „Jméno" ve sl. B). Čteme vždy od A1.
    let opts = {header:1, defval:null};
    if(ws['!ref']){
      const rng = XLSX.utils.decode_range(ws['!ref']);
      rng.s.r = 0; rng.s.c = 0;
      opts.range = rng;
    }
    const rows = XLSX.utils.sheet_to_json(ws, opts);
    if(rows.length<10) return;

    // 1) najdi header řádek: col1 začíná "Jméno"
    let hdrIdx = -1;
    for(let i=0;i<Math.min(rows.length,15);i++){
      const r = rows[i]||[];
      if(typeof r[1]==='string' && r[1].trim().toLowerCase().startsWith('jméno')){ hdrIdx=i; break; }
    }
    if(hdrIdx<0) return; // list bez matice (Grafika, Plán zaškolení…)

    // 2) proces: řádek s "Proces" nad headerem — hodnota v col4, jinak text za dvojtečkou
    if(!procName){
      for(let i=0;i<hdrIdx;i++){
        const r = rows[i]||[];
        const c1 = String(r[1]||'');
        if(c1.toLowerCase().includes('proces')){
          procName = normName(r[4]) || normName(c1.split(':')[1]) || null;
          break;
        }
      }
    }

    // 3) pracoviště: z header řádku, col 4, krok 6
    const hdr = rows[hdrIdx]||[];
    const sts = [];
    for(let c=4;c<hdr.length;c+=6){
      const v = hdr[c];
      if(v===null||v===undefined||String(v).trim()==='') break;
      sts.push(normName(v));
    }
    if(sts.length===0) return;
    if(!stations) stations = sts;

    // 4) bloky zaměstnanců: jméno col1 + pozice col3; score řádek hledej +3..+8 (max==5 v col+2)
    const POS_OK = new Set(['OP','TL','TR','OP/TL','TL/OP']);
    for(let i=hdrIdx+1;i<rows.length;i++){
      const r = rows[i]||[];
      const name = r[1];
      const poz = String(r[3]||'').trim();
      if(!name || typeof name!=='string' || name.trim().length<4) continue;
      if(!POS_OK.has(poz)) continue;

      let sr = null;
      for(let off=3;off<=8;off++){
        const cand = rows[i+off]||[];
        const hasMax = sts.some((_,si)=>{
          const mx = cand[4+si*6+2];
          return mx===5 || mx==='5';
        });
        if(hasMax){ sr=cand; break; }
      }
      if(!sr) continue;

      const key = normName(name).toLowerCase();
      if(!employees.has(key)) employees.set(key, {name:normName(name), pozice:poz, skills:{}});
      const emp = employees.get(key);
      sts.forEach((st,si)=>{
        const c = 4+si*6;
        const mx = sr[c+2];
        if(!(mx===5||mx==='5')) return;
        let sc = sr[c];
        if(sc===null||sc===undefined||sc==='') return;
        sc = typeof sc==='string' ? parseFloat(sc) : sc;
        if(isNaN(sc)) return;
        sc = Math.max(0, Math.min(4, Math.round(sc)));
        if(sc>0) emp.skills[st] = Math.max(emp.skills[st]||0, sc);
      });
    }
  });

  if(!stations || employees.size===0) return null;
  return {procName: procName||'Nový proces', stations, employees:[...employees.values()]};
}

/* case-insensitive klíč pro párování pozic */
function posNorm(s){ return normName(s).toLowerCase(); }

/* nese pozice v projektu nějaká data? (kvalifikace operátorů nebo přiřazení v rozpisech) */
function positionHasData(db, projId, pos){
  const kk = skillKey(projId, pos);
  if((db.operators||[]).some(o=>o.skills && o.skills[kk]>0)) return true;
  return Object.values(db.plans||{}).some(w=>{
    const pr = w[projId]; if(!pr || !pr[pos]) return false;
    return PLAN_SHIFTS.some(s=>(pr[pos][s.id]||[]).length>0);
  });
}

/* přesun kvalifikací i přiřazení ze staré pozice na novou (oficiální pravopis) */
function migratePositionData(db, projId, oldPos, newPos){
  if(oldPos===newPos) return;
  const ok = skillKey(projId, oldPos), nk = skillKey(projId, newPos);
  (db.operators||[]).forEach(o=>{
    if(o.skills && ok in o.skills){
      o.skills[nk] = Math.max(o.skills[nk]||0, o.skills[ok]);
      delete o.skills[ok];
    }
  });
  Object.values(db.plans||{}).forEach(w=>{
    const pr = w[projId]; if(!pr || !(oldPos in pr)) return;
    if(!(newPos in pr)){ pr[newPos]=pr[oldPos]; }
    else PLAN_SHIFTS.forEach(s=>{
      const a = pr[newPos][s.id]||[], b = pr[oldPos][s.id]||[];
      pr[newPos][s.id] = [...new Set([...a,...b])];
    });
    delete pr[oldPos];
  });
}

/* odstranění dat pozice (kvalifikace + přiřazení) */
function removePositionData(db, projId, pos){
  const kk = skillKey(projId, pos);
  (db.operators||[]).forEach(o=>{ if(o.skills) delete o.skills[kk]; });
  Object.values(db.plans||{}).forEach(w=>{ if(w[projId]) delete w[projId][pos]; });
}

function applyMatrixImport(res){
  // 1) najdi / vytvoř projekt
  const pn = res.procName.toLowerCase();
  let proj = DB.projects.find(p=>{
    const n = p.name.toLowerCase();
    return n===pn || n.includes(pn) || pn.includes(n);
  });
  let projCreated = false;
  if(!proj){
    proj = {id:uid('pr'), name:res.procName, positions:['TL','TR']};
    DB.projects.push(proj);
    projCreated = true;
  }

  // 2) oficiální matice = zdroj pravdy pro pozice.
  //    Sestav cílový seznam: TL, TR + pracoviště z matice (pravopis z matice).
  const officialPos = [];
  const officialByNorm = new Map();
  ['TL','TR'].forEach(p=>{ officialPos.push(p); officialByNorm.set(posNorm(p), p); });
  res.stations.forEach(st=>{
    const stU = RENAME_MAP[st]||st;
    const k = posNorm(stU);
    if(!officialByNorm.has(k)){ officialPos.push(stU); officialByNorm.set(k, stU); }
  });

  // 2b) slaď původní pozice projektu s oficiální maticí
  let posMigrated = 0, posRemoved = 0;
  const posKept = [];
  proj.positions.forEach(oldPos=>{
    const match = officialByNorm.get(posNorm(oldPos));
    if(match){
      // case-insensitive shoda → přemigruj data na oficiální pravopis
      if(match!==oldPos){ migratePositionData(DB, proj.id, oldPos, match); posMigrated++; }
    } else if(positionHasData(DB, proj.id, oldPos)){
      // bez shody, ale nese data → ponech na konci
      posKept.push(oldPos);
    } else {
      // bez shody a bez dat → odstraň
      removePositionData(DB, proj.id, oldPos);
      posRemoved++;
    }
  });
  proj.positions = officialPos.concat(posKept);

  // 3) operátoři + kvalifikace (oficiální hodnoty přepisují — zdroj pravdy)
  const byName = new Map(DB.operators.map(o=>[normName(o.name).toLowerCase(), o]));
  let opsNew = 0, skillsSet = 0, opsReactivated = 0;
  res.employees.forEach(emp=>{
    const key = normName(emp.name).toLowerCase();
    let op = byName.get(key);
    if(!op){
      op = {id:uid(), name:emp.name, skills:{}, active:true};
      DB.operators.push(op);
      byName.set(key, op);
      opsNew++;
    } else if(!isActive(op)){
      // v matici by nebyl, kdyby nepracoval → reaktivuj (např. agenturní návrat)
      op.active = true;
      delete op.endDate;
      opsReactivated++;
    }
    if(!op.skills) op.skills={};
    Object.entries(emp.skills).forEach(([st,lvl])=>{
      const stU = RENAME_MAP[st]||st;
      op.skills[skillKey(proj.id, stU)] = lvl;
      skillsSet++;
    });
  });

  save();
  mxProj = proj.id;
  render();
  let msg = `Import: ${proj.name}${projCreated?' (nový projekt)':''} · ${res.stations.length} pozic`;
  const chg = [];
  if(posMigrated) chg.push(`${posMigrated} přejmenováno`);
  if(posRemoved) chg.push(`${posRemoved} odstraněno`);
  if(posKept.length) chg.push(`${posKept.length} ponecháno`);
  if(chg.length) msg += ` (${chg.join(', ')})`;
  msg += ` · ${res.employees.length} operátorů (${opsNew} nových${opsReactivated?`, ${opsReactivated} reaktivováno`:''}) · ${skillsSet} kvalifikací`;
  if(posKept.length) msg += ` · ⚠ Mimo oficiální matici (nesou data): ${posKept.join(', ')}`;
  toast(msg);
}

/* ============ TOAST ============ */
let toastT = null;
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(()=>t.classList.remove('show'), 3200);
}

/* ============ MASTER RENDER ============ */
function render(){
  const active = document.querySelector('.view.on').id;
  if(active==='v-dash') renderDash();
  if(active==='v-matrix') renderMatrix();
  if(active==='v-plan') renderPlan();
  if(active==='v-set') renderSet();
}

/* ============ INIT ============ */
document.getElementById('topDate').textContent = new Date().toLocaleDateString('cs-CZ',{day:'numeric',month:'long',year:'numeric'});
captureSnapshot(); save();   // zaznamenej snímek připravenosti aktuálního měsíce
render();

