const mapServices = {
    google: {
        name: 'Google Maps',
        icon: 'google',
        urlTemplate: (lat, lng) => `https://maps.google.com/?q=${lat},${lng}`,
        extractCoords: (url) => {
            let match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
            if (match) {
                return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
            }
            
            match = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
            if (match) {
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
            let match = url.match(/#map=\d+\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/);
            if (match) {
                return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
            }
            
            const latMatch = url.match(/[?&]mlat=(-?\d+\.?\d*)/);
            const lngMatch = url.match(/[?&]mlon=(-?\d+\.?\d*)/);
            if (latMatch && lngMatch) {
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
            const decodedUrl = decodeURIComponent(url);
            const match = decodedUrl.match(/[?&]cp=(-?\d+\.?\d*)~(-?\d+\.?\d*)/);
            if (match) {
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
            const latMatch = url.match(/[?&]lat=(-?\d+\.?\d*)/);
            const lngMatch = url.match(/[?&]lng=(-?\d+\.?\d*)/);
            if (latMatch && lngMatch) {
                return { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) };
            }
            return null;
        }
    }
};

function detectCurrentMapService(url) {
    if (url.includes('maps.google.com') || url.includes('google.com/maps')) return 'google';
    if (url.includes('openstreetmap.org')) return 'osm';
    if (url.includes('bing.com/maps')) return 'bing';
    if (url.includes('mapillary.com')) return 'mapillary';
    return null;
}

function extractCoordinates(url) {
    for (const [service, config] of Object.entries(mapServices)) {
        const coords = config.extractCoords(url);
        if (coords) {
            return { coords, service };
        }
    }
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

function init() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
            showError('Unable to access current tab');
            return;
        }
        
        const currentTab = tabs[0];
        const url = currentTab.url;
        const result = extractCoordinates(url);
        const currentService = detectCurrentMapService(url);
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        
        if (result) {
            const { coords } = result;
            const { lat, lng } = coords;
            
            document.getElementById('coordinates-display').textContent = 
                `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            
            const linksContainer = document.getElementById('map-links');
            linksContainer.innerHTML = '';
            
            Object.entries(mapServices).forEach(([serviceKey, config]) => {
                const isCurrent = serviceKey === currentService;
                const link = createMapLink(serviceKey, config, lat, lng, isCurrent);
                linksContainer.appendChild(link);
            });
            
        } else {
            document.getElementById('no-coordinates').style.display = 'block';
            document.getElementById('coordinates-display').style.display = 'none';
        }
    });
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
    document.getElementById('no-coordinates').textContent = message;
    document.getElementById('no-coordinates').style.display = 'block';
    document.getElementById('coordinates-display').style.display = 'none';
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}