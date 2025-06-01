// Background script to control when the popup is available

// Map service URL patterns
const mapServicePatterns = [
    /^https?:\/\/maps\.google\.com\//,
    /^https?:\/\/www\.google\.com\/maps\//,
    /^https?:\/\/www\.openstreetmap\.org\//,
    /^https?:\/\/www\.bing\.com\/maps\//,
    /^https?:\/\/www\.mapillary\.com\//
];

function isMapServiceUrl(url) {
    return mapServicePatterns.some(pattern => pattern.test(url));
}

// Update extension icon and popup availability when tab changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        updateExtensionState(tabId, tab.url);
    }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url) {
            updateExtensionState(activeInfo.tabId, tab.url);
        }
    });
});

function updateExtensionState(tabId, url) {
    if (isMapServiceUrl(url)) {
        // Enable popup and set normal icon
        chrome.action.setPopup({ tabId: tabId, popup: 'popup.html' });
        chrome.action.enable(tabId);
        chrome.action.setTitle({ 
            tabId: tabId, 
            title: 'Map Coordinate Extractor - Click to extract coordinates' 
        });
    } else {
        // Disable popup and set disabled state
        chrome.action.setPopup({ tabId: tabId, popup: '' });
        chrome.action.disable(tabId);
        chrome.action.setTitle({ 
            tabId: tabId, 
            title: 'Map Coordinate Extractor - Only works on map service websites' 
        });
    }
}

// Handle initial load
chrome.runtime.onStartup.addListener(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            updateExtensionState(tabs[0].id, tabs[0].url);
        }
    });
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            updateExtensionState(tabs[0].id, tabs[0].url);
        }
    });
});