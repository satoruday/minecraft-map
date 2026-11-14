(function(){
const FONT="'M PLUS Rounded 1c','Hiragino Maru Gothic ProN','Hiragino Sans','Noto Sans JP',sans-serif";
const EMOJI="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
const DEFAULT_TYPES=[
  {id:'base',e:'🏠',n:'拠点',k:'きょてん',d:'over',c:'#e67e22'},
  {id:'village',e:'🏘️',n:'村',k:'むら',d:'over',c:'#d4a017'},
  {id:'ruinvillage',e:'🏚️',n:'廃村',k:'はいそん',d:'over',c:'#8d6e63'},
  {id:'plains',e:'🌱',n:'平原',k:'へいげん',d:'over',c:'#8bc34a',b:true},
  {id:'forest',e:'🌳',n:'森',k:'もり',d:'over',c:'#2e7d32',b:true},
  {id:'desert',e:'🌵',n:'砂漠',k:'さばく',d:'over',c:'#e0b84a',b:true},
  {id:'snowy',e:'❄️',n:'雪原',k:'せつげん',d:'over',c:'#90caf9',b:true},
  {id:'jungle',e:'🌴',n:'ジャングル',k:'',d:'over',c:'#1b9e5a',b:true},
  {id:'ocean',e:'🌊',n:'海',k:'うみ',d:'over',c:'#1e88e5',b:true},
  {id:'mountain',e:'⛰️',n:'山',k:'やま',d:'over',c:'#8d8d8d',b:true},
  {id:'monument',e:'🔱',n:'海底神殿',k:'かいていしんでん',d:'over',c:'#26a69a'},
  {id:'outpost',e:'🏴',n:'前哨基地',k:'ぜんしょうきち',d:'over',c:'#607d8b'},
  {id:'mansion',e:'🏰',n:'森の洋館',k:'もりのようかん',d:'over',c:'#6d4c41'},
  {id:'stronghold',e:'👁️',n:'エンド要塞',k:'エンドようさい',d:'over',c:'#00897b'},
  {id:'trial',e:'🗝️',n:'トライアルチャンバー',k:'',d:'over',c:'#b87333'},
  {id:'ruinportal',e:'🌀',n:'荒廃したポータル',k:'こうはいしたポータル',d:'both',c:'#8e44ad'},
  {id:'mineshaft',e:'⛏️',n:'廃坑',k:'はいこう',d:'over',c:'#a1887f'},
  {id:'cave',e:'🕳️',n:'洞窟',k:'どうくつ',d:'over',c:'#546e7a'},
  {id:'gate',e:'🟪',n:'ネザーゲート',k:'',d:'both',c:'#7e57c2'},
  {id:'fortress',e:'🔥',n:'ネザー要塞',k:'ネザーようさい',d:'nether',c:'#e53935'},
  {id:'bastion',e:'🐷',n:'ピグリン要塞',k:'ピグリンようさい',d:'nether',c:'#f9a825'},
  {id:'warped',e:'🌿',n:'歪んだ森',k:'ゆがんだもり',d:'nether',c:'#14a89a',b:true},
  {id:'crimson',e:'🍄',n:'真紅の森',k:'しんくのもり',d:'nether',c:'#c62828',b:true},
  {id:'soulvalley',e:'💀',n:'ソウルサンドの谷',k:'ソウルサンドのたに',d:'nether',c:'#6d8fa8',b:true},
  {id:'basalt',e:'🌋',n:'玄武岩の三角州',k:'げんぶがんのさんかくす',d:'nether',c:'#78909c',b:true},
  {id:'wastes',e:'🏜️',n:'ネザーの荒地',k:'ネザーのあれち',d:'nether',c:'#a1452f',b:true},
  {id:'other',e:'📍',n:'その他',k:'そのた',d:'both',c:'#90a4ae'}
];
const KEY='bouken-map-v1';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data={pins:[],custom:[]};
try{const r=localStorage.getItem(KEY);if(r){const p=JSON.parse(r);if(p&&Array.isArray(p.pins))data={pins:p.pins,custom:Array.isArray(p.custom)?p.custom:[]};}}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){}}
const types=()=>DEFAULT_TYPES.concat(data.custom);
const typeOf=id=>types().find(t=>t.id===id)||DEFAULT_TYPES[DEFAULT_TYPES.length-1];
const label=p=>{const n=p.name||typeOf(p.type).n;return p.kana&&p.kana!==n?`${n}（${p.kana}）`:n};
const dimName=d=>d==='nether'?'ネザー':'オーバーワールド';
const typesFor=d=>{const a=types();return[...a.filter(t=>t.d===d&&!t.b),...a.filter(t=>t.d==='both'),...a.filter(t=>t.d===d&&t.b)]};
const RADII={over:{s:64,m:160,l:320},nether:{s:32,m:80,l:160}};
const SIZE_LABEL={s:'ちいさい',m:'ふつう',l:'おおきい'};
const radius=p=>RADII[p.dim][p.size||'m'];
const rgba=(h,a)=>{let m=String(h||'#90a4ae').replace('#','');if(m.length===3)m=m.split('').map(c=>c+c).join('');const n=parseInt(m,16)||0;return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};

