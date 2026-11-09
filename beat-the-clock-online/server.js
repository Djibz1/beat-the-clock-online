const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
const CATS=JSON.parse(fs.readFileSync(path.join(__dirname,'categories.json'),'utf8'));
const rooms={},DEF={clock:60,rounds:3,passes:3,penalty:3};
const rid=()=>Math.random().toString(36).slice(2,10),oth=t=>t==='A'?'B':'A';
const clamp=(v,lo,hi,d)=>Number.isFinite(+v)?Math.min(hi,Math.max(lo,Math.round(+v))):d;
const shuf=a=>{for(let i=a.length;i>1;i--){const j=Math.floor(Math.random()*i);[a[i-1],a[j]]=[a[j],a[i-1]]}return a};
const clean=n=>String(n||'Player').trim().slice(0,16)||'Player';
// The judge is whoever sits in the Judge slot; if nobody does, the host judges.
const judge=r=>(Object.values(r.players).find(p=>p.team==='J')||r.players[r.host]).id;
// Only a judge who is NOT playing on a team ever receives the answer.
const view=(r,id)=>{const j=judge(r),me=r.players[id];return{code:r.code,you:id,host:r.host,judge:j,phase:r.phase,s:r.s,score:r.score,round:r.round,cat:r.cat,turn:r.turn,clock:r.clock,left:r.left,winner:r.winner,rw:r.rw,ev:r.ev,
  cd:r.phase==='count'?Math.ceil((r.cdEnd-Date.now())/1000):0,cats:Object.keys(CATS),
  item:r.item&&{e:r.item.e,img:r.item.img,q:r.item.q,qa:r.item.qa,...(id===j&&me.team!=='A'&&me.team!=='B'?{a:r.item.a,aa:r.item.aa}:{})},
  players:Object.values(r.players).map(p=>({id:p.id,name:p.name,team:p.team,ready:p.ready}))}};
