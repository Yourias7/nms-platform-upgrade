// static/js/alarms-map.js
// Leaflet map for Communication Alarms page

let map;
let markersLayer;
let isInitializing = false; // Flag to prevent concurrent initialization

function initMap() {
  // Prevent multiple initializations
  showMapLoading();
  if (map) {
    console.log('[alarm-map] Map already initialized, skipping');
    hideMapLoading();
    return;
  }
  
  if (isInitializing) {
    console.log('[alarm-map] Map initialization already in progress, skipping');
    hideMapLoading();
    return;
  }
  
  const mapDiv = document.getElementById("map");
  if (!mapDiv || typeof L === "undefined") {
    console.warn('[alarm-map] Map div not found or Leaflet not loaded');
    hideMapLoading();
    return;
  }
  
  // Check if Leaflet has already initialized this container
  if (mapDiv.classList.contains('leaflet-container')) {
    console.warn('[alarm-map] Map container already has Leaflet classes, skipping initialization');
    hideMapLoading();
    return;
  }

  console.log('[alarm-map] Initializing map...');
  isInitializing = true;

  // Wait for the next frame to ensure flex container has calculated its dimensions
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Double requestAnimationFrame to ensure layout is complete
      
      try {
        map = L.map("map", {
          zoomControl: true,
          attributionControl: true,
        }).setView([37.9838, 23.7275], 6); // Greece default

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap",
        }).addTo(map);

        markersLayer = L.layerGroup().addTo(map);
        
        console.log('[alarm-map] Map initialized successfully');
        
        // Immediately invalidate size after map creation
        setTimeout(() => {
          if (map) {
            map.invalidateSize(true);
          }
        }, 50);
        
        // Additional resize after flex container has stabilized
        setTimeout(() => {
          if (map) {
            map.invalidateSize(true);
          }
        }, 300);
        
        // Final resize to catch any late adjustments
        setTimeout(() => {
          if (map) {
            map.invalidateSize(true);
          }
        }, 800);
        hideMapLoading();
      } catch (error) {
        console.error('[alarm-map] Error initializing map:', error);
        isInitializing = false; // Reset flag on error
        hideMapLoading();
        throw error;
      }
    });
  });
}

function clearMarkers() {
  if (markersLayer) markersLayer.clearLayers();
}

/**
 * Show map loading overlay
 */
