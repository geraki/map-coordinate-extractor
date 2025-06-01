console.log('Popup script started');

// Map service configurations
const mapServices = {
    google: {
        name: 'Google Maps',
        icon: 'google',
        urlTemplate: (lat, lng) => `https://maps.google.com/?q=${lat},${lng}`,
        extractCoords: (url) => {
            console.log('Checking Google Maps patterns in:', url);
            // Google Maps patterns: /@lat,lng,zoom or ?q=lat,lng
            let match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
            if (match) {
                console.log('Found Google Maps @ pattern:', match);
                return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
            }
            
            match = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
            if (match) {
                console.log('Found Google Maps q= pattern:', match);
                return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
            }
            
            return null;
        }
    },
    osm: {
        name: 'OpenStreetMap',
        icon: 'osm',
        urlTemplate: (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`,
        extractCoords: (url) => {
            console.log('Checking OSM patterns in:', url);
            // OSM patterns: #map=zoom/lat/lng or ?mlat=lat&mlon=lng
            let match = url.match(/#map=\d+\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/);
            if (match) {
                console.log('Found OSM #map pattern:', match);
                return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
            }
            
            const latMatch = url.match(/[?&]mlat=(-?\d+\.?\d*)/);
            const lngMatch = url.match(/[?&]mlon=(-?\d+\.?\d*)/);
            if (latMatch && lngMatch) {
                console.log('Found OSM mlat/mlon pattern:', latMatch, lngMatch);
                return { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) };
            }
            
            return null;
        }
    },
    bing: {
        name: 'Bing Maps',
        icon: 'bing',
        urlTemplate: (lat, lng) => `https://www.bing.com/maps?cp=${lat}~${lng}&lvl=15`,
        extractCoords: (url) => {
            console.log('Checking Bing patterns in:', url);
            // Bing Maps patterns: ?cp=lat~lng
            const match = url.match(/[?&]cp=(-?\d+\.?\d*)~(-?\d+\.?\d*)/);
            if (match) {
                console.log('Found Bing cp= pattern:', match);
                return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
            }
            
            return null;
        }
    },
    mapillary: {
        name: 'Mapillary',
        icon: 'mapillary',
        urlTemplate: (lat, lng) => `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=15`,
        extractCoords: (url) => {
            console.log('Checking Mapillary patterns in:', url);
            // Mapillary patterns: ?lat=lat&lng=lng
            const latMatch = url.match(/[?&]lat=(-?\d+\.?\d*)/);
            const lngMatch = url.match(/[?&]lng=(-?\d+\.?\d*)/);
            if (latMatch && lngMatch) {
                console.log('Found Mapillary lat/lng pattern:', latMatch, lngMatch);
                return { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) };
            }
            
            return null;
        }
    }
};

function detectCurrentMapService(url) {
    console.log('Detecting map service for:', url);
    if (url.includes('maps.google.com') || url.includes('google.com/maps')) return 'google';
    if (url.includes('openstreetmap.org')) return 'osm';
    if (url.includes('bing.com/maps')) return 'bing';
    if (url.includes('mapillary.com')) return 'mapillary';
    return null;
}

function extractCoordinates(url) {
    console.log('Extracting coordinates from:', url);
    for (const [service, config] of Object.entries(mapServices)) {
        const coords = config.extractCoords(url);
        if (coords) {
            console.log('Found coordinates:', coords, 'from service:', service);
            return { coords, service };
        }
    }
    console.log('No coordinates found');
    return null;
}

function createMapLink(service, config, lat, lng, isCurrent = false) {
    const link = document.createElement('a');
    link.href = config.urlTemplate(lat, lng);
    link.target = '_blank';
    link.className = `map-link ${isCurrent ? 'current' : ''}`;
    
    link.innerHTML = `
        <div class="map-icon ${config.icon}"></div>
        <span class="map-name">${config.name}${isCurrent ? ' (Current)' : ''}</span>
    `;
    
    return link;
}

// Main execution
function init() {
    console.log('Init function started');
    
    // Try to access chrome.tabs
    if (!chrome || !chrome.tabs) {
        console.error('Chrome tabs API not available');
        showError('Chrome extension API not available');
        return;
    }
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        console.log('Chrome tabs query result:', tabs);
        
        if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            showError(`Chrome error: ${chrome.runtime.lastError.message}`);
            return;
        }
        
        if (!tabs || tabs.length === 0) {
            console.error('No active tabs found');
            showError('No active tab found');
            return;
        }
        
        const currentTab = tabs[0];
        const url = currentTab.url;
        
        console.log('Current tab:', currentTab);
        console.log('Current URL:', url);
        
        const result = extractCoordinates(url);
        const currentService = detectCurrentMapService(url);
        
        console.log('Extraction result:', result);
        console.log('Current service:', currentService);
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        
        if (result) {
            const { coords, service } = result;
            const { lat, lng } = coords;
            
            console.log('Displaying coordinates:', lat, lng);
            
            // Display coordinates
            document.getElementById('coordinates-display').textContent = 
                `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            
            // Create links for all map services
            const linksContainer = document.getElementById('map-links');
            linksContainer.innerHTML = ''; // Clear existing links
            
            Object.entries(mapServices).forEach(([serviceKey, config]) => {
                const isCurrent = serviceKey === currentService;
                const link = createMapLink(serviceKey, config, lat, lng, isCurrent);
                linksContainer.appendChild(link);
            });
            
        } else {
            console.log('No coordinates found, showing no-coordinates message');
            document.getElementById('no-coordinates').style.display = 'block';
            document.getElementById('coordinates-display').style.display = 'none';
        }
    });
}

function showError(message) {
    console.log('Showing error:', message);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
    document.getElementById('no-coordinates').textContent = message;
    document.getElementById('no-coordinates').style.display = 'block';
    document.getElementById('coordinates-display').style.display = 'none';
}

// Wait for DOM to be ready
console.log('Document ready state:', document.readyState);
if (document.readyState === 'loading') {
    console.log('Waiting for DOM content loaded');
    document.addEventListener('DOMContentLoaded', init);
} else {
    console.log('DOM already ready, calling init');
    init();
}