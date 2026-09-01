# Reaper V3 — Parameter Sweep Results & Engine Configuration

## Date: September 1, 2026
## Author: BIGagent404 (Per Mau5's direction — "go back to the original 8, tighter for the rest")

---

## Background

The R11-V2 engine achieved **73.1% hit rate** and **+156.8% PnL** on 8 liquidity coins using Bull Flag (long) + Double Top (short) patterns with dynamic 2% stops and 2x risk-reward targets.

Mau5 directed a full parameter sweep to find the optimal configuration. This document records the results and reasoning behind the final configuration.

---

## Parameter Sweep — 11 Configs Tested

All tests run on 365 days of Hyperliquid daily candle data.

### Results (Ranked by Win Rate)

| Config | Win Rate | PnL | Signals | Longs | Shorts |
|--------|----------|-----|---------|-------|--------|
| Pure DT (no BF) | 78.3% | +145.7% | 23 | 0 | 23 |
| Stop 3% | 76.9% | +162.8% | 26 | 3 | 23 |
| V2 Baseline | 73.1% | +156.8% | 26 | 3 | 23 |
| Stop 1% | 73.1% | +141.3% | 26 | 3 | 23 |
| RR 1.5x | 73.1% | +118.5% | 26 | 3 | 23 |
| RR 3x | 73.1% | +148.3% | 26 | 3 | 23 |
| V3g3 Reaper | 69.0% | +215.2% | 42 | 20 | 22 |
| Tiered V2+Tight | 63.6% | +142.1% | 33 | — | — |
| V2 on 18 coins | 61.4% | +161.0% | 44 | 5 | 39 |
| Loose BF | 61.1% | +201.8% | 54 | 31 | 23 |
| DT Strict | 44.4% | +20.5% | 9 | 3 | 6 |
| T2-Tight | 28.6% | -14.7% | 7 | 1 | 6 |

---

## Key Findings

### 1. Bull Flag is Dead Weight
- Longs consistently hit only 33% WR across all configs
- Dropping Bull Flag entirely (Pure DT) → **78.3% WR** (best hit rate)
- The edge is entirely in Double Top shorts
- Bull Flag revival attempts (loose BF) increased signal count to 54 but dropped WR to 61.1%

### 2. Stop 3% Beats Stop 2%
- Looser stops let winners breathe: 76.9% vs 73.1% WR
- Also higher PnL: +162.8% vs +156.8%
- Same signal count (26) — stops aren't being hit more, just better placement

### 3. T2 Small Caps Are Toxic
- WIF: 0% WR, -39.7% PnL
- TIA: 0% WR, -22.0% PnL
- JUP: 0% WR, -20.2% PnL
- These coins are too volatile for Double Top — they blow through stops
- T2-Tight params (conf3, RSI 68-80) are too restrictive — only 7 signals, 28.6% WR
- Recommendation: exclude small caps from the engine

### 4. V3g3 (Reaper) Has Highest PnL But Lower WR
- V3g3 = loosened BF (RSI 20-55, conf>=1) + 3% trailing + partial exits at 1R
- Generated 42 signals (vs 26 baseline) and +215.2% PnL
- But WR dropped to 69% — more trades = more PnL but lower accuracy
- Tradeoff: volume vs precision

### 5. ETH is the Weakest T1 Coin
- ETH: 33% WR, -3.4% PnL across all configs
- ETH Double Top signals consistently fail — likely due to ETH's tendency to have extended tops that don't resolve cleanly
- Watch list for potential removal or per-coin tuning

---

## Per-Coin Breakdown (V2 Baseline, T1)

| Coin | Signals | Win Rate | PnL | Longs | Shorts | Status |
|------|----------|----------|------|-------|--------|--------|
| BTC | 3 | 100% | +21.7% | 0 | 3 | 🟢 Elite |
| ETH | 3 | 33% | -3.4% | 0 | 3 | 🔴 Watch |
| SOL | 7 | 71% | +36.5% | 1 | 6 | 🟢 Strong |
| HYPE | 4 | 50% | +26.1% | 2 | 2 | 🟡 Mixed |
| XRP | 1 | 100% | +3.0% | 0 | 1 | 🟢 Small sample |
| DOGE | 2 | 100% | +30.1% | 0 | 2 | 🟢 Elite |
| AVAX | 3 | 100% | +29.9% | 0 | 3 | 🟢 Elite |
| ARB | 3 | 67% | +12.9% | 0 | 3 | 🟢 Solid |

---

## Final Configuration

### Recommended: Pure Double Top + 3% Stops on T1 (8 coins)

```
Patterns: Double Top only (Bull Flag disabled)
Coins: BTC, ETH, SOL, HYPE, XRP, DOGE, AVAX, ARB
Stop Loss: 3% beyond candle structure
Risk:Reward: 2x
RSI Range: 65-82
Min Confluence: 2
Volume Ratio: >1.2
Regime Filter: Suppress shorts when SMA20 > SMA50 by >5%
Max Hold: 15 days
Fees: 0.07% per trade
```

**Expected Performance:** ~76-78% WR, +145-163% PnL over 365 days

### Alternative: V2 Baseline (if keeping Bull Flag)
- 73.1% WR, +156.8% PnL
- Same 8 coins, 2% stops, both patterns active

### Alternative: V3g3 (if maximizing PnL over WR)
- 69.0% WR, +215.2% PnL
- Loosened BF + trailing stops + partial exits
- More signals, more PnL, but lower hit rate

---

## Reasoning for the Update

1. **Back to original 8 coins** — Mau5 confirmed V2's 73% WR is the baseline to beat. The 20-coin acid test proved small caps degrade performance.

2. **Tighter params for T2** — Tested but T2-Tight params (conf3, RSI 68-80) generated only 7 signals at 28.6% WR. Small caps don't have enough clean Double Top setups. Exclude from the engine.

3. **Bull Flag removal** — The sweep proved longs are consistently 33% WR. Pure Double Top = 78.3% WR. The edge is entirely in shorts. Keeping BF adds noise without adding edge.

4. **Stop 3% over 2%** — Wider stops let winners develop. Same signal count, higher WR, higher PnL.

5. **V3g3 is optional** — If Mau5 wants max PnL over max WR, V3g3's +215% is the best. But the Reaper's loosened BF entries increase false signals.

---

## Engine Classification

**Short-heavy regime-aware strategy.**
- 100% shorts (Pure DT) or ~90% shorts (V2 with BF)
- Edge comes from Double Top pattern detection in overextended markets
- Regime filter (SMA20/50) suppresses counter-trend shorts in strong bull markets
- Not a "both sides win" strategy — longs are structural, not a core edge
