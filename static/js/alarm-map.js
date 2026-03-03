// static/js/alarms-map.js
// Leaflet map for Communication Alarms page

let map;
let markersLayer;

function initMap() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv || typeof L === "undefined") return;

  // Wait for the next frame to ensure flex container has calculated its dimensions
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Double requestAnimationFrame to ensure layout is complete
      
      map = L.map("map", {
        zoomControl: true,
        attributionControl: true,
      }).setView([37.9838, 23.7275], 6); // Greece default

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      markersLayer = L.layerGroup().addTo(map);
      
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
  const m = L.marker([lat, lon]);
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

// Try to load vessels (adjust endpoint if your backend is different)
async function loadVesselsAndPlot() {
  try {
    // Show loading overlay
    showMapLoading();
    // change this if your API is different
    const res = await fetch("/api/vessels", { cache: "no-store" });
    if (!res.ok) {
      hideMapLoading();
      return;
    }

    const data = await res.json();

    // Initialize map after data is loaded
    if (!map) {
      initMap();
    }

    // expected: array of vessels with {lat, lon, name, mmsi, last_seen, ...}
    clearMarkers();

    for (const v of data) {
      const lat = Number(v.lat ?? v.latitude);
      const lon = Number(v.lon ?? v.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const name = v.name || v.vessel_name || v.mmsi || "Vessel";
      const last = v.last_seen || v.lastSeen || v.last_update || "";

      addMarker(
        lat,
        lon,
        `
        <div style="min-width:200px">
          <div style="font-weight:600">${name}</div>
          ${v.mmsi ? `<div><small class="text-muted">MMSI: ${v.mmsi}</small></div>` : ""}
          ${last ? `<div><small class="text-muted">Last: ${last}</small></div>` : ""}
        </div>
        `
      );
    }

    fitToMarkers();
  } catch (e) {
    // Map still works even if API fails - initialize it anyway
    console.warn("[alarms-map] Failed to load vessels:", e);
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

// Optional: if your alarms.js dispatches an event with alarm vessels, we can listen:
// window.dispatchEvent(new CustomEvent("alarms:update", { detail: alarmsArray }))
window.addEventListener("alarms:update", (ev) => {
  const alarms = ev.detail;
  if (!Array.isArray(alarms)) return;

  // Initialize map if not already done
  if (!map) {
    initMap();
  }

  clearMarkers();

  for (const a of alarms) {
    const lat = Number(a.lat ?? a.latitude);
    const lon = Number(a.lon ?? a.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const name = a.name || a.vessel_name || a.mmsi || "Alarm";
    const reason = a.reason || "No comms > 3 hours";

    addMarker(
      lat,
      lon,
      `
      <div style="min-width:200px">
        <div style="font-weight:600">${name}</div>
        <div><small class="text-muted">${reason}</small></div>
      </div>
      `
    );
  }

  fitToMarkers();
  
  // Ensure map resizes to fill container after alarms update
  setTimeout(() => {
    if (map) {
      map.invalidateSize(true);
    }
  }, 200);
});

// Listen for alarms table being rendered before initializing map
window.addEventListener('alarms:table-rendered', async (event) => {
  console.log('[alarm-map] Alarms table rendered, initializing map');
  // Initialize map after communication alarms data is loaded
  if (!map) {
    // Wait a bit to ensure the container has its final dimensions
    await new Promise(resolve => setTimeout(resolve, 100));
    
    initMap();
    console.log('[alarm-map] Map initialized');
    
    // Wait for map to be ready before loading data
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Reload/refresh the map with vessel data
    await loadVesselsAndPlot();
    console.log('[alarm-map] Map reloaded with data');
    
    // Final resize to ensure map fills container
    setTimeout(() => {
      if (map) {
        console.log('[alarm-map] Final resize after data load');
        map.invalidateSize(true);
      }
    }, 500);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  // Only load vessel data if map is already initialized
  // Otherwise wait for alarms:table-rendered event
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
  
  // If map hasn't been initialized after 2 seconds, initialize it anyway
  setTimeout(() => {
    if (!map) {
      console.log('[alarm-map] Initializing map after timeout');
      initMap();
    }
  }, 2000);
});
