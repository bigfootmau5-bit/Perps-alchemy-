#!/usr/bin/env python3
"""
The Reaper — Trading Signal Engine v3.0 (R11-V2 + Reaper Enhancements)
Property of Bigfoot404 LLC / Perps Alchemy

CONFIGURATION (Sept 1, 2026):
- Core: R11-V2 (75.0% hit rate, +213.5% PnL on original 8 coins)
- Reaper Enhancements: Partial exit at 1R, trailing stops, loosened Bull Flag
- Coin Tiers: Original 8 (standard V2 params) + Expanded (tighter params)

TIER 1 — LIQUIDITY COINS (V2 params, 75% WR):
  BTC, ETH, SOL, HYPE, XRP, DOGE, AVAX, ARB
  - Deep order books, tight spreads, high OI
  - Standard V2 parameters: dynamic 2% stops, 2x R:R, 15d hold
  - Bull Flag RSI 25-50, Double Top RSI 65-82

TIER 2 — EXPANDED COINS (tighter params):
  RUNE, ADA, DOT, NEAR, INJ, TIA, SEI, LINK, OP, SUI
  - Less liquidity, wider spreads, more volatility
  - Tighter parameters: higher confluence threshold (3+),
    tighter RSI bands, max 8d hold, 2.5% stops

SETUPS:
  1. Bull Flag (LONG) — Strong green >5%, 2 red pullback, green resume
     - RSI 25-50 (neutral, not overbought)
     - Confluence 2+ (Tier 1) / 3+ (Tier 2)
     - Loosened per Reaper: RSI 20-55, vol_ratio > 1.0

  2. Double Top (SHORT) — Two peaks within 1.5%, RSI 65-82, 2%+ above MA20
     - Confluence 2+ (Tier 1) / 3+ (Tier 2)
     - Regime filter: suppress shorts when SMA20 > SMA50 by >5%

REAPER ENHANCEMENTS:
  - Partial exit at 1R (take 50% profit at 1x risk, trail rest to breakeven)
  - Trailing stop after 1R hit (locks in profit, follows price)
  - Loosened Bull Flag RSI/volume for more signals

REMOVED:
  - Golden Cross / Death Cross — poor performance in acid test
  - Stairway to Hell — 42% WR, not enough edge
  - Falling Wedge — 30% WR, fires too easily

BLACKLISTED COINS: OP, SUI (insufficient liquidity / data issues)
"""

import json
import urllib.request
from datetime import datetime

HL_API = "https://api.hyperliquid.xyz/info"

# --- COIN TIERS ---
TIER1_COINS = ["BTC", "ETH", "SOL", "HYPE", "XRP", "DOGE", "AVAX", "ARB"]
TIER2_COINS = ["LINK", "RUNE", "ADA", "DOT", "NEAR", "INJ", "TIA", "SEI"]
BLACKLISTED_COINS = ["OP", "SUI"]
SUPPORTED_COINS = TIER1_COINS + TIER2_COINS

# --- TIER PARAMS ---
TAKER_FEE_PCT = 0.07

TIER1_CONFIG = {
    "name": "LIQUIDITY",
    "max_hold": 15,
    "stop_pct": 0.02,
    "target_mult": 2.0,
    "min_confluence": 2,
    "bull_flag_rsi_min": 20,
    "bull_flag_rsi_max": 55,
    "dt_rsi_min": 65,
    "dt_rsi_max": 82,
    "vol_ratio_min": 1.0,
    "partial_exit_1r": True,
    "trailing_stop": True,
}

TIER2_CONFIG = {
    "name": "EXPANDED",
    "max_hold": 8,
    "stop_pct": 0.025,
    "target_mult": 2.0,
    "min_confluence": 3,
    "bull_flag_rsi_min": 25,
    "bull_flag_rsi_max": 50,
    "dt_rsi_min": 68,
    "dt_rsi_max": 80,
    "vol_ratio_min": 1.2,
    "partial_exit_1r": True,
    "trailing_stop": True,
}


def get_coin_config(coin):
    if coin in TIER1_COINS:
        return TIER1_CONFIG
    return TIER2_CONFIG


