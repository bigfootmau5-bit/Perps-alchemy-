#!/usr/bin/env node
/**
 * Perps Alchemy — Tuned Backtest v7
 * Disable weak signals, test multiple stop/target combos
 * to find the 72% win rate config Mau5 referenced.
 */
const https = require('https');
const HL_API = 'https://api.hyperliquid.xyz/info';
const COINS = ['BTC','ETH','SOL','HYPE','XRP','DOGE','AVAX','ARB'];
const DAYS = 365;
const TAKER_FEE = 0.07;
const MAX_HOLD = 12;

function fetchCandles(coin) {
  return new Promise((resolve) => {
    const end=Date.now(),start=end-DAYS*86400000;
    const data=JSON.stringify({type:'candleSnapshot',req:{coin,interval:'1d',startTime:start,endTime:end}});
    const req=https.request(HL_API,{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}},res=>{
      let b='';res.on('data',c=>b+=c);res.on('end',()=>{try{resolve(JSON.parse(b))}catch{resolve([])}});
    });req.on('error',()=>resolve([]));req.write(data);req.end();
  });
}

function calcRSI(c,p,i){
  if(i<p)return 50;
  let g=0,l=0;
  for(let j=i-p;j<i;j++){const ch=parseFloat(c[j+1].c)-parseFloat(c[j].c);if(ch>=0)g+=ch;else l+=Math.abs(ch)}
  const ag=g/p,al=l/p;return al===0?100:100-(100/(1+ag/al));
}
function calcEMA(c,i,p){
  if(i<p)return parseFloat(c[i].c);
  const k=2/(p+1);let e=parseFloat(c[p-1].c);
  for(let j=p;j<=i;j++)e=parseFloat(c[j].c)*k+e*(1-k);return e;
}
function calcMA(c,i,p=20){
  if(i<p)return parseFloat(c[i].c);
  let s=0;for(let j=i-p;j<i;j++)s+=parseFloat(c[j].c);return s/p;
}

// Tuned signal detection — only keep HIGH win-rate setups
function detectTunedSignals(candles, i, longCount, shortCount, stopPct) {
  var c = candles[i], prev = candles[i-1], prev2 = candles[i-2], prev3 = candles[i-3];
  var o = parseFloat(c.o), h = parseFloat(c.h), l = parseFloat(c.l), cl = parseFloat(c.c);
  var po = parseFloat(prev.o), pc = parseFloat(prev.c), ph = parseFloat(prev.h), pl2 = parseFloat(prev.l);
  var isGreen = cl > o, isRed = cl < o;

  var tot = longCount + shortCount;
  var longPct = tot > 10 ? longCount / tot : 0;
  var skipLong = longPct > 0.65;

  var signal = null;
  var setup = null;

  // Golden Cross (EMA50/EMA200 crossover) — keep but tighten RSI
  if (i >= 200) {
    var e50n = calcEMA(candles, i, 50), e200n = calcEMA(candles, i, 200);
    var e50p = calcEMA(candles, i-1, 50), e200p = calcEMA(candles, i-1, 200);
    if (e50p < e200p && e50n > e200n && !skipLong) {
      var rsiGC = calcRSI(candles, 14, i);
      if (rsiGC >= 40 && rsiGC <= 65) { signal = 'long'; setup = 'Golden Cross'; } // tighter RSI
    }
  }

  // Death Cross (EMA50/EMA200 crossunder) — keep, tighten RSI
  if (!signal && i >= 200) {
    var e50nD = calcEMA(candles, i, 50), e200nD = calcEMA(candles, i, 200);
    var e50pD = calcEMA(candles, i-1, 50), e200pD = calcEMA(candles, i-1, 200);
    if (e50pD > e200pD && e50nD < e200nD) {
      var rsiDC = calcRSI(candles, 14, i);
      if (rsiDC >= 35 && rsiDC <= 60) { signal = 'short'; setup = 'Death Cross'; } // tighter RSI
    }
  }

  // Double Bottom — 68.8% WR, BEST setup — keep
  if (!signal && i >= 15 && !skipLong) {
    var t1i = -1, t2i = -1, t1v = 999999, t2v = 999999;
    for (var j = i - 15; j < i - 2; j++) { var ll = parseFloat(candles[j].l); if (ll < t1v) { t1v = ll; t1i = j; } }
    for (var j2 = t1i + 2; j2 < i; j2++) { var ll2 = parseFloat(candles[j2].l); if (ll2 < t2v) { t2v = ll2; t2i = j2; } }
    if (t1i !== -1 && t2i !== -1) {
      var troughDiff = Math.abs(t1v - t2v) / Math.min(t1v, t2v) * 100;
      var bounce = parseFloat(candles[Math.floor((t1i + t2i) / 2)].h);
      var rsiDB = calcRSI(candles, 14, i);
      var ma20DB = calcMA(candles, i, 20);
      if (troughDiff <= 2.5 && bounce > Math.min(t1v, t2v) * 1.02 && rsiDB <= 40 && cl >= ma20DB * 0.98 && isGreen) {
        signal = 'long'; setup = 'Double Bottom';
      }
    }
  }

  // Stairway to Hell — 40.3% WR, +63.1% PnL — keep (Mau5's setup)
  if (!signal && i >= 5) {
    var lh1 = parseFloat(prev3.h), lh2 = parseFloat(prev2.h), lh3 = parseFloat(prev.h);
    if (lh1 > lh2 && lh2 > lh3 && h < lh3 && isRed) { signal = 'short'; setup = 'Stairway to Hell'; }
  }

  // Bear Flag — 45.5% WR, +7.0% PnL — keep
  if (!signal && i >= 4) {
    var strongDown = (parseFloat(prev3.o) - parseFloat(prev3.c)) / parseFloat(prev3.o) > 0.03;
    var pullbackUp = pc > po && parseFloat(prev2.c) > parseFloat(prev2.o) && isRed;
    if (strongDown && pullbackUp) {
      var e20bfD = calcEMA(candles, i, 20), e50bfD = calcEMA(candles, i, 50);
      if (e20bfD < e50bfD) { signal = 'short'; setup = 'Bear Flag'; }
    }
  }

  // Bull Flag — 33.3% WR — DISABLED (below breakeven with 3% stop)
  // Head & Shoulders — 29.2% WR — DISABLED
  // Inverse H&S — 37.5% WR — DISABLED (fires too much, marginal)
  // Balanced fallback — DISABLED (12-38% WR, too noisy)
  // Falling Wedge — 35.5% WR — DISABLED
  // Rising Wedge — 28.6% WR — DISABLED
  // Double Top — 37.5% WR — DISABLED (marginal)

  return signal ? { side: signal, setup: setup, entry: cl } : null;
}

