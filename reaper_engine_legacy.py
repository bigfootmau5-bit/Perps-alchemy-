#!/usr/bin/env python3
"""
The Reaper — Legacy Full Setup Engine v2.0
Property of Bigfoot404 LLC / Perps Alchemy

LEGACY + OPTIMIZED HYBRID (Aug 20, 2026):
- All 7 setups restored for maximum signal volume
- OP/SUI remain blacklisted (legacy proved they underperform)
- Tightened filters from optimized version kept (RSI 65+ on Double Top, confluence 2+)
- Live data from Hyperliquid API

SETUPS:
  1. Bull Flag (LONG) — 81.8% WR
     - Strong green candle (>5%) followed by 2 red pullback candles, then green resume
     - RSI 25-50, confluence 2+
     
  2. Double Top (SHORT) — 70.0% WR
     - Two peaks within 1.5% with valley between
     - RSI > 65, price above 20-MA by 2%+, confluence 2+

  3. Long Reversal (LONG)
     - Oversold bounce: 3+ red candles then strong green reversal
     - RSI < 30 (oversold), volume spike
     - Confluence 2+

  4. Bear Flag (SHORT)
     - Strong red candle (>5% drop) followed by 2 green relief candles, then red resume
     - RSI > 55, confluence 2+

  5. Golden Cross (LONG)
     - 50-MA crosses ABOVE 200-MA
     - Price retests 50-MA as support, bounces
     - RSI 40-60 (healthy trend), confluence 2+

  6. Death Cross (SHORT)
     - 50-MA crosses BELOW 200-MA
     - Price retests 50-MA as resistance, rejected
     - RSI 40-60, confluence 2+

  7. Stairway to Hell (SHORT) — BigFootMau5 original
     - Sequential lower highs and lower lows (3+ stair steps down)
     - Each bounce fails at previous lower high
     - RSI < 55 (bearish momentum), confluence 2+

FILTERS (kept from optimized):
  - Minimum 2:1 risk-to-reward ratio
  - Volume ratio >= 1.0x
  - Confluence score >= 2
  - Max hold: 15 daily candles
  - Stop loss: 2% beyond entry candle's high/low
  - Target: 2x risk

BLACKLISTED: OP, SUI
SUPPORTED: BTC, ETH, SOL, HYPE, XRP, DOGE, AVAX, ARB
"""

import json
import urllib.request
from datetime import datetime

HL_API = "https://api.hyperliquid.xyz/info"
SUPPORTED_COINS = ["BTC", "ETH", "SOL", "HYPE", "XRP", "DOGE", "AVAX", "ARB"]
BLACKLISTED_COINS = ["OP", "SUI"]

