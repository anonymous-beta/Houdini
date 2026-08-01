(function() {
    window.HoudiniBotCheck = function() {
        const checks = {
            webdriver: navigator.webdriver === true,
            phantom: !!window.callPhantom || !!window._phantom,
            selenium: !!window.__webdriver_script_fn || !!window.seleniumAlert,
            headlessUA: /Headless|PhantomJS|Selenium|Puppeteer/i.test(navigator.userAgent),
            noPlugins: navigator.plugins.length === 0,
            noMime: navigator.mimeTypes.length === 0,
            zeroOuter: window.outerWidth === 0 && window.outerHeight === 0,
            chromeObj: /Chrome/.test(navigator.userAgent) && !window.chrome,
            permissionQuick: false
        };
        
        // Test permissions API speed (automation often instant-resolves)
        if (navigator.permissions) {
            const start = performance.now();
            navigator.permissions.query({name: 'notifications'}).then(() => {
                checks.permissionQuick = (performance.now() - start) < 10;
            }).catch(() => {});
        }
        
        // Consistency check: Chrome should have chrome object
        const score = Object.values(checks).filter(Boolean).length;
        return { detected: score >= 2, score, details: checks };
    };
})();
