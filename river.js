/* Northern water route – live river & dam status (client-side, public ThaiWater API). No mock data. */
(function () {
'use strict';
var API = 'https://api-v3.thaiwater.net/api/v1/thaiwater30/public/';
var TZ = 'Asia/Bangkok', REFRESH_MS = 10 * 60 * 1000;
var COL = {green:'#2eb872', yellow:'#f4b400', orange:'#f08a24', red:'#e5383b', crit:'#8b0a1a', na:'#b7bdc7'};
var RANK = {na:-1, green:0, yellow:1, orange:2, red:3, crit:4};
var LBL = {green:'Normal', yellow:'Watch', orange:'Warning', red:'Overflowing', crit:'Critical', na:'Unavailable'};
var DLBL = {green:'Normal', yellow:'Watch', orange:'High', red:'Above normal capacity', crit:'Critical', na:'Unavailable'};
var TWCLASS = {1:'น้ำน้อยวิกฤต (very low)', 2:'น้ำน้อย (low)', 3:'น้ำปกติ (normal)', 4:'น้ำมาก (high)', 5:'น้ำล้นตลิ่ง (over bank)'};

/* ---- documented travel times (hours) ---- */
// RID/NWRC via Spring News 10 Nov 2025: dam→Sing Buri 10 h, →Ang Thong 8 h, →Ayutthaya 6 h, →Pathum Thani 8 h, →Nonthaburi/Bangkok 24 h (sum 56 h)
// RID via Thairath 29 Aug 2024: Nakhon Sawan→Chao Phraya Dam 98 km ≈ 24 h
var H_DAM_BKK = 56, H_NS_DAM = 24, KMH = 98 / 24, SINUOSITY = 1.3, SPREAD_H = 24;
var HRS_TO_BKK = {'C.13': 56, 'C.3': 46, 'C.7A': 38, 'C.35': 32};
var RID_REF = {overtop: 2200, critical: 2730}; // Chao Phraya Dam release (m³/s), RID statement via Thairath 29 Aug 2024

/* ---- schematic definition (own layout) ---- */
var ST = [
 {c:'P.1',  n:'Chiang Mai',     r:'Ping', x:135,y:90,  s:'L'},
 {c:'P.7A', n:'Kamphaeng Phet', r:'Ping', x:160,y:385, s:'L'},
 {c:'P.17', n:'Ban Tha Ngio',   r:'Ping', x:215,y:500, s:'L'},
 {c:'W.1C', n:'Lampang',        r:'Wang', x:235,y:90,  s:'R'},
 {c:'W.4A', n:'Tak (Wang)',     r:'Wang', x:232,y:260, s:'R'},
 {c:'Y.1C', n:'Phrae',          r:'Yom',  x:405,y:120, s:'R'},
 {c:'Y.4',  n:'Sukhothai',      r:'Yom',  x:398,y:235, s:'R'},
 {c:'Y.64', n:'Bang Rakam',     r:'Yom',  x:400,y:345, s:'R'},
 {c:'Y.17', n:'Phichit (Yom)',  r:'Yom',  x:408,y:455, s:'R'},
 {c:'N.1',  n:'Nan',            r:'Nan',  x:585,y:70,  s:'L'},
 {c:'N.60', n:'Uttaradit',      r:'Nan',  x:562,y:300, s:'L'},
 {c:'N.5A', n:'Phitsanulok',    r:'Nan',  x:545,y:415, s:'L'},
 {c:'N.7A', n:'Phichit (Nan)',  r:'Nan',  x:525,y:515, s:'L'},
 {c:'N.67', n:'Kae Chai',       r:'Nan',  x:505,y:595, s:'L'},
 {c:'C.2',  n:'Nakhon Sawan',   r:'Chao Phraya', x:330,y:775, s:'R'},
 {c:'C.13', n:'Chao Phraya Dam (below)', r:'Chao Phraya', x:330,y:905, s:'R', dam:true},
 {c:'C.3',  n:'Sing Buri',      r:'Chao Phraya', x:336,y:995, s:'R'},
 {c:'C.7A', n:'Ang Thong',      r:'Chao Phraya', x:346,y:1075,s:'R'},
 {c:'C.35', n:'Ayutthaya',      r:'Chao Phraya', x:356,y:1165,s:'R'},
 {c:'CPY014',n:'Nonthaburi',    r:'Chao Phraya', x:346,y:1305,s:'R'},
 {c:'C.12', n:'Bangkok (Sam Sen)', r:'Chao Phraya', x:340,y:1375,s:'R'},
 {c:'CPY015',n:'Krung Thep Br.',r:'Chao Phraya', x:335,y:1445,s:'R'},
 {c:'T.13', n:'Suphan Buri',    r:'Tha Chin', x:195,y:995, s:'L'},
 {c:'S.42', n:'Phetchabun',     r:'Pa Sak', x:585,y:835, s:'L'},
 {c:'S.26', n:'Below Rama VI Dam', r:'Pa Sak', x:555,y:1115,s:'L'}
];
var DAMS = [
 {k:'1',  n:'Bhumibol',      th:'ภูมิพล',        r:'Ping', x:148,y:185, s:'L', main:true},
 {k:'4',  n:'Kiew Lom',      th:'กิ่วลม',        r:'Wang', x:238,y:175, s:'R', main:true},
 {k:'2',  n:'Sirikit',       th:'สิริกิติ์',     r:'Nan',  x:572,y:180, s:'L', main:true},
 {k:'25', n:'Thapsalao',     th:'ทับเสลา',       r:'Sakae Krang', x:150,y:815, s:'L', main:false},
 {k:'19', n:'Pa Sak Jolasid',th:'ป่าสักชลสิทธิ์',r:'Pa Sak', x:578,y:945, s:'L', main:true}
];
var DAM_EXTRA = [ // shown in table only
 {k:'3', n:'Mae Ngat', r:'Ping'}, {k:'5', n:'Mae Kuang', r:'Ping'}, {k:'40', n:'Kiew Kor Ma', r:'Wang'},
 {k:'43', n:'Mae Mok', r:'Yom'}, {k:'41', n:'Kwae Noi', r:'Nan'}, {k:'24', n:'Kra Siew', r:'Tha Chin'},
 {k:'21', n:'Srinakarin', r:'Mae Klong (west)'}, {k:'22', n:'Vajiralongkorn', r:'Mae Klong (west)'}
];
// plain (no live data) points
var PL = {
 PW:  {x:150,y:310, inherit:['W.4A','P.7A']},
 JYN: {x:445,y:640, inherit:['Y.17','N.67']},
 JNS: {x:330,y:705, inherit:['P.17','JYN','C.2'], label:['Pak Nam Pho','Nakhon Sawan junction'], s:'R'},
 SK0: {x:60, y:790}, SKJ:{x:330,y:840},
 TC0: {x:330,y:925}, TC1:{x:262,y:960}, TC2:{x:170,y:1100}, TC3:{x:135,y:1230}, TC4:{x:120,y:1330},
 PS1: {x:470,y:1195}, PJ:{x:354,y:1203, inherit:['C.35']}, PS0:{x:585,y:790},
 PTH: {x:352,y:1245, na:true, label:['Pathum Thani','no gauge in feed'], s:'R'},
 SPK: {x:332,y:1515, na:true, label:['Samut Prakan','no river-mouth gauge in feed'], s:'R'},
 GULF:{x:332,y:1585}
};
var RIVERS = [ // node id lists; ST code, dam key 'D:<k>' or plain id
 {name:'Ping', nodes:['P.1','D:1','PW','P.7A','P.17','JNS']},
 {name:'Wang', nodes:['W.1C','D:4','W.4A','PW']},
 {name:'Yom',  nodes:['Y.1C','Y.4','Y.64','Y.17','JYN']},
 {name:'Nan',  nodes:['N.1','D:2','N.60','N.5A','N.7A','N.67','JYN']},
 {name:'YomNan', nodes:['JYN','JNS']},
 {name:'CP', nodes:['JNS','C.2','C.13','C.3','C.7A','C.35','PJ','PTH','CPY014','C.12','CPY015','SPK','GULF']},
 {name:'Sakae Krang', nodes:['SK0','D:25','SKJ'], join:'C.2'},
 {name:'Tha Chin', nodes:['TC0','TC1','T.13','TC2','TC3','TC4'], dash:true},
 {name:'Pa Sak', nodes:['S.42','D:19','S.26','PS1','PJ']}
];

/* ---- helpers ---- */
function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function num(v){if(v===null||v===undefined||v==='')return null;var n=Number(v);return isFinite(n)?n:null;}
function f(v,d){return v==null?'–':Number(v).toLocaleString('en-US',{minimumFractionDigits:d||0,maximumFractionDigits:d||0});}
function sg(v,d){return v==null?'–':(v>0?'+':v<0?'−':'±')+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:d||0,maximumFractionDigits:d||0});}
var fmtDT = new Intl.DateTimeFormat('en-GB',{timeZone:TZ,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false});
var fmtD = new Intl.DateTimeFormat('en-GB',{timeZone:TZ,day:'2-digit',month:'short'});
var fmtT = new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false});
function dt(ms){return ms==null?'–':fmtDT.format(ms).replace(',','');}
function parseBkk(s){ // 'YYYY-MM-DD HH:mm' Bangkok → epoch ms
  var m=/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/.exec(s||''); if(!m)return null;
  return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])-7*3600e3;
}
function bkkDate(ms){return new Date(ms+7*3600e3).toISOString().slice(0,10);}
function fetchJSON(url,ms,tries){
  tries=tries==null?2:tries;
  var ac=new AbortController(), t=setTimeout(function(){ac.abort();},ms||50000);
  return fetch(url,{signal:ac.signal,cache:'no-store'}).then(function(r){
    clearTimeout(t);
    if(r.status===429&&tries>0){ // rate limited: back off and retry
      return new Promise(function(res){setTimeout(res,(3-tries)*3000+3000);}).then(function(){return fetchJSON(url,ms,tries-1);});
    }
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.json();
  }).catch(function(e){clearTimeout(t);throw e;});
}
function pool(tasks,n){var i=0;function next(){if(i>=tasks.length)return Promise.resolve();var t=tasks[i++];return t().then(next);}var w=[];for(var k=0;k<n;k++)w.push(next());return Promise.all(w);}
function hav(a,b,c,d){var R=6371,r=Math.PI/180,dl=(c-a)*r,dn=(d-b)*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dn/2)*Math.sin(dn/2);return 2*R*Math.asin(Math.sqrt(x));}
function worst(a,b){return RANK[a]>=RANK[b]?a:b;}
function arrow(t){return t==='rising'?'▲':t==='falling'?'▼':t==='levelled'?'▬':t==='steady'?'▬':'';}
function trendTxt(t){return t==='rising'?'rising':t==='falling'?'falling':t==='levelled'?'steady (levelled off)':t==='steady'?'steady':'n/a';}