let dim='over',highlight=null;
const views={over:{cx:0,cz:0,s:.5,fit:false},nether:{cx:0,cz:0,s:1,fit:false}};

/* ---------- map ---------- */
const canvas=$('#map'),ctx=canvas.getContext('2d');let W=0,H=0,dpr=1,raf=0;
function resize(){const r=canvas.getBoundingClientRect();dpr=window.devicePixelRatio||1;W=r.width;H=r.height;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);if(!views[dim].fit){fitAll();views[dim].fit=true}draw()}
new ResizeObserver(resize).observe(canvas);
const req=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;draw()})};
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function niceStep(s){for(const st of [1,2,4,8,16,32,64,128,256,512,1024,2048,4096,8192,16384,32768]){if(st*s>=60)return st}return 65536}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function draw(){
  if(!W)return;const v=views[dim],P=dim==='over'?'--ow':'--nt';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle=css(P+'-bg');ctx.fillRect(0,0,W,H);
  const step=niceStep(v.s),x0=v.cx-W/2/v.s,x1=v.cx+W/2/v.s,z0=v.cz-H/2/v.s,z1=v.cz+H/2/v.s;
  const sx=x=>(x-v.cx)*v.s+W/2,sy=z=>(z-v.cz)*v.s+H/2;
  ctx.strokeStyle=css(P+'-grid');ctx.lineWidth=1;ctx.beginPath();
  for(let x=Math.floor(x0/step)*step;x<=x1;x+=step){const p=Math.round(sx(x))+.5;ctx.moveTo(p,0);ctx.lineTo(p,H)}
  for(let z=Math.floor(z0/step)*step;z<=z1;z+=step){const p=Math.round(sy(z))+.5;ctx.moveTo(0,p);ctx.lineTo(W,p)}
  ctx.stroke();
  ctx.strokeStyle=css(P+'-axis');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx(0),0);ctx.lineTo(sx(0),H);ctx.moveTo(0,sy(0));ctx.lineTo(W,sy(0));ctx.stroke();
  ctx.fillStyle=css(P+'-label');ctx.font='700 11px '+FONT;ctx.textBaseline='bottom';ctx.textAlign='left';
  for(let x=Math.floor(x0/step)*step;x<=x1;x+=step){ctx.fillText(String(x),sx(x)+3,H-34)}
  ctx.textBaseline='top';
  for(let z=Math.floor(z0/step)*step;z<=z1;z+=step){if(sy(z)>40)ctx.fillText(String(z),4,sy(z)+3)}
  const ps=data.pins.filter(p=>p.dim===dim);
  if(!ps.length){ctx.fillStyle=css(P+'-label');ctx.font='800 15px '+FONT;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('まだピンがないよ',W/2,H/2-12);ctx.font='700 12px '+FONT;ctx.fillText('したの「＋ピンをたてる」からはじめよう',W/2,H/2+12)}
  const pinBg=css('--pin-bg'),edge=css('--pin-edge'),lbg=css('--label-bg'),link=css('--label-ink');
  for(const p of ps){const t=typeOf(p.type);if(!t.b)continue;const x=sx(p.x),y=sy(p.z),R=Math.max(radius(p)*v.s,1);if(x<-R-80||x>W+R+80||y<-R-80||y>H+R+80)continue;
    const k=Math.min(1,Math.max(0,(140-R)/100));
    const g=ctx.createRadialGradient(x,y,0,x,y,R);g.addColorStop(0,rgba(t.c,.5+.35*k));g.addColorStop(.35+.2*k,rgba(t.c,.4+.35*k));g.addColorStop(.6+.2*k,rgba(t.c,.28+.27*k));g.addColorStop(1,rgba(t.c,0));
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.fill();
    if(highlight===p.id){ctx.setLineDash([6,5]);ctx.lineWidth=2;ctx.strokeStyle=rgba(t.c,.9);ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}
    ctx.textAlign='center';ctx.textBaseline='middle';
    if(R>=28){const busy=ps.some(q=>!typeOf(q.type).b&&Math.hypot(sx(q.x)-x,sy(q.z)-y)<44);const ly=busy?y-52:y;ctx.font='16px '+EMOJI;ctx.fillStyle=link;ctx.fillText(t.e,x,ly-10);const lab=label(p);ctx.font='800 12px '+FONT;ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle=lbg;ctx.strokeText(lab,x,ly+10);ctx.fillStyle=link;ctx.fillText(lab,x,ly+10)}
    else{ctx.font='12px '+EMOJI;ctx.fillStyle=link;ctx.fillText(t.e,x,y)}}
  for(const p of ps){
    const x=sx(p.x),y=sy(p.z);if(typeOf(p.type).b)continue;if(x<-120||x>W+120||y<-60||y>H+60)continue;
    const t=typeOf(p.type),hl=highlight===p.id,r=hl?21:17;
    if(hl){ctx.fillStyle='rgba(255,215,64,.45)';ctx.beginPath();ctx.arc(x,y,32,0,Math.PI*2);ctx.fill()}
    rr(x-r,y-r+3,r*2,r*2,6);ctx.fillStyle=edge;ctx.fill();
    rr(x-r,y-r,r*2,r*2,6);ctx.fillStyle=pinBg;ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=t.c||'#90a4ae';ctx.stroke();
    ctx.font=(hl?22:18)+'px '+EMOJI;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=link;ctx.fillText(t.e,x,y+1);
    if(p.type==='gate'&&p.link){ctx.beginPath();ctx.arc(x+r,y-r,9,0,Math.PI*2);ctx.fillStyle=pinBg;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=t.c;ctx.stroke();ctx.font='11px '+EMOJI;ctx.fillStyle=link;ctx.fillText('🔗',x+r,y-r+1)}
    const lab=label(p);ctx.font='800 12px '+FONT;const tw=ctx.measureText(lab).width;
    rr(x-tw/2-7,y+r+6,tw+14,21,7);ctx.fillStyle=lbg;ctx.fill();ctx.fillStyle=link;ctx.fillText(lab,x,y+r+17);
  }
  ctx.lineCap='round';for(const [lw,col] of [[5,lbg],[2,link]]){ctx.lineWidth=lw;ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(W/2-10,H/2);ctx.lineTo(W/2+10,H/2);ctx.moveTo(W/2,H/2-10);ctx.lineTo(W/2,H/2+10);ctx.stroke()}ctx.lineCap='butt';
  $('#readout').textContent=`まんなか X ${Math.round(v.cx)} / Z ${Math.round(v.cz)}`;
}
function zoomAt(px,py,f){const v=views[dim];const ns=Math.min(16,Math.max(.02,v.s*f));const wx=(px-W/2)/v.s+v.cx,wz=(py-H/2)/v.s+v.cz;v.s=ns;v.cx=wx-(px-W/2)/ns;v.cz=wz-(py-H/2)/ns;req()}
function fitAll(){const v=views[dim],ps=data.pins.filter(p=>p.dim===dim);
  if(!ps.length){v.cx=0;v.cz=0;v.s=dim==='over'?.5:1;req();return}
  let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const p of ps){a=Math.min(a,p.x);b=Math.max(b,p.x);c=Math.min(c,p.z);d=Math.max(d,p.z)}
  v.cx=(a+b)/2;v.cz=(c+d)/2;const s=Math.min((W-140)/Math.max(b-a,60),(H-150)/Math.max(d-c,60));v.s=Math.min(3,Math.max(.02,s||.5));req()}
