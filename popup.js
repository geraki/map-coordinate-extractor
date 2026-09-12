console.log('Popup script started');

// proj4 setup: define EPSG:2100 (ΕΓΣΑ'87) when proj4 is loaded
if (typeof proj4 !== 'undefined') {
    try {
        proj4.defs("EPSG:2100", "+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9996 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs");
    } catch (e) {
        console.warn('proj4 defs failed:', e);
    }
} else {
    console.warn('proj4 not available — include proj4 before popup.js to enable transformations');
}

// Map service configurations
const mapServices = {
    google: {
        name: 'Google Maps',
        icon: 'google',
        urlTemplate: (lat, lng, zoom) => `https://www.google.com/maps/@${lat},${lng},${zoom}z`,
        extractCoords: (url) => {
            console.log('Checking Google Maps patterns in:', url);
            // Google Maps patterns: /@lat,lng,zoomz or @lat,lng
            let match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),([0-9.]+)z?/);
            if (match) {
                console.log('Found Google Maps @ pattern with zoom:', match);
                return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), zoom: parseFloat(match[3]) };
            }

            match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
            if (match) {
                console.log('Found Google Maps @ pattern (no zoom):', match);
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
        urlTemplate: (lat, lng, zoom) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`,
        extractCoords: (url) => {
            console.log('Checking OSM patterns in:', url);
            // OSM patterns: #map=zoom/lat/lng or ?mlat=lat&mlon=lng
            let match = url.match(/#map=(\d+)\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/);
            if (match) {
                console.log('Found OSM #map pattern with zoom:', match);
                return { zoom: parseInt(match[1], 10), lat: parseFloat(match[2]), lng: parseFloat(match[3]) };
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
        urlTemplate: (lat, lng, zoom) => `https://www.bing.com/maps?cp=${lat}~${lng}&lvl=${zoom}`,
        extractCoords: (url) => {
            console.log('Checking Bing patterns in:', url);
            // Bing Maps patterns: ?cp=lat~lng
            const match = url.match(/[?&]cp=(-?\d+\.?\d*)~(-?\d+\.?\d*)/);
            if (match) {
                const lvlMatch = url.match(/[?&]lvl=([0-9.]+)/);
                const zoom = lvlMatch ? parseFloat(lvlMatch[1]) : undefined;
                console.log('Found Bing cp= pattern:', match, 'zoom:', zoom);
                return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), zoom };
            }
            
            return null;
        }
    },
    mapillary: {
        name: 'Mapillary',
        icon: 'mapillary',
        urlTemplate: (lat, lng, zoom) => `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=${zoom}`,
        extractCoords: (url) => {
            console.log('Checking Mapillary patterns in:', url);
            // Mapillary patterns: ?lat=lat&lng=lng and optional z
            const latMatch = url.match(/[?&]lat=(-?\d+\.?\d*)/);
            const lngMatch = url.match(/[?&]lng=(-?\d+\.?\d*)/);
            const zMatch = url.match(/[?&]z=([0-9.]+)/);
            const zoom = zMatch ? parseFloat(zMatch[1]) : undefined;
            if (latMatch && lngMatch) {
                console.log('Found Mapillary lat/lng pattern:', latMatch, lngMatch, 'zoom:', zoom);
                return { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]), zoom };
            }
            
            return null;
        }
    },
    wikishootme: {
        name: 'Wikishootme',
        icon: 'wikishootme',
        urlTemplate: (lat, lng, zoom) => `https://wikishootme.toolforge.org/#lat=${lat}&lng=${lng}&zoom=${zoom}`,
        extractCoords: (url) => {
            console.log('Checking Wikishootme patterns in:', url);
            // Wikishootme uses fragment coords like #lat=...&lng=...&zoom=...
            const hashMatch = url.match(/#.*(?:lat|latitude)=(-?\d+\.?\d*)[&;](?:lng|lon|longitude)=(-?\d+\.?\d*)(?:[&;]zoom=([0-9.]+))?/i);
            if (hashMatch) {
                const zoom = hashMatch[3] ? parseFloat(hashMatch[3]) : undefined;
                console.log('Found Wikishootme hash pattern:', hashMatch, 'zoom:', zoom);
                return { lat: parseFloat(hashMatch[1]), lng: parseFloat(hashMatch[2]), zoom };
            }

            const queryMatch = url.match(/[?&](?:lat|latitude)=(-?\d+\.?\d*)[&;](?:lng|lon|longitude)=(-?\d+\.?\d*)(?:[&;]zoom=([0-9.]+))?/i);
            if (queryMatch) {
                const zoom = queryMatch[3] ? parseFloat(queryMatch[3]) : undefined;
                console.log('Found Wikishootme query pattern:', queryMatch, 'zoom:', zoom);
                return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]), zoom };
            }

            return null;
        }
    },
    osmand: {
        name: 'OsmAnd',
        icon: 'osmand',
        urlTemplate: (lat, lng, zoom) => `https://osmand.net/map/#${zoom}/${lat}/${lng}`,
        extractCoords: (url) => {
            console.log('Checking OsmAnd patterns in:', url);

            const hashMatch = url.match(/#([0-9]+(?:\.[0-9]+)?)\/(-?\d+\.?\d+)\/(-?\d+\.?\d+)/);
            if (hashMatch) {
                console.log('Found OsmAnd hash pattern:', hashMatch);
                return { zoom: parseFloat(hashMatch[1]), lat: parseFloat(hashMatch[2]), lng: parseFloat(hashMatch[3]) };
            }

            const pinMatch = url.match(/[?&]pin=\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i);
            if (pinMatch) {
                console.log('Found OsmAnd pin pattern:', pinMatch);
                return { lat: parseFloat(pinMatch[1]), lng: parseFloat(pinMatch[2]) };
            }

            const legacyMatch = url.match(/(?:\/|#)([0-9]+(?:\.[0-9]+)?)\/(-?\d+\.?\d+)\/(-?\d+\.?\d+)/);
            if (legacyMatch) {
                console.log('Found OsmAnd legacy pattern:', legacyMatch);
                return { zoom: parseFloat(legacyMatch[1]), lat: parseFloat(legacyMatch[2]), lng: parseFloat(legacyMatch[3]) };
            }

            return null;
        }
    },
    ktimatologio: {
        name: 'Ktimatologio',
        icon: 'ktimatologio',
        urlTemplate: (lat, lng, zoom) => getKtimatologioUrl(lng, lat, zoom),
        extractCoords: (url) => {
            try {
                // Get fragment after '#'
                const hashIndex = url.indexOf('#');
                if (hashIndex === -1) return null;
                const hash = url.substring(hashIndex + 1);

                const centerIndex = hash.indexOf('center:');
                if (centerIndex === -1) return null;

                // Extract from 'center:' up to 'level:' (if present)
                const afterCenter = hash.substring(centerIndex + 7);
                const levelPos = afterCenter.indexOf('level:');
                const centerPartRaw = levelPos >= 0 ? afterCenter.substring(0, levelPos) : afterCenter;
                const centerPart = decodeURIComponent(centerPartRaw);

                // centerPart expected like 'X,Y,SRID' or 'X,Y'
                const parts = centerPart.split(',').map(s => s.trim()).filter(s => s.length > 0);
                if (parts.length < 2) return null;

                const x = parseFloat(parts[0]);
                const y = parseFloat(parts[1]);
                const srid = parts[2] ? parts[2] : '102100';

                // try to extract level/zoom value
                let zoom = undefined;
                const levelMatch = hash.match(/level:([0-9]+\.?[0-9]*)/);
                if (levelMatch) {
                    zoom = parseFloat(levelMatch[1]);
                }

                let lonLat = null;

                // If SRID indicates WebMercator (102100 or 3857) convert to WGS84
                if (srid === '102100' || srid === '3857' || srid.toLowerCase().includes('102100') ) {
                    if (typeof proj4 !== 'undefined') {
                        try {
                            lonLat = proj4('EPSG:3857', 'EPSG:4326', [x, y]);
                        } catch (e) {
                            console.warn('proj4 EPSG:3857->4326 failed, falling back to formula', e);
                        }
                    }

                    if (!lonLat) {
                        // inverse Web Mercator
                        const R = 6378137.0;
                        const lon = (x / R) * 180.0 / Math.PI;
                        const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2.0) * 180.0 / Math.PI;
                        lonLat = [lon, lat];
                    }
                } else if (srid === '2100' || srid.toLowerCase().includes('2100')) {
                    // EPSG:2100 (ΕΓΣΑ'87) -> WGS84
                    if (typeof proj4 !== 'undefined') {
                        try {
                            lonLat = proj4('EPSG:2100', 'EPSG:4326', [x, y]);
                        } catch (e) {
                            console.warn('proj4 EPSG:2100->4326 failed', e);
                        }
                    }
                    // no good fallback without proj4 for datum conversion
                }

                if (!lonLat) return null;

                const lon = lonLat[0];
                const lat = lonLat[1];

                const result = { lat: parseFloat(lat), lng: parseFloat(lon) };
                if (zoom !== undefined) result.zoom = zoom;
                return result;
            } catch (e) {
                console.error('Error extracting ktimatologio center:', e);
                return null;
            }
        }
    }
};

function detectCurrentMapService(url) {
    console.log('Detecting map service for:', url);
    if (url.includes('maps.google.com') || url.includes('google.com/maps')) return 'google';
    if (url.includes('openstreetmap.org')) return 'osm';
    if (url.includes('bing.com/maps')) return 'bing';
    if (url.includes('mapillary.com')) return 'mapillary';
    if (url.includes('wikishootme.toolforge.org')) return 'wikishootme';
    if (url.includes('osmand.net')) return 'osmand';
    if (url.includes('maps.ktimatologio.gr') || url.includes('ktimatologio.gr')) return 'ktimatologio';
    return null;
}

// Build URL for maps.ktimatologio.gr. The site uses Web Mercator (EPSG:3857 / 102100)
// Example URL pattern observed:
// https://maps.ktimatologio.gr/?locale=el#widget_6=active_datasource_id:dataSource_1,center:<X>%2C<Y>,102100,level:<zoom>
// Simple conversion using the Web Mercator formula (as you provided).
function getKtimatologioUrl(lon, lat, zoom = 19) {
    // Ακτίνα της Γης στο σύστημα Web Mercator
    const R = 6378137.0;
    
    // Μετατροπή Longitude σε X
    const x = lon * Math.PI * R / 180.0;
    
    // Μετατροπή Latitude σε Y
    const y = Math.log(Math.tan((Math.PI / 4.0) + (lat * Math.PI / 360.0))) * R;
    
    // Δημιουργία του URL (η toFixed(2) κρατάει 2 δεκαδικά όπως το παράδειγμα)
    const baseUrl = "https://maps.ktimatologio.gr/?locale=el#widget_6=active_datasource_id:dataSource_1,center:";
    return `${baseUrl}${x.toFixed(2)}%2C${y.toFixed(2)}%2C102100,level:${zoom}`;
}

// If you have ΕΓΣΑ'87 coordinates (EPSG:2100), convert them to Web Mercator for the URL
function getKtimatologioUrlFromEgs87(xEgs87, yEgs87, zoom = 19) {
    if (typeof proj4 === 'undefined') {
        console.warn('proj4 missing — cannot transform EPSG:2100 to EPSG:3857');
        return `https://maps.ktimatologio.gr/?locale=el`;
    }
    try {
        const xy = proj4('EPSG:2100', 'EPSG:3857', [xEgs87, yEgs87]);
        const x = xy[0];
        const y = xy[1];
        const baseUrl = 'https://maps.ktimatologio.gr/?locale=el#widget_6=active_datasource_id:dataSource_1,center:';
        return `${baseUrl}${x.toFixed(6)}%2C${y.toFixed(6)},102100,level:${zoom}`;
    } catch (e) {
        console.error('proj4 transform EPSG:2100->3857 failed:', e);
        return `https://maps.ktimatologio.gr/?locale=el`;
    }
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

function createMapLink(service, config, lat, lng, isCurrent = false, zoom = 19) {
    const link = document.createElement('a');
    // call template with zoom if it accepts it
    try {
        link.href = config.urlTemplate(lat, lng, zoom);
    } catch (e) {
        link.href = config.urlTemplate(lat, lng);
    }
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
            // Use provided zoom from ktimatologio if available, otherwise default 19
            const sourceZoom = coords.zoom !== undefined ? coords.zoom : 19;
            
            console.log('Displaying coordinates:', lat, lng);
            
            // Display coordinates
            document.getElementById('coordinates-display').textContent = 
                `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            
            // Create links for all map services
            const linksContainer = document.getElementById('map-links');
            linksContainer.innerHTML = ''; // Clear existing links
            
            Object.entries(mapServices).forEach(([serviceKey, config]) => {
                const isCurrent = serviceKey === currentService;
                const targetZoom = mapZoomForService(sourceZoom, serviceKey);
                const link = createMapLink(serviceKey, config, lat, lng, isCurrent, targetZoom);
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

// Map ktimatologio zoom to target service zoom
function mapZoomForService(sourceZoom, serviceKey) {
    // ktimatologio uses fractional zoom; target services use integer zoom levels.
    const z = Math.round(sourceZoom);
    // clamp common web map zoom range
    const minZ = 0;
    const maxZ = 22;
    const rz = Math.max(minZ, Math.min(maxZ, z));
    return rz;
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