#!/usr/bin/env node
/**
 * PERPS ALCHEMY — Acid Test Suite (Node port, BIGagent404 for BigFootMau5)
 * Faithful 1:1 port of acid-test-suite.py — same checks, same verdict law.
 * Outputs a single JSON line, identical shape to the Python suite.
 *
 * Usage:
 *   node acid-test-suite.node.js            # full suite
 *   node acid-test-suite.node.js --slot AM  # same, records the slot name
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
let slotArg = null;
if (args.includes("--slot")) {
  const i = args.indexOf("--slot");
  if (i + 1 < args.length) slotArg = args[i + 1];
}

const HERE = __dirname;
const CANON = path.join(HERE, "..", "..", "index.html"); // repo canon build
const URL_CFG = path.join(HERE, "live_url.txt");          // fallback; defaults to the live Pages deploy

const now = new Date();
const res = {
  run_date: now.toISOString().slice(0, 10),
  slot: slotArg || (now.getUTCHours() < 12 ? "AM" : "PM"),
  checks_passed: 0,
  checks_total: 0,
  ui_ok: false, api_price_ok: false, api_fng_ok: false, api_news_ok: false,
  acid_score: 0, acid_test: "FAIL",
  target_url: "local build", notes: [],
};

function check(name, ok, note = "") {
  res.checks_total += 1;
  if (ok) {
    res.checks_passed += 1;
  } else {
    res.notes.push(`${name} failed${note ? ": " + note : ""}`);
  }
  return ok;
}

// ---------- 1) APP BUILD INTEGRITY (local canon copy) ----------
try {
  const html = fs.readFileSync(CANON, "utf8");
  check("title", html.includes("Perps Alchemy"));
  check("professor_persona", html.includes("Professor") || html.includes("professor"));
  check("coach_personas", html.includes("Roast") && html.includes("Mentor"));
  check("voice_system", html.includes("SpeechRecognition") || html.toLowerCase().includes("speech"));
  check("music_modes", html.includes("Lofi"));
  check("xp_system", html.includes("XP"));
  check("risk_rating_ui", html.toLowerCase().includes("skull") || html.toLowerCase().includes("risk"));
  check("gold_hex_fixed", !html.includes("#FFD700")); // old-gold hex should be gone
  // ---- MAU5 BUILD (Sept 14) — new feature checks (1:1 with the Python suite) ----
  check("ws_ticker", html.includes("pfd-ws-ticker") && html.includes("pfd-ws-track"), "Wall Street ticker strip");
  check("tab_dropdown_nav", html.includes("pfd-tab-dd-menu") && html.includes("pfd-tab-dd-item"), "top-tab dropdown accordion nav");
  check("rerolled_kept", html.includes("preRerollStatus") && html.includes("rerolledAt"), "re-rolled calls kept in history");
  check("wr_denominators", html.includes("allDaysWinRate") && html.includes("all-days"), "decisive WR + all-days WR + n=");
  check("shared_record", html.includes("record.json") && html.includes("CANONICAL RECORD"), "shared canonical track record");
  res.ui_ok = res.checks_passed === res.checks_total;
} catch (e) {
  if (e && e.code === "ENOENT") {
    check("app_file", false, "canon copy missing");
  } else {
    check("app_file", false, String(e).slice(0, 120));
  }
  res.ui_ok = false;
}

// ---------- 2) LIVE DATA PIPELINE ----------
async function fetchCheck(name, url, bodyCheck, okMutator = null) {
  const t0 = Date.now();
  let ok = false, code = 0, body = "";
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "BIGagent404-PerpsQA/1.0" },
      signal: AbortSignal.timeout(12000),
    });
    code = r.status;
    body = (await r.text()).slice(0, 512 * 1024);
    ok = r.status === 200 && bodyCheck(body);
  } catch (_) { /* network failure -> ok stays false */ }
  const ms = Date.now() - t0;
  check(name, ok, `HTTP ${code} ${ms}ms`);
  if (okMutator) okMutator(ok, body);
}

(async () => {
  await fetchCheck("coinbase_btc",
    "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400",
    () => true,
    (ok) => { res.api_price_ok = ok; });

  await fetchCheck("fear_greed",
    "https://api.alternative.me/fng/",
    (b) => b.includes("value"),
    (ok) => { res.api_fng_ok = ok; });

  await fetchCheck("news_rss",
    "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fcointelegraph.com%2Frss",
    (b) => b.includes("items") || b.includes("status"),
    (ok) => { res.api_news_ok = ok; });

  await fetchCheck("coingecko",
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    (b) => b.includes("bitcoin"));

  // ---------- 3) LIVE DEPLOYMENT (if URL configured) ----------
  let live = "";
  if (fs.existsSync(URL_CFG)) live = fs.readFileSync(URL_CFG, "utf8").trim();
  if (!live) live = "https://mcontwitter-glitch.github.io/perps-alchemy-test/"; // default: live GitHub Pages deploy
  await fetchCheck("live_site", live, () => true);
  res.target_url = live;

  // ---------- verdict ----------
  const ratio = res.checks_passed / Math.max(res.checks_total, 1);
  res.acid_score = Math.round(ratio * 100);
  // ACID TEST LAW (Mau5, Sept 7 2026): 69% = FAIL, anything above 69% = PASS
  res.acid_test = res.acid_score > 69 ? "PASS" : "FAIL";
  res.status = res.acid_test === "PASS" ? "Pass" : "Fail";
  res.notes = (res.notes.join("; ").slice(0, 500)) || "all green";
  console.log(JSON.stringify(res));
})();
