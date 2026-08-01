const crypto = require('crypto');

// Scramble PowerShell without touching base64 or %ENV% syntax
function scramblePowerShell(code, token) {
    const vars = 'abcdefghjkmnpqrstuvwxyz'.split('');
    const used = new Set();
    const map = {};
    
    // Extract existing variables (simple regex, avoids $env:)
    const varMatches = code.match(/\$[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    varMatches.forEach(v => {
        const clean = v.slice(1);
        if (clean.startsWith('env:')) return; // NEVER touch %ENV%
        if (!map[clean]) {
            let replacement;
            do {
                replacement = vars[Math.floor(Math.random() * vars.length)] + 
                             vars[Math.floor(Math.random() * vars.length)];
            } while (used.has(replacement));
            used.add(replacement);
            map[clean] = replacement;
        }
    });
    
    let obfuscated = code;
    Object.keys(map).forEach(original => {
        obfuscated = obfuscated.replace(new RegExp(`\\$${original}\\b`, 'g'), `$${map[original]}`);
    });
    
    // Inject random comments (PowerShell # comments)
    const lines = obfuscated.split(';');
    const withComments = lines.map(line => {
        if (Math.random() > 0.7 && line.trim()) {
            const noise = crypto.randomBytes(4).toString('hex');
            return `${line} #${noise}`;
        }
        return line;
    });
    
    return withComments.join(';');
}

// Watermark: embed token signature via whitespace patterns
function watermark(code, token) {
    // Use token hash to determine tab vs space indentation in first 5 lines
    const hash = crypto.createHash('md5').update(token).digest('hex');
    const lines = code.split('\n');
    const watermarked = lines.map((line, i) => {
        if (i < 5 && line.trim()) {
            const useTab = parseInt(hash[i], 16) % 2 === 0;
            const indent = line.match(/^\s*/)[0];
            const newIndent = indent.replace(/  /g, useTab ? '\t' : '  ');
            return line.replace(/^\s*/, newIndent);
        }
        return line;
    });
    return watermarked.join('\n');
}

module.exports = { scramblePowerShell, watermark };
