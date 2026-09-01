#!/usr/bin/env node
/**
 * Perps Alchemy — R11 Backtest
 * Merges Reaper v1.0's proven patterns (Bull Flag + Double Top) with R10's regime gate fix
 */
const https = require('https');
const HL_API = 'https://api.hyperliquid.xyz/info';
const COINS = ['BTC','ETH','SOL','HYPE','XRP','DOGE','AVAX','ARB'];
const DAYS = 365;
const MAX_HOLD = 15;

function fetchCandles(coin) {
  return new Promise((resolve) => {
    const end=Date.now(),start=end-DAYS*86400000;
    const data=JSON.stringify({type:'candleSnapshot',req:{coin,interval:'1d',startTime:start,endTime:end}});
    const req=https.request(HL_API,{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}},res=>{
      let b='';res.on('data',c=>b+=c);res.on('end',()=>{try{resolve(JSON.parse(b))}catch{resolve([])}});
    });req.on('error',()=>resolve([]));req.write(data);req.end();
  });
}
function calcRSI(c,p,i){if(i<p)return 50;let g=0,l=0;for(let j=i-p;j<i;j++){const ch=parseFloat(c[j+1].c)-parseFloat(c[j].c);if(ch>=0)g+=ch;else l+=Math.abs(ch)}const ag=g/p,al=l/p;return al===0?100:100-(100/(1+ag/al))}
function calcVR(c,i,lb=10){if(i<lb)return 1;const r=parseFloat(c[i].h)-parseFloat(c[i].l);let s=0;for(let j=i-lb;j<i;j++)s+=parseFloat(c[j].h)-parseFloat(c[j].l);const a=s/lb;return a>0?r/a:1}
function calcMA(c,i,p=20){if(i<p)return parseFloat(c[i].c);let s=0;for(let j=i-p;j<i;j++)s+=parseFloat(c[j].c);return s/p}

// Bull Flag (LONG) — 81.8% WR in Reaper v1.0
function detectBullFlag(c,i,rsi,vr,ma20){
  if(i<4)return null;
  const c0=parseFloat(c[i].c),o0=parseFloat(c[i].o);
  const c1=parseFloat(c[i-1].c),o1=parseFloat(c[i-1].o);
  const c2=parseFloat(c[i-2].c),o2=parseFloat(c[i-2].o);
  const c3=parseFloat(c[i-3].c),o3=parseFloat(c[i-3].o);
  const h3=parseFloat(c[i-3].h),l1=parseFloat(c[i-1].l),l0=parseFloat(c[i].l),h0=parseFloat(c[i].h);
  
  // Strong green candle (>5%) then 2 red pullback then green resume
  const strong=(c3-o3)/o3>0.05;
  const pullback=(c1<o1 && c2<o2 && c0>o0);
  if(!(strong && pullback && rsi>25 && rsi<50))return null;
  
  // Confluence
  let conf=1;
  if(vr>1.0)conf++;          // Volume confirmation
  if(Math.abs(c0-ma20)/ma20*100>1.5)conf++;  // MA deviation
  if(rsi<35)conf++;           // Deep RSI = stronger reversal
  if(conf<2)return null;
  
  // Dynamic stop: 2% below entry candle's low
  const entry=c0;
  const stop=Math.min(l1,l0)*0.98;
  const risk=entry-stop;
  if(risk<=0)return null;
  const target=entry+risk*2;  // 2:1 RR
  
  return{side:'long',setup:'Bull Flag',entry,stop,target,rsi:Math.round(rsi*10)/10,vol_ratio:Math.round(vr*100)/100,confluence:conf};
}

// Double Top (SHORT) — 70.0% WR in Reaper v1.0
function detectDoubleTop(c,i,rsi,vr,ma20){
  if(i<4)return null;
  const c0=parseFloat(c[i].c),o0=parseFloat(c[i].o);
  const h0=parseFloat(c[i].h),h1=parseFloat(c[i-1].h),h2=parseFloat(c[i-2].h),h3=parseFloat(c[i-3].h);
  const l1=parseFloat(c[i-1].l);
  const isRed=c0<o0;
  
  // Two peaks within 1.5% with valley between
  const peak1=Math.max(h3,h2);
  const peak2=h0;
  const valley=l1;
  if(!(Math.abs(peak2-peak1)/peak1<0.015 && valley<peak1*0.985 && isRed))return null;
  
  // Tightened RSI: >65 (was 58)
  if(rsi<65)return null;
  
  // Price above MA20 by 2%+
  if(c0<ma20*1.02)return null;
  
  // Confluence
  let conf=1;
  if(rsi>70)conf++;         // Extreme RSI
  if(vr>1.0)conf++;         // Volume
  if(c0>ma20*1.04)conf++;   // Far from MA
  if(conf<2)return null;
  
  // Dynamic stop: 2% above entry candle's high
  const entry=c0;
  const stop=Math.max(h1,h0)*1.02;
  const risk=stop-entry;
  if(risk<=0)return null;
  const target=entry-risk*2;  // 2:1 RR
  
  return{side:'short',setup:'Double Top',entry,stop,target,rsi:Math.round(rsi*10)/10,vol_ratio:Math.round(vr*100)/100,confluence:conf};
}