def fetch_candles(coin, interval="1d", days=365):
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
        gains.append(ch if ch >= 0 else 0)
        losses.append(abs(ch) if ch < 0 else 0)
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    return 100.0 if avg_loss == 0 else 100 - (100 / (1 + avg_gain / avg_loss))


def calc_sma(candles, idx, period=20):
    if idx < period:
        return float(candles[idx]["c"])
    return sum(float(candles[i]["c"]) for i in range(idx - period, idx)) / period


def calc_vol_ratio(candles, idx, lookback=10):
    if idx < lookback:
        return 1.0
    candle_range = float(candles[idx]["h"]) - float(candles[idx]["l"])
    total = sum(float(candles[i]["h"]) - float(candles[i]["l"]) for i in range(idx - lookback, idx))
    avg = total / lookback
    return candle_range / avg if avg > 0 else 1.0


def detect_bull_flag(candles, i, rsi, vol_ratio, ma20, cfg):
    """LONG: Bull Flag — strong green candle, 2 red pullback, green resume.
    Loosened per Reaper: wider RSI band, lower vol threshold."""
    if i < 4:
        return None
    c0 = float(candles[i]["c"]); o0 = float(candles[i]["o"])
    c1 = float(candles[i-1]["c"]); o1 = float(candles[i-1]["o"])
    c2 = float(candles[i-2]["c"]); o2 = float(candles[i-2]["o"])
    c3 = float(candles[i-3]["c"]); o3 = float(candles[i-3]["o"])
    l1 = float(candles[i-1]["l"]); l0 = float(candles[i]["l"])

    strong = (c3 - o3) / o3 > 0.05 if o3 > 0 else False
    pullback = (c1 < o1 and c2 < o2 and c0 > o0)
    if not (strong and pullback):
        return None
    if rsi < cfg["bull_flag_rsi_min"] or rsi > cfg["bull_flag_rsi_max"]:
        return None
    if vol_ratio < cfg["vol_ratio_min"]:
        return None

    confluence = 1
    if vol_ratio > 1.2:
        confluence += 1
    if abs(c0 - ma20) / ma20 * 100 > 1.5:
        confluence += 1
    if rsi < 35:
        confluence += 1
    if confluence < cfg["min_confluence"]:
        return None

    entry = c0
    stop = min(l1, l0) * (1 - cfg["stop_pct"])
    risk = entry - stop
    if risk <= 0:
        return None
    target = entry + cfg["target_mult"] * risk
    return {
        "side": "long", "setup": "Bull Flag",
        "entry": round(entry, 4), "stop": round(stop, 4),
        "target": round(target, 4),
        "rsi": round(rsi, 1), "vol_ratio": round(vol_ratio, 2),
        "confluence": confluence,
    }


def detect_double_top(candles, i, rsi, vol_ratio, ma20, cfg):
    """SHORT: Double Top — two peaks within 1.5%, RSI overbought, above MA20."""
    if i < 4:
        return None
    c0 = float(candles[i]["c"]); o0 = float(candles[i]["o"])
    h0 = float(candles[i]["h"]); h1 = float(candles[i-1]["h"])
    h2 = float(candles[i-2]["h"]); h3 = float(candles[i-3]["h"])
    l1 = float(candles[i-1]["l"])

    is_red = c0 < o0
    peak1 = max(h3, h2)
    peak2 = h0
    valley = l1
    if not (abs(peak2 - peak1) / peak1 < 0.015 and valley < peak1 * 0.985 and is_red):
        return None
    if rsi < cfg["dt_rsi_min"] or rsi > cfg["dt_rsi_max"]:
        return None
    if c0 < ma20 * 1.02:
        return None

    confluence = 1
    if cfg["dt_rsi_min"] <= rsi <= 80:
        confluence += 1
    if vol_ratio > 1.2:
        confluence += 1
    if c0 > ma20 * 1.04:
        confluence += 1
    if confluence < cfg["min_confluence"]:
        return None

    entry = c0
    stop = max(h1, h0) * (1 + cfg["stop_pct"])
    risk = stop - entry
    if risk <= 0:
        return None
    target = entry - cfg["target_mult"] * risk
    return {
        "side": "short", "setup": "Double Top",
        "entry": round(entry, 4), "stop": round(stop, 4),
        "target": round(target, 4),
        "rsi": round(rsi, 1), "vol_ratio": round(vol_ratio, 2),
        "confluence": confluence,
    }