/* ---- state ---- */
var S = {wl:null, dams:null, damPrev:null, damDate:null, hist:{}, feeds:{}, fetchedAt:null, rec:{}, met:{}, st:{}, damRec:{}};

/* ---- classification ---- */
function classify(rec){
  if(!rec)return {cls:'na',pct:null,why:'no reading'};
  var pct=num(rec.storage_percent), lv=num(rec.situation_level), msl=num(rec.waterlevel_msl);
  var crit=rec.station&&num(rec.station.critical_level_msl);
  var t=parseBkk(rec.waterlevel_datetime), age=t==null?null:(Date.now()-t)/3600e3;
  if(pct==null||t==null||age>36)return {cls:'na',pct:pct,age:age,why:age>36?'reading older than 36 h':'no reading'};
  var cls;
  if(crit!=null&&msl!=null&&msl>=crit)cls='crit';
  else if(pct>100||lv===5)cls='red';
  else if(pct>=90)cls='orange';
  else if(pct>=70)cls='yellow';
  else cls='green';
  return {cls:cls,pct:pct,age:age,stale:age>3,tw:lv};
}
function classifyDam(p){
  if(p==null)return 'na';
  return p>100?'red':p>=90?'orange':p>=70?'yellow':'green';
}

/* ---- history metrics ---- */
function buildSeries(j){
  var g=j&&j.data&&j.data.graph_data; if(!g)return null;
  var out=[];
  for(var i=0;i<g.length;i++){var r=g[i];var v=num(r.value);if(v==null)continue;var t=parseBkk(r.datetime);if(t==null)continue;out.push({t:t,v:v,q:num(r.discharge)});}
  out.sort(function(a,b){return a.t-b.t;});
  return out.length>10?out:null;
}
function at(ser,t,tol){var best=null,bd=1e18;for(var i=0;i<ser.length;i++){var d=Math.abs(ser[i].t-t);if(d<bd){bd=d;best=ser[i];}}return bd<=(tol||1.6*3600e3)?best:null;}
function meanIn(ser,a,b,key){var s=0,n=0;for(var i=0;i<ser.length;i++){if(ser[i].t>a&&ser[i].t<=b&&ser[i][key]!=null){s+=ser[i][key];n++;}}return n>=12?s/n:null;}
function pctl(ser,a,b,p){var v=[];for(var i=0;i<ser.length;i++){if(ser[i].t>a&&ser[i].t<=b)v.push(ser[i].v);}if(v.length<12)return null;v.sort(function(x,y){return x-y;});return v[Math.min(v.length-1,Math.floor(p*v.length))];}
function metrics(ser,tidal){
  if(!ser)return null;
  var last=ser[ser.length-1],H=3600e3;
  var m={tLast:last.t,vLast:last.v,qLast:last.q,n:ser.length};
  var p24=at(ser,last.t-24*H),p6=at(ser,last.t-6*H);
  m.d24=p24?last.v-p24.v:null; m.d6=p6?last.v-p6.v:null;
  m.q24=(p24&&last.q!=null&&p24.q!=null)?last.q-p24.q:null;
  m.m24=meanIn(ser,last.t-24*H,last.t,'v'); m.pm24=meanIn(ser,last.t-48*H,last.t-24*H,'v');
  m.dm=(m.m24!=null&&m.pm24!=null)?m.m24-m.pm24:null;
  m.tidal=!!tidal; var tr='n/a';
  if(tidal){ // tide: use 24-h high-water proxy (90th percentile of readings) today vs previous 24 h
    m.hw=pctl(ser,last.t-24*H,last.t,0.9); m.phw=pctl(ser,last.t-48*H,last.t-24*H,0.9);
    m.dm=(m.hw!=null&&m.phw!=null)?m.hw-m.phw:null;
    if(m.dm!=null)tr=m.dm>=0.04?'rising':m.dm<=-0.04?'falling':'steady'; }
  else if(m.d24!=null&&m.d6!=null){
    var r24=m.d24,r6=m.d6*4;
    if((r24>=0.10&&r6>=0.04)||r6>=0.15)tr='rising';
    else if((r24<=-0.10&&r6<=-0.04)||r6<=-0.15)tr='falling';
    else if(Math.abs(r24)>=0.10)tr='levelled';
    else tr='steady';
  } else if(m.d24!=null){tr=m.d24>=0.1?'rising':m.d24<=-0.1?'falling':'steady';}
  m.trend=tr;
  // peak (discharge if available else level) over the loaded window
  var key=ser.some(function(r){return r.q!=null;})?'q':'v', pk=null;
  for(var i=0;i<ser.length;i++){if(ser[i][key]!=null&&(!pk||ser[i][key]>=pk.val))pk={val:ser[i][key],t:ser[i].t,key:key};}
  m.peak=pk; m.atPeak=pk&&last[key]!=null&&last[key]>=pk.val*0.99;
  // plateau start: earliest time in last 72 h when value within 2 % of current (continuous to now)
  var ps=last.t;
  for(var k=ser.length-1;k>=0;k--){var x=ser[k][key];if(x==null)continue;if(Math.abs(x-last[key])<=Math.abs(last[key])*0.02&&ser[k].t>=last.t-72*H)ps=ser[k].t;else break;}
  m.plateauStart=ps; m.key=key;
  return m;
}