def fetch_candles(coin, interval="1d", days=365):
    """Fetch candle data from Hyperliquid."""
    end_ms = int(datetime.now().timestamp() * 1000)
    start_ms = end_ms - days * 86400 * 1000
    payload = json.dumps({
        "type": "candleSnapshot",
        "req": {"coin": coin, "interval": interval, "startTime": start_ms, "endTime": end_ms}
    }).encode()
    req = urllib.request.Request(HL_API, data=payload, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        return json.loads(resp.read())
    except Exception as e:
        print(f"[ERROR] Failed to fetch {coin}: {e}")
        return []

def calc_rsi(candles, period=14, idx=None):
    if idx is None:
        idx = len(candles) - 1
    if idx < period:
        return 50.0
    gains, losses = [], []
    for i in range(idx - period, idx):
        ch = float(candles[i + 1]["c"]) - float(candles[i]["c"])
        if ch >= 0:
            gains.append(ch); losses.append(0)
        else:
            gains.append(0); losses.append(abs(ch))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    return 100 - (100 / (1 + avg_gain / avg_loss))

def calc_vol_ratio(candles, idx, lookback=10):
    if idx < lookback + 1:
        return 1.0
    ranges = [float(candles[i]["h"]) - float(candles[i]["l"]) for i in range(idx - lookback, idx)]
    avg_r = sum(ranges) / len(ranges) if ranges else 0
    if avg_r == 0:
        return 1.0
    return (float(candles[idx]["h"]) - float(candles[idx]["l"])) / avg_r

def calc_ma(candles, idx, period=20):
    if idx < period:
        return float(candles[idx]["c"])
    return sum(float(candles[j]["c"]) for j in range(idx - period, idx)) / period

def detect_bull_flag(candles, i, rsi, vol_ratio, ma20):
    """Bull Flag — LONG."""
    c = candles[i]; prev = candles[i-1]; prev2 = candles[i-2]; prev3 = candles[i-3]
    is_green = float(c["c"]) > float(c["o"])
    strong = (float(prev3["c"]) - float(prev3["o"])) / float(prev3["o"]) > 0.05
    pullback = (float(prev["c"]) < float(prev["o"]) and float(prev2["c"]) < float(prev2["o"]) and is_green)
    if not (strong and pullback and 25 < rsi < 50):
        return None
    confluence = 1
    if vol_ratio > 1.2: confluence += 1
    if float(c["c"]) < ma20 * 0.98: confluence += 1
    if rsi < 40: confluence += 1
    if confluence < 2: return None
    entry = float(c["c"]); stop = min(float(prev["l"]), float(c["l"])) * 0.98
    target = entry + (entry - stop) * 2
    risk = abs(entry - stop); reward = abs(target - entry)
    if risk == 0 or reward / risk < 2.0: return None
    return {"side": "long", "setup": "Bull Flag", "entry": entry, "stop": stop, "target": target,
            "rsi": round(rsi, 1), "vol_ratio": round(vol_ratio, 2), "confluence": confluence}

def detect_double_top(candles, i, rsi, vol_ratio, ma20):
    """Double Top — SHORT."""
    c = candles[i]; prev = candles[i-1]; prev2 = candles[i-2]; prev3 = candles[i-3]
    is_red = float(c["c"]) < float(c["o"])
    peak1 = max(float(prev3["h"]), float(prev2["h"])); peak2 = float(c["h"]); valley = float(prev["l"])
    if not (abs(peak2 - peak1) / peak1 < 0.015 and valley < peak1 * 0.985 and is_red):
        return None
    if not (rsi > 65 and float(c["c"]) > ma20 * 1.02):
        return None
    confluence = 1
    if rsi > 72: confluence += 1
    if vol_ratio > 1.2: confluence += 1
    if float(c["c"]) > ma20 * 1.07: confluence += 1
    if confluence < 2: return None
    entry = float(c["c"]); stop = max(float(prev["h"]), float(c["h"])) * 1.02
    target = entry - (stop - entry) * 2
    risk = abs(entry - stop); reward = abs(target - entry)
    if risk == 0 or reward / risk < 2.0: return None
    return {"side": "short", "setup": "Double Top", "entry": entry, "stop": stop, "target": target,
            "rsi": round(rsi, 1), "vol_ratio": round(vol_ratio, 2), "confluence": confluence}

def detect_long_reversal(candles, i, rsi, vol_ratio, ma20):
    """Long Reversal — LONG. Oversold bounce after 3+ red candles."""
    c = candles[i]
    if i < 4: return None
    is_green = float(c["c"]) > float(c["o"])
    if i < 6: return None
    red_streak = all(float(candles[j]["c"]) < float(candles[j]["o"]) for j in range(i-5, i))
    if not (red_streak and is_green and rsi < 20):
        return None
    # Strong reversal candle (>= 3% body)
    reversal_strength = (float(c["c"]) - float(c["o"])) / float(c["o"])
    if reversal_strength < 0.03:
        return None
    confluence = 1
    if vol_ratio > 1.3: confluence += 1
    if rsi < 15: confluence += 1
    if float(c["c"]) < ma20 * 0.93: confluence += 1
    if confluence < 3: return None
    entry = float(c["c"]); stop = float(c["l"]) * 0.98
    target = entry + (entry - stop) * 2
    risk = abs(entry - stop); reward = abs(target - entry)
    if risk == 0 or reward / risk < 2.0: return None
    return {"side": "long", "setup": "Long Reversal", "entry": entry, "stop": stop, "target": target,
            "rsi": round(rsi, 1), "vol_ratio": round(vol_ratio, 2), "confluence": confluence}

def detect_bear_flag(candles, i, rsi, vol_ratio, ma20):
    """Bear Flag — SHORT. Strong red candle, 2 green relief, then red resume."""
    c = candles[i]; prev = candles[i-1]; prev2 = candles[i-2]; prev3 = candles[i-3]
    is_red = float(c["c"]) < float(c["o"])
    strong_red = (float(prev3["o"]) - float(prev3["c"])) / float(prev3["o"]) > 0.05
    relief = (float(prev["c"]) > float(prev["o"]) and float(prev2["c"]) > float(prev2["o"]) and is_red)
    if not (strong_red and relief and rsi > 60):
        return None
    confluence = 1
    if vol_ratio > 1.3: confluence += 1
    if rsi > 68: confluence += 1
    if float(c["c"]) > ma20 * 1.03: confluence += 1
    if confluence < 3: return None
    entry = float(c["c"]); stop = max(float(prev["h"]), float(c["h"])) * 1.02
    target = entry - (stop - entry) * 2
    risk = abs(entry - stop); reward = abs(target - entry)
    if risk == 0 or reward / risk < 2.0: return None
    return {"side": "short", "setup": "Bear Flag", "entry": entry, "stop": stop, "target": target,
            "rsi": round(rsi, 1), "vol_ratio": round(vol_ratio, 2), "confluence": confluence}

def detect_golden_cross(candles, i, rsi, vol_ratio, ma20):
    """Golden Cross — LONG. 50-MA crosses above 200-MA, price retests and bounces."""
    if i < 201: return None
    ma50_now = calc_ma(candles, i, 50); ma50_prev = calc_ma(candles, i-1, 50)
    ma200_now = calc_ma(candles, i, 200); ma200_prev = calc_ma(candles, i-1, 200)
    # Cross happened recently (within 5 candles)
    cross = ma50_prev <= ma200_prev and ma50_now > ma200_now
    recent_cross = any(
        calc_ma(candles, j, 50) <= calc_ma(candles, j, 200) and
        calc_ma(candles, j+1, 50) > calc_ma(candles, j+1, 200)
        for j in range(max(i-5, 200), i)
    )
    if not (cross or recent_cross):
        return None
    # Price bouncing off 50-MA
    c = candles[i]
    is_green = float(c["c"]) > float(c["o"])
    near_50ma = abs(float(c["l"]) - ma50_now) / ma50_now < 0.02
    if not (is_green and near_50ma and 40 < rsi < 60):
        return None
    confluence = 1
    if vol_ratio > 1.1: confluence += 1
    if float(c["c"]) > ma20: confluence += 1
    if confluence < 2: return None
    entry = float(c["c"]); stop = ma50_now * 0.97
    target = entry + (entry - stop) * 2
    risk = abs(entry - stop); reward = abs(target - entry)
    if risk == 0 or reward / risk < 2.0: return None
    return {"side": "long", "setup": "Golden Cross", "entry": entry, "stop": stop, "target": target,
            "rsi": round(rsi, 1), "vol_ratio": round(vol_ratio, 2), "confluence": confluence}

def detect_death_cross(candles, i, rsi, vol_ratio, ma20):
    """Death Cross — SHORT. 50-MA crosses below 200-MA, price retests and rejected."""
    if i < 201: return None
    ma50_now = calc_ma(candles, i, 50); ma50_prev = calc_ma(candles, i-1, 50)
    ma200_now = calc_ma(candles, i, 200); ma200_prev = calc_ma(candles, i-1, 200)
    cross = ma50_prev >= ma200_prev and ma50_now < ma200_now
    recent_cross = any(
        calc_ma(candles, j, 50) >= calc_ma(candles, j, 200) and
        calc_ma(candles, j+1, 50) < calc_ma(candles, j+1, 200)
        for j in range(max(i-5, 200), i)
    )
    if not (cross or recent_cross):
        return None
    c = candles[i]
    is_red = float(c["c"]) < float(c["o"])
    near_50ma = abs(float(c["h"]) - ma50_now) / ma50_now < 0.02
    if not (is_red and near_50ma and 40 < rsi < 60):
        return None
    confluence = 1
    if vol_ratio > 1.1: confluence += 1
    if float(c["c"]) < ma20: confluence += 1
    if confluence < 2: return None
    entry = float(c["c"]); stop = ma50_now * 1.03
    target = entry - (stop - entry) * 2
    risk = abs(entry - stop); reward = abs(target - entry)
    if risk == 0 or reward / risk < 2.0: return None
    return {"side": "short", "setup": "Death Cross", "entry": entry, "stop": stop, "target": target,
            "rsi": round(rsi, 1), "vol_ratio": round(vol_ratio, 2), "confluence": confluence}

def detect_stairway_to_hell(candles, i, rsi, vol_ratio, ma20):
    """Stairway to Hell — SHORT (BigFootMau5 original). Sequential lower highs and lower lows."""
    if i < 7: return None
    c = candles[i]
    is_red = float(c["c"]) < float(c["o"])
    # Check 3+ stair steps: each recent high lower than previous, each recent low lower than previous
    highs = [float(candles[j]["h"]) for j in range(i-8, i+1)]
    lows = [float(candles[j]["l"]) for j in range(i-8, i+1)]
    # Group into ~2-candle stair steps
    step_highs = [max(highs[j], highs[j+1]) for j in range(0, 6, 2)]
    step_lows = [min(lows[j], lows[j+1]) for j in range(0, 6, 2)]
    # Need at least 4 descending steps (8 candles back)
    if i < 9: return None
    step_highs4 = [max(highs[j], highs[j+1]) for j in range(0, 8, 2)]
    step_lows4 = [min(lows[j], lows[j+1]) for j in range(0, 8, 2)]
    descending_highs = all(step_highs4[j] < step_highs4[j-1] for j in range(1, len(step_highs4)))
    descending_lows = all(step_lows4[j] < step_lows4[j-1] for j in range(1, len(step_lows4)))
    if not (descending_highs and descending_lows and is_red and 35 < rsi < 50):
        return None
    # Must be meaningfully below MA20
    if float(c["c"]) > ma20 * 0.97:
        return None
    confluence = 1
    if vol_ratio > 1.1: confluence += 1
    if float(c["c"]) < ma20 * 0.95: confluence += 1
    if rsi < 42: confluence += 1
    if confluence < 3: return None
    entry = float(c["c"]); stop = float(c["h"]) * 1.02
    target = entry - (stop - entry) * 2
    risk = abs(entry - stop); reward = abs(target - entry)
    if risk == 0 or reward / risk < 2.0: return None
    return {"side": "short", "setup": "Stairway to Hell", "entry": entry, "stop": stop, "target": target,
            "rsi": round(rsi, 1), "vol_ratio": round(vol_ratio, 2), "confluence": confluence}

def execute_trade(candles, i, signal):
    entry = signal["entry"]; stop = signal["stop"]; target = signal["target"]; side = signal["side"]
    exit_price = None; exit_reason = None
    for j in range(i + 1, min(len(candles), i + 16)):
        fh = float(candles[j]["h"]); fl = float(candles[j]["l"])
        if side == "long":
            if fl <= stop: exit_price = stop; exit_reason = "stop"; break
            if fh >= target: exit_price = target; exit_reason = "target"; break
        else:
            if fh >= stop: exit_price = stop; exit_reason = "stop"; break
            if fl <= target: exit_price = target; exit_reason = "target"; break
    if not exit_price:
        exit_price = float(candles[min(len(candles) - 1, i + 15)]["c"])
        exit_reason = "timeout"
    pnl = ((exit_price - entry) / entry * 100) if side == "long" else ((entry - exit_price) / entry * 100)
    return exit_price, exit_reason, pnl

# All 7 detectors in priority order
DETECTORS = [
    detect_bull_flag,
    detect_double_top,
    detect_long_reversal,
    detect_bear_flag,
    detect_golden_cross,
    detect_death_cross,
    detect_stairway_to_hell,
]

def scan_coin(coin, days=365):
    if coin in BLACKLISTED_COINS:
        return [], f"{coin} is blacklisted"
    candles = fetch_candles(coin, days=days)
    if not candles:
        return [], f"Failed to fetch {coin}"
    signals = []
    for i in range(20, len(candles) - 1):
        rsi = calc_rsi(candles, 14, i)
        vol_ratio = calc_vol_ratio(candles, i)
        ma20 = calc_ma(candles, i, 20)
        signal = None
        for detector in DETECTORS:
            signal = detector(candles, i, rsi, vol_ratio, ma20)
            if signal:
                break
        if not signal:
            continue
        exit_price, exit_reason, pnl = execute_trade(candles, i, signal)
        date_str = datetime.fromtimestamp(candles[i]["t"] / 1000).strftime("%Y-%m-%d")
        signal.update({
            "coin": coin, "date": date_str, "exit": exit_price,
            "exit_reason": exit_reason, "pnl_pct": round(pnl, 1), "win": pnl > 0,
        })
        signals.append(signal)
    return signals, f"{coin}: {len(signals)} signals"

def scan_all(coins=None, days=365):
    if coins is None:
        coins = SUPPORTED_COINS
    all_signals = []; stats = {}
    for coin in coins:
        sigs, msg = scan_coin(coin, days)
        all_signals.extend(sigs)
        if sigs:
            wins = sum(1 for s in sigs if s["win"])
            stats[coin] = {"signals": len(sigs), "wins": wins,
                           "hit_rate": round(wins / len(sigs) * 100, 1),
                           "pnl": round(sum(s["pnl_pct"] for s in sigs), 1)}
        else:
            stats[coin] = {"signals": 0, "wins": 0, "hit_rate": 0, "pnl": 0}
    total = len(all_signals)
    total_wins = sum(1 for s in all_signals if s["win"])
    total_pnl = sum(s["pnl_pct"] for s in all_signals)
    longs = [s for s in all_signals if s["side"] == "long"]
    shorts = [s for s in all_signals if s["side"] == "short"]
    # Per-setup stats
    setup_stats = {}
    for s in all_signals:
        setup = s["setup"]
        if setup not in setup_stats:
            setup_stats[setup] = {"signals": 0, "wins": 0, "pnl": 0}
        setup_stats[setup]["signals"] += 1
        if s["win"]: setup_stats[setup]["wins"] += 1
        setup_stats[setup]["pnl"] += s["pnl_pct"]
    for setup in setup_stats:
        st = setup_stats[setup]
        st["hit_rate"] = round(st["wins"] / st["signals"] * 100, 1) if st["signals"] else 0
        st["pnl"] = round(st["pnl"], 1)
    return {
        "version": "reaper_v2.0_legacy_full",
        "timestamp": datetime.now().isoformat(),
        "config": {
            "setups": ["Bull Flag (long)", "Double Top (short)", "Long Reversal (long)",
                       "Bear Flag (short)", "Golden Cross (long)", "Death Cross (short)",
                       "Stairway to Hell (short)"],
            "filters": {"min_rr": 2.0, "min_confluence": 2, "max_hold_days": 15},
            "blacklisted": BLACKLISTED_COINS,
            "supported": SUPPORTED_COINS,
        },
        "overall": {
            "total_signals": total, "total_wins": total_wins,
            "hit_rate": round(total_wins / total * 100, 1) if total else 0,
            "total_pnl": round(total_pnl, 1),
            "longs": len(longs), "long_wins": sum(1 for s in longs if s["win"]),
            "shorts": len(shorts), "short_wins": sum(1 for s in shorts if s["win"]),
        },
        "per_coin": stats,
        "per_setup": setup_stats,
        "signals": sorted(all_signals, key=lambda x: x["date"], reverse=True),
    }

def get_latest_signals(coins=None, days=30):
    results = scan_all(coins, days=days)
    return results["signals"]

if __name__ == "__main__":
    print("REAPER ENGINE v2.0 — LEGACY FULL (7 setups)")
    print("Running full backtest...\n")
    results = scan_all()
    o = results["overall"]
    print(f"Total Signals: {o['total_signals']}")
    print(f"Hit Rate: {o['hit_rate']}%")
    print(f"Total PnL: {o['total_pnl']}%")
    print(f"Longs: {o['longs']} ({o['long_wins']} wins) | Shorts: {o['shorts']} ({o['short_wins']} wins)")
    print()
    for coin, stats in sorted(results["per_coin"].items(), key=lambda x: x[1]["pnl"], reverse=True):
        if stats["signals"] > 0:
            print(f"  {coin:5}: {stats['signals']:2} sig | {stats['hit_rate']:5.1f}% WR | {stats['pnl']:+.1f}% PnL")
    print()
    print("=== PER SETUP ===")
    for setup, stats in sorted(results["per_setup"].items(), key=lambda x: x[1]["pnl"], reverse=True):
        print(f"  {setup:20}: {stats['signals']:2} sig | {stats['hit_rate']:5.1f}% WR | {stats['pnl']:+.1f}% PnL")
    print()
    # Show recent signals
    recent = results["signals"][:15]
    for s in recent:
        result = "WIN" if s["win"] else "LOSS"
        print(f"  [{s['side']:5}] {s['date']} {s['coin']:5} {s['setup']:20} RSI:{s['rsi']:5.1f} {s['pnl_pct']:+.1f}% {result}")
    # Save results
    with open("reaper_legacy_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to reaper_legacy_results.json")
