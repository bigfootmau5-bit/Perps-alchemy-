#!/usr/bin/env node
const https = require('https');
const HL_API = 'https://api.hyperliquid.xyz/info';
const DAYS = 365, MAX_HOLD = 15;
const T1 = ['BTC','ETH','SOL','HYPE','XRP','DOGE','AVAX','ARB'];
const T2 = ['ZEC','PUMP','LINK','SUI','APT','INJ','TIA','SEI','JUP','WIF'];
const ALL = [...T1, ...T2];
const cache = {};

function fetchCandles(coin) {
  return new Promise((resolve) => {
    const end=Date.now(),start=end-DAYS*86400000;
    const data=JSON.stringify({type:'candleSnapshot',req:{coin,interval:'1d',startTime:start,endTime:end}});
    const req=https.request(HL_API,{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}},res=>{
      let b='';res.on('data',c=>b+=c);res.on('end',()=>{try{resolve(JSON.parse(b))}catch{resolve([])}});
    });req.on('error',()=>resolve([]));req.write(data);req.end();
  });
}
async function getCandles(coin){
  if(cache[coin]) return cache[coin];
  cache[coin] = await fetchCandles(coin);
  return cache[coin];
}
function calcRSI(c,p,i){if(i<p)return 50;let g=0,l=0;for(let j=i-p;j<i;j++){const ch=parseFloat(c[j+1].c)-parseFloat(c[j].c);if(ch>=0)g+=ch;else l+=Math.abs(ch)}const ag=g/p,al=l/p;return al===0?100:100-(100/(1+ag/al))}
function calcVR(c,i,lb=10){if(i<lb)return 1;const r=parseFloat(c[i].h)-parseFloat(c[i].l);let s=0;for(let j=i-lb;j<i;j++)s+=parseFloat(c[j].h)-parseFloat(c[j].l);const a=s/lb;return a>0?r/a:1}
function calcMA(c,i,p=20){if(i<p)return parseFloat(c[i].c);let s=0;for(let j=i-p;j<i;j++)s+=parseFloat(c[j].c);return s/p}

function detectBF(c,i,rsi,vr,ma20,o){
  if(i<4)return null;
  const c0=parseFloat(c[i].c),o0=parseFloat(c[i].o),c1=parseFloat(c[i-1].c),o1=parseFloat(c[i-1].o);
  const c2=parseFloat(c[i-2].c),o2=parseFloat(c[i-2].o),c3=parseFloat(c[i-3].c),o3=parseFloat(c[i-3].o);
  const l1=parseFloat(c[i-1].l),l0=parseFloat(c[i].l);
  if(!((c3-o3)/o3>o.bfStr && c1<o1 && c2<o2 && c0>o0 && rsi>o.bfLo && rsi<o.bfHi))return null;
  let conf=1;if(vr>o.vol)conf++;if(Math.abs(c0-ma20)/ma20*100>1.5)conf++;if(rsi<35)conf++;
  if(conf<o.bfConf)return null;
  const entry=c0,stop=Math.min(l1,l0)*(1-o.stop/100),risk=entry-stop;
  if(risk<=0)return null;
  return{side:'long',setup:'Bull Flag',entry,stop,target:entry+risk*o.rr,rsi:Math.round(rsi*10)/10,confluence:conf};
}
function detectDT(c,i,rsi,vr,ma20,o){
  if(i<4)return null;
  const c0=parseFloat(c[i].c),o0=parseFloat(c[i].o);
  const h0=parseFloat(c[i].h),h1=parseFloat(c[i-1].h),h2=parseFloat(c[i-2].h),h3=parseFloat(c[i-3].h);
  const l1=parseFloat(c[i-1].l);
  if(!(c0<o0 && Math.abs(h0-Math.max(h3,h2))/Math.max(h3,h2)<o.pkTol && l1<Math.max(h3,h2)*(1-o.valPct/100)))return null;
  if(rsi<o.dtLo||rsi>o.dtHi)return null;
  if(c0<ma20*(1+o.maOff/100))return null;
  let conf=1;if(rsi>=70&&rsi<=80)conf++;if(vr>o.vol)conf++;if(c0>ma20*(1+(o.maOff+2)/100))conf++;
  if(conf<o.dtConf)return null;
  const entry=c0,stop=Math.max(h1,h0)*(1+o.stop/100),risk=stop-entry;
  if(risk<=0)return null;
  return{side:'short',setup:'Double Top',entry,stop,target:entry-risk*o.rr,rsi:Math.round(rsi*10)/10,confluence:conf};
}
function execTrade(c,i,s,o){
  const{entry,stop,target,side}=s;let ep=null,er=null;
  for(let j=i+1;j<Math.min(c.length,i+MAX_HOLD+1);j++){
    const fh=parseFloat(c[j].h),fl=parseFloat(c[j].l);
    if(side==='long'){if(fl<=stop){ep=stop;er='stop';break}if(fh>=target){ep=target;er='target';break}}
    else{if(fh>=stop){ep=stop;er='stop';break}if(fl<=target){ep=target;er='target';break}}
  }
  if(!ep){ep=parseFloat(c[Math.min(c.length-1,i+MAX_HOLD)].c);er='timeout'}
  let pnl=side==='long'?(ep-entry)/entry*100:(entry-ep)/entry*100;
  pnl-=0.07;
  return{pnl,er};
}