function showMapLoading() {
  const overlay = document.getElementById('mapLoadingOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }
}

/**
 * Hide map loading overlay
 */
function hideMapLoading() {
  const overlay = document.getElementById('mapLoadingOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

function addMarker(lat, lon, popupHtml) {
  if (!map || !markersLayer) return;
  const m = L.circleMarker([lat, lon], {
    radius: 8,
    fillColor: "#dc3545",
    color: "#fff",
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9
  });
  if (popupHtml) m.bindPopup(popupHtml, { maxWidth: 280 });
  m.addTo(markersLayer);
}

function fitToMarkers() {
  if (!map || !markersLayer) return;
  const bounds = [];
  markersLayer.eachLayer((layer) => {
    if (layer.getLatLng) bounds.push(layer.getLatLng());
  });
  if (bounds.length === 0) return;
  const b = L.latLngBounds(bounds);
  map.fitBounds(b.pad(0.2));
}

// Load and plot alarms on the map
export async function loadVesselsAndPlot(alarms) {
  try {
    // Show loading overlay
    showMapLoading();
    
    if (!alarms || alarms.length === 0) {
      console.log('[alarm-map] No alarms to plot');
      hideMapLoading();
      return;
    }

    if (!map) {
      console.warn('[alarm-map] Map not initialized, cannot plot markers');
      hideMapLoading();
      return;
    }

    // Clear existing markers
    clearMarkers();

    let validMarkerCount = 0;
    
    for (const alarm of alarms) {
      const lat = Number(alarm.latitude ?? alarm.LATITUDE ?? alarm.lat);
      const lon = Number(alarm.longitude ?? alarm.LONGITUDE ?? alarm.lon);
      
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat==0 || lon==0) {
        console.log(`[alarm-map] Skipping alarm for ${alarm.site} - invalid coordinates: lat=${lat}, lon=${lon}`);
        continue;
      }

      const site = alarm.site || 'Unknown Site';
      const status = alarm.status || 'Alarm';
      
      // Build popup HTML based on alarm type
      let popupHtml = `<div style="min-width:200px">
        <div style="font-weight:600; color: #dc3545;">${site}</div>
        <div style="margin-top: 4px;">
          <span style="background: #dc3545; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">
            ${status}
          </span>
        </div>`;
      
      // Add communication alarm details if available
      if (alarm.hoursAgo !== undefined && alarm.lastUpdate !== undefined) {
        const hoursAgo = alarm.hoursAgo || 'N/A';
        const lastUpdate = alarm.lastUpdate || 'Never';
        popupHtml += `
          <div style="margin-top: 6px;">
            <small class="text-muted">Last Update: ${lastUpdate !== 'Never' ? new Date(lastUpdate).toLocaleString() : 'Never'}</small>
          </div>
          <div>
            <small class="text-muted">Time ago: ${hoursAgo >= 24 
              ? `${Math.floor(hoursAgo / 24)}d ${(hoursAgo % 24).toFixed(1)}h` 
              : `${hoursAgo}h`}</small>
          </div>`;
      }
      
      // Add performance alarm details if available
      if (alarm.datetime !== undefined) {
        popupHtml += `
          <div style="margin-top: 6px;">
            <small class="text-muted">Time: ${alarm.datetime !== 'Unknown' ? new Date(alarm.datetime).toLocaleString() : 'Unknown'}</small>
          </div>`;
      }
      
      if (alarm.rsrp !== undefined || alarm.sinr !== undefined || alarm.temp !== undefined) {
        popupHtml += `<div style="margin-top: 6px;">`;
        if (alarm.rsrp !== null && alarm.rsrp !== undefined) {
          popupHtml += `<div><small>RSRP: <strong>${alarm.rsrp.toFixed(1)} dBm</strong></small></div>`;
        }
        if (alarm.sinr !== null && alarm.sinr !== undefined) {
          popupHtml += `<div><small>SINR: <strong>${alarm.sinr.toFixed(1)} dB</strong></small></div>`;
        }
        if (alarm.temp !== null && alarm.temp !== undefined) {
          popupHtml += `<div><small>Temp: <strong>${alarm.temp.toFixed(1)} °C</strong></small></div>`;
        }
        popupHtml += `</div>`;
      }
      
      popupHtml += `</div>`;

      addMarker(lat, lon, popupHtml);
      validMarkerCount++;
    }

    console.log(`[alarm-map] Plotted ${validMarkerCount} alarm markers out of ${alarms.length} alarms`);

    if (validMarkerCount > 0) {
      fitToMarkers();
    }
  } catch (e) {
    // Map still works even if API fails - initialize it anyway
    console.warn("[alarms-map] Failed to load alarms:", e);
    if (!map) {
      initMap();
    }
  }
  
  // Hide loading overlay after markers are loaded
  hideMapLoading();
  
  // Final resize to ensure map fills container after all data is loaded
  setTimeout(() => {
    if (map) {
      map.invalidateSize(true);
    }
  }, 300);
}

// Listen for alarms table being rendered - use the alarm data from the event
window.addEventListener('alarms:table-rendered', async (event) => {
  console.log('[alarm-map] Alarms table rendered event received');
  
  // Get alarm data from the event
  const alarms = event.detail?.alarms || [];
  console.log(`[alarm-map] Received ${alarms.length} alarms from event`);
  
  // Initialize map if not already done
  if (!map) {
    console.log('[alarm-map] Map not initialized, initializing now');
    // Wait a bit to ensure the container has its final dimensions
    await new Promise(resolve => setTimeout(resolve, 100));
    
    initMap();
    
    // Wait for map to be ready before loading data
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  
  // Plot the alarm data on the map (works whether map is new or existing)
  if (alarms.length > 0 && map) {
    await loadVesselsAndPlot(alarms);
    console.log('[alarm-map] Map updated with alarm data');
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  console.log('[alarm-map] DOM loaded');
  
  // Add ResizeObserver to watch for map container size changes
  const mapDiv = document.getElementById('map');
  if (mapDiv && typeof ResizeObserver !== 'undefined') {
    let resizeTimeout;
    const resizeObserver = new ResizeObserver(() => {
      if (map) {
        // Debounce resize calls to avoid performance issues
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (map) {
            console.log('[alarm-map] Container resized, invalidating map size');
            map.invalidateSize(true);
          }
        }, 150);
      }
    });
    resizeObserver.observe(mapDiv);
  }
});