function centerOn(p){const v=views[dim];v.cx=p.x;v.cz=p.z;if(v.s<.4)v.s=.8;highlight=p.id;req()}
const pts=new Map();let tapStart=null,moved=false,pinchPrev=null;
function pinchInfo(){const a=[...pts.values()];return{mx:(a[0].x+a[1].x)/2,my:(a[0].y+a[1].y)/2,d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1}}
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pts.size===1){tapStart={x:e.clientX,y:e.clientY};moved=false}else{moved=true;pinchPrev=pts.size===2?pinchInfo():null}});
canvas.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;const prev=pts.get(e.pointerId),cur={x:e.clientX,y:e.clientY};pts.set(e.pointerId,cur);const v=views[dim];
  if(pts.size===1){if(tapStart&&Math.hypot(cur.x-tapStart.x,cur.y-tapStart.y)>6)moved=true;if(moved){v.cx-=(cur.x-prev.x)/v.s;v.cz-=(cur.y-prev.y)/v.s;req()}}
  else if(pts.size===2){const info=pinchInfo();if(pinchPrev){const r=canvas.getBoundingClientRect();v.cx-=(info.mx-pinchPrev.mx)/v.s;v.cz-=(info.my-pinchPrev.my)/v.s;zoomAt(info.mx-r.left,info.my-r.top,info.d/pinchPrev.d)}pinchPrev=info}});
function endPtr(e){if(!pts.has(e.pointerId))return;const single=pts.size===1;pts.delete(e.pointerId);
  if(single&&!moved&&e.type==='pointerup'){const r=canvas.getBoundingClientRect();tapAt(e.clientX-r.left,e.clientY-r.top)}
  pinchPrev=pts.size===2?pinchInfo():null}
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoomAt(e.clientX-r.left,e.clientY-r.top,Math.exp(-e.deltaY*.0015))},{passive:false});
function tapAt(x,y){const v=views[dim];let best=null,bd=30;for(const p of data.pins){if(p.dim!==dim||typeOf(p.type).b)continue;const d=Math.hypot((p.x-v.cx)*v.s+W/2-x,(p.z-v.cz)*v.s+H/2-y);if(d<bd){bd=d;best=p}}
  if(!best){let br=Infinity;for(const p of data.pins){if(p.dim!==dim||!typeOf(p.type).b)continue;const R=Math.max(radius(p)*v.s,24);const d=Math.hypot((p.x-v.cx)*v.s+W/2-x,(p.z-v.cz)*v.s+H/2-y);if(d<R&&R<br){br=R;best=p}}}
  if(best){highlight=best.id;req();openDetail(best)}else if(highlight){highlight=null;req()}}