const C = {
  V2: {stop:2,rr:2,bfConf:2,dtConf:2,bfLo:25,bfHi:50,dtLo:65,dtHi:82,pkTol:0.015,valPct:1.5,maOff:2,vol:1.2,bfStr:0.05,reg:5,bearFilt:true},
  V3g3: {stop:2,rr:2,bfConf:2,dtConf:2,bfLo:20,bfHi:55,dtLo:65,dtHi:82,pkTol:0.015,valPct:1.5,maOff:2,vol:1.0,bfStr:0.04,reg:3,bearFilt:false},
  T2t: {stop:1.5,rr:2.5,bfConf:3,dtConf:3,bfLo:28,bfHi:48,dtLo:68,dtHi:80,pkTol:0.01,valPct:2,maOff:3,vol:1.5,bfStr:0.06,reg:2,bearFilt:true},
  s1: {stop:1,rr:2,bfConf:2,dtConf:2,bfLo:25,bfHi:50,dtLo:65,dtHi:82,pkTol:0.015,valPct:1.5,maOff:2,vol:1.2,bfStr:0.05,reg:5,bearFilt:true},
  s3: {stop:3,rr:2,bfConf:2,dtConf:2,bfLo:25,bfHi:50,dtLo:65,dtHi:82,pkTol:0.015,valPct:1.5,maOff:2,vol:1.2,bfStr:0.05,reg:5,bearFilt:true},
  r15: {stop:2,rr:1.5,bfConf:2,dtConf:2,bfLo:25,bfHi:50,dtLo:65,dtHi:82,pkTol:0.015,valPct:1.5,maOff:2,vol:1.2,bfStr:0.05,reg:5,bearFilt:true},
  r3: {stop:2,rr:3,bfConf:2,dtConf:2,bfLo:25,bfHi:50,dtLo:65,dtHi:82,pkTol:0.015,valPct:1.5,maOff:2,vol:1.2,bfStr:0.05,reg:5,bearFilt:true},
  dtOnly: {stop:2,rr:2,bfConf:99,dtConf:2,bfLo:25,bfHi:50,dtLo:65,dtHi:82,pkTol:0.015,valPct:1.5,maOff:2,vol:1.2,bfStr:0.05,reg:5,bearFilt:true},
  looseBF: {stop:2,rr:2,bfConf:1,dtConf:2,bfLo:20,bfHi:55,dtLo:65,dtHi:82,pkTol:0.015,valPct:1.5,maOff:2,vol:0.8,bfStr:0.03,reg:5,bearFilt:false},
  dtStrict: {stop:2,rr:2,bfConf:2,dtConf:3,bfLo:25,bfHi:50,dtLo:68,dtHi:80,pkTol:0.012,valPct:2,maOff:3,vol:1.2,bfStr:0.05,reg:5,bearFilt:true}
};

