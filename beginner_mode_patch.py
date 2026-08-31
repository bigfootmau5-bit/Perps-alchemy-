"""
Perps Alchemy Patch — Beginner Mode + Toast Fix + Color Update
==============================================================
1. Local showToast() fallback — toasts always work, even without PW platform
2. Beginner Mode toggle in nav bar — simplifies UI for new users
3. Color scheme improvements — better contrast, modernized dark theme
"""

import re

with open('index.html', 'r') as f:
    html = f.read()

# ============================================================
# 1. LOCAL showToast() FALLBACK
# ============================================================
# Inject a local showToast function right after <body> tag
# This ensures toasts work even when the PW platform isn't loaded

toast_fallback = """
<!-- ====== BEGINNER MODE + TOAST FIX + COLOR UPDATE ====== -->
<style>
/* ===== TOAST SYSTEM ===== */
#pa-toast-container {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  max-width: 92vw;
}
.pa-toast {
  background: rgba(13, 13, 16, 0.95);
  border: 1px solid rgba(255, 222, 0, 0.3);
  border-radius: 10px;
  padding: 12px 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #F4F4F5;
  box-shadow: 0 4px 24px rgba(0,0,0,0.6);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  animation: pa-toast-slide 0.3s cubic-bezier(0.2, 0.9, 0.3, 1);
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.pa-toast.pa-toast-success {
  border-color: #10B981;
  box-shadow: 0 4px 24px rgba(16, 185, 129, 0.3);
}
.pa-toast.pa-toast-error {
  border-color: #ef4444;
  box-shadow: 0 4px 24px rgba(239, 68, 68, 0.3);
}
.pa-toast.pa-toast-warn {
  border-color: #f59e0b;
  box-shadow: 0 4px 24px rgba(245, 158, 11, 0.3);
}
.pa-toast.pa-toast-info {
  border-color: #22D3EE;
  box-shadow: 0 4px 24px rgba(34, 211, 238, 0.2);
}
.pa-toast.pa-toast-out {
  animation: pa-toast-out 0.3s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
}
@keyframes pa-toast-slide {
  from { opacity: 0; transform: translateY(-20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pa-toast-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(-20px) scale(0.95); }
}

/* ===== BEGINNER MODE ===== */
#beginner-mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(34, 211, 238, 0.08);
  border: 1px solid rgba(34, 211, 238, 0.25);
  border-radius: 10px;
  color: #22D3EE;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0.9, 0.3, 1);
  white-space: nowrap;
  user-select: none;
}
#beginner-mode-btn:hover {
  background: rgba(34, 211, 238, 0.15);
  border-color: #22D3EE;
  box-shadow: 0 0 12px rgba(34, 211, 238, 0.3);
}
#beginner-mode-btn.active {
  background: rgba(34, 211, 238, 0.2);
  border-color: #22D3EE;
  color: #22D3EE;
  box-shadow: 0 0 16px rgba(34, 211, 238, 0.4);
}

/* Beginner Mode UI changes — simplified, larger, clearer */
body.beginner-mode .tab {
  font-size: 14px !important;
  font-weight: 700 !important;
  padding: 10px 14px !important;
}
body.beginner-mode .tab .tab-badge {
  display: none !important;
}
/* Hide advanced tabs in beginner mode */
body.beginner-mode .tab[data-tab="vibe"],
body.beginner-mode .tab[data-tab="community"],
body.beginner-mode .tab[data-tab="book"] {
  display: none !important;
}
/* Simplify panels */
body.beginner-mode .pfd-dash-section-head {
  font-size: 16px !important;
}
body.beginner-mode input[type="number"],
body.beginner-mode select {
  font-size: 15px !important;
  padding: 10px 12px !important;
}
body.beginner-mode button {
  font-size: 14px !important;
  padding: 10px 16px !important;
}
/* Show beginner helper tooltips */
body.beginner-mode .beginner-tip {
  display: block !important;
}
.beginner-tip {
  display: none;
  font-size: 12px;
  color: #22D3EE;
  padding: 8px 12px;
  margin: 4px 0;
  background: rgba(34, 211, 238, 0.08);
  border-radius: 8px;
  border-left: 3px solid #22D3EE;
  font-weight: 500;
  line-height: 1.5;
}

/* ===== COLOR IMPROVEMENTS ===== */
/* Better contrast on dark theme */
[data-theme="dark"] {
  --bg-card: #161618 !important;
  --bg-inset: #1e1e22 !important;
  --border: #333335 !important;
  --fg-muted: #b0b8c4 !important;
  --accent-primary: #FFDE00 !important;
  --accent-success: #10B981 !important;
  --accent-danger: #ef4444 !important;
  --accent-info: #22D3EE !important;
  --accent-warn: #f59e0b !important;
  --accent-magenta: #ec4899 !important;
  --accent-purple: #8b5cf6 !important;
}
/* Slightly lighter card backgrounds for better depth */
[data-theme="dark"] .panel,
[data-theme="dark"] .card,
[data-theme="dark"] [class*="panel-"] {
  background: #161618 !important;
  border-color: rgba(255, 222, 0, 0.12) !important;
}
/* Gold accent improvements — more readable */
[data-theme="dark"] .tab.active {
  color: #FFDE00 !important;
  border-bottom-color: #FFDE00 !important;
}
[data-theme="dark"] button:not(.tab):not(.no-anim) {
  background: #1e1e22 !important;
  border: 1px solid #333335 !important;
  color: #e5e5e5 !important;
}
[data-theme="dark"] button:not(.tab):not(.no-anim):hover {
  background: #252528 !important;
  border-color: rgba(255, 222, 0, 0.3) !important;
}
/* Success/danger colors more vibrant */
[data-theme="dark"] .text-green,
[data-theme="dark"] [style*="color: #22c55e"],
[data-theme="dark"] [style*="color:#22c55e"] {
  color: #10B981 !important;
}
[data-theme="dark"] .text-red,
[data-theme="dark"] [style*="color: #ef4444"],
[data-theme="dark"] [style*="color:#ef4444"] {
  color: #ef4444 !important;
}
/* Light theme improvements */
[data-theme="light"] {
  --bg: #f8f9fa !important;
  --bg-card: #ffffff !important;
  --bg-inset: #f1f3f5 !important;
  --border: #dee2e6 !important;
  --fg-muted: #6c757d !important;
}
[data-theme="light"] .tab.active {
  color: #FFDE00 !important;
  border-bottom-color: #FFDE00 !important;
  background: rgba(255, 222, 0, 0.08) !important;
}
/* PFD theme color refresh */
:root {
  --pfd-bg-deep: #08080a !important;
  --pfd-bg-elev: #111114 !important;
  --pfd-gold: #FFDE00 !important;
  --pfd-cyan: #22D3EE !important;
  --pfd-green: #10B981 !important;
  --pfd-red: #ef4444 !important;
  --pfd-text: #F4F4F5 !important;
}
</style>

<!-- Toast container -->
<div id="pa-toast-container"></div>

<!-- Beginner Mode toggle button — injected into the tab bar -->
<script>
(function() {
  'use strict';

  // ===== LOCAL showToast() FALLBACK =====
  // Ensures toasts work even without the PW platform
  function _paShowToast(msg, duration, type) {
    var container = document.getElementById('pa-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pa-toast-container';
      container.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:92vw;';
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'pa-toast';
    if (type === 'success') toast.classList.add('pa-toast-success');
    else if (type === 'error' || type === 'danger') toast.classList.add('pa-toast-error');
    else if (type === 'warn' || type === 'warning') toast.classList.add('pa-toast-warn');
    else if (type === 'info') toast.classList.add('pa-toast-info');
    toast.textContent = msg;
    container.appendChild(toast);

    var ms = (typeof duration === 'number') ? duration : 4000;

    setTimeout(function() {
      toast.classList.add('pa-toast-out');
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, ms);
  }

  // Override showToast if not already defined
  if (typeof window.showToast !== 'function') {
    window.showToast = function(msg, duration, type) {
      _paShowToast(msg, duration, type);
    };
  }

  // Also override PW.showToast if PW exists but doesn't have it
  if (window.PW && typeof window.PW.showToast !== 'function') {
    window.PW.showToast = function(msg, type) {
      var dur = 4000;
      if (type === 'error' || type === 'danger') dur = 5000;
      if (type === 'success') dur = 3000;
      _paShowToast(msg, dur, type);
    };
  }

  // ===== BEGINNER MODE TOGGLE =====
  var beginnerEnabled = false;
  try {
    beginnerEnabled = localStorage.getItem('pa-beginner-mode') === 'true';
    if (!beginnerEnabled && window.PW && PW.getStorage) {
      beginnerEnabled = PW.getStorage('pa-beginner-mode') === 'true';
    }
  } catch(e) {}

  function applyBeginnerMode(enabled) {
    if (enabled) {
      document.body.classList.add('beginner-mode');
    } else {
      document.body.classList.remove('beginner-mode');
    }
    // Save preference
    try {
      localStorage.setItem('pa-beginner-mode', enabled ? 'true' : 'false');
      if (window.PW && PW.setStorage) PW.setStorage('pa-beginner-mode', enabled ? 'true' : 'false');
    } catch(e) {}
    // Update button state
    var btn = document.getElementById('beginner-mode-btn');
    if (btn) {
      if (enabled) {
        btn.classList.add('active');
        btn.textContent = '🎓 Beginner: ON';
      } else {
        btn.classList.remove('active');
        btn.textContent = '🎓 Beginner Mode';
      }
    }
    // Toast
    _paShowToast(enabled ? '🎓 Beginner Mode ON — simplified UI, larger text, tips visible' : '🎓 Beginner Mode OFF — full interface restored', 3000, 'info');
  }

  // Inject the beginner mode button into the tab bar
  function injectBeginnerButton() {
    var tabBar = document.querySelector('.tabs');
    if (!tabBar) return;
    if (document.getElementById('beginner-mode-btn')) return;

    var btn = document.createElement('div');
    btn.id = 'beginner-mode-btn';
    btn.className = 'no-anim';
    btn.style.cssText = 'flex-shrink:0;padding:8px 14px;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.25);border-radius:10px;color:#22D3EE;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.2s;white-space:nowrap;user-select:none;display:flex;align-items:center;gap:6px;margin-left:auto;';
    btn.textContent = beginnerEnabled ? '🎓 Beginner: ON' : '🎓 Beginner Mode';
    if (beginnerEnabled) btn.classList.add('active');
    btn.onclick = function(e) {
      e.stopPropagation();
      beginnerEnabled = !beginnerEnabled;
      applyBeginnerMode(beginnerEnabled);
    };
    tabBar.appendChild(btn);

    if (beginnerEnabled) {
      document.body.classList.add('beginner-mode');
    }
  }

  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBeginnerButton);
  } else {
    injectBeginnerButton();
  }

  // Also try after a delay in case DOMContentLoaded already fired
  setTimeout(injectBeginnerButton, 500);
  setTimeout(injectBeginnerButton, 2000);

  // ===== BEGINNER TIPS =====
  // Inject helpful tips into key panels
  function injectBeginnerTips() {
    if (!document.body.classList.contains('beginner-mode')) return;

    // Trade tab tip
    var tradePanel = document.querySelector('[data-tab="playbook"]') || document.querySelector('#panel-playbook');
    if (tradePanel && !document.querySelector('#beginner-tip-trade')) {
      var tip = document.createElement('div');
      tip.id = 'beginner-tip-trade';
      tip.className = 'beginner-tip';
      tip.innerHTML = '💡 <strong>New here?</strong> Start with Paper Trading to practice risk-free. Set your position size, pick long or short, and hit execute. No real money involved!';
      var panel = document.getElementById('panel-playbook');
      if (panel) panel.insertBefore(tip, panel.firstChild);
    }

    // Live tab tip
    var livePanel = document.getElementById('panel-live');
    if (livePanel && !document.querySelector('#beginner-tip-live')) {
      var tip2 = document.createElement('div');
      tip2.id = 'beginner-tip-live';
      tip2.className = 'beginner-tip';
      tip2.innerHTML = '💡 <strong>Live tab</strong> shows real-time BTC/ETH/SOL price action. The Ripper engine scans for high-leverage scalp setups — these are advanced signals, use with caution!';
      livePanel.insertBefore(tip2, livePanel.firstChild);
    }

    // Professor tab tip
    var coachPanel = document.getElementById('panel-coach');
    if (coachPanel && !document.querySelector('#beginner-tip-coach')) {
      var tip3 = document.createElement('div');
      tip3.id = 'beginner-tip-coach';
      tip3.className = 'beginner-tip';
      tip3.innerHTML = '💡 <strong>Your Professor</strong> coaches you through trades. Choose a style: Wise Mentor (patient), Drill Sergeant (tough love), Best Friend (encouraging), or Roast Master (hilarious roasts). Pick what motivates you!';
      coachPanel.insertBefore(tip3, coachPanel.firstChild);
    }
  }

  // Inject tips when beginner mode is active and when tabs are switched
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList && e.target.classList.contains('tab')) {
      setTimeout(injectBeginnerTips, 100);
    }
  });
  setTimeout(injectBeginnerTips, 1000);
  setTimeout(injectBeginnerTips, 3000);
})();
</script>
<!-- ====== END BEGINNER MODE + TOAST FIX + COLOR UPDATE ====== -->
"""

# Insert right after <body class="pfd-grid-bg">
body_tag = '<body class="pfd-grid-bg">'
if body_tag in html:
    html = html.replace(body_tag, body_tag + '\n' + toast_fallback, 1)
    print("✅ Injected toast fallback + beginner mode + color update after <body>")
else:
    # Try alternate body tag
    import re
    match = re.search(r'<body[^>]*>', html)
    if match:
        pos = match.end()
        html = html[:pos] + '\n' + toast_fallback + html[pos:]
        print("✅ Injected after <body> tag (regex match)")
    else:
        print("❌ Could not find <body> tag")

# Write the updated file
with open('index.html', 'w') as f:
    f.write(html)

print(f"\nFile size: {len(html):,} chars")
print("Done!")