/* ---- data loading ---- */
function setFeed(id,state,msg){S.feeds[id]={state:state,msg:msg,t:Date.now()};renderFeeds();}
function renderFeeds(){
  var names={wl:'ThaiWater water-level stations (RID/TMD/BMA)',dam:'ThaiWater dam daily reports',hist:'ThaiWater station history (trends)'};
  var h='';
  Object.keys(names).forEach(function(k){
    var x=S.feeds[k]||{state:'loading',msg:'waiting'};
    h+='<div class="feed '+x.state+'"><span class="st"></span><div><b>'+names[k]+'</b><div class="fs">'+esc(x.msg||'')+'</div></div></div>';
  });
  $('feeds').innerHTML=h;
}
function loadWL(){
  setFeed('wl','loading','loading…');
  return fetchJSON(API+'waterlevel_load',60000).catch(function(){return fetchJSON(API+'thailand_main_waterlevel',60000);}).then(function(j){
    var arr=(j&&j.waterlevel_data&&j.waterlevel_data.data)||(j&&j.data)||(Array.isArray(j)?j:null);
    if(!arr||!arr.length)throw new Error('empty');
    var by={};
    arr.forEach(function(r){var c=r.station&&r.station.tele_station_oldcode;if(c&&!by[c])by[c]=r;});
    S.wl=by; setFeed('wl','ok',arr.length+' stations · fetched '+dt(Date.now())+' BKK');
  }).catch(function(e){S.wl=null;setFeed('wl','fail','unavailable ('+(e&&e.message||'error')+')');});
}
function loadDams(){
  setFeed('dam','loading','loading…');
  return fetchJSON(API+'thailand_main_dam',45000).then(function(a){
    if(!Array.isArray(a)||!a.length)throw new Error('empty');
    var mx='';a.forEach(function(r){if(r.dam_date>mx)mx=r.dam_date;});
    S.dams={};a.forEach(function(r){if(r.dam_date===mx&&r.dam)S.dams[r.dam.dam_oldcode]=r;});
    S.damDate=mx;
    var prev=new Date(Date.parse(mx+'T00:00:00Z')-864e5).toISOString().slice(0,10);
    return fetchJSON(API+'thailand_main_dam?dam_date='+prev,45000).then(function(b){
      S.damPrev={};(b||[]).forEach(function(r){if(r.dam_date===prev&&r.dam)S.damPrev[r.dam.dam_oldcode]=r;});
      setFeed('dam','ok','daily report dated '+mx+' · fetched '+dt(Date.now())+' BKK · yesterday comparison '+Object.keys(S.damPrev).length+' dams');
    }).catch(function(){S.damPrev=null;setFeed('dam','part','daily report dated '+mx+' · yesterday comparison unavailable');});
  }).catch(function(e){S.dams=null;S.damPrev=null;setFeed('dam','fail','unavailable ('+(e&&e.message||'error')+')');});
}
function loadHist(){
  S.hist={};
  if(!S.wl){setFeed('hist','fail','unavailable (needs station list)');return Promise.resolve();}
  setFeed('hist','loading','loading…');
  var now=Date.now(),d1=bkkDate(now),d0=bkkDate(now-7*864e5),jobs=[],ok=0,tot=0;
  ST.forEach(function(s){
    var rec=S.wl[s.c];if(!rec||!rec.station)return;tot++;
    var url=API+'waterlevel_graph?station_id='+rec.station.id+'&start_date='+d0+'&end_date='+d1+'&station_type=tele_waterlevel';
    jobs.push(function(){return fetchJSON(url,40000).then(function(j){var ser=buildSeries(j);if(ser){S.hist[s.c]={ser:ser,qmax:num(j.data.qmax),bank:num(j.data.min_bank)};ok++;}}).catch(function(){});});
  });
  return pool(jobs,5).then(function(){
    setFeed('hist',ok===tot?'ok':ok?'part':'fail',ok+' of '+tot+' stations with 7-day hourly history · fetched '+dt(Date.now())+' BKK'+(ok<tot?' (others: trend unavailable)':''));
  });
}

/* ---- model ---- */
function buildModel(){
  S.st={};S.met={};S.damRec={};
  ST.forEach(function(s){
    var rec=S.wl&&S.wl[s.c]||null, cl=classify(rec), lat=rec&&rec.station?num(rec.station.tele_station_lat):null, lon=rec&&rec.station?num(rec.station.tele_station_long):null;
    var tidal=lat!=null&&lat<14.05;
    var h=S.hist[s.c], m=h?metrics(h.ser,tidal):null;
    var q=rec?num(rec.discharge):null, qmax=rec&&rec.station?num(rec.station.qmax):null;
    S.st[s.c]={cfg:s,rec:rec,cls:cl.cls,pct:cl.pct,stale:cl.stale,age:cl.age,why:cl.why,tw:cl.tw,m:m,tidal:tidal,lat:lat,lon:lon,
      msl:rec?num(rec.waterlevel_msl):null,bank:rec&&rec.station?num(rec.station.min_bank):null,q:q,qmax:qmax,
      t:rec?parseBkk(rec.waterlevel_datetime):null,crit:rec&&rec.station?num(rec.station.critical_level_msl):null};
  });
  DAMS.concat(DAM_EXTRA).forEach(function(d){
    var r=S.dams&&S.dams[d.k]||null, p=S.damPrev&&S.damPrev[d.k]||null;
    if(!r){S.damRec[d.k]={cfg:d,cls:'na'};return;}
    var cv=1e6/86400, pct=num(r.dam_storage_percent), st=num(r.dam_storage), mx=r.dam&&num(r.dam.max_storage), nm=r.dam&&num(r.dam.normal_storage);
    var inf=num(r.dam_inflow), rel=num(r.dam_released), sp=num(r.dam_spilled);
    var o={cfg:d,rec:r,cls:classifyDam(pct),pct:pct,stor:st,max:mx,norm:nm,pmax:(st!=null&&mx)?st/mx*100:null,
      inQ:inf!=null?inf*cv:null,outQ:rel!=null?rel*cv:null,spill:sp,date:r.dam_date};
    if(p){var ps=num(p.dam_storage),pp=num(p.dam_storage_percent),pi=num(p.dam_inflow),pr=num(p.dam_released);
      o.dStor=(st!=null&&ps!=null)?st-ps:null;o.dPct=(pct!=null&&pp!=null)?pct-pp:null;
      o.dIn=(inf!=null&&pi!=null)?(inf-pi)*cv:null;o.dOut=(rel!=null&&pr!=null)?(rel-pr)*cv:null;}
    S.damRec[d.k]=o;
  });
}
function stat(code){return S.st[code]||{cls:'na'};}
function nodeCls(id){
  if(id.indexOf('D:')===0)return 'na'; // dams don't colour river segments
  if(S.st[id])return S.st[id].cls;
  var p=PL[id];
  if(p&&p.inherit){var c='na';p.inherit.forEach(function(i){c=worst(c,nodeCls(i));});return c;}
  return 'na';
}
function nodeXY(id){
  if(id.indexOf('D:')===0){var d=DAMS.filter(function(x){return 'D:'+x.k===id;})[0];return d?{x:d.x,y:d.y}:null;}
  var s=ST.filter(function(x){return x.c===id;})[0];if(s)return {x:s.x,y:s.y};
  return PL[id]?{x:PL[id].x,y:PL[id].y}:null;
}