async function run(cfg,coins,label){
  const sigs=[];let lc=0,sc=0,bf=0,dt=0,tp=0,rk=0;
  const pc={};
  for(const coin of coins){
    const c=await getCandles(coin);if(!c||c.length<60)continue;
    let cs=0,cl=0,cs2=0,cp=0;
    for(let i=20;i<c.length-1;i++){
      const rsi=calcRSI(c,14,i),vr=calcVR(c,i),ma20=calcMA(c,i,20);
      let s=detectBF(c,i,rsi,vr,ma20,cfg);if(!s)s=detectDT(c,i,rsi,vr,ma20,cfg);if(!s)continue;
      if(s.side==='short'){const ma50=calcMA(c,i,50);if((ma20-ma50)/ma50*100>cfg.reg){rk++;continue}}
      if(s.side==='long'&&cfg.bearFilt){const ma50=calcMA(c,i,50);if((ma50-ma20)/ma20*100>5){rk++;continue}}
      const{pnl,er}=execTrade(c,i,s,cfg);tp+=pnl;cp+=pnl;cs++;
      if(s.side==='long'){lc++;cl++}else{sc++;cs2++}
      if(s.setup==='Bull Flag')bf++;else dt++;
      sigs.push({coin,setup:s.setup,side:s.side,pnl:Math.round(pnl*10)/10,win:pnl>0,er,rsi:s.rsi,date:new Date(c[i].t).toISOString().split('T')[0]});
    }
    if(cs>0)pc[coin]={sigs:cs,wins:sigs.filter(x=>x.coin===coin&&x.win).length,pnl:cp,longs:cl,shorts:cs2};
  }
  const tot=lc+sc,wins=sigs.filter(s=>s.win).length;
  const bfS=sigs.filter(s=>s.setup==='Bull Flag'),dtS=sigs.filter(s=>s.setup==='Double Top');
  const lS=sigs.filter(s=>s.side==='long'),sS=sigs.filter(s=>s.side==='short');
  return{label,totalSigs:tot,wins,wr:tot>0?(wins/tot*100):0,pnl:parseFloat(tp.toFixed(1)),
    longs:lc,shorts:sc,bf,dt,rk,
    bfWR:bfS.length>0?(bfS.filter(s=>s.win).length/bfS.length*100):0,
    dtWR:dtS.length>0?(dtS.filter(s=>s.win).length/dtS.length*100):0,
    longWR:lS.length>0?(lS.filter(s=>s.win).length/lS.length*100):0,
    shortWR:sS.length>0?(sS.filter(s=>s.win).length/sS.length*100):0,
    longPnL:lS.reduce((a,s)=>a+s.pnl,0),shortPnL:sS.reduce((a,s)=>a+s.pnl,0),
    perCoin:pc,sigs};
}