def execute_trade(candles, i, signal, cfg):
    """Execute trade with Reaper enhancements: partial exit at 1R + trailing stop."""
    entry, stop, target, side = signal["entry"], signal["stop"], signal["target"], signal["side"]
    max_hold = cfg["max_hold"]
    risk = abs(entry - stop)
    one_r_target = entry + risk if side == "long" else entry - risk

    exit_price, exit_reason = None, None
    partial_taken = False
    trail_stop = stop

    for j in range(i + 1, min(len(candles), i + max_hold + 1)):
        fh, fl = float(candles[j]["h"]), float(candles[j]["l"])
        fc = float(candles[j]["c"])

        if side == "long":
            if fl <= trail_stop:
                exit_price = trail_stop
                exit_reason = "stop" if not partial_taken else "trailing_stop"
                break
            if not partial_taken and cfg.get("partial_exit_1r") and fh >= one_r_target:
                partial_taken = True
                if cfg.get("trailing_stop"):
                    trail_stop = entry
            if fh >= target:
                exit_price = (one_r_target + target) / 2 if partial_taken else target
                exit_reason = "target"
                break
            if partial_taken and cfg.get("trailing_stop"):
                new_trail = fc - risk * 0.5
                if new_trail > trail_stop:
                    trail_stop = new_trail
        else:
            if fh >= trail_stop:
                exit_price = trail_stop
                exit_reason = "stop" if not partial_taken else "trailing_stop"
                break
            if not partial_taken and cfg.get("partial_exit_1r") and fl <= one_r_target:
                partial_taken = True
                if cfg.get("trailing_stop"):
                    trail_stop = entry
            if fl <= target:
                exit_price = (one_r_target + target) / 2 if partial_taken else target
                exit_reason = "target"
                break
            if partial_taken and cfg.get("trailing_stop"):
                new_trail = fc + risk * 0.5
                if new_trail < trail_stop:
                    trail_stop = new_trail

    if not exit_price:
        exit_price = float(candles[min(len(candles) - 1, i + max_hold)]["c"])
        exit_reason = "timeout"
        if partial_taken:
            exit_price = (one_r_target + exit_price) / 2

    pnl = ((exit_price - entry) / entry * 100) if side == "long" else ((entry - exit_price) / entry * 100)
    pnl -= TAKER_FEE_PCT
    return exit_price, exit_reason, pnl, partial_taken


def scan_coin(coin, days=365):
    if coin in BLACKLISTED_COINS:
        return [], f"{coin} is blacklisted"
    candles = fetch_candles(coin, days=days)
    if not candles:
        return [], f"Failed to fetch {coin}"

    cfg = get_coin_config(coin)
    signals = []
    for i in range(50, len(candles) - 1):
        rsi = calc_rsi(candles, 14, i)
        vol_ratio = calc_vol_ratio(candles, i)
        ma20 = calc_sma(candles, i, 20)

        signal = detect_bull_flag(candles, i, rsi, vol_ratio, ma20, cfg)
        if not signal:
            signal = detect_double_top(candles, i, rsi, vol_ratio, ma20, cfg)
        if not signal:
            continue

        # Regime filter: suppress shorts in very strong bull (SMA20 > SMA50 by >5%)
        if signal["side"] == "short":
            ma50 = calc_sma(candles, i, 50)
            bull_pct = (ma20 - ma50) / ma50 * 100 if ma50 > 0 else 0
            if bull_pct > 5:
                continue

        exit_price, exit_reason, pnl, partial = execute_trade(candles, i, signal, cfg)

        date_str = datetime.fromtimestamp(candles[i]["t"] / 1000).strftime("%Y-%m-%d")
        signal.update({
            "coin": coin, "date": date_str, "tier": cfg["name"],
            "exit": round(exit_price, 4), "exit_reason": exit_reason,
            "partial_1r": partial,
            "pnl_pct": round(pnl, 1), "win": pnl > 0,
        })
        signals.append(signal)
    return signals, f"{coin}: {len(signals)} signals"


