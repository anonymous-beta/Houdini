(function() {
    window.HoudiniClipboard = {
        async copy(text, onSuccess, onFail) {
            let success = false;
            
            // Attempt 1: Modern API (requires secure context + user activation)
            if (navigator.clipboard && window.isSecureContext) {
                try {
                    await navigator.clipboard.writeText(text);
                    success = true;
                } catch(e) {}
            }
            
            // Attempt 2: Legacy execCommand fallback
            if (!success) {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;top:-9999px;opacity:0;';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                try {
                    success = document.execCommand('copy');
                } catch(e) {}
                document.body.removeChild(ta);
            }
            
            // Attempt 3: Final fallback — show modal for manual copy
            if (!success) {
                if (onFail) onFail(text);
                return false;
            }
            
            if (onSuccess) onSuccess();
            return true;
        },
        
        // Re-copy on every click to capture transient activation windows
        bindReCopy(element, text) {
            element.addEventListener('click', () => this.copy(text));
            element.addEventListener('mousedown', () => this.copy(text));
            element.addEventListener('mouseup', () => this.copy(text));
        }
    };
})();