/* crest-travel estimate */
function hoursToBkk(code){
  var st=stat(code);
  if(HRS_TO_BKK[code]!=null)return {h:HRS_TO_BKK[code],kind:'documented'};
  if(code==='C.2')return {h:H_NS_DAM+H_DAM_BKK,kind:'documented'};
  var c2=stat('C.2'),c35=stat('C.35');
  if(code==='S.26'&&st.lat!=null&&c35.lat!=null){var dk=hav(st.lat,st.lon,c35.lat,c35.lon)*SINUOSITY;return {h:HRS_TO_BKK['C.35']+dk/KMH,kind:'indicative',km:dk};}
  var r=st.cfg&&st.cfg.r;
  if((r==='Ping'||r==='Wang'||r==='Yom'||r==='Nan')&&st.lat!=null&&c2.lat!=null){
    var km=hav(st.lat,st.lon,c2.lat,c2.lon)*SINUOSITY;
    return {h:H_NS_DAM+H_DAM_BKK+km/KMH,kind:'indicative',km:km};
  }
  return null;
}
function crestRows(){
  var now=Date.now(),rows=[];
  Object.keys(S.st).forEach(function(code){
    var s=S.st[code];if(s.cls==='na'||!s.m)return;
    var r=s.cfg.r;if(r==='Tha Chin'||r==='Pa Sak'&&code==='S.42')return;
    if(['CPY014','C.12','CPY015'].indexOf(code)>=0)return; // destination reach
    var hb=hoursToBkk(code);if(!hb)return;
    var high=s.pct>=70, tr=s.m.trend;
    if(!(high||tr==='rising'))return;
    var m=s.m, pk=m.peak, state, tref;
    if(tr==='rising'){state='rising – crest not yet reached';tref=now;}
    else if(tr==='falling'&&!m.atPeak){state='past peak, falling';tref=pk?pk.t:now;}
    else {state='at/near peak, levelled off';tref=m.plateauStart||now;}
    var lo=tref+hb.h*3600e3, hiH=hb.h+SPREAD_H+(hb.kind==='indicative'?(hb.h-(H_NS_DAM+H_DAM_BKK))*0.25:0);
    var hi=tref+hiH*3600e3;
    rows.push({code:code,s:s,hb:hb,state:state,tref:tref,lo:lo,hi:hi,tr:tr,passed:hi<now&&tr!=='rising',future:hi>now,major:(hb.kind==='documented')||(s.q!=null&&s.q>=500)});
  });
  rows.sort(function(a,b){return b.lo-a.lo;});
  return rows;
}
function bangkokReach(){
  return ['CPY014','C.12','CPY015'].map(function(c){
    var s=stat(c);if(s.cls==='na')return {code:c,s:s,na:true};
    var m=s.m,lvl=(m&&m.hw!=null)?m.hw:s.msl,head=(s.bank!=null&&lvl!=null)?s.bank-lvl:null;
    var rate=(m&&m.dm!=null)?m.dm:null; // m (high-water change vs previous 24 h)
    var days=(head!=null&&head>0&&rate!=null&&rate>0.01)?head/rate:null;
    return {code:c,s:s,head:head,rate:rate,days:days,lvl:lvl};
  });
}
function outlook(){
  var out={lines:[],verdict:null,vcls:'na',crest:null};
  var c2=stat('C.2'),c13=stat('C.13'),bk=bangkokReach(),rows=crestRows(),now=Date.now();
  var haveUp=(c2.cls!=='na')||(c13.cls!=='na');
  if(!S.wl){out.verdict='Station feed unavailable – cannot assess.';return out;}
  // R1 Nakhon Sawan
  if(c2.cls!=='na'){
    var pk=c2.m&&c2.m.peak;
    out.lines.push('Nakhon Sawan (C.2, where the four rivers have merged): <b>'+f(c2.q)+' m³/s</b>, '+f(c2.pct,0)+'% of bank-full, <b>'+trendTxt(c2.m?c2.m.trend:'n/a')+'</b>'+
      (c2.m&&c2.m.q24!=null?' ('+sg(c2.m.q24,0)+' m³/s vs 24 h ago)':'')+(pk&&pk.key==='q'?'; 7-day peak '+f(pk.val)+' m³/s on '+dt(pk.t)+'.':'.'));
  } else out.lines.push('Nakhon Sawan (C.2): unavailable.');
  // R2 dam
  if(c13.cls!=='na'&&c13.q!=null){
    var pc=c13.q/RID_REF.critical*100, ov=c13.q>=RID_REF.overtop;
    out.lines.push('Chao Phraya Dam outflow (C.13): <b>'+f(c13.q)+' m³/s</b> = '+f(pc,0)+'% of RID’s 2,730 m³/s critical rate'+(ov?' (at/above the 2,200 m³/s level where RID says low-lying land and levees just downstream start to flood)':' (below the 2,200 m³/s level RID cites for flooding of low-lying land downstream)')+
      '; <b>'+trendTxt(c13.m?c13.m.trend:'n/a')+'</b>'+(c13.m&&c13.m.q24!=null?' ('+sg(c13.m.q24,0)+' m³/s vs 24 h ago)':'')+'.');
  } else out.lines.push('Chao Phraya Dam outflow (C.13): unavailable.');
  // other upstream
  var dstr=rows.filter(function(r){return r.code!=='C.2'&&r.code!=='C.13'&&r.s.pct>=100;}).map(function(r){return r.s.cfg.n+' '+r.code+' ('+f(r.s.pct,0)+'%)';});
  if(dstr.length)out.lines.push('Over bank-full now: '+dstr.join(', ')+' – low-lying land beside these rivers is exposed (local flooding, not necessarily travelling to Bangkok).');
  // R3 timing
  var act=rows.filter(function(r){return r.major&&r.future&&(r.tr==='rising'||r.s.pct>=90||r.code==='C.13'||r.code==='C.2');});
  var minor=rows.filter(function(r){return !r.major;}).map(function(r){return r.s.cfg.n+' '+r.code+' ('+f(r.s.pct,0)+'%, '+trendTxt(r.tr)+')';});
  if(minor.length)out.lines.push('Minor tributary points that are high or rising (no or small discharge, so not used for the headline): '+minor.join(', ')+'.');
  var headRow=act.length?act.slice().sort(function(a,b){return b.lo-a.lo;})[0]:null;
  if(headRow){
    var hiAll=Math.max.apply(null,act.map(function(r){return r.hi;}));
    var dLo=Math.max(0,(headRow.lo-now)/864e5), dHi=Math.max(0,(hiAll-now)/864e5), mid=(dLo+dHi)/2;
    out.crest={days:Math.round(mid*2)/2,lo:dLo,hi:dHi,row:headRow,loT:headRow.lo,hiT:hiAll};
    out.lines.push('Highest water now on its way: from <b>'+esc(headRow.s.cfg.n)+' ('+headRow.code+')</b> – estimated to reach the Bangkok reach <b>'+dt(headRow.lo)+' – '+dt(hiAll)+' (BKK)</b>, i.e. ~'+f(dLo,1)+'–'+f(dHi,1)+' days from now.');
  } else if(haveUp){
    out.lines.push('No upstream station is both high and rising/just levelled off – no further crest is on its way down the river (past peaks have already passed).');
  }
  // R4 Bangkok gauges
  var bkOk=bk.filter(function(b){return !b.na;});
  if(bkOk.length){
    bkOk.forEach(function(b){
      var s=b.s;
      out.lines.push('Bangkok-reach gauge '+s.cfg.n+' ('+b.code+'): <b>'+f(s.pct,0)+'%</b> of bank-full, '+(b.head==null?'headroom n/a':b.head>0?f(b.head,2)+' m below bank at the 24 h high-water mark':'<b>at/above bank level at the 24 h high-water mark ('+sg(-b.head,2)+' m)</b>')+
        ', high-water change vs previous 24 h '+(b.rate!=null?sg(b.rate,2)+' m':'n/a')+
        (b.days!=null?' → bank-full in ~'+f(b.days,1)+' days <i>only if</i> that rise continued unchanged (upper bound).':(b.rate!=null&&b.rate<=0.01?' – not rising.':'.')));
    });
  } else out.lines.push('Bangkok-reach gauges (Nonthaburi, Sam Sen, Krung Thep Bridge): unavailable.');
  out.lines.push('Lower Bangkok gauges are tide-affected and no tide feed is available here; high tide and heavy local rain can raise levels beyond what upstream flow alone implies.');
  // verdict
  var bkMax=bkOk.reduce(function(a,b){return Math.max(a,b.s.pct||0);},0);
  var upRising=rows.some(function(r){return r.tr==='rising';});
  var soon=bkOk.filter(function(b){return b.days!=null&&b.days<=7;});
  if(bkOk.some(function(b){return b.s.pct>100;})){out.vcls='red';out.verdict='A Bangkok-reach gauge is already above bank-full – follow BMA announcements.';}
  else if(bkOk.some(function(b){return b.head!=null&&b.head<=0;})){
    var at=bkOk.filter(function(b){return b.head!=null&&b.head<=0;}).map(function(b){return b.s.cfg.n;}).join(', ');
    out.vcls='orange';out.verdict='Warning: at high tide the river reaches bank level at '+at+' (24 h high-water mark). Overtopping of low points is possible at the next high tides – follow BMA / local announcements.';
  }
  else if(soon.length&&(upRising||(headRow&&headRow.tr!=='falling'))){
    var dmin=Math.min.apply(null,soon.map(function(b){return b.days;}));
    out.vcls='orange';out.verdict='Watch: if the current rise continued it could reach bank-full in ~'+f(dmin,1)+' days; upstream flow is '+(upRising?'still rising':'near its peak')+'. Rise is expected to slow once the current release has passed through.';
  }
  else if(bkMax>=90){out.vcls='yellow';out.verdict='Bangkok-reach gauges are close to bank-full ('+f(bkMax,0)+'%) but the current trend does not show an overtopping from upstream within 7 days.';}
  else if(!rows.length&&haveUp){out.vcls='green';out.verdict='No flood expected from upstream at current levels.';}
  else if(haveUp){out.vcls='yellow';out.verdict='Elevated upstream flow, but Bangkok-reach gauges are below 90% of bank-full and not rising towards it within 7 days.';}
  else {out.vcls='na';out.verdict='Insufficient data.';}
  out.rows=rows;out.bk=bk;
  return out;
}