function execTrade(candles, i, sig, stopPct, targetMult) {
  var entry = sig.entry;
  var stopDist = entry * stopPct;
  var stop = sig.side === 'long' ? entry - stopDist : entry + stopDist;
  var risk = Math.abs(entry - stop);
  var target = sig.side === 'long' ? entry + targetMult * risk : entry - targetMult * risk;
  var exit = null, exitReason = null;

  for (var j = i+1; j < Math.min(candles.length, i + MAX_HOLD + 1); j++) {
    var fh = parseFloat(candles[j].h), fl = parseFloat(candles[j].l);
    if (sig.side === 'long') {
      if (fl <= stop) { exit = stop; exitReason = 'stop'; break; }
      if (fh >= target) { exit = target; exitReason = 'target'; break; }
    } else {
      if (fh >= stop) { exit = stop; exitReason = 'stop'; break; }
      if (fl <= target) { exit = target; exitReason = 'target'; break; }
    }
  }
  if (!exit) { exit = parseFloat(candles[Math.min(candles.length-1, i + MAX_HOLD)].c); exitReason = 'timeout'; }

  var pnlPct = sig.side === 'long' ? (exit - entry) / entry * 100 : (entry - exit) / entry * 100;
  pnlPct -= TAKER_FEE;

  return { exit: exit, exitReason: exitReason, pnlPct: pnlPct };
}

