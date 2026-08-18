# Perps Alchemy

Turn volatility into gold. A perpetual futures trading education, practice, and execution mini-app for Print World.

**Author:** BigFootMau5 / Reaper Mau5 (#44)
**Tagline:** *"Every liquidation is tuition. Pay attention."* — Professor BigFoot

---

## What this is

`index.html` is the complete, single-file Perps Alchemy application:

- **Personal AI Professor (BigFoot)** — rotating quotes, coaching memory, weekly reviews
- **Daily Call** — algorithmic honest daily setup (BTC / ETH / SOL / HYPE / rotating alt)
- **Reaper's 5-Pick Lineup** — dual daily crypto + stock lineups with live Hyperliquid data
- **Paper trading** up to 5000x leverage — safe practice with real Binance/Coinbase candles
- **Live Perps** — Hyperliquid mark price, funding, OI, whale prints (>$250k), live tape
- **Playbook** — 40 pattern setups with animated SVG lessons and pattern trainer
- **Multi-timeframe scanner, options, arb, liquidation heatmap, cross-exchange funding divergence**
- **My Book** — unified P&L across Hyperliquid perps + Solana spot + paper account
- **Reaper Points** — hash-chained rewards ledger, streaks, achievements (35 badges)
- **Weekly League** — race 7 AI bots on deterministic seeded PnL (Monday UTC reset)
- **Feature Unlock Levels** — 7 tiers Rookie → Dragon, XP-gated leverage caps
- **Emotional Checkpoint Gate** — 3-second mood check blocks tilt trades
- **Graduation System** — 6-criteria gate to unlock live-trade buttons
- **Community scaffold** — leaderboard, study groups, peer review, mentor program, Caller Studio (activates the moment Server App backend opens)
- **Music engine** — in-browser synthesized focus tracks
- **Cosmic cycles** — moon phase / astro overlays for the superstitious

Everything is a single self-contained HTML file — no npm, no bundler, CDN-only. Print World mini-app SDK via `window.PW.*` with `localStorage` fallback for local testing.

---

## How to run

### Local
```bash
python3 -m http.server 8080
# open http://localhost:8080/index.html
```

### GitHub Pages
1. Create a new repo (public)
2. Push these files
3. Settings → Pages → Deploy from branch → `main` / `root`
4. Your site: `https://<user>.github.io/<repo>/`

### Print World
Upload the file through the Reaper Studio publish flow — the app already targets the Print World iframe environment (Solana wallet integration, PW.transferSol, PW.setStorage, etc.).

---

## Tech notes

- ~47,600 lines / ~2.3 MB, all in one HTML file
- Zero build step. Open in a browser, it runs.
- Uses CDN-only dependencies (no npm)
- Mobile-first CSS (works iPhone SE → desktop)
- Live data: Binance REST, Hyperliquid `/info` endpoint, alternative.me (F&G index), CoinDesk + Cointelegraph RSS (via rss2json)
- Music synthesized in-browser — no copyrighted tracks
- Voice chat uses `SpeechRecognition` API — iOS Safari support is parent-context only, not cross-origin iframes

---

## License

All rights reserved. Contact BigFootMau5 / Reaper Mau5 (#44) for licensing.

---

## Roadmap (shipped)

- ✅ Wave 1 — Futuristic obsidian + gold aesthetic tokens
- ✅ Wave 2 — Visual Trade Replay, Pattern Trainer, Daily Briefing
- ✅ Wave 3 — Weekly League, Feature Unlock Levels, Risk Sim, Coach Memory, Weekly Reviews
- ✅ Wave 4 — Trade Plan Templates, What-If Simulator, Analytics Dashboard
- ✅ Wave 5 — Emotional Gate, Graduation System, 35-badge Achievement Expansion
- ✅ Wave 6 — Full mobile-fit pass, glass reskin across every panel
- ✅ Animated pattern lessons (10s SVG per setup)
- ✅ Backend-ready Social Layer scaffold

## Roadmap (waiting)

- Server App backend flip (community feeds, leaderboards, Caller Studio publishing) — one-flag deploy the moment Print World enables it