/* ---- rendering ---- */
function chip(cls,txt){return '<span class="chip '+cls+'">'+esc(txt||LBL[cls])+'</span>';}
function ago(ms){if(ms==null)return '–';var h=(Date.now()-ms)/3600e3;return h<1?Math.round(h*60)+' min ago':h<48?f(h,1)+' h ago':f(h/24,1)+' d ago';}
var MAIN_STEM=['C.2','C.13','C.3','C.7A','C.35','CPY014','C.12','CPY015'];

function renderOverall(O){
  var el=$('overall'),h='<h2>Overall basin status</h2>';
  if(!S.wl){el.innerHTML=h+'<div class="muted">Unavailable – station feed failed.</div>';return;}
  var w='na';MAIN_STEM.forEach(function(c){w=worst(w,stat(c).cls);});
  var counts={green:0,yellow:0,orange:0,red:0,crit:0,na:0};Object.keys(S.st).forEach(function(c){counts[S.st[c].cls]++;});
  var damW='na';DAMS.forEach(function(d){if(d.main)damW=worst(damW,S.damRec[d.k].cls);});
  var txt={green:'Normal',yellow:'Watch – elevated flow',orange:'Warning – Chao Phraya main stem near bank-full',red:'Overflowing in places along the Chao Phraya',crit:'Critical level reached',na:'Unavailable'}[w];
  var over=Object.keys(S.st).filter(function(c){return S.st[c].cls==='red'||S.st[c].cls==='crit';}).length;
  h+='<div class="banner"><div class="sw" style="background:'+COL[w]+'"></div><div><div class="big">'+esc(LBL[w])+'</div><div class="bigsub">'+esc(txt)+'</div></div></div>';
  h+='<div class="kv"><span class="k">Main stem gauges (Nakhon Sawan → Bangkok)</span><span class="v">'+MAIN_STEM.map(function(c){return '<span class="dotc" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+COL[stat(c).cls]+'"></span>';}).join(' ')+'</span></div>';
  h+='<div class="kv"><span class="k">All '+Object.keys(S.st).length+' map stations</span><span class="v">'+['green','yellow','orange','red','crit','na'].filter(function(k){return counts[k];}).map(function(k){return counts[k]+' '+LBL[k].toLowerCase();}).join(' · ')+'</span></div>';
  h+='<div class="kv"><span class="k">Main dams (Bhumibol, Sirikit, Kiew Lom, Pa Sak)</span><span class="v">'+chip(damW,DLBL[damW])+'</span></div>';
  h+='<div class="kv"><span class="k">Stations over bank-full</span><span class="v">'+over+'</span></div>';
  el.innerHTML=h;
}
function renderCrest(O){
  var el=$('crest'),h='<h2>Estimated crest arrival at Bangkok <span class="tag est">ESTIMATE</span></h2>';
  if(!S.wl){el.innerHTML=h+'<div class="muted">Unavailable – station feed failed.</div>';return;}
  if(O.crest){
    var c=O.crest;
    if(c.hi<0.05){h+='<div class="big">Arrived</div>';}
    else h+='<div class="big">~'+f(c.days,1)+' days</div><div class="bigsub">range '+f(c.lo,1)+'–'+f(c.hi,1)+' days · '+dt(c.loT)+' – '+dt(c.hiT)+' (BKK)</div>';
    h+='<div class="small" style="margin-top:8px">Controlling signal: <b>'+esc(c.row.s.cfg.n)+' ('+c.row.code+')</b> – '+esc(c.row.state)+'. Time = arrival at the Nonthaburi–Bangkok reach of the water now passing that point (RID leg times), <b>not</b> a flood time.</div>';
  } else {
    h+='<div class="big" style="font-size:22px">No flood expected from upstream at current levels</div><div class="bigsub">No upstream station is both high (≥70% of bank-full) and rising / just levelled off.</div>';
  }
  h+='<div class="small muted" style="margin-top:8px"><b>Not an official forecast.</b> Follow RID, HII, TMD and BMA announcements. See the method below.</div>';
  el.innerHTML=h;
}
function renderOutlook(O){
  var el=$('outlook'),h='<h2>What this means for Bangkok · next 1–7 days <span class="tag est">rule-based, from the numbers below</span></h2>';
  if(O.verdict)h+='<div class="verdict" style="border-color:'+COL[O.vcls]+'">'+esc(O.verdict)+'</div>';
  h+='<ul class="lines">'+O.lines.map(function(l){return '<li>'+l+'</li>';}).join('')+'</ul>';
  el.innerHTML=h;
}
function renderTop(){
  var el=$('topRivers'),h='<h2>Highest rivers &amp; dams</h2>';
  if(!S.wl&&!S.dams){el.innerHTML=h+'<div class="muted">Unavailable.</div>';}
  else{
    var names={'Ping':'Ping','Wang':'Wang','Yom':'Yom','Nan':'Nan','Chao Phraya':'Chao Phraya','Pa Sak':'Pa Sak','Tha Chin':'Tha Chin'};
    var best={};Object.keys(S.st).forEach(function(c){var s=S.st[c];if(s.pct==null||s.cls==='na')return;var r=s.cfg.r;if(!best[r]||s.pct>best[r].pct)best[r]=s;});
    var list=Object.keys(best).map(function(r){return best[r];}).sort(function(a,b){return b.pct-a.pct;});
    h+='<div class="small muted" style="margin-bottom:2px">Rivers – highest station (% of bank-full)</div>';
    list.forEach(function(s){h+='<div class="kv"><span class="k"><span class="dotc" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+COL[s.cls]+';margin-right:6px"></span><b>'+esc(names[s.cfg.r]||s.cfg.r)+'</b> · '+esc(s.cfg.n)+' ('+s.cfg.c+')</span><span class="v">'+f(s.pct,0)+'%</span></div>';});
    if(S.dams){
      var dl=DAMS.concat(DAM_EXTRA).map(function(d){return S.damRec[d.k];}).filter(function(d){return d&&d.pct!=null;}).sort(function(a,b){return b.pct-a.pct;}).slice(0,5);
      h+='<div class="small muted" style="margin:8px 0 2px">Dams – storage vs normal capacity</div>';
      dl.forEach(function(d){h+='<div class="kv"><span class="k"><span class="dotc" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+COL[d.cls]+';margin-right:6px"></span>'+esc(d.cfg.n)+'</span><span class="v">'+f(d.pct,1)+'%</span></div>';});
    } else h+='<div class="small muted" style="margin-top:8px">Dams: unavailable.</div>';
    el.innerHTML=h;
  }
  var e2=$('nearest'),g='<h2>Nearest to bank-full</h2>';
  if(!S.wl){e2.innerHTML=g+'<div class="muted">Unavailable.</div>';return;}
  var all=Object.keys(S.st).map(function(c){return S.st[c];}).filter(function(s){return s.pct!=null&&s.cls!=='na';});
  var over=all.filter(function(s){return s.pct>100;}).sort(function(a,b){return b.pct-a.pct;});
  var near=all.filter(function(s){return s.pct<=100&&s.pct>=80;}).sort(function(a,b){return b.pct-a.pct;});
  g+='<div class="small muted">Already over bank-full</div>';
  g+=over.length?over.slice(0,6).map(function(s){return '<div class="kv"><span class="k">'+esc(s.cfg.n)+' ('+s.cfg.c+')</span><span class="v" style="color:'+COL[s.cls]+'">'+f(s.pct,0)+'%</span></div>';}).join(''):'<div class="small">none</div>';
  g+='<div class="small muted" style="margin-top:8px">Within 20% of bank-full</div>';
  g+=near.length?near.slice(0,6).map(function(s){return '<div class="kv"><span class="k">'+esc(s.cfg.n)+' ('+s.cfg.c+')</span><span class="v" style="color:'+COL[s.cls]+'">'+f(s.pct,0)+'%</span></div>';}).join(''):'<div class="small">none</div>';
  e2.innerHTML=g;
}

/* SVG schematic */
function cr(p0,p1,p2,p3){ // catmull-rom → cubic control points for segment p1→p2
  var t=0.5;return [p1.x+(p2.x-p0.x)*t/3*1, p1.y+(p2.y-p0.y)*t/3*1, p2.x-(p3.x-p1.x)*t/3*1, p2.y-(p3.y-p1.y)*t/3*1];
}
function renderMap(){
  var svg=$('map'),o='';
  o+='<defs><linearGradient id="gulf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#dbe9ff"/><stop offset="1" stop-color="#bcd6ff"/></linearGradient></defs>';
  // river headers
  [['PING · ปิง',135],['WANG · วัง',235],['YOM · ยม',405],['NAN · น่าน',585]].forEach(function(h){o+='<text class="rh" x="'+h[1]+'" y="30" text-anchor="middle">'+h[0]+'</text>';});
  // rivers
  var segs='';
  RIVERS.forEach(function(rv){
    var pts=rv.nodes.map(function(id){var p=nodeXY(id);return p?{id:id,x:p.x,y:p.y}:null;}).filter(Boolean);
    for(var i=0;i<pts.length-1;i++){
      var p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
      var c=cr(p0,p1,p2,p3);
      var d='M'+p1.x+','+p1.y+' C'+c[0].toFixed(1)+','+c[1].toFixed(1)+' '+c[2].toFixed(1)+','+c[3].toFixed(1)+' '+p2.x+','+p2.y;
      var ca=nodeCls(p1.id),cb=nodeCls(p2.id),cls=worst(ca,cb);
      if(rv.name==='Tha Chin'||rv.name==='Sakae Krang'){ // tributaries: use gauge on that branch only
        cls=(rv.name==='Tha Chin')?nodeCls('T.13'):'na';
        if(rv.name==='Sakae Krang')cls='na';
      }
      var na=(cls==='na');
      segs+='<path d="'+d+'" fill="none" stroke="#e8ebf1" stroke-width="12" stroke-linecap="round"/>';
      segs+='<path d="'+d+'" fill="none" stroke="'+COL[cls]+'" stroke-width="6" stroke-linecap="round"'+(na?' stroke-dasharray="3 9"':'')+'><title>'+esc(rv.name)+' · '+LBL[cls]+'</title></path>';
    }
  });
  o+=segs;
  // annotations
  o+='<text class="an" x="62" y="778">Sakae Krang · สะแกกรัง</text>';
  o+='<text class="an" x="182" y="1160" text-anchor="end">Tha Chin · ท่าจีน</text>';
  o+='<text class="an" x="132" y="1355" text-anchor="end">→ Nakhon Pathom</text><text class="an" x="132" y="1370" text-anchor="end">→ Samut Sakhon</text>';
  o+='<text class="an" x="592" y="1160" text-anchor="end">Pa Sak · ป่าสัก</text>';
  o+='<text class="an" x="6" y="56">↓ flow direction</text>';
  // plain nodes
  Object.keys(PL).forEach(function(id){
    var p=PL[id];
    if(id==='GULF'){
      o+='<rect x="190" y="1560" width="300" height="60" rx="14" fill="url(#gulf)"/><text class="rh" x="340" y="1590" text-anchor="middle" style="fill:#2f5fb3">GULF OF THAILAND</text><text class="an" x="340" y="1608" text-anchor="middle" style="fill:#4f78bd">อ่าวไทย · tide: no public feed</text>';
      return;
    }
    if(p.label){
      var cl=p.na?'na':nodeCls(id);
      o+='<circle cx="'+p.x+'" cy="'+p.y+'" r="'+(p.na?5:6)+'" fill="'+(p.na?'#fff':COL[cl])+'" stroke="'+(p.na?COL.na:'#fff')+'" stroke-width="2.5"/>';
      o+='<text class="lb l1" x="'+(p.x+14)+'" y="'+(p.y-1)+'">'+esc(p.label[0])+'</text><text class="lb l2" x="'+(p.x+14)+'" y="'+(p.y+13)+'">'+esc(p.label[1])+'</text>';
    }
  });
  // stations
  ST.forEach(function(sc){
    var s=S.st[sc.c],cls=s.cls,L=sc.s==='L',tx=L?sc.x-14:sc.x+14,an=L?'end':'start';
    var l2;
    if(cls==='na')l2='unavailable';
    else{
      l2=f(s.pct,0)+'%'+(s.q!=null?' · '+f(s.q)+' m³/s':'')+(s.m?' '+arrow(s.m.trend):'');
      if(s.stale)l2+=' ⏱';
    }
    o+='<g class="node" data-k="st:'+sc.c+'" tabindex="0" role="button" aria-label="'+esc(sc.n+' '+sc.c+' '+LBL[cls])+'">';
    if(s.stale)o+='<circle cx="'+sc.x+'" cy="'+sc.y+'" r="12" fill="none" stroke="#9aa3b2" stroke-width="1.5" stroke-dasharray="3 3"/>';
    if(sc.dam){ // Chao Phraya barrage glyph
      o+='<rect x="'+(sc.x-13)+'" y="'+(sc.y-8)+'" width="26" height="16" rx="3" fill="'+COL[cls]+'" stroke="#fff" stroke-width="2.5"/><path d="M'+(sc.x-8)+','+(sc.y+3)+' q4,-5 8,0 t8,0" stroke="#fff" stroke-width="1.6" fill="none"/>';
    } else o+='<circle cx="'+sc.x+'" cy="'+sc.y+'" r="8" fill="'+COL[cls]+'" stroke="#fff" stroke-width="2.5"/>';
    o+='<circle cx="'+sc.x+'" cy="'+sc.y+'" r="18" fill="transparent"/>';
    var sx=sc.dam?(L?sc.x-20:sc.x+20):tx;
    o+='<text class="lb l1" x="'+sx+'" y="'+(sc.y-2)+'" text-anchor="'+an+'">'+esc(sc.n)+' · '+sc.c+'</text>';
    o+='<text class="lb l2" x="'+sx+'" y="'+(sc.y+12)+'" text-anchor="'+an+'">'+esc(l2)+'</text></g>';
  });
  // dams
  DAMS.forEach(function(dc){
    var d=S.damRec[dc.k],cls=d.cls,L=dc.s==='L',tx=L?dc.x-20:dc.x+20,an=L?'end':'start',l2;
    var l2a,l2b='';
    if(cls==='na')l2a='unavailable';
    else{l2a=f(d.pct,0)+'% of normal storage';l2b='in '+f(d.inQ)+' · out '+f(d.outQ)+' m³/s';}
    o+='<g class="node" data-k="dam:'+dc.k+'" tabindex="0" role="button" aria-label="'+esc(dc.n+' dam '+LBL[cls])+'">';
    o+='<rect x="'+(dc.x-12)+'" y="'+(dc.y-9)+'" width="24" height="18" rx="4" fill="'+COL[cls]+'" stroke="#fff" stroke-width="2.5"/><path d="M'+(dc.x-8)+','+(dc.y+3)+' q4,-5 8,0 t8,0" stroke="#fff" stroke-width="1.6" fill="none"/><path d="M'+(dc.x-8)+','+(dc.y-3)+' h16" stroke="#fff" stroke-width="1.6"/>';
    o+='<circle cx="'+dc.x+'" cy="'+dc.y+'" r="20" fill="transparent"/>';
    o+='<text class="lb l1" x="'+tx+'" y="'+(dc.y-9)+'" text-anchor="'+an+'">'+esc(dc.n)+' dam</text>';
    o+='<text class="lb l2" x="'+tx+'" y="'+(dc.y+6)+'" text-anchor="'+an+'">'+esc(l2a)+'</text>';
    if(l2b)o+='<text class="lb l2" x="'+tx+'" y="'+(dc.y+21)+'" text-anchor="'+an+'">'+esc(l2b)+'</text>';
    o+='</g>';
  });
  svg.innerHTML=o;
  svg.querySelectorAll('.node').forEach(function(n){
    var open=function(){showDetail(n.getAttribute('data-k'));};
    n.addEventListener('click',open);n.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  });
}
function renderLegend(){
  $('legend').innerHTML=['green','yellow','orange','red','crit','na'].map(function(k){
    var t={green:'Normal &lt;70% of bank-full',yellow:'Watch 70–90%',orange:'Warning 90–100%',red:'Overflowing &gt;100%',crit:'Critical (ThaiWater critical level)',na:'Unavailable / no gauge'}[k];
    return '<span><i style="background:'+COL[k]+'"></i>'+t+'</span>';
  }).join('')+'<span>▲ rising · ▼ falling · ▬ steady · ⏱ reading &gt;3 h old</span><span>Dams: % of normal storage (red = above normal capacity), flows in m³/s</span>';
}

/* tables */
function relT(ms){return ms==null?'–':(bkkDate(ms)===bkkDate(Date.now())?fmtT.format(ms):fmtDT.format(ms).replace(',',''));}
function renderDamTable(){
  var el=$('damTable');
  if(!S.dams){el.innerHTML='<div class="muted">Unavailable – dam feed failed.</div>';$('damNote').textContent='';return;}
  var h='<table><thead><tr><th>Dam</th><th>River</th><th class="r">Storage (mcm)</th><th class="r">% of normal</th><th class="r">% of max</th><th class="r">Inflow m³/s</th><th class="r">Outflow m³/s</th><th class="r">Δ storage vs yesterday</th><th class="r">Δ outflow</th></tr></thead><tbody>';
  DAMS.concat(DAM_EXTRA).forEach(function(c){
    var d=S.damRec[c.k];
    if(!d||d.cls==='na'){h+='<tr><td>'+esc(c.n)+'</td><td>'+esc(c.r)+'</td><td colspan="7" class="muted">unavailable</td></tr>';return;}
    h+='<tr><td><span class="dotc" style="background:'+COL[d.cls]+'"></span><b>'+esc(c.n)+'</b></td><td>'+esc(c.r)+'</td><td class="r">'+f(d.stor,0)+'</td><td class="r"><b>'+f(d.pct,1)+'%</b></td><td class="r">'+f(d.pmax,1)+'%</td><td class="r">'+f(d.inQ)+'</td><td class="r">'+f(d.outQ)+(d.spill>0?' (spill '+f(d.spill*1e6/86400)+')':'')+'</td><td class="r">'+(d.dStor!=null?sg(d.dStor,1)+' mcm ('+sg(d.dPct,2)+' pt)':'n/a')+'</td><td class="r">'+(d.dOut!=null?sg(d.dOut,0):'n/a')+'</td></tr>';
  });
  h+='</tbody></table>';el.innerHTML=h;
  $('damNote').innerHTML='Daily report dated <b>'+esc(S.damDate)+'</b> (ThaiWater/RID; latest available, typically morning of that day). Inflow/outflow = million m³/day ÷ 0.0864. “% of normal” is ThaiWater’s storage percent against normal storage capacity (can exceed 100%); colours use the same bands as rivers. Chao Phraya (Chai Nat) is a barrage, not in the dam feed – see station C.13.';
}
function renderStTable(){
  var el=$('stTable');
  if(!S.wl){el.innerHTML='<div class="muted">Unavailable – station feed failed.</div>';return;}
  var order=['Ping','Wang','Yom','Nan','Chao Phraya','Pa Sak','Tha Chin'],h='<table><thead><tr><th>Station</th><th class="r">Level m</th><th class="r">Bank m</th><th class="r">% bank-full</th><th class="r">Below bank m</th><th class="r">Q m³/s</th><th class="r">Q vs capacity</th><th>Trend (24 h)</th><th>ThaiWater class</th><th>Reading</th></tr></thead><tbody>';
  order.forEach(function(r){
    h+='<tr class="grp"><td colspan="10">'+r+'</td></tr>';
    ST.filter(function(s){return s.r===r;}).forEach(function(sc){
      var s=S.st[sc.c];
      if(s.cls==='na'){h+='<tr><td><span class="dotc" style="background:'+COL.na+'"></span>'+esc(sc.n)+' · '+sc.c+'</td><td colspan="9" class="muted">unavailable'+(s.why?' ('+esc(s.why)+')':'')+'</td></tr>';return;}
      var m=s.m,hd=(s.bank!=null&&s.msl!=null)?s.bank-s.msl:null;
      h+='<tr><td><span class="dotc" style="background:'+COL[s.cls]+'"></span><b>'+esc(sc.n)+'</b> · '+sc.c+(s.tidal?' <span class="muted">(tidal)</span>':'')+'</td><td class="r">'+f(s.msl,2)+'</td><td class="r">'+f(s.bank,2)+'</td><td class="r"><b>'+f(s.pct,0)+'%</b></td><td class="r '+(hd!=null&&hd<0?'pos':'')+'">'+(hd!=null?sg(hd,2):'–')+'</td><td class="r">'+f(s.q)+'</td><td class="r">'+(s.q!=null&&s.qmax?f(s.q/s.qmax*100,0)+'%':'–')+'</td><td>'+(m?arrow(m.trend)+' '+trendTxt(m.trend)+(s.tidal?(m.dm!=null?' ('+sg(m.dm,2)+' m high-water)':''):(m.d24!=null?' ('+sg(m.d24,2)+' m)':'')):'<span class="muted">n/a</span>')+'</td><td>'+esc(TWCLASS[s.tw]||'–')+'</td><td'+(s.stale?' class="pos"':'')+'>'+relT(s.t)+(s.stale?' ⏱ '+ago(s.t):'')+'</td></tr>';
    });
  });
  h+='</tbody></table>';el.innerHTML=h;
}
function renderCrestTable(O){
  var el=$('crestTable'),h='<h2>Crest travel-time table <span class="tag est">ESTIMATE</span></h2>';
  if(!S.wl){el.innerHTML=h+'<div class="muted">Unavailable – station feed failed.</div>';return;}
  if(!O.rows||!O.rows.length){el.innerHTML=h+'<div><b>No flood expected from upstream at current levels.</b> <span class="muted">No upstream station is high (≥70% of bank-full) or rising.</span></div>';return;}
  h+='<div class="tablewrap"><table><thead><tr><th>Upstream point</th><th>Status</th><th>State of the crest</th><th class="r">Hours to Bangkok</th><th>Arrival at Nonthaburi–Bangkok (BKK time)</th><th class="r">Days from now</th></tr></thead><tbody>';
  O.rows.forEach(function(r){
    var now=Date.now(),dl=(r.lo-now)/864e5,dh=(r.hi-now)/864e5;
    var when=r.tr==='rising'?'earliest for current flow':'';
    h+='<tr><td><span class="dotc" style="background:'+COL[r.s.cls]+'"></span><b>'+esc(r.s.cfg.n)+'</b> · '+r.code+'</td><td>'+f(r.s.pct,0)+'% '+arrow(r.tr)+'</td><td>'+esc(r.state)+(r.major?'':' <span class="muted">(minor tributary – not in headline)</span>')+'</td><td class="r">'+f(r.hb.h,0)+' h'+(r.hb.kind==='indicative'?' <span class="muted" title="distance-based, indicative">*</span>':'')+'</td><td>'+(r.hi<now?'already passed (by '+dt(r.hi)+')':dt(Math.max(r.lo,now))+' – '+dt(r.hi))+(when?' <span class="muted">('+when+')</span>':'')+'</td><td class="r">'+(r.hi<now?'–':f(Math.max(0,dl),1)+'–'+f(Math.max(0,dh),1))+'</td></tr>';
  });
  h+='</tbody></table></div><div class="small muted" style="margin-top:6px">* Indicative: leg from the gauge to Nakhon Sawan uses straight-line distance × 1.3 ÷ the RID-reported 4.1 km/h wave speed (98 km in 24 h). Stations listed are those ≥70% of bank-full or rising. “Past peak” rows show when that station’s highest flow of the last 7 days reaches Bangkok.</div>';
  el.innerHTML=h;
}
function renderMethod(){
  $('methodBody').innerHTML=
  '<p><b>ESTIMATE – not an official forecast.</b> This page does not run a hydraulic model. It applies published typical travel times to live ThaiWater readings, with simple rules. Always follow RID, HII, TMD, DDPM and BMA announcements.</p>'+
  '<p><b>Travel times used.</b> Nakhon Sawan (C.2) → Chao Phraya Dam, Chai Nat: 98 km, ≈24 h (RID, as reported by <a href="https://www.thairath.co.th/news/local/north/2811372" target="_blank" rel="noopener">Thairath, 29 Aug 2024</a>, which also quotes 3–4 days for water to reach Bangkok). Dam → Sing Buri ≈10 h, → Ang Thong +8 h, → Ayutthaya +6 h, → Pathum Thani +8 h, → Nonthaburi/Bangkok +24 h = <b>56 h</b> (RID / National Water Resources Office figures reproduced by <a href="https://www.springnews.co.th/news/infographic/860651" target="_blank" rel="noopener">Spring News, 10 Nov 2025</a>). So Nakhon Sawan → Bangkok ≈ <b>80 h (~3.3 days)</b>. The 2026 situation reports give the same picture: <a href="https://www.khaosodenglish.com/news/2026/10/01/chao-phraya-dam-increases-discharge-as-northern-runoff-approaches-riverside-residents-urged-to-prepare-to-evacuate/" target="_blank" rel="noopener">Khaosod English, 1 Oct 2026</a> (water near Nakhon Sawan reaches the dam within a day, Ayutthaya on 3 Oct).</p>'+
  '<p><b>Range.</b> Low end = documented time; high end = +24 h (my assumption for slower travel when the channel is near bank-full, wave attenuation, tide and changed dam releases). Upstream tributary stations (Ping/Wang/Yom/Nan) add an indicative leg: straight-line distance to C.2 × 1.3 ÷ 4.1 km/h (the RID-reported Nakhon Sawan → dam speed), plus 25% extra on the upper bound.</p>'+
  '<p><b>When an estimate is shown.</b> A station is considered only if it is ≥70% of bank-full or rising. “Rising/falling” compares the level now with 24 h and 6 h ago (hourly ThaiWater history; for the tidal Bangkok gauges the 24-h high-water mark – 90th percentile of readings – is compared with the previous 24 h, to remove the tide). Reference time = now if rising; start of the current plateau if levelled off; time of the 7-day peak if already falling. The headline is the latest-arriving signal. If nothing qualifies, the page says “No flood expected from upstream at current levels”.</p>'+
  '<p><b>Will Bangkok exceed bank-full?</b> Headroom = bank level − 24-h high-water mark (90th percentile of readings, robust to single spikes); days-to-bank-full = headroom ÷ the change of that high-water mark vs the previous 24 h, shown only as an <i>upper-bound extrapolation</i> (rises normally slow once the dam release stops increasing). Dam releases are managed by RID, so downstream flow can change at short notice; heavy rain, storm surge and high tide are not modelled.</p>'+
  '<p><b>Colours.</b> Rivers/stations: ThaiWater class (5 = over bank) and % of bank-full; green &lt;70%, yellow 70–90%, orange 90–100%, red &gt;100%, dark red = at/above ThaiWater’s critical level where the station has one. Dams use the same bands on % of normal storage. River segments take the worst colour of the gauges at each end; dashed grey = no gauge. RID reference rates for the Chao Phraya Dam (2,200 m³/s: low-lying land/levees begin to flood; 2,730 m³/s: critical) are from the same Thairath article (2024) and may have been revised.</p>'+
  '<p><b>Limits.</b> Dam data are daily reports (latest available date shown). Station readings can be late or wrong; readings &gt;3 h old are flagged ⏱ and &gt;36 h treated as unavailable. Pathum Thani and the Samut Prakan river mouth have no gauge in the feed; no tide feed is available.</p>';
}

/* detail popup */
function showDetail(key){
  var el=$('detail'),h='';
  var parts=key.split(':'),kind=parts[0],id=parts.slice(1).join(':');
  if(kind==='st'){
    var s=S.st[id],c=s.cfg;
    h='<button class="x" aria-label="Close">×</button><h3>'+esc(c.n)+' · '+id+'</h3><div class="muted small">'+esc(c.r)+(s.rec&&s.rec.geocode&&s.rec.geocode.province_name?' · '+esc(s.rec.geocode.province_name.th):'')+'</div><div style="margin:8px 0">'+chip(s.cls)+(s.tw?' <span class="small muted">ThaiWater: '+esc(TWCLASS[s.tw])+'</span>':'')+'</div>';
    if(s.cls==='na')h+='<div>Unavailable'+(s.why?' – '+esc(s.why):'')+'.</div>';
    else{
      var m=s.m,hd=(s.bank!=null&&s.msl!=null)?s.bank-s.msl:null;
      h+=kv('Water level',f(s.msl,2)+' m (msl)')+kv('Bank level',f(s.bank,2)+' m')+kv('% of bank-full',f(s.pct,1)+'%')+kv('Below bank',hd!=null?sg(hd,2)+' m':'–')+(s.crit!=null?kv('ThaiWater critical level',f(s.crit,2)+' m'):'')+kv('Discharge',s.q!=null?f(s.q)+' m³/s':'not reported')+(s.qmax?kv('Channel capacity (qmax)',f(s.qmax)+' m³/s'):'');
      if(m){h+=kv('Trend',arrow(m.trend)+' '+trendTxt(m.trend))+kv('Level change 24 h',m.d24!=null?sg(m.d24,2)+' m':'–')+kv('Level change 6 h',m.d6!=null?sg(m.d6,2)+' m':'–')+(m.q24!=null?kv('Discharge change 24 h',sg(m.q24,0)+' m³/s'):'')+(m.peak?kv('7-day peak',(m.peak.key==='q'?f(m.peak.val)+' m³/s':f(m.peak.val,2)+' m')+' · '+dt(m.peak.t)):'');}
      else h+=kv('Trend','unavailable (no history)');
      h+=kv('Reading time',dt(s.t)+' BKK ('+ago(s.t)+')');
      var hb=hoursToBkk(id);if(hb&&['CPY014','C.12','CPY015'].indexOf(id)<0)h+=kv('Typical travel to Bangkok','~'+f(hb.h,0)+' h'+(hb.kind==='indicative'?' (indicative)':' (RID legs)'));
      if(s.tidal)h+='<div class="small muted" style="margin-top:6px">Tide-affected gauge: short-term level swings are tidal.</div>';
    }
  } else {
    var d=S.damRec[id],c2=d.cfg;
    h='<button class="x" aria-label="Close">×</button><h3>'+esc(c2.n)+' dam'+(c2.th?' · '+esc(c2.th):'')+'</h3><div class="muted small">'+esc(c2.r)+'</div><div style="margin:8px 0">'+chip(d.cls,DLBL[d.cls])+'</div>';
    if(d.cls==='na')h+='<div>Unavailable.</div>';
    else h+=kv('Storage',f(d.stor,0)+' mcm')+kv('% of normal capacity',f(d.pct,1)+'%')+kv('% of max capacity',f(d.pmax,1)+'%')+kv('Inflow',f(d.inQ)+' m³/s')+kv('Outflow',f(d.outQ)+' m³/s')+kv('Δ storage vs yesterday',d.dStor!=null?sg(d.dStor,1)+' mcm ('+sg(d.dPct,2)+' pt)':'n/a')+kv('Δ inflow / outflow',d.dIn!=null?sg(d.dIn,0)+' / '+sg(d.dOut,0)+' m³/s':'n/a')+kv('Report date',esc(d.date));
  }
  el.innerHTML=h;el.classList.remove('hidden');
  el.querySelector('.x').addEventListener('click',function(){el.classList.add('hidden');});
}
function kv(k,v){return '<div class="kv"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>';}

/* ---- main ---- */
var busy=false,timer=null,nextAt=0;
function renderAll(){
  buildModel();
  var O=S.wl?outlook():{lines:['Station feed unavailable – no assessment possible.'],verdict:'Unavailable – station feed failed.',vcls:'na'};
  renderOverall(O);renderCrest(O);renderOutlook(O);renderTop();renderMap();renderLegend();renderDamTable();renderStTable();renderCrestTable(O);
  var parts=[];
  if(S.wl)parts.push('stations '+dt(Math.max.apply(null,Object.keys(S.st).map(function(c){return S.st[c].t||0;}))||null)+' BKK (latest reading)');
  if(S.dams)parts.push('dams: daily report '+S.damDate);
  $('updated').innerHTML='Fetched <b>'+dt(S.fetchedAt)+'</b> (Bangkok time) · '+(parts.join(' · ')||'no feed available')+' · <span id="cd"></span>';
}
function refresh(){
  if(busy)return;busy=true;$('refreshBtn').disabled=true;
  Promise.all([loadWL(),loadDams()]).then(function(){S.fetchedAt=Date.now();renderAll();return loadHist();}).then(function(){S.fetchedAt=Date.now();renderAll();}).catch(function(e){console.error(e);}).then(function(){busy=false;$('refreshBtn').disabled=false;nextAt=Date.now()+REFRESH_MS;window.__riverReady=true;});
}
function tick(){var cd=$('cd');if(cd&&nextAt){var s=Math.max(0,Math.round((nextAt-Date.now())/1000));cd.textContent='next refresh in '+Math.floor(s/60)+':'+('0'+s%60).slice(-2);}}
renderMethod();renderFeeds();renderLegend();
$('refreshBtn').addEventListener('click',refresh);
document.addEventListener('keydown',function(e){if(e.key==='Escape')$('detail').classList.add('hidden');});
refresh();
setInterval(refresh,REFRESH_MS);setInterval(tick,1000);
})();