$('#zin').onclick=()=>zoomAt(W/2,H/2,1.5);$('#zout').onclick=()=>zoomAt(W/2,H/2,1/1.5);$('#zfit').onclick=fitAll;

function setDim(d){dim=d;document.body.dataset.dim=d;document.querySelectorAll('header .seg button').forEach(b=>b.classList.toggle('on',b.dataset.dim===d));if(!views[d].fit){views[d].fit=true;fitAll()}req()}
document.querySelectorAll('header .seg button').forEach(b=>b.onclick=()=>setDim(b.dataset.dim));

/* ---------- sheets ---------- */
function openSheet(id){document.querySelectorAll('.sheet.open').forEach(s=>s.classList.remove('open'));$('#backdrop').classList.add('open');$(id).classList.add('open');$(id).scrollTop=0}
function closeSheets(){document.querySelectorAll('.sheet.open').forEach(s=>s.classList.remove('open'));$('#backdrop').classList.remove('open');disarm()}
$('#backdrop').onclick=closeSheets;document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeSheets);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheets()});

/* ---------- form ---------- */
let editingId=null;const form={dim:'over',type:'base',nameTouched:false};
function renderFormDim(){document.querySelectorAll('#f-dim button').forEach(b=>b.classList.toggle('on',b.dataset.dim===form.dim))}
document.querySelectorAll('#f-dim button').forEach(b=>b.onclick=()=>{form.dim=b.dataset.dim;const list=typesFor(form.dim);
  if(!list.some(t=>t.id===form.type)){const t=list[0];form.type=t.id;if(!form.nameTouched){$('#f-name').value=t.n;$('#f-kana').value=t.k||''}}
  renderFormDim();renderTypes()});
const chip=t=>`<button type="button" class="tchip${t.id===form.type?' on':''}" data-id="${esc(t.id)}"><span class="te">${esc(t.e)}</span><span class="tn">${esc(t.n)}</span>${t.k&&t.k!==t.n?`<span class="tk">${esc(t.k)}</span>`:''}</button>`;
function renderTypes(){const a=typesFor(form.dim);$('#f-types').innerHTML=`<div class="tgroup">🏠 建物（たてもの）</div><div class="types">${a.filter(t=>!t.b).map(chip).join('')}</div>`;$('#f-types2').innerHTML=`<div class="tgroup">🌳 バイオーム</div><div class="types">${a.filter(t=>t.b).map(chip).join('')}</div>`;renderLink();renderSize()}
function renderSize(){const b=typeOf(form.type).b;$('#f-sizewrap').hidden=!b;document.querySelectorAll('#f-size button').forEach(x=>x.classList.toggle('on',x.dataset.size===form.size))}
document.querySelectorAll('#f-size button').forEach(x=>x.onclick=()=>{form.size=x.dataset.size;renderSize()});
let formLink=null;
function renderLink(){const wrap=$('#f-linkwrap');if(form.type!=='gate'){wrap.hidden=true;return}wrap.hidden=false;
  const other=form.dim==='over'?'nether':'over';const x=num($('#f-x').value),z=num($('#f-z').value);
  const has=x!=null&&z!=null&&!Number.isNaN(x)&&!Number.isNaN(z);
  const ex=has?(form.dim==='over'?{x:Math.floor(x/8),z:Math.floor(z/8)}:{x:x*8,z:z*8}):null;
  const gs=data.pins.filter(p=>p.type==='gate'&&p.dim===other&&p.id!==editingId).map(p=>({p,d:ex?Math.hypot(p.x-ex.x,p.z-ex.z):0}));
  if(ex)gs.sort((a,b)=>a.d-b.d);
  const near=ex&&gs.length&&gs[0].d<=(other==='nether'?16:128);
  $('#f-link').innerHTML='<option value="">つながっていない</option>'+gs.map((g,i)=>`<option value="${esc(g.p.id)}">${esc(label(g.p))}（X ${g.p.x} / Z ${g.p.z}）${near&&i===0?' ←ちかい！':''}</option>`).join('');
  $('#f-link').value=gs.some(g=>g.p.id===formLink)?formLink:'';
  $('#f-linkhint').textContent=!gs.length?`${dimName(other)}にゲートのピンがまだないよ。あとからつなげられるよ`:(ex?`${dimName(other)}だと だいたい X ${ex.x} / Z ${ex.z} のあたりにつながるよ`:'ざひょうを入れると、ちかいゲートをおしえてくれるよ')}
