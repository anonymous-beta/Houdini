(function() {
    // Weighted detection: automation-indicating signals score 2,
    // weak signals (empty plugin list also happens on Safari) score 1
    // and only count on Chromium-family browsers.
    window.HoudiniBotCheck = function() {
        const isChromium = /Chrome|Chromium|Edg\//.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !isChromium;

        const checks = {
            webdriver: navigator.webdriver === true,                        // weight 2
            phantom: !!window.callPhantom || !!window._phantom,             // weight 2
            selenium: !!window.__webdriver_script_fn || !!window.seleniumAlert, // weight 2
            headlessUA: /Headless|PhantomJS|Selenium|Puppeteer|Playwright/i.test(navigator.userAgent), // weight 2
            zeroOuter: window.outerWidth === 0 && window.outerHeight === 0, // weight 1
            chromeObj: isChromium && !window.chrome,                        // weight 2
            plugins: (isChromium && !isSafari &&
                      navigator.plugins.length === 0 &&
                      navigator.mimeTypes.length === 0)                     // weight 1
        };

        const score =
            (checks.webdriver ? 2 : 0) +
            (checks.phantom ? 2 : 0) +
            (checks.selenium ? 2 : 0) +
            (checks.headlessUA ? 2 : 0) +
            (checks.zeroOuter ? 1 : 0) +
            (checks.chromeObj ? 2 : 0) +
            (checks.plugins ? 1 : 0);

        return { detected: score >= 3, score, details: checks };
    };
})();