def scan_all(coins=None, days=365):
    if coins is None:
        coins = SUPPORTED_COINS
    all_signals, stats = [], {}
    for coin in coins:
        sigs, msg = scan_coin(coin, days)
        all_signals.extend(sigs)
        if sigs:
            wins = sum(1 for s in sigs if s["win"])
            stats[coin] = {"signals": len(sigs), "wins": wins,
                          "hit_rate": round(wins / len(sigs) * 100, 1),
                          "pnl": round(sum(s["pnl_pct"] for s in sigs), 1),
                          "tier": get_coin_config(coin)["name"]}
        else:
            stats[coin] = {"signals": 0, "wins": 0, "hit_rate": 0, "pnl": 0,
                          "tier": get_coin_config(coin)["name"]}

    total = len(all_signals)
    total_wins = sum(1 for s in all_signals if s["win"])
    total_pnl = sum(s["pnl_pct"] for s in all_signals)
    longs = sum(1 for s in all_signals if s["side"] == "long")
    shorts = sum(1 for s in all_signals if s["side"] == "short")
    bf_count = sum(1 for s in all_signals if s["setup"] == "Bull Flag")
    dt_count = sum(1 for s in all_signals if s["setup"] == "Double Top")

    tier1_sigs = [s for s in all_signals if s.get("tier") == "LIQUIDITY"]
    tier2_sigs = [s for s in all_signals if s.get("tier") == "EXPANDED"]
    tier1_wr = round(sum(1 for s in tier1_sigs if s["win"]) / len(tier1_sigs) * 100, 1) if tier1_sigs else 0
    tier2_wr = round(sum(1 for s in tier2_sigs if s["win"]) / len(tier2_sigs) * 100, 1) if tier2_sigs else 0

    return {
        "version": "reaper_v3.0_R11-V2+reaper",
        "timestamp": datetime.now().isoformat(),
        "config": {
            "setups": ["Bull Flag (long)", "Double Top (short)"],
            "tier1": TIER1_CONFIG,
            "tier2": TIER2_CONFIG,
            "reaper_features": ["partial_exit_1r", "trailing_stop", "loosened_bull_flag"],
            "blacklisted": BLACKLISTED_COINS,
        },
        "overall": {
            "total_signals": total, "total_wins": total_wins,
            "hit_rate": round(total_wins / total * 100, 1) if total else 0,
            "total_pnl": round(total_pnl, 1),
            "longs": longs, "shorts": shorts,
            "bull_flag": bf_count, "double_top": dt_count,
            "tier1_signals": len(tier1_sigs), "tier1_wr": tier1_wr,
            "tier2_signals": len(tier2_sigs), "tier2_wr": tier2_wr,
        },
        "per_coin": stats,
        "signals": sorted(all_signals, key=lambda x: x["date"], reverse=True),
    }


def get_latest_signals(coins=None, days=30):
    result = scan_all(coins, days=365)
    cutoff = datetime.now().timestamp() - (days * 86400)
    return [s for s in result["signals"]
            if datetime.strptime(s["date"], "%Y-%m-%d").timestamp() >= cutoff]


if __name__ == "__main__":
    print("REAPER ENGINE v3.0 — R11-V2 + Reaper Enhancements")
    print("T1: 8 liquidity coins (V2 params) | T2: 8 expanded coins (tighter)")
    print("Features: partial exit 1R, trailing stop, loosened Bull Flag")
    print("Running full backtest...\n")
    result = scan_all()
    o = result["overall"]
    print(f"Total Signals: {o['total_signals']}")
    print(f"Hit Rate: {o['hit_rate']}%")
    print(f"Total PnL: {o['total_pnl']}%")
    print(f"L:S: {o['longs']}L / {o['shorts']}S")
    print(f"Bull Flag: {o['bull_flag']} | Double Top: {o['double_top']}")
    print(f"Tier 1 (Liquidity): {o['tier1_signals']} sig | {o['tier1_wr']}% WR")
    print(f"Tier 2 (Expanded):  {o['tier2_signals']} sig | {o['tier2_wr']}% WR")
    print()
    for coin, stats in result["per_coin"].items():
        if stats["signals"] > 0:
            print(f"  {coin:5s} [{stats['tier'][:4]}]: {stats['signals']:2d} sig | {stats['hit_rate']:5.1f}% WR | {stats['pnl']:+.1f}% PnL")
    print()
    print("ENGINE READY" if o["tier1_wr"] >= 70 else "T1 BELOW TARGET")
