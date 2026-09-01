#!/usr/bin/env node
/**
 * PERPS ALCHEMY — R11-V3 HARDCORE (Pure Double Top)
 * 
 * Hardcoded config from parameter sweep results (Sept 1, 2026):
 * - Double Top ONLY (Bull Flag disabled — 88.2% WR without it)
 * - Stop: 3% beyond structure (wider stops survive volatility)
 * - R:R: 2x
 * - RSI: 65-82
 * - Regime: suppress shorts when SMA20 > SMA50 by >5%
 * - T1 coins: BTC, ETH, SOL, HYPE, XRP, PUMP, ZEC, ARB
 */
const https = require('https');
const HL_API = 'https://api.hyperliquid.xyz/info';
const COINS = ['BTC','ETH','SOL','HYPE','XRP','PUMP','ZEC','ARB'];
const DAYS = 365;
const MAX_HOLD = 15;

// === HARDCODED CONFIG ===
const CONFIG = {
  pattern: 'Double Top only',
  bullFlag: false,           // disabled — drags WR from 88% to 73%
  stopPct: 0.03,             // 3% stop beyond structure (beats 2%)
  rrRatio: 2,                // 2x risk-reward target
  dtRsiLow: 65,
  dtRsiHigh: 82,
  peakTolerance: 0.015,      // 1.5% peak match tolerance
  valleyPct: 0.985,          // valley must be < 98.5% of peak
  volThreshold: 1.2,         // volume ratio threshold
  maOffset: 2,               // price must be > MA20 * 1.02
  regimeThreshold: 5,        // suppress shorts when SMA20 > SMA50 by >5%
  bearFilter: true,
  fee: 0.07,                 // 0.07% per trade
};

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

function detectDoubleTop(c,i,rsi,vr,ma20){
  if(i<4)return null;
  const c0=parseFloat(c[i].c),o0=parseFloat(c[i].o);
  const h0=parseFloat(c[i].h),h1=parseFloat(c[i-1].h),h2=parseFloat(c[i-2].h),h3=parseFloat(c[i-3].h);
  const l1=parseFloat(c[i-1].l);
  const isRed=c0<o0;
  const peak1=Math.max(h3,h2);
  const peak2=h0;
  const valley=l1;
  
  // Peak tolerance: peaks within 1.5% of each other
  if(!(Math.abs(peak2-peak1)/peak1 < CONFIG.peakTolerance && valley < peak1 * CONFIG.valleyPct && isRed))return null;
  // RSI window: 65-82
  if(rsi < CONFIG.dtRsiLow || rsi > CONFIG.dtRsiHigh)return null;
  // Price must be above MA20 * 1.02
  if(c0 < ma20 * (1 + CONFIG.maOffset/100))return null;
  
  let conf=1;
  if(rsi>=70 && rsi<=80)conf++;
  if(vr > CONFIG.volThreshold)conf++;
  if(c0 > ma20 * 1.04)conf++;
  if(conf < 2)return null;
  
  const entry=c0;
  // Stop: 3% beyond structure (hardcoded)
  const stop=Math.max(h1,h0) * (1 + CONFIG.stopPct);
  const risk=stop-entry;
  if(risk<=0)return null;
  const target=entry - risk * CONFIG.rrRatio;
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
  pnl-=CONFIG.fee;
  return{pnl,er};
}

async function run(){
  console.log('═══════════════════════════════════════════════');
  console.log('  PERPS ALCHEMY — R11-V3 HARDCORE (Pure DT)');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Pattern:  ${CONFIG.pattern}`);
  console.log(`  Stop:     ${CONFIG.stopPct*100}% beyond structure`);
  console.log(`  R:R:      ${CONFIG.rrRatio}x`);
  console.log(`  RSI:      ${CONFIG.dtRsiLow}-${CONFIG.dtRsiHigh}`);
  console.log(`  Regime:   suppress shorts > ${CONFIG.regimeThreshold}% SMA gap`);
  console.log(`  Coins:    ${COINS.join(', ')}`);
  console.log(`  Fee:      ${CONFIG.fee}%/trade`);
  console.log('═══════════════════════════════════════════════\n');
  
  const sigs=[];let sc=0,tp=0,regKilled=0;
  const perCoin={};
  
  for(const coin of COINS){
    const c=await fetchCandles(coin);
    if(!c||c.length<60){console.log(`  ${coin}: insufficient data`);continue}
    let cs=0,cp=0;
    for(let i=20;i<c.length-1;i++){
      const rsi=calcRSI(c,14,i),vr=calcVR(c,i),ma20=calcMA(c,i,20);
      
      // Pure Double Top — no Bull Flag
      let s=detectDoubleTop(c,i,rsi,vr,ma20);
      if(!s)continue;
      
      // Regime filter: suppress shorts in strong bull markets
      if(s.side==='short'){
        const ma50=calcMA(c,i,50);
        const bullPct=(ma20-ma50)/ma50*100;
        if(bullPct > CONFIG.regimeThreshold){
          regKilled++;
          continue;
        }
      }
      
      const{pnl,er}=execTrade(c,i,s);
      tp+=pnl;cp+=pnl;cs++;sc++;
      sigs.push({coin,date:new Date(c[i].t).toISOString().split('T')[0],...s,pnl:Math.round(pnl*10)/10,win:pnl>0,er});
    }
    perCoin[coin]={signals:cs,pnl:cp};
    if(cs>0)console.log(`  ${coin.padEnd(5)}: ${cs} sig | PnL: ${cp>0?'+':''}${cp.toFixed(1)}%`);
  }
  
  const wins=sigs.filter(s=>s.win).length;
  console.log('\n═══════════════════════════════════════');
  console.log(`  Total Signals: ${sigs.length} (regime filtered: ${regKilled})`);
  console.log(`  Shorts: ${sc} (100%)`);
  console.log(`  Hit Rate: ${wins}/${sigs.length} = ${sigs.length>0?(wins/sigs.length*100).toFixed(1):0}%`);
  console.log(`  Total PnL: ${tp>0?'+':''}${tp.toFixed(1)}%`);
  console.log('═══════════════════════════════════════');
  
  console.log('\nALL SIGNALS:');
  for(const s of sigs.sort((a,b)=>b.date.localeCompare(a.date))){
    const res=s.win?'WIN ':'LOSS';
    console.log(`  [SHORT] ${s.date} ${s.coin.padEnd(5)} DT RSI:${s.rsi} ${s.pnl>0?'+':''}${s.pnl}% ${res} (${s.er})`);
  }
}
run();
