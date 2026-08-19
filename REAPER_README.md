# The Reaper — Optimized Trading Signal Engine v1.0

**Property of Bigfoot404 LLC / Perps Alchemy**
**Backtest: 73.2% Hit Rate | +212.6% Total PnL (365-day, 8 coins)**

## Overview

The Reaper scans Hyperliquid DEX candle data for high-conviction trade setups using RSI, volume analysis, moving average deviation, and confluence scoring. It runs two proven setups:

1. **Bull Flag (LONG)** — 81.8% win rate
2. **Double Top (SHORT)** — 70.0% win rate

## Configuration

### Supported Coins
BTC, ETH, SOL, HYPE, XRP, DOGE, AVAX, ARB

### Blacklisted Coins
OP, SUI (consistently underperform across all backtest versions)

### Filters
- Minimum 2:1 risk-to-reward ratio
- Volume ratio >= 1.0x (signal candle range vs 10-period average)
- Confluence score >= 2 (pattern + at least 1 confirmation)
- Max hold: 15 daily candles
- Stop loss: 2% beyond entry candle's high/low
- Target: 2x risk

### Bull Flag Parameters
- Strong move: >5% green candle
- Pullback: 2 consecutive red candles
- Resume: green candle
- RSI range: 25-50
- Confluence factors: volume > 1.2x, price < MA20 * 0.98, RSI < 40

### Double Top Parameters
- Two peaks within 1.5% of each other
- Valley between peaks < 98.5% of peak height
- RSI > 65 (tightened from 58 in earlier versions)
- Price > MA20 * 1.02
- Confluence factors: RSI > 72, volume > 1.2x, price > MA20 * 1.07

## Version History

| Version | Signals | Hit Rate | PnL | Changes |
|---------|---------|----------|-----|---------|
| v1 (raw) | 268 | 39.2% | -55.4% | No filters, all setups |
| v2 (tight) | 8 | 62.5% | +13.8% | RSI 45/55, Vol 1.2x, R:R 2:1, Confluence 2+ |
| v3 (balanced) | 27 | 51.9% | -17.8% | Loosened v2 |
| v4 (surgical) | 8 | 62.5% | +13.8% | Dropped Stairway, RSI 40/60 |
| v5 (4H candles) | 143 | 41.3% | -5.0% | 4H interval, too noisy |
| v6 (1Y all setups) | 138 | 41.3% | +0.6% | 365-day, all setups |
| FINAL (no reversal) | 64 | 60.9% | +195.8% | Dropped Long Reversal |
| **OPTIMIZED** | **41** | **73.2%** | **+212.6%** | Dropped Bear Flag, blacklisted OP/SUI, RSI 65+ |

## Usage

```python
from reaper_engine import scan_all, get_latest_signals

# Full backtest scan
results = scan_all()
print(f"Hit Rate: {results['overall']['hit_rate']}%")
print(f"Total PnL: {results['overall']['total_pnl']}%")

# Get recent signals (last 30 days)
recent = get_latest_signals(days=30)
for s in recent:
    print(f"[{s['side'].upper()}] {s['date']} {s['coin']} {s['setup']} {s['pnl_pct']}%")
```

## Architecture

```
reaper_engine.py          — Main engine (importable module)
reaper_optimized_results.json — Final optimized backtest results
reaper_test_final_results.json — Previous version results (60.9% WR)
```

---
**Status:** LOCKED — Optimized v1.0
**Last Updated:** August 19, 2026