$('#f-link').onchange=e=>{formLink=e.target.value||null};
['#f-x','#f-z'].forEach(s=>$(s).addEventListener('input',renderLink));
document.querySelectorAll('.pm').forEach(b=>b.addEventListener('click',()=>setTimeout(renderLink,0)));
$('#f-types').onclick=$('#f-types2').onclick=e=>{const b=e.target.closest('.tchip');if(!b)return;const t=typeOf(b.dataset.id);form.type=t.id;
  if(!form.nameTouched){$('#f-name').value=t.n;$('#f-kana').value=t.k||''}
  if(t.d==='over'||t.d==='nether'){form.dim=t.d;renderFormDim()}renderTypes()};
$('#f-name').oninput=$('#f-kana').oninput=()=>{form.nameTouched=true};

document.querySelectorAll('.pm').forEach(b=>b.onclick=()=>{const i=document.getElementById(b.dataset.for);const v=i.value.trim();i.value=v.startsWith('-')?v.slice(1):'-'+v;i.focus()});
function openForm(p){editingId=p?p.id:null;form.dim=p?p.dim:dim;form.type=p?p.type:(dim==='nether'?'fortress':'base');form.nameTouched=!!p;
  const t=typeOf(form.type);$('#f-title').textContent=p?'ピンをなおす':'ピンをたてる';
  $('#f-name').value=p?(p.name||''):t.n;$('#f-kana').value=p?(p.kana||''):(t.k||'');
  $('#f-x').value=p?p.x:'';$('#f-y').value=p&&p.y!=null?p.y:'';$('#f-z').value=p?p.z:'';
  $('#f-memo').value=p?(p.memo||''):'';formLink=p?(p.link||null):null;form.size=(p&&p.size)||'m';$('#f-err').textContent='';
  renderFormDim();renderTypes();openSheet('#sheet-form')}
