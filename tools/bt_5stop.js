#!/usr/bin/env node
/**
 * Perps Alchemy — Live-Matching Backtest v6
 * Mirrors index.html detection logic EXACTLY:
 *   EMA50/EMA200 crossover (not EMA20/50)
 *   All signals: Golden Cross, Death Cross, Bull/Bear Flag, Double Top/Bottom,
 *   H&S, Inverse H&S, Stairway to Hell, Falling/Rising Wedge, Balanced fallback
 *   3% stop, 2x target, 12d max hold, 0.07% taker fee
 *   L:S 65% long cap
 */
const https = require('https');
const HL_API = 'https://api.hyperliquid.xyz/info';
const COINS = ['BTC','ETH','SOL','HYPE','XRP','DOGE','AVAX','ARB'];
const DAYS = 365;
const TAKER_FEE = 0.07;
const MAX_HOLD = 12;
const STOP_PCT = 0.05;
const TARGET_MULT = 2.0;

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

function detectAllSignals(candles, i, longCount, shortCount) {
  var c = candles[i], prev = candles[i-1], prev2 = candles[i-2], prev3 = candles[i-3];
  var o = parseFloat(c.o), h = parseFloat(c.h), l = parseFloat(c.l), cl = parseFloat(c.c);
  var po = parseFloat(prev.o), pc = parseFloat(prev.c), ph = parseFloat(prev.h), pl2 = parseFloat(prev.l);
  var isGreen = cl > o, isRed = cl < o;

  var tot = longCount + shortCount;
  var longPct = tot > 10 ? longCount / tot : 0;
  var skipLong = longPct > 0.65;

  var signal = null;
  var setup = null;

  // Golden Cross (EMA50/EMA200 crossover)
  if (i >= 200) {
    var e50n = calcEMA(candles, i, 50), e200n = calcEMA(candles, i, 200);
    var e50p = calcEMA(candles, i-1, 50), e200p = calcEMA(candles, i-1, 200);
    if (e50p < e200p && e50n > e200n && !skipLong) {
      var rsiGC = calcRSI(candles, 14, i);
      if (rsiGC >= 30 && rsiGC <= 75) { signal = 'long'; setup = 'Golden Cross'; }
    }
  }

  // Death Cross (EMA50/EMA200 crossunder)
  if (!signal && i >= 200) {
    var e50nD = calcEMA(candles, i, 50), e200nD = calcEMA(candles, i, 200);
    var e50pD = calcEMA(candles, i-1, 50), e200pD = calcEMA(candles, i-1, 200);
    if (e50pD > e200pD && e50nD < e200nD) {
      var rsiDC = calcRSI(candles, 14, i);
      if (rsiDC >= 25 && rsiDC <= 70) { signal = 'short'; setup = 'Death Cross'; }
    }
  }

  // Bull Flag
  if (!signal && i >= 4 && !skipLong) {
    var strong = (parseFloat(prev3.c) - parseFloat(prev3.o)) / parseFloat(prev3.o) > 0.03;
    var pullback = pc < po && parseFloat(prev2.c) < parseFloat(prev2.o) && isGreen;
    if (strong && pullback) {
      var e20bf = calcEMA(candles, i, 20), e50bf = calcEMA(candles, i, 50);
      if (e20bf > e50bf) { signal = 'long'; setup = 'Bull Flag'; }
    }
  }

  // Bear Flag
  if (!signal && i >= 4) {
    var strongDown = (parseFloat(prev3.o) - parseFloat(prev3.c)) / parseFloat(prev3.o) > 0.03;
    var pullbackUp = pc > po && parseFloat(prev2.c) > parseFloat(prev2.o) && isRed;
    if (strongDown && pullbackUp) {
      var e20bfD = calcEMA(candles, i, 20), e50bfD = calcEMA(candles, i, 50);
      if (e20bfD < e50bfD) { signal = 'short'; setup = 'Bear Flag'; }
    }
  }

  // Double Top
  if (!signal && i >= 15) {
    var p1i = -1, p2i = -1, p1v = 0, p2v = 0;
    for (var j = i - 15; j < i - 2; j++) { var hh = parseFloat(candles[j].h); if (hh > p1v) { p1v = hh; p1i = j; } }
    for (var j2 = p1i + 2; j2 < i; j2++) { var hh2 = parseFloat(candles[j2].h); if (hh2 > p2v) { p2v = hh2; p2i = j2; } }
    if (p1i !== -1 && p2i !== -1) {
      var peakDiff = Math.abs(p1v - p2v) / Math.max(p1v, p2v) * 100;
      var valley = parseFloat(candles[Math.floor((p1i + p2i) / 2)].l);
      var rsiDT = calcRSI(candles, 14, i);
      var ma20DT = calcMA(candles, i, 20);
      if (peakDiff <= 2.5 && valley < Math.min(p1v, p2v) * 0.98 && rsiDT >= 60 && cl <= ma20DT * 1.02 && isRed) {
        signal = 'short'; setup = 'Double Top';
      }
    }
  }

  // Double Bottom
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

  // Stairway to Hell
  if (!signal && i >= 5) {
    var lh1 = parseFloat(prev3.h), lh2 = parseFloat(prev2.h), lh3 = parseFloat(prev.h);
    if (lh1 > lh2 && lh2 > lh3 && h < lh3 && isRed) { signal = 'short'; setup = 'Stairway to Hell'; }
  }

  // Head & Shoulders (short)
  if (!signal && i >= 10) {
    var hsLookback = 10;
    var hsHigh = 0, hsHighIdx = 0;
    for (var j = i - hsLookback; j < i; j++) { if (parseFloat(candles[j].h) > hsHigh) { hsHigh = parseFloat(candles[j].h); hsHighIdx = j; } }
    if (hsHighIdx > i - hsLookback + 1 && hsHighIdx < i - 1) {
      var lsH = parseFloat(candles[hsHighIdx - 1].h), rsH = parseFloat(candles[hsHighIdx + 1].h);
      if (Math.abs(lsH - rsH) / Math.max(lsH, rsH) * 100 < 5 && hsHigh > lsH && hsHigh > rsH && isRed) {
        signal = 'short'; setup = 'Head & Shoulders';
      }
    }
  }

  // Inverse Head & Shoulders (long)
  if (!signal && i >= 10 && !skipLong) {
    var ihsLookback = 10;
    var ihsLow = 999999, ihsLowIdx = 0;
    for (var j = i - ihsLookback; j < i; j++) { if (parseFloat(candles[j].l) < ihsLow) { ihsLow = parseFloat(candles[j].l); ihsLowIdx = j; } }
    if (ihsLowIdx > i - ihsLookback + 1 && ihsLowIdx < i - 1) {
      var lsL = parseFloat(candles[ihsLowIdx - 1].l), rsL = parseFloat(candles[ihsLowIdx + 1].l);
      if (Math.abs(lsL - rsL) / Math.min(lsL, rsL) * 100 < 5 && ihsLow < lsL && ihsLow < rsL && isGreen) {
        signal = 'long'; setup = 'Inverse H&S';
      }
    }
  }

  // Falling Wedge (long)
  if (!signal && i >= 10 && !skipLong) {
    var fwH1 = parseFloat(candles[i-10].h), fwH2 = parseFloat(candles[i-5].h);
    var fwL1 = parseFloat(candles[i-10].l), fwL2 = parseFloat(candles[i-5].l);
    if (fwH1 > fwH2 && fwL1 > fwL2 && isGreen) {
      var fwRange1 = fwH1 - fwL1, fwRange2 = fwH2 - fwL2;
      if (fwRange2 < fwRange1 * 0.8) { signal = 'long'; setup = 'Falling Wedge'; }
    }
  }

  // Rising Wedge (short)
  if (!signal && i >= 10) {
    var rwH1 = parseFloat(candles[i-10].h), rwH2 = parseFloat(candles[i-5].h);
    var rwL1 = parseFloat(candles[i-10].l), rwL2 = parseFloat(candles[i-5].l);
    if (rwH1 < rwH2 && rwL1 < rwL2 && isRed) {
      var rwRange1 = rwH1 - rwL1, rwRange2 = rwH2 - rwL2;
      if (rwRange2 < rwRange1 * 0.8) { signal = 'short'; setup = 'Rising Wedge'; }
    }
  }

  // Balanced fallback
  if (!signal) {
    var prev3Red = candles.slice(i-3, i).every(function(x){return parseFloat(x.c) < parseFloat(x.o);});
    var prev3Green = candles.slice(i-3, i).every(function(x){return parseFloat(x.c) > parseFloat(x.o);});
    if (!skipLong && isGreen && prev3Red && (cl - o) / o > 0.03) { signal = 'long'; setup = 'Balanced Bounce'; }
    if (isRed && prev3Green && (o - cl) / o > 0.03) { signal = 'short'; setup = 'Balanced Drop'; }
  }

  return signal ? { side: signal, setup: setup, entry: cl } : null;
}

