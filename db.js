const Database = require('better-sqlite3');
const config = require('./config');

const db = new Database(config.DB_PATH);

// Initialize schema
db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
        id TEXT PRIMARY KEY,
        ip TEXT NOT NULL,
        user_agent TEXT,
        os_detected TEXT,
        os_confirmed TEXT,
        created_at INTEGER,
        expires_at INTEGER,
        stages TEXT,        -- JSON array of {stage, timestamp, meta}
        executed INTEGER DEFAULT 0,
        callback_data TEXT,
        bot_flag INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS bot_hits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT,
        user_agent TEXT,
        reason TEXT,
        timestamp INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS config_state (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_tokens_ip ON tokens(ip);
    CREATE INDEX IF NOT EXISTS idx_tokens_expires ON tokens(expires_at);
`);

// Prepared statements for performance
const stmts = {
    insertToken: db.prepare(`
        INSERT INTO tokens (id, ip, user_agent, os_detected, os_confirmed, created_at, expires_at, stages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    
    getToken: db.prepare(`SELECT * FROM tokens WHERE id = ?`),
    
    updateStages: db.prepare(`
        UPDATE tokens SET stages = ? WHERE id = ?
    `),
    
    markExecuted: db.prepare(`
        UPDATE tokens SET executed = 1, callback_data = ? WHERE id = ?
    `),
    
    flagBot: db.prepare(`
        INSERT INTO bot_hits (ip, user_agent, reason, timestamp) VALUES (?, ?, ?, ?)
    `),
    
    getStats: db.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN executed = 1 THEN 1 ELSE 0 END) as executed,
            SUM(bot_flag) as bots
        FROM tokens
        WHERE created_at > ?
    `),
    
    getRecent: db.prepare(`
        SELECT * FROM tokens ORDER BY created_at DESC LIMIT 50
    `),
    
    purgeExpired: db.prepare(`DELETE FROM tokens WHERE expires_at < ?`),
    
    setState: db.prepare(`INSERT OR REPLACE INTO config_state (key, value) VALUES (?, ?)`),
    getState: db.prepare(`SELECT value FROM config_state WHERE key = ?`)
};

module.exports = { db, stmts };
