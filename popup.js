// Updated popup.js with dynamic zoom extraction

const mapServices = {
    google: {
        name: 'Google Maps',
        icon: 'google',
        urlTemplate: (lat, lng, zoom = 15) => `https://maps.google.com/?q=${lat},${lng}&z=${zoom}`,
        extractCoords: (url) => {
            // Google Maps URLs typically look like:
            // @40.583507,22.990077,15z or @40.583507,22.990077,15.5z
            // @40.583507,22.990077,15.25z/data=... (more complex)
            
            let match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)z/);
            if (match) {
                return { 
                    lat: parseFloat(match[1]), 
                    lng: parseFloat(match[2]),
                    zoom: parseFloat(match[3])
                };
            }
            
            // Sometimes zoom appears in a different format like @lat,lng,zoom.xxz
            match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+)(?:\.\d+)?z/);
            if (match) {
                return { 
                    lat: parseFloat(match[1]), 
                    lng: parseFloat(match[2]),
                    zoom: parseFloat(match[3])
                };
            }
            
            // Fallback: coordinates without zoom
            match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
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
        urlTemplate: (lat, lng, zoom = 15) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`,
        extractCoords: (url) => {
            let match = url.match(/#map=(\d+\.?\d*)\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/);
            if (match) {
                return { 
                    lat: parseFloat(match[2]), 
                    lng: parseFloat(match[3]),
                    zoom: parseFloat(match[1])
                };
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
        urlTemplate: (lat, lng, zoom = 15) => `https://www.bing.com/maps?cp=${lat}~${lng}&lvl=${zoom}`,
        extractCoords: (url) => {
            const decodedUrl = decodeURIComponent(url);
            
            // Extract coordinates and zoom level
            const cpMatch = decodedUrl.match(/[?&]cp=(-?\d+\.?\d*)~(-?\d+\.?\d*)/);
            const lvlMatch = decodedUrl.match(/[?&]lvl=(-?\d+\.?\d*)/);
            
            if (cpMatch) {
                const result = { 
                    lat: parseFloat(cpMatch[1]), 
                    lng: parseFloat(cpMatch[2])
                };
                
                // Add zoom if found
                if (lvlMatch) {
                    result.zoom = parseFloat(lvlMatch[1]);
                }
                
                return result;
            }
            
            return null;
        }
    },
    mapillary: {
        name: 'Mapillary',
        icon: 'mapillary',
        urlTemplate: (lat, lng, zoom = 15) => `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=${zoom}`,
        extractCoords: (url) => {
            const latMatch = url.match(/[?&]lat=(-?\d+\.?\d*)/);
            const lngMatch = url.match(/[?&]lng=(-?\d+\.?\d*)/);
            const zoomMatch = url.match(/[?&]z=(-?\d+\.?\d*)/);
            
            if (latMatch && lngMatch) {
                const result = { 
                    lat: parseFloat(latMatch[1]), 
                    lng: parseFloat(lngMatch[1])
                };
                
                // Add zoom if found
                if (zoomMatch) {
                    result.zoom = parseFloat(zoomMatch[1]);
                }
                
                return result;
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

function createMapLink(service, config, lat, lng, zoom, isCurrent = false) {
    const link = document.createElement('a');
    link.href = config.urlTemplate(lat, lng, zoom);
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
            const { lat, lng, zoom = 15 } = coords; // Default zoom to 15 if not found
            
            // Display coordinates and zoom level
            const coordText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            const zoomText = zoom ? ` (zoom: ${zoom})` : '';
            document.getElementById('coordinates-display').textContent = coordText + zoomText;
            
            const linksContainer = document.getElementById('map-links');
            linksContainer.innerHTML = '';
            
            Object.entries(mapServices).forEach(([serviceKey, config]) => {
                const isCurrent = serviceKey === currentService;
                const link = createMapLink(serviceKey, config, lat, lng, zoom, isCurrent);
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