const num=v=>{v=String(v).trim().replace(/[－−ー]/g,'-').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248));if(v===''||v==='-')return null;const n=Number(v);return Number.isFinite(n)?Math.round(n):NaN};
$('#f-save').onclick=()=>{const x=num($('#f-x').value),y=num($('#f-y').value),z=num($('#f-z').value);
  if(x==null||z==null){$('#f-err').textContent='XとZを入れてね';return}
  if(Number.isNaN(x)||Number.isNaN(z)||Number.isNaN(y)){$('#f-err').textContent='ざひょうは数字で入れてね';return}
  const pin={id:editingId||('p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),type:form.type,dim:form.dim,x,y,z,
    name:$('#f-name').value.trim(),kana:$('#f-kana').value.trim(),memo:$('#f-memo').value.trim(),created:Date.now()};
  if(typeOf(form.type).b)pin.size=form.size;
  const before=new Map(data.pins.map(q=>[q.id,q.link||null]));
  const newLink=form.type==='gate'?(formLink||null):null;pin.link=newLink;
  for(const q of data.pins){if(q.link===pin.id&&q.id!==newLink)q.link=null}
  if(newLink){const q=data.pins.find(q=>q.id===newLink);if(q){if(q.link&&q.link!==pin.id){const o=data.pins.find(o=>o.id===q.link);if(o)o.link=null}q.link=pin.id}}
  const i=editingId?data.pins.findIndex(p=>p.id===editingId):-1;if(i>=0){pin.created=data.pins[i].created;data.pins[i]=pin}else data.pins.push(pin);
  const now=Date.now();pin.updatedAt=now;
  for(const q of data.pins){if(q.id!==pin.id&&before.get(q.id)!==(q.link||null)){q.updatedAt=now;queuePin(q)}}
  queuePin(pin);save();closeSheets();if(pin.dim!==dim)setDim(pin.dim);centerOn(pin)};
$('#btn-add').onclick=()=>openForm(null);

/* ---------- detail ---------- */
let detailId=null,armed=false;
function disarm(){armed=false;const b=$('#d-del');b.classList.remove('armed');b.textContent='けす'}
function openDetail(p){detailId=p.id;disarm();const t=typeOf(p.type);const n=p.name||t.n;
  const conv=p.dim==='over'?`ネザーだと だいたい X ${Math.floor(p.x/8)} / Z ${Math.floor(p.z/8)}`:`オーバーワールドだと だいたい X ${p.x*8} / Z ${p.z*8}`;
  $('#d-body').innerHTML=`<div class="dhead"><span class="dicon" style="border-color:${esc(t.c||'#90a4ae')}">${esc(t.e)}</span><div><div class="dname">${esc(n)}</div>${p.kana&&p.kana!==n?`<div class="dkana">${esc(p.kana)}</div>`:''}<div class="dtype">${esc(t.n)}／${dimName(p.dim)}</div></div></div>
  <div class="coords"><div><b>X</b>${p.x}</div><div><b>Y</b>${p.y==null?'ー':p.y}</div><div><b>Z</b>${p.z}</div></div>
  <p class="conv">${esc(conv)}</p>${p.memo?`<p class="memo">${esc(p.memo)}</p>`:''}`;
  if(t.b){$('#d-body').insertAdjacentHTML('beforeend',`<p class="conv">🎨 ひろさ：${SIZE_LABEL[p.size||'m']}（まんなかから やく${radius(p)}ブロック）</p>`)}
  if(p.type==='gate'){const q=p.link&&data.pins.find(q=>q.id===p.link);
    $('#d-body').insertAdjacentHTML('beforeend',q?`<div class="linkbox"><div class="flabel">🔗 つながっているゲート（${dimName(q.dim)}）</div><div class="in">${esc(label(q))}</div><div class="ic">X ${q.x}${q.y==null?'':' / Y '+q.y} / Z ${q.z}</div><button class="smallbtn" id="d-jump" data-id="${esc(q.id)}">${dimName(q.dim)}で見る</button></div>`:`<div class="linkbox"><div class="flabel">🔗 まだどこともつながっていないよ</div><div class="ic">「なおす」からつなげられるよ</div></div>`);
    const j=$('#d-jump');if(j)j.onclick=()=>{const q2=data.pins.find(x=>x.id===j.dataset.id);if(!q2)return;closeSheets();setDim(q2.dim);centerOn(q2)}}
  openSheet('#sheet-detail')}
$('#d-edit').onclick=()=>{const p=data.pins.find(p=>p.id===detailId);if(p)openForm(p)};
$('#d-del').onclick=()=>{const b=$('#d-del');if(!armed){armed=true;b.classList.add('armed');b.textContent='ほんとうにけす？';return}
  const now=Date.now();data.pins=data.pins.filter(p=>p.id!==detailId);data.pins.forEach(p=>{if(p.link===detailId){p.link=null;p.updatedAt=now;queuePin(p)}});queuePinDel(detailId,now);if(highlight===detailId)highlight=null;save();closeSheets();req()};

/* ---------- list ---------- */
let listDim='over';
function renderList(){document.querySelectorAll('#l-dim button').forEach(b=>b.classList.toggle('on',b.dataset.dim===listDim));
  const ps=data.pins.filter(p=>p.dim===listDim).sort((a,b)=>b.created-a.created);
  $('#l-items').innerHTML=ps.length?ps.map(p=>{const t=typeOf(p.type);return`<button class="item" data-id="${esc(p.id)}"><span class="ie">${esc(t.e)}</span><span><div class="in">${esc(label(p))}</div><div class="ic">X ${p.x}${p.y==null?'':' / Y '+p.y} / Z ${p.z}</div></span></button>`}).join(''):`<div class="empty">${dimName(listDim)}にはまだピンがないよ</div>`}
document.querySelectorAll('#l-dim button').forEach(b=>b.onclick=()=>{listDim=b.dataset.dim;renderList()});
$('#l-items').onclick=e=>{const b=e.target.closest('.item');if(!b)return;const p=data.pins.find(p=>p.id===b.dataset.id);if(!p)return;closeSheets();if(p.dim!==dim)setDim(p.dim);centerOn(p)};
$('#btn-list').onclick=()=>{listDim=dim;renderList();openSheet('#sheet-list')};

/* ---------- settings ---------- */
const PALETTE=['#ef5350','#ab47bc','#42a5f5','#26c6da','#66bb6a','#ffca28','#ff7043','#8d6e63'];
function renderCustom(){$('#c-list').innerHTML=data.custom.map(t=>`<div class="ctype"><span>${esc(t.e)} ${esc(t.n)}${t.k?'（'+esc(t.k)+'）':''}</span><button class="smallbtn" data-del="${esc(t.id)}">けす</button></div>`).join('')}
$('#c-add').onclick=()=>{const e=$('#c-emoji').value.trim()||'📍',n=$('#c-name').value.trim(),k=$('#c-kana').value.trim();
  if(!n){$('#c-err').textContent='なまえを入れてね';return}
  const nt={id:'c'+Date.now().toString(36),e,n,k,d:'both',c:PALETTE[data.custom.length%PALETTE.length],updatedAt:Date.now()};data.custom.push(nt);queueType(nt);save();
  $('#c-emoji').value=$('#c-name').value=$('#c-kana').value='';$('#c-err').textContent=`「${n}」をふやしたよ`;renderCustom()};
$('#c-list').onclick=e=>{const b=e.target.closest('[data-del]');if(!b)return;data.custom=data.custom.filter(t=>t.id!==b.dataset.del);queueTypeDel(b.dataset.del,Date.now());save();renderCustom();req()};
$('#b-export').onclick=async()=>{const t=JSON.stringify({app:'bouken-map',v:1,pins:data.pins,custom:data.custom});$('#b-text').value=t;
  try{await navigator.clipboard.writeText(t);$('#b-msg').textContent='コピーしたよ。メモアプリなどにはりつけてね'}catch(e){$('#b-text').select();$('#b-msg').textContent='上の文字をぜんぶえらんでコピーしてね'}};
$('#b-import').onclick=()=>{try{const p=JSON.parse($('#b-text').value);if(!p||!Array.isArray(p.pins))throw 0;
  const inPins=p.pins,inCustom=Array.isArray(p.custom)?p.custom:[];
  if(cfg){/* つないでいるときは けさずに たす（新しいほうをのこす） */
    const ts=x=>x.updatedAt||x.created||0;
    const merge=(arr,items)=>{for(const it of items){if(!it||!it.id)continue;const i=arr.findIndex(x=>x.id===it.id);if(i<0)arr.push(it);else if(ts(arr[i])<=ts(it))arr[i]=it}};
    merge(data.custom,inCustom);merge(data.pins,inPins);inCustom.forEach(t=>t&&t.id&&queueType(t));inPins.forEach(q=>q&&q.id&&queuePin(q))}
  else data={pins:inPins,custom:inCustom};
  save();views.over.fit=views.nether.fit=false;views[dim].fit=true;fitAll();renderCustom();$('#b-msg').textContent=cfg?`ピンを${inPins.length}こ よみこんで、スプレッドシートにおくるよ`:`ピンを${data.pins.length}こ よみこんだよ`}
  catch(e){$('#b-msg').textContent='よみこめなかったよ。かきだした文字をそのまま、はりつけてね'}};
$('#btn-set').onclick=()=>{renderCustom();renderSync();$('#s-msg').textContent='';$('#c-err').textContent='';$('#b-msg').textContent='';openSheet('#sheet-set')};

/* ---------- sync（Google スプレッドシート） ----------
   ローカル優先：localStorage ですぐ表示 → 裏でシートとやりとり。
   変更は outbox（id ごとに最新の1件）にためて送る。失敗したら残して、あとでまとめて再送。
   シートからの返事＝正。そこへ まだ送れていない outbox の変更を上にかさねる。 */
const SYNC_KEY='bouken-map-sync',OUT_KEY='bouken-map-outbox';
const load=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};
const store=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
let cfg=load(SYNC_KEY);if(!cfg||!cfg.url||!cfg.key)cfg=null;
let outbox=(cfg&&load(OUT_KEY))||{};
let syncing=false,again=false,syncTimer=0;
const pending=()=>Object.keys(outbox).length;
const STATUS={ok:'☁️ ほぞんずみ',send:'⏳ おくっています',load:'⏳ よみこみちゅう',off:'⚠️ つながっていません',key:'🔑 あいことばが ちがうよ',err:'⚠️ うまくいかなかったよ'};
function setSync(s){const b=$('#sync');b.hidden=!cfg;if(!cfg)return;const n=pending();b.dataset.state=s;b.textContent=STATUS[s]+(s!=='ok'&&s!=='send'&&n?`（${n}こ まだ）`:'')}
const pinOut=p=>({id:p.id,type:p.type,dim:p.dim,x:p.x,y:p.y==null?null:p.y,z:p.z,name:p.name||'',kana:p.kana||'',memo:p.memo||'',size:p.size||'',link:p.link||'',created:p.created||0,updatedAt:p.updatedAt||p.created||0});
const typeOut=t=>({id:t.id,emoji:t.e||'',name:t.n||'',kana:t.k||'',dim:t.d||'both',color:t.c||'',isBiome:!!t.b,updatedAt:t.updatedAt||0});
function pinIn(r,ts){const t=ts.find(t=>t.id===r.type)||ts.find(t=>t.n===r.type);
  const p={id:String(r.id),type:t?t.id:String(r.type||'other'),dim:r.dim==='nether'?'nether':'over',x:r.x,y:r.y==null?null:r.y,z:r.z,
    name:r.name||'',kana:r.kana||'',memo:r.memo||'',link:r.link||null,created:r.created||0,updatedAt:r.updatedAt||0};
  if(r.size)p.size=r.size;return p}