async function main(){
  console.log('======================================================');
  console.log('PERPS ALCHEMY — R11-V3 PARAMETER SWEEP (CACHED)');
  console.log('======================================================\n');
  
  // Pre-fetch ALL candles
  console.log('Fetching candles for all 18 coins...');
  for(const coin of ALL){
    const c=await getCandles(coin);
    console.log('  '+coin.padEnd(6)+': '+(c?c.length:0)+' candles');
  }
  console.log('');
  
  const tests = [
    ['V2 Baseline',C.V2,T1,'T1-8'],
    ['V3g3 Reaper',C.V3g3,T1,'T1-8'],
    ['V2 on 18 coins',C.V2,ALL,'All-18'],
    ['T2-Tight on T2',C.T2t,T2,'T2-10'],
    ['Stop 1%',C.s1,T1,'T1-8'],
    ['Stop 3%',C.s3,T1,'T1-8'],
    ['RR 1.5x',C.r15,T1,'T1-8'],
    ['RR 3x',C.r3,T1,'T1-8'],
    ['Pure DT (no BF)',C.dtOnly,T1,'T1-8'],
    ['Loose BF (revive longs)',C.looseBF,T1,'T1-8'],
    ['DT Strict (conf3,RSI68-80)',C.dtStrict,T1,'T1-8'],
  ];
  
  const results=[];
  for(const [name,cfg,coins,label] of tests){
    process.stdout.write('Running: '+name+'... ');
    const r=await run(cfg,coins,label);
    r.name=name;
    results.push(r);
    console.log('WR:'+r.wr.toFixed(1)+'% PnL:'+(r.pnl>0?'+':'')+r.pnl.toFixed(1)+'% Sigs:'+r.totalSigs+' L:'+r.longs+' S:'+r.shorts);
  }
  
  // TIERED
  process.stdout.write('Running: Tiered V2+Tight... ');
  const r1=await run(C.V2,T1,'T1');
  const r2=await run(C.T2t,T2,'T2');
  const tS=r1.totalSigs+r2.totalSigs,tW=r1.wins+r2.wins,tP=r1.pnl+r2.pnl;
  results.push({name:'Tiered V2+Tight',label:'Tiered',totalSigs:tS,wins:tW,wr:tS>0?(tW/tS*100):0,pnl:tP,longs:r1.longs+r2.longs,shorts:r1.shorts+r2.shorts,bf:r1.bf+r2.bf,dt:r1.dt+r2.dt});
  console.log('WR:'+(tS>0?(tW/tS*100).toFixed(1):0)+'% PnL:+'+tP.toFixed(1)+'% Sigs:'+tS);
  
  // SUMMARY TABLE
  console.log('\n\n======================================================');
  console.log('SUMMARY — RANKED BY WIN RATE');
  console.log('======================================================');
  console.log('Config'.padEnd(28)+'  WR    PnL     Sigs  L%   S%   BF-WR DT-WR');
  console.log('-'.repeat(80));
  for(const r of results.sort((a,b)=>b.wr-a.wr)){
    const star=r.wr>=70?'***':r.wr>=60?'**  ':'*   ';
    console.log(star+r.name.padEnd(25)+
      r.wr.toFixed(1).padStart(5)+'% '+
      (r.pnl>0?'+':'')+r.pnl.toFixed(1).padStart(6)+'% '+
      r.totalSigs.toString().padStart(5)+' '+
      (r.longs>0?(r.longWR||0).toFixed(0):'-').padStart(4)+'% '+
      (r.shorts>0?(r.shortWR||0).toFixed(0):'-').padStart(4)+'% '+
      (r.bf>0?(r.bfWR||0).toFixed(0):'-').padStart(5)+'% '+
      (r.dt>0?(r.dtWR||0).toFixed(0):'-').padStart(5)+'%'
    );
  }
  
  // PER-COIN for V2 baseline
  console.log('\n======================================================');
  console.log('PER-COIN BREAKDOWN — V2 Baseline (T1):');
  const v2=results.find(r=>r.name==='V2 Baseline');
  if(v2&&v2.perCoin){
    for(const[coin,d] of Object.entries(v2.perCoin)){
      const wr=d.sigs>0?(d.wins/d.sigs*100).toFixed(0):0;
      const flag=wr<40?'RED':wr<60?'YEL':'GRN';
      console.log('  ['+flag+'] '+coin.padEnd(5)+': '+d.sigs+' sigs | WR:'+wr+'% | PnL:'+(d.pnl>0?'+':'')+d.pnl.toFixed(1)+'% | L:'+d.longs+' S:'+d.shorts);
    }
  }
  
  // PER-COIN for T2-Tight
  console.log('\nPER-COIN BREAKDOWN — T2-Tight (small caps):');
  const t2r=results.find(r=>r.name==='T2-Tight on T2');
  if(t2r&&t2r.perCoin){
    for(const[coin,d] of Object.entries(t2r.perCoin)){
      const wr=d.sigs>0?(d.wins/d.sigs*100).toFixed(0):0;
      const flag=wr<40?'RED':wr<60?'YEL':'GRN';
      console.log('  ['+flag+'] '+coin.padEnd(5)+': '+d.sigs+' sigs | WR:'+wr+'% | PnL:'+(d.pnl>0?'+':'')+d.pnl.toFixed(1)+'% | L:'+d.longs+' S:'+d.shorts);
    }
  } else {
    console.log('  (no signals generated — params too restrictive)');
  }
  
  // PER-COIN for V2 on ALL 18
  console.log('\nPER-COIN BREAKDOWN — V2 on ALL 18 coins:');
  const v18=results.find(r=>r.name==='V2 on 18 coins');
  if(v18&&v18.perCoin){
    for(const[coin,d] of Object.entries(v18.perCoin)){
      const wr=d.sigs>0?(d.wins/d.sigs*100).toFixed(0):0;
      const flag=wr<40?'RED':wr<60?'YEL':'GRN';
      console.log('  ['+flag+'] '+coin.padEnd(5)+': '+d.sigs+' sigs | WR:'+wr+'% | PnL:'+(d.pnl>0?'+':'')+d.pnl.toFixed(1)+'% | L:'+d.longs+' S:'+d.shorts);
    }
  }
  
  // ALL SIGNALS for best config
  const best=results.sort((a,b)=>b.wr-a.wr)[0];
  console.log('\n======================================================');
  console.log('BEST CONFIG: '+best.name);
  console.log('WR:'+best.wr.toFixed(1)+'% | PnL:'+(best.pnl>0?'+':'')+best.pnl.toFixed(1)+'% | Sigs:'+best.totalSignals);
  console.log('Longs:'+best.longs+' ('+(best.longWR||0).toFixed(0)+'% WR) | Shorts:'+best.shorts+' ('+(best.shortWR||0).toFixed(0)+'% WR)');
  console.log('BF:'+best.bf+' ('+(best.bfWR||0).toFixed(0)+'% WR) | DT:'+best.dt+' ('+(best.dtWR||0).toFixed(0)+'% WR)');
  console.log('======================================================');
  
  if(best.sigs){
    console.log('\nAll signals for best config:');
    for(const s of best.sigs.sort((a,b)=>b.date.localeCompare(a.date))){
      const side=s.side==='long'?'LONG ':'SHORT';
      const res=s.win?'WIN ':'LOSS';
      console.log('  ['+side+'] '+s.date+' '+s.coin.padEnd(5)+' '+s.setup.padEnd(12)+' RSI:'+s.rsi+' '+(s.pnl>0?'+':'')+s.pnl+'% '+res+' ('+s.er+')');
    }
  }
}

main().catch(e=>console.error(e));
