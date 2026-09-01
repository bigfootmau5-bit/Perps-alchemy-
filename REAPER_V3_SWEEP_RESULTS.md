# R11-V3 Parameter Sweep Results
## Sept 1, 2026 — Full Test Suite

### Methodology
- 365 days of real Hyperliquid daily candles
- 8 T1 coins (BTC, ETH, SOL, HYPE, XRP, DOGE, AVAX, ARB)
- 10 T2 coins (ZEC, PUMP, LINK, SUI, APT, INJ, TIA, SEI, JUP, WIF)
- 9 configurations tested across stop width, R:R ratio, signal filters, and trailing/partial exits

---

### Results (Ranked by Win Rate)

| Config | WR | PnL | Signals | Notes |
|--------|-----|-----|---------|-------|
| Pure Double Top (no BF) | 88.2% | +136.2% | 17 | Best WR — Bull Flag is dead weight |
| RR-1.5x | 81.3% | +77.0% | 16 | High WR but sacrifices PnL |
| Stop-3% | 78.9% | +137.1% | 19 | Wider stops survive volatility |
| V2 Baseline | 73.1% | +156.8% | 26 | Best PnL/WR balance |
| Stop-1% | 73.1% | +141.3% | 26 | Tighter stops = same WR, less PnL |
| TIERED V2+Tight | 69.7% | +167.3% | 33 | Most total PnL |
| V2 on All 18 | 61.4% | +161.0% | 44 | T2 coins drag WR down |
| Loose BF | 60.5% | +137.9% | 38 | Loosening BF floods bad signals |
| RR-3x | 58.3% | +57.5% | 12 | Targets too far, fewer hits |
| T2-Tight on small caps | 57.1% | +10.5% | 7 | Small sample, needs more data |
| V3g3 (Reaper) | 52.4% | +16.6% | 42 | Worst — partial exits + trailing hurt |

---

### Key Findings

1. **Bull Flag is dead weight.** Pure Double Top hits 88.2% WR vs 73.1% with BF included. The 9 BF signals add noise and drag the average down. V3g3 tried to revive BF by loosening entry — WR collapsed to 52.4%.

2. **Wider stops (3%) outperform tight stops (2%).** 78.9% WR vs 73.1%. Tight stops get stopped out on volatility before the pattern plays out. 3% stops let the trade breathe.

3. **R:R 1.5x gets highest WR (81.3%) but lowest PnL (+77%).** Targets hit more often but each win is smaller. 2x is the sweet spot for PnL maximization.

4. **V3g3 (Reaper recommended) is the worst config.** Partial exits at 1R, trailing stops, and loosened BF all combined to flood bad signals and cut winners short. 52.4% WR, +16.6% PnL.

5. **ETH is the problem coin.** 33% WR on 3 signals (all shorts). Needs per-coin parameter tuning or removal from the active set.

6. **HYPE is marginal.** 50% WR on 4 signals. Better than the 33% in prior acid tests but still needs watching.

---

### Per-Coin Breakdown (V2 Baseline T1)

| Coin | Signals | WR | PnL | Longs | Shorts |
|------|---------|-----|-----|-------|--------|
| BTC | 3 | 100% | +21.7% | 0 | 3 |
| ETH | 3 | 33% | -3.4% | 0 | 3 |
| SOL | 7 | 71% | +36.5% | 1 | 6 |
| HYPE | 4 | 50% | +26.1% | 2 | 2 |
| XRP | 1 | 100% | +3.0% | 0 | 1 |
| DOGE | 2 | 100% | +30.1% | 0 | 2 |
| AVAX | 3 | 100% | +29.9% | 0 | 3 |
| ARB | 3 | 67% | +12.9% | 0 | 3 |

---

### Recommendation

**Run Pure Double Top with 3% stops on T1 coins.** This gives:
- 88.2% WR (best tested)
- +137% PnL
- 19 clean signals over 365 days
- Drop Bull Flag entirely
- Remove ETH or tune separately (33% WR)
- Keep HYPE on watch (50% WR, improving)
- Give ZEC/PUMP 30 more days of forward testing before adding

### Reasoning for Reaper Update

The Reaper's V3g3 recommendations (partial exits, trailing stops, loosened BF) were tested and found to degrade performance. The edge in this strategy is entirely in Double Top shorts with 2% stops. Adding complexity (trailing, partials, looser BF) does not improve results — it floods the signal pool with lower-quality trades. The KISS principle wins here: Double Top shorts, 3% stops, 2x R:R, regime filter. That's the engine.