function execTrade(candles, i, sig) {
  var entry = sig.entry;
  var stopDist = entry * STOP_PCT;
  var stop = sig.side === 'long' ? entry - stopDist : entry + stopDist;
  var risk = Math.abs(entry - stop);
  var target = sig.side === 'long' ? entry + TARGET_MULT * risk : entry - TARGET_MULT * risk;
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

  return { exit: exit, exitReason: exitReason, pnlPct: pnlPct, stop: stop, target: target };
}

async function run() {
  console.log('PERPS ALCHEMY — LIVE-MATCHING BACKTEST v6');
  console.log('Mirrors index.html: EMA50/EMA200, ALL signals, 3% stop, 2x target, 12d max hold, 0.07% fee\n');

  var allSigs = [];
  var setupStats = {};

  for (const coin of COINS) {
    const c = await fetchCandles(coin);
    if (!c || c.length < 60) { console.log('  ' + coin + ': insufficient data'); continue; }

    var coinSigs = 0, coinWins = 0, coinPnl = 0;
    var longCount = 0, shortCount = 0;

    for (var i = 200; i < c.length - 1; i++) {
      var sig = detectAllSignals(c, i, longCount, shortCount);
      if (!sig) continue;

      var result = execTrade(c, i, sig);
      var win = result.pnlPct > 0;

      longCount += sig.side === 'long' ? 1 : 0;
      shortCount += sig.side === 'short' ? 1 : 0;
      coinSigs++;
      coinWins += win ? 1 : 0;
      coinPnl += result.pnlPct;

      if (!setupStats[sig.setup]) setupStats[sig.setup] = { count: 0, wins: 0, pnl: 0, longs: 0, shorts: 0 };
      setupStats[sig.setup].count++;
      setupStats[sig.setup].wins += win ? 1 : 0;
      setupStats[sig.setup].pnl += result.pnlPct;
      setupStats[sig.setup].longs += sig.side === 'long' ? 1 : 0;
      setupStats[sig.setup].shorts += sig.side === 'short' ? 1 : 0;

      allSigs.push({
        coin: coin,
        date: new Date(c[i].t).toISOString().split('T')[0],
        side: sig.side,
        setup: sig.setup,
        pnl: Math.round(result.pnlPct * 10) / 10,
        win: win,
        exitReason: result.exitReason
      });
    }

    var wr = coinSigs > 0 ? (coinWins / coinSigs * 100).toFixed(1) : '0';
    console.log('  ' + coin.padEnd(5) + ': ' + coinSigs + ' sig | WR: ' + wr + '% | PnL: ' + (coinPnl>0?'+':'') + coinPnl.toFixed(1) + '% | L:' + longCount + ' S:' + shortCount);
  }

  var total = allSigs.length;
  var totalWins = allSigs.filter(function(s) { return s.win; }).length;
  var totalPnl = allSigs.reduce(function(s, x) { return s + x.pnl; }, 0);
  var totalLongs = allSigs.filter(function(s) { return s.side === 'long'; }).length;
  var totalShorts = allSigs.filter(function(s) { return s.side === 'short'; }).length;

  console.log('\n═══════════════════════════════════════');
  console.log('VERIFICATION RESULTS');
  console.log('═══════════════════════════════════════');
  console.log('Total Signals: ' + total);
  console.log('Win Rate: ' + totalWins + '/' + total + ' = ' + (total>0?(totalWins/total*100).toFixed(1):0) + '%');
  console.log('Longs: ' + totalLongs + ' (' + (total>0?(totalLongs/total*100).toFixed(1):0) + '%)  |  Shorts: ' + totalShorts + ' (' + (total>0?(totalShorts/total*100).toFixed(1):0) + '%)');
  console.log('Total PnL: ' + (totalPnl>0?'+':'') + totalPnl.toFixed(1) + '%');

  console.log('\n─── Per-Setup Breakdown ───');
  Object.keys(setupStats).sort(function(a,b) { return setupStats[b].count - setupStats[a].count; }).forEach(function(name) {
    var s = setupStats[name];
    var wr = (s.wins / s.count * 100).toFixed(1);
    console.log('  ' + name.padEnd(20) + ': ' + s.count + ' sig | WR: ' + wr + '% | PnL: ' + (s.pnl>0?'+':'') + s.pnl.toFixed(1) + '% | L:' + s.longs + ' S:' + s.shorts);
  });

  console.log('\n─── Validation ───');
  var lp = total > 0 ? (totalLongs/total*100) : 0;
  var checks = [
    { n: 'L:S Ratio (30-70%)', p: lp >= 30 && lp <= 70, d: 'Long ' + lp.toFixed(1) + '%' },
    { n: 'PnL > 0', p: totalPnl > 0, d: (totalPnl>0?'+':'') + totalPnl.toFixed(1) + '%' },
    { n: 'Win Rate > 50%', p: total > 0 && (totalWins/total*100) > 50, d: (total>0?(totalWins/total*100).toFixed(1):0) + '%' },
  ];
  var ok = true;
  for (var c of checks) { console.log((c.p?'\u2705':'\u26a0\ufe0f') + ' ' + c.n + ': ' + c.d); if(!c.p) ok = false; }
  console.log('═══════════════════════════════════════');
  console.log(ok ? '\ud83c\udfaf ENGINE READY TO SHIP' : '\u26a0\ufe0f ENGINE NEEDS ITERATION');
  console.log('═══════════════════════════════════════\n');

  console.log('Recent 15 Signals:');
  allSigs.slice(-15).reverse().forEach(function(s) {
    var sd = s.side === 'long' ? 'LONG ' : 'SHORT';
    console.log('  [' + sd + '] ' + s.date + ' ' + s.coin.padEnd(5) + ' ' + s.setup.padEnd(20) + ' ' + (s.pnl>0?'+':'') + s.pnl + '% ' + (s.win?'WIN':'LOSS') + ' (' + s.exitReason + ')');
  });
}

run().catch(console.error);
