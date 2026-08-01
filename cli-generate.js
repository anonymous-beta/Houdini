const crypto = require('crypto');
const { db, stmts } = require('./db');
const config = require('./config');

const args = process.argv.slice(2);
const ip = args[0] || '0.0.0.0';
const os = args[1] || 'Windows';
const ttl = parseInt(args[2]) || config.TOKEN_TTL;

const token = config.TOKEN_PREFIX + crypto.randomBytes(16).toString('hex');
const now = Date.now();

stmts.insertToken.run(
    token,
    ip,
    'CLI-generated',
    os,
    os,
    now,
    now + ttl,
    JSON.stringify([{stage: 'generated', timestamp: now, meta: {source: 'cli'}}])
);

console.log(`[Houdini] Token generated:`);
console.log(`  Token: ${token}`);
console.log(`  URL:   ${config.SERVER_URL}/?t=${token}`);
console.log(`  IP:    ${ip}`);
console.log(`  OS:    ${os}`);
console.log(`  Exp:   ${new Date(now + ttl).toISOString()}`);