const push=r=>{r.touched=Date.now();send(r)};
const send=r=>Object.values(r.players).forEach(p=>p.res&&p.res.write('data:'+JSON.stringify(view(r,p.id))+'\n\n'));
// Question categories (items with d = 1/2/3) are ordered easy -> hard; pictures are shuffled.
const deckOf=c=>{const it=CATS[c];return it[0].d?[3,2,1].flatMap(d=>shuf(it.filter(x=>x.d===d))):shuf(it.slice())};
const next=r=>{if(!r.deck.length)return false;r.item=r.deck.pop();return true}; // never repeats: false = category used up
const evt=(r,k)=>{r.ev={k,n:r.ev.n+1}};
function startRound(r,cat){
  r.cat=cat;r.deck=deckOf(cat);
  r.clock={A:r.s.clock*1000,B:r.s.clock*1000};r.left={A:r.s.passes,B:r.s.passes};
  r.turn=r.round%2?'B':'A';r.round++;next(r);r.phase='count';r.cdEnd=Date.now()+3000;
}
function after(r){
  const a=r.score.A,b=r.score.B;
  if(Math.max(a,b)>=Math.floor(r.s.rounds/2)+1){r.phase='matchEnd';r.winner=a>b?'A':b>a?'B':'D';r.endAt=Date.now()}else r.phase='roundEnd';
}
function endRound(r,w){r.score[w]++;r.rw=w;after(r)}
function endDraw(r){r.score.A++;r.score.B++;r.rw='D';after(r)} // every item answered: draw, a point each
function toLobby(r){r.phase='lobby';r.score={A:0,B:0};r.round=0;r.winner=null;Object.values(r.players).forEach(p=>p.ready=false)}
function drop(r,id){
  const p=r.players[id];if(!p)return;
  delete r.players[id];p.res&&p.res.end();
  const rest=Object.values(r.players);
  if(!rest.length)return void delete rooms[r.code];
  if(id===r.host)r.host=rest[0].id;
  push(r);
}
setInterval(()=>{const n=Date.now();for(const r of Object.values(rooms)){
  if(r.phase==='count'){if(n>=r.cdEnd){r.phase='playing';r.last=n}push(r)}
  else if(r.phase==='playing'){
    r.clock[r.turn]-=n-r.last;r.last=n;
    if(r.clock[r.turn]<=0){r.clock[r.turn]=0;endRound(r,oth(r.turn))}
    push(r);
  }else if(r.phase==='matchEnd'&&n-r.endAt>25000){toLobby(r);push(r)}
}},250);
// free-tier hygiene: forget rooms nobody has been connected to for 30 minutes
setInterval(()=>{for(const [c,r] of Object.entries(rooms))if(Object.values(r.players).every(p=>!p.res)&&Date.now()-(r.touched||0)>30*60e3)delete rooms[c]},5*60e3);
function mkRoom(name){
  let c;do c=String(1000+Math.floor(Math.random()*9000));while(rooms[c]);
  const id=rid();
  rooms[c]={code:c,host:id,players:{[id]:{id,name,team:null,ready:false}},s:{...DEF},phase:'lobby',score:{A:0,B:0},round:0,cat:null,item:null,deck:[],turn:'A',clock:{A:0,B:0},left:{A:0,B:0},last:0,winner:null,rw:null,ev:{k:'',n:0}};
  return{code:c,id};
}
const body=req=>new Promise(ok=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>{try{ok(JSON.parse(d||'{}'))}catch{ok({})}})});
const json=(res,o)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x');
  if(u.pathname==='/health'){res.writeHead(200);return res.end('ok')}
  if(req.method==='GET'&&u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fs.readFileSync(path.join(__dirname,'index.html')))}
  if(req.method==='GET'&&u.pathname.startsWith('/images/')){
    const f=path.join(__dirname,'images',path.basename(u.pathname));
    if(!fs.existsSync(f)){res.writeHead(404);return res.end()}
    res.writeHead(200,{'Cache-Control':'public, max-age=86400','Content-Type':{'.png':'image/png','.webp':'image/webp','.gif':'image/gif'}[path.extname(f).toLowerCase()]||'image/jpeg'});return res.end(fs.readFileSync(f));
  }
  if(u.pathname==='/events'){
    const r=rooms[u.searchParams.get('code')],p=r&&r.players[u.searchParams.get('id')];
    if(!p){res.writeHead(404);return res.end()}
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive','X-Accel-Buffering':'no'});
    p.res=res;const hb=setInterval(()=>res.write(': ping\n\n'),20000);req.on('close',()=>{p.res=null;clearInterval(hb)});return push(r);
  }
  if(req.method!=='POST'){res.writeHead(404);return res.end()}
  const b=await body(req);
  if(u.pathname==='/create')return json(res,mkRoom(clean(b.name)));
  if(u.pathname==='/join'){
    const r=rooms[b.code];if(!r)return json(res,{err:'noRoom'});
    const id=rid();r.players[id]={id,name:clean(b.name),team:null,ready:false};push(r);return json(res,{code:r.code,id});
  }
  if(u.pathname==='/act'){
    const r=rooms[b.code],p=r&&r.players[b.id];if(!p)return json(res,{err:'noRoom'});
    const H=b.id===r.host,d=b.d||{},ph=r.phase,J=b.id===judge(r);
    if(b.a==='leave')return drop(r,b.id),json(res,{});
    if(b.a==='kick'&&H&&d.id!==r.host)return drop(r,d.id),json(res,{});
    if(b.a==='team'&&ph==='lobby'){
      const j=Object.values(r.players).find(x=>x.team==='J');
      if(['A','B'].includes(d)||(d==='J'&&(!j||j.id===p.id))){p.team=d;p.ready=false}
    }
    else if(b.a==='ready'&&ph==='lobby'&&p.team){p.ready=!p.ready}
    else if(H&&b.a==='set'&&ph==='lobby'){
      const s=r.s;
      if('clock' in d)s.clock=clamp(d.clock,10,300,60);
      if('rounds' in d)s.rounds=clamp(d.rounds,1,9,3);
      if('passes' in d)s.passes=clamp(d.passes,0,10,3);
      if('penalty' in d)s.penalty=clamp(d.penalty,0,10,3);
    }
    else if(H&&b.a==='start'&&CATS[d.cat]&&(ph==='lobby'||ph==='roundEnd')){
      const ps=Object.values(r.players);
      if(ph==='lobby'){
        if(!ps.some(x=>x.team==='A')||!ps.some(x=>x.team==='B'))return json(res,{err:'need'});
        if(!ps.every(x=>x.id===r.host||x.ready))return json(res,{err:'notReady'});
        r.score={A:0,B:0};r.round=0;r.winner=null;
      }
      startRound(r,d.cat);evt(r,'start');
    }
    else if(J&&ph==='playing'&&b.a==='ok'){r.turn=oth(r.turn);evt(r,'ok');if(!next(r))endDraw(r)}
    else if(J&&ph==='playing'&&b.a==='pass'&&r.left[r.turn]>0){
      r.left[r.turn]--;r.clock[r.turn]=Math.max(1000,r.clock[r.turn]-r.s.penalty*1000);evt(r,'pass');if(!next(r))endDraw(r);
    }
    else if(H&&b.a==='again'&&ph==='matchEnd')toLobby(r);
    push(r);return json(res,{});
  }
  res.writeHead(404);res.end();
}).listen(process.env.PORT||3000,'0.0.0.0',()=>{
  const P=process.env.PORT||3000;
  console.log('\nBeat the Clock is running!\n  This computer:      http://localhost:'+P);
  for(const l of Object.values(os.networkInterfaces()).flat())if(l.family==='IPv4'&&!l.internal)console.log('  Phone (same Wi-Fi): http://'+l.address+':'+P);
});