async function runConfig(stopPct, targetMult) {
  var allSigs = [];
  var setupStats = {};

  for (const coin of COINS) {
    const c = await fetchCandles(coin);
    if (!c || c.length < 60) continue;

    var longCount = 0, shortCount = 0;

    for (var i = 200; i < c.length - 1; i++) {
      var sig = detectTunedSignals(c, i, longCount, shortCount, stopPct);
      if (!sig) continue;

      var result = execTrade(c, i, sig, stopPct, targetMult);
      var win = result.pnlPct > 0;

      longCount += sig.side === 'long' ? 1 : 0;
      shortCount += sig.side === 'short' ? 1 : 0;

      if (!setupStats[sig.setup]) setupStats[sig.setup] = { count: 0, wins: 0, pnl: 0, longs: 0, shorts: 0 };
      setupStats[sig.setup].count++;
      setupStats[sig.setup].wins += win ? 1 : 0;
      setupStats[sig.setup].pnl += result.pnlPct;
      setupStats[sig.setup].longs += sig.side === 'long' ? 1 : 0;
      setupStats[sig.setup].shorts += sig.side === 'short' ? 1 : 0;

      allSigs.push({ coin: coin, side: sig.side, setup: sig.setup, pnl: result.pnlPct, win: win, exitReason: result.exitReason });
    }
  }

  var total = allSigs.length;
  var totalWins = allSigs.filter(function(s) { return s.win; }).length;
  var totalPnl = allSigs.reduce(function(s, x) { return s + x.pnl; }, 0);
  var totalLongs = allSigs.filter(function(s) { return s.side === 'long'; }).length;
  var totalShorts = allSigs.filter(function(s) { return s.side === 'short'; }).length;

  var wr = total > 0 ? (totalWins/total*100).toFixed(1) : '0';
  var lp = total > 0 ? (totalLongs/total*100).toFixed(1) : '0';

  console.log('\n═══════════════════════════════════════');
  console.log('CONFIG: ' + (stopPct*100) + '% stop, ' + targetMult + 'x target, ' + MAX_HOLD + 'd max hold');
  console.log('═══════════════════════════════════════');
  console.log('Total Signals: ' + total);
  console.log('Win Rate: ' + totalWins + '/' + total + ' = ' + wr + '%');
  console.log('Longs: ' + totalLongs + ' (' + lp + '%)  |  Shorts: ' + totalShorts);
  console.log('Total PnL: ' + (totalPnl>0?'+':'') + totalPnl.toFixed(1) + '%');

  console.log('\nPer-Setup:');
  Object.keys(setupStats).sort(function(a,b) { return setupStats[b].count - setupStats[a].count; }).forEach(function(name) {
    var s = setupStats[name];
    var swr = (s.wins / s.count * 100).toFixed(1);
    console.log('  ' + name.padEnd(20) + ': ' + s.count + ' sig | WR: ' + swr + '% | PnL: ' + (s.pnl>0?'+':'') + s.pnl.toFixed(1) + '% | L:' + s.longs + ' S:' + s.shorts);
  });

  var checks = [
    { n: 'L:S (30-70%)', p: parseFloat(lp) >= 30 && parseFloat(lp) <= 70 },
    { n: 'PnL > 0', p: totalPnl > 0 },
    { n: 'WR > 50%', p: parseFloat(wr) > 50 },
    { n: 'WR > 72%', p: parseFloat(wr) >= 72 },
  ];
  for (var c of checks) { console.log((c.p?'\u2705':'\u26a0\ufe0f') + ' ' + c.n); }

  return { wr: parseFloat(wr), pnl: totalPnl, total: total, longs: totalLongs, shorts: totalShorts, setups: setupStats };
}

async function run() {
  console.log('PERPS ALCHEMY — TUNED BACKTEST v7');
  console.log('Disabled: H&S, Inverse H&S, Bull Flag, Balanced, Wedges, Double Top');
  console.log('Kept: Golden Cross, Death Cross, Double Bottom, Stairway to Hell, Bear Flag');
  console.log('Testing multiple stop/target combos...\n');

  var configs = [
    [0.03, 2.0],  // 3% stop, 2x target (current)
    [0.05, 2.0],  // 5% stop, 2x target
    [0.08, 2.0],  // 8% stop, 2x target
    [0.05, 1.5],  // 5% stop, 1.5x target
    [0.08, 1.5],  // 8% stop, 1.5x target
    [0.10, 2.0],  // 10% stop, 2x target
    [0.05, 3.0],  // 5% stop, 3x target
  ];

  var results = [];
  for (var cfg of configs) {
    var r = await runConfig(cfg[0], cfg[1]);
    results.push({ stop: cfg[0], target: cfg[1], ...r });
  }

  console.log('\n\n═══════════════════════════════════════');
  console.log('SUMMARY COMPARISON');
  console.log('═══════════════════════════════════════');
  console.log('Config'.padEnd(25) + 'WR'.padStart(8) + 'PnL'.padStart(10) + 'Sigs'.padStart(8) + 'L:S'.padStart(10));
  results.forEach(function(r) {
    console.log(((r.stop*100)+'%/'+r.target+'x').padEnd(25) + r.wr.toFixed(1) + '%'.padStart(8) + (r.pnl>0?'+':'') + r.pnl.toFixed(1) + '%'.padStart(10) + r.total.toString().padStart(8) + (r.longs+':'+r.shorts).padStart(10));
  });
}

run().catch(console.error);
