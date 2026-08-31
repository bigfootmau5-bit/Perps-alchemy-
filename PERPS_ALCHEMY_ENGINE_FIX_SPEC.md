# Perps Alchemy Engine — Fix Specification

## Overview
5 targeted fixes to `reaper_engine.py` to achieve production-ready signal quality.
Verification via `tools/backtest_engine.js` — a 100-signal Hyperliquid backtest.

## Pass/Fail Thresholds
- **L:S Ratio**: 30–70% (longs must not exceed 70% of total signals)
- **PnL**: Total PnL > 0%
- **Golden Cross**: Fires 3+ times in backtest period

## Fixes

### Fix 1: Add Golden Cross Signal (NEW LONG SETUP)
**Problem**: Engine only has Bull Flag and Double Top — no trend-following signal.
**Fix**: Add `detect_golden_cross()` — EMA20 crosses above EMA50 with volume confirmation.
- Entry: close of crossover candle
- Stop: 3% below EMA50 at signal time
- Target: 2x risk
- RSI filter: 40-60 (trending, not overbought)
- Confluence: volume ratio > 1.1x

### Fix 2: Add EMA Calculation Function
**Problem**: No EMA support — Golden Cross requires EMA20/EMA50.
**Fix**: Add `calc_ema(candles, idx, period)` returning EMA value at given index.

### Fix 3: L:S Ratio Enforcement
**Problem**: Bull Flag fires too often vs Double Top — longs dominate >80%.
**Fix**: Track running long/short counts. If longs >70% of signals so far, skip new long signals and force short detection only until ratio rebalances to <65%.

### Fix 4: Add Trading Fee to PnL Calculation
**Problem**: PnL doesn't account for Hyperliquid taker fees (0.035% per side = 0.07% round trip).
**Fix**: Subtract 0.07% from every trade's PnL in `execute_trade()`.

### Fix 5: Tighten Double Top Detection
**Problem**: Double Top fires too rarely — threshold too strict (1.5% peak proximity, RSI 65).
**Fix**: Widen peak proximity to 2.5% and lower RSI minimum from 65 to 60. More short signals = better L:S balance.

## Verification
Run `node tools/backtest_engine.js` — must print `🎯 ENGINE READY TO SHIP`.