function execTrade(c,i,s){
  const{entry,stop,target,side}=s;let ep=null,er=null;
  for(let j=i+1;j<Math.min(c.length,i+MAX_HOLD+1);j++){
    const fh=parseFloat(c[j].h),fl=parseFloat(c[j].l);
    if(side==='long'){if(fl<=stop){ep=stop;er='stop';break}if(fh>=target){ep=target;er='target';break}}
    else{if(fh>=stop){ep=stop;er='stop';break}if(fl<=target){ep=target;er='target';break}}
  }
  if(!ep){ep=parseFloat(c[Math.min(c.length-1,i+MAX_HOLD)].c);er='timeout'}
  let pnl=side==='long'?(ep-entry)/entry*100:(entry-ep)/entry*100;
  pnl-=0.07; // taker fee
  return{pnl,er};
}

async function run(){
  console.log('PERPS ALCHEMY — R11 BACKTEST (Reaper v1.0 patterns + regime fix)');
  console.log('Config: dynamic 2% stop, 2x target, 15d max hold, confluence>=2\n');
  
  const sigs=[];let lc=0,sc=0,bf=0,dt=0,tp=0;
  for(const coin of COINS){
    const c=await fetchCandles(coin);if(!c||c.length<60){console.log(`  ${coin}: insufficient data`);continue}
    let cs=0,cl=0,cs2=0,cp=0;
    for(let i=20;i<c.length-1;i++){
      const rsi=calcRSI(c,14,i),vr=calcVR(c,i),ma20=calcMA(c,i,20);
      let s=null;
      s=detectBullFlag(c,i,rsi,vr,ma20);
      if(!s)s=detectDoubleTop(c,i,rsi,vr,ma20);
      if(!s)continue;
      const{pnl,er}=execTrade(c,i,s);tp+=pnl;cp+=pnl;cs++;
      if(s.side==='long'){lc++;cl++}else{sc++;cs2++}
      if(s.setup==='Bull Flag')bf++;
      if(s.setup==='Double Top')dt++;
      sigs.push({coin,date:new Date(c[i].t).toISOString().split('T')[0],...s,pnl:Math.round(pnl*10)/10,win:pnl>0,er});
    }
    if(cs>0)console.log(`  ${coin.padEnd(5)}: ${cs} sig | L:${cl} S:${cs2} | BF:${bf} DT:${dt} | PnL: ${cp>0?'+':''}${cp.toFixed(1)}%`);
  }
  
  const tot=lc+sc,wins=sigs.filter(s=>s.win).length;
  console.log('\n═══════════════════════════════════════');
  console.log('VERIFICATION RESULTS');
  console.log('═══════════════════════════════════════');
  console.log(`Total Signals: ${tot}`);
  console.log(`Longs: ${lc} (${tot>0?(lc/tot*100).toFixed(1):0}%)  |  Shorts: ${sc} (${tot>0?(sc/tot*100).toFixed(1):0}%)`);
  console.log(`Bull Flag: ${bf} | Double Top: ${dt}`);
  console.log(`Hit Rate: ${wins}/${tot} = ${tot>0?(wins/tot*100).toFixed(1):0}%`);
  console.log(`Total PnL: ${tp>0?'+':''}${tp.toFixed(1)}%`);
  console.log('═══════════════════════════════════════');
  
  // Per pattern
  const bfSigs=sigs.filter(s=>s.setup==='Bull Flag');
  const dtSigs=sigs.filter(s=>s.setup==='Double Top');
  const bfWR=bfSigs.length>0?bfSigs.filter(s=>s.win).length/bfSigs.length*100:0;
  const dtWR=dtSigs.length>0?dtSigs.filter(s=>s.win).length/dtSigs.length*100:0;
  console.log(`Bull Flag:  ${bfSigs.length} sig | WR: ${bfWR.toFixed(0)}% | PnL: ${(bfSigs.reduce((a,s)=>a+s.pnl,0)).toFixed(1)}%`);
  console.log(`Double Top: ${dtSigs.length} sig | WR: ${dtWR.toFixed(0)}% | PnL: ${(dtSigs.reduce((a,s)=>a+s.pnl,0)).toFixed(1)}%`);
  
  console.log('\nALL SIGNALS:');
  for(const s of sigs.sort((a,b)=>b.date.localeCompare(a.date))){
    const side=s.side==='long'?'LONG ':'SHORT';
    const res=s.win?'WIN ':'LOSS';
    console.log(`  [${side}] ${s.date} ${s.coin.padEnd(5)} ${s.setup.padEnd(12)} RSI:${s.rsi} ${s.pnl>0?'+':''}${s.pnl}% ${res} (${s.er})`);
  }
}
run();
