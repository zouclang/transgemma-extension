// TransGemma Service Worker
// Background script for Chrome Extension

chrome.runtime.onInstalled.addListener(() => {
    // Initialize default settings
    chrome.storage.sync.get(['hoverEnabled', 'selectEnabled', 'sourceLang', 'targetLang'], (result) => {
        const defaults = {
            hoverEnabled: result.hoverEnabled !== undefined ? result.hoverEnabled : true,
            selectEnabled: result.selectEnabled !== undefined ? result.selectEnabled : true,
            sourceLang: result.sourceLang || 'auto',
            targetLang: result.targetLang || 'English'
        };
        chrome.storage.sync.set(defaults);
    });

    console.log('TransGemma extension installed');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'translate') {
        translateText(request.text, request.from, request.to)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
    }
});

async function translateText(text, fromLang, toLang) {
    const response = await fetch('https://transgemma-api.godii.xyz/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'translategemma:latest',
            prompt: `Translate from ${fromLang} to ${toLang}. Only provide the translation:\n\n${text}`,
            stream: false
        })
    });

    if (!response.ok) throw new Error('API request failed');

    const data = await response.json();
    return data.response;
}