const typeIn=r=>({id:String(r.id),e:r.emoji||'📍',n:r.name||'',k:r.kana||'',d:r.dim==='over'||r.dim==='nether'?r.dim:'both',c:r.color||'#90a4ae',b:!!r.isBiome,updatedAt:r.updatedAt||0});
function queue(k,op){if(!cfg)return;outbox[k]=op;store(OUT_KEY,outbox);setSync('send');clearTimeout(syncTimer);syncTimer=setTimeout(syncNow,400)}
function queuePin(p){queue('pin:'+p.id,{op:'upsertPin',pin:pinOut(p)})}
function queuePinDel(id,ts){queue('pin:'+id,{op:'deletePin',id,updatedAt:ts})}
function queueType(t){queue('type:'+t.id,{op:'upsertType',type:typeOut(t)})}
function queueTypeDel(id,ts){queue('type:'+id,{op:'deleteType',id,updatedAt:ts})}
async function callApi(c,ops){const r=await fetch(c.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({key:c.key,ops}),cache:'no-store',redirect:'follow'});
  if(!r.ok)throw new Error('http '+r.status);return r.json()}
async function syncNow(){if(!cfg)return;if(syncing){again=true;return}clearTimeout(syncTimer);syncing=true;
  const c=cfg,sent=Object.assign({},outbox),ops=Object.values(sent);
  if(ops.length)setSync('send');
  try{const j=await callApi(c,ops);if(c!==cfg)return;
    if(!j||!j.ok){setSync(j&&(j.error==='bad-key'||j.error==='no-passphrase')?'key':'err');return}
    for(const k in sent)if(outbox[k]===sent[k])delete outbox[k];store(OUT_KEY,outbox);
    applyRemote(j);setSync(pending()?'send':'ok')}
  catch(e){if(c===cfg)setSync('off')}
  finally{syncing=false;if(again&&cfg){again=false;syncTimer=setTimeout(syncNow,300)}}}
