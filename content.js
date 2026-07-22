// Content script for map coordinate extraction
// This runs on map service pages and can be extended for additional functionality

console.log('Map Coordinate Extractor: Content script loaded on', window.location.href);

// Listen for messages from popup if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getCurrentUrl') {
        sendResponse({ url: window.location.href });
    }
    
    if (request.action === 'extractCoordinates') {
        // This could be extended to extract coordinates using page-specific methods
        // For now, URL parsing in popup.js handles most cases
        sendResponse({ url: window.location.href });
    }
});

// Optional: Monitor URL changes for single-page applications
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('URL changed to:', url);
        // Could notify popup or perform other actions here
    }
}).observe(document, { subtree: true, childList: true });