function applyRemote(j){const ops=Object.values(outbox);
  const custom=(j.types||[]).map(typeIn);
  for(const o of ops){if(o.op==='upsertType'){const t=typeIn(o.type),i=custom.findIndex(x=>x.id===t.id);if(i>=0)custom[i]=t;else custom.push(t)}
    else if(o.op==='deleteType'){const i=custom.findIndex(x=>x.id===o.id);if(i>=0)custom.splice(i,1)}}
  const ts=DEFAULT_TYPES.concat(custom),pins=(j.pins||[]).map(r=>pinIn(r,ts));
  for(const o of ops){if(o.op==='upsertPin'){const p=pinIn(o.pin,ts),i=pins.findIndex(x=>x.id===p.id);if(i>=0)pins[i]=p;else pins.push(p)}
    else if(o.op==='deletePin'){const i=pins.findIndex(x=>x.id===o.id);if(i>=0)pins.splice(i,1)}}
  const next={pins,custom};if(JSON.stringify(next)===JSON.stringify(data))return;
  const had=d=>data.pins.some(p=>p.dim===d),was={over:had('over'),nether:had('nether')};
  data=next;save();
  for(const d of ['over','nether'])if(!was[d]&&had(d)){if(d===dim)fitAll();else views[d].fit=false}
  req();if($('#sheet-list').classList.contains('open'))renderList();if($('#sheet-set').classList.contains('open'))renderCustom()}
let discArmed=false;
function renderSync(){$('#s-off').hidden=!!cfg;$('#s-on').hidden=!cfg;discArmed=false;$('#s-disconnect').textContent='つなぐのをやめる';
  $('#b-hint').textContent=cfg?'スプレッドシートにも ほぞんされているよ。「よみこむ」は いまのちずに たすよ（けさないよ）。'
    :'いまはこの端末の中だけにほぞんされるよ。「かきだす」で出た文字をメモアプリなどにとっておけば、べつの端末で「よみこむ」とおなじちずになるよ。'}
$('#s-connect').onclick=async()=>{const url=$('#s-url').value.trim(),key=$('#s-key').value.trim(),m=$('#s-msg');
  if(!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)){m.textContent='Apps Script の URL（https://script.google.com/ ではじまる）を入れてね';return}
  if(!key){m.textContent='合言葉（あいことば）を入れてね';return}
  m.textContent='⏳ たしかめています…';$('#s-connect').disabled=true;
  try{const j=await callApi({url,key},[]);
    if(!j||!j.ok){m.textContent=j&&j.error==='bad-key'?'合言葉（あいことば）が ちがうよ':j&&j.error==='no-passphrase'?'スクリプト プロパティに PASSPHRASE が まだないよ':'うまくいかなかったよ。もういちど やってみてね';return}
    cfg={url,key};store(SYNC_KEY,cfg);
    /* この端末のピンもぜんぶ送る（シート側が新しければ、シートのほうがのこる） */
    outbox={};data.custom.forEach(t=>{outbox['type:'+t.id]={op:'upsertType',type:typeOut(t)}});data.pins.forEach(p=>{outbox['pin:'+p.id]={op:'upsertPin',pin:pinOut(p)}});store(OUT_KEY,outbox);
    $('#s-url').value=$('#s-key').value='';renderSync();m.textContent='つながったよ！';setSync('send');syncNow()}
  catch(e){m.textContent='つながらなかったよ。URL と、デプロイの「アクセスできるユーザー：全員」を たしかめてね'}
  finally{$('#s-connect').disabled=false}};
$('#s-now').onclick=()=>{$('#s-msg').textContent='';syncNow()};
$('#s-disconnect').onclick=()=>{const n=pending();
  if(n&&!discArmed){discArmed=true;$('#s-disconnect').textContent='ほんとうにやめる？';$('#s-msg').textContent=`まだ おくれていない へんこうが ${n}こ あるよ。やめると おくられないよ`;return}
  cfg=null;outbox={};store(SYNC_KEY,null);store(OUT_KEY,null);setSync('');renderSync();$('#s-msg').textContent='つなぐのをやめたよ。ちずは この端末に のこっているよ'};
$('#sync').onclick=()=>syncNow();
if(cfg){setSync(pending()?'send':'load');syncNow()}
setInterval(()=>{if(cfg&&!document.hidden)syncNow()},60000);
document.addEventListener('visibilitychange',()=>{if(cfg&&!document.hidden)syncNow()});
window.addEventListener('online',()=>{if(cfg)syncNow()});

if(document.fonts&&document.fonts.ready)document.fonts.ready.then(req);
window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').addEventListener&&matchMedia('(prefers-color-scheme: dark)').addEventListener('change',req);
})();
