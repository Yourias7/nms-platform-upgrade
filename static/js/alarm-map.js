// static/js/alarms-map.js
// Leaflet map for alarms pages (communication + performance)

import { safeParseFloat } from './utils.js';

let map;
let markersLayer;
let isInitializing = false; // Flag to prevent concurrent initialization
let latestAlarms = [];
let activePerformanceAlarmKeys = new Set();
let lassoLayerGroup = null;
let activeLassoLayer = null;
const isPerformancePage = () => !!document.getElementById('performanceAlarmsArea');

function getPerformanceAlarmKey(alarm) {
  if (!alarm) return null;
  return `${alarm.serial || ''}|${alarm.site || ''}|${alarm.datetime || ''}|${alarm.status || ''}`;
}

function updateMapFilterStatus(alarm) {
  const selectedCount = Array.isArray(alarm) ? alarm.length : (alarm ? 1 : 0);
  const statusEl = document.getElementById('alarmMapFilterStatus');
  if (statusEl) {
    if (isPerformancePage()) {
      statusEl.textContent = `Showing: ${selectedCount} performance alarm${selectedCount === 1 ? '' : 's'}`;
    } else {
      if (selectedCount === 0) {
        statusEl.textContent = 'Showing: All alarms';
      } else if (selectedCount === 1) {
        statusEl.textContent = `Showing: ${alarm[0]?.site || 'Selected alarm'}`;
      } else {
        statusEl.textContent = `Showing: ${selectedCount} selected alarms`;
      }
    }
  }

  const clearBtn = document.getElementById('clearAlarmFiltersBtn');
  if (clearBtn) {
    clearBtn.disabled = selectedCount === 0;
  }
}

function getLatLonFromAlarm(alarm) {
  const lat = safeParseFloat(alarm.latitude ?? alarm.LATITUDE ?? alarm.lat, NaN);
  const lon = safeParseFloat(alarm.longitude ?? alarm.LONGITUDE ?? alarm.lon, NaN);

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 || lon === 0) {
    return null;
  }

  return { lat, lon };
}

function buildPerformancePopup(alarm) {
  const site = alarm.site || 'Unknown Site';
  const serial = alarm.serial || '';
  const datetime = alarm.datetime && alarm.datetime !== 'Unknown'
    ? new Date(alarm.datetime).toLocaleString()
    : 'Unknown';
  const rsrp = alarm.rsrp !== null && alarm.rsrp !== undefined ? Number(alarm.rsrp).toFixed(1) : 'N/A';
  const sinr = alarm.sinr !== null && alarm.sinr !== undefined ? Number(alarm.sinr).toFixed(1) : 'N/A';
  const temp = alarm.temp !== null && alarm.temp !== undefined ? Number(alarm.temp).toFixed(1) : 'N/A';

  return (
    `<b>${site}</b>` +
    `<br>${serial}` +
    `<br>Status: ${alarm.status || 'Performance Alarm'}` +
    `<br>Time: ${datetime}` +
    `<br>RSRP: ${rsrp} dBm` +
    `<br>SINR: ${sinr} dB` +
    `<br>TEMP: ${temp}°C`
  );
}

function buildCommunicationPopup(alarm) {
  const site = alarm.site || 'Unknown Site';
  const status = alarm.status || 'Alarm';
  const lastUpdate = alarm.lastUpdate && alarm.lastUpdate !== 'Never'
    ? new Date(alarm.lastUpdate).toLocaleString()
    : 'Never';
  const timeAgo = alarm.hoursAgo !== undefined && alarm.hoursAgo !== null ? `${alarm.hoursAgo}h` : 'N/A';

  return (
    `<b>${site}</b>` +
    `<br>Status: ${status}` +
    `<br>Last Update: ${lastUpdate}` +
    `<br>Time ago: ${timeAgo}`
  );
}

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

        if (isPerformancePage()) {
          initPerformanceLassoTool();
        }
        
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

function isLatLngInPolygon(point, polygonLatLngs) {
  const x = point.lng;
  const y = point.lat;
  let inside = false;

  for (let i = 0, j = polygonLatLngs.length - 1; i < polygonLatLngs.length; j = i++) {
    const xi = polygonLatLngs[i].lng;
    const yi = polygonLatLngs[i].lat;
    const xj = polygonLatLngs[j].lng;
    const yj = polygonLatLngs[j].lat;

    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) inside = !inside;
  }

  return inside;
}

function applyDefaultAlarmMarkerStyle(marker) {
  marker.setStyle({
    radius: 8,
    fillColor: '#dc3545',
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9
  });
}

function clearLassoAlarmSelection() {
  if (!markersLayer) return;
  markersLayer.eachLayer((layer) => {
    if (layer && typeof layer.setStyle === 'function' && layer.getLatLng) {
      applyDefaultAlarmMarkerStyle(layer);
    }
  });
  window.dispatchEvent(new CustomEvent('performance-alarms:lasso-selected', {
    detail: {
      hasLasso: false,
      selectedKeys: []
    }
  }));
}

function clearActiveLasso() {
  if (lassoLayerGroup) {
    lassoLayerGroup.clearLayers();
  }
  activeLassoLayer = null;
  clearLassoAlarmSelection();
}

function applyLassoToAlarmMarkers(layer) {
  if (!layer || !markersLayer) return;

  const latLngs = layer.getLatLngs();
  const polygon = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
  const selectedKeys = new Set();

  markersLayer.eachLayer((marker) => {
    if (!marker || typeof marker.getLatLng !== 'function' || typeof marker.setStyle !== 'function') {
      return;
    }

    const inside = isLatLngInPolygon(marker.getLatLng(), polygon);
    if (inside) {
      if (marker._alarmKey) {
        selectedKeys.add(marker._alarmKey);
      }
      marker.setStyle({
        radius: 9,
        fillColor: '#00d4ff',
        color: '#111827',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.95
      });
    } else {
      applyDefaultAlarmMarkerStyle(marker);
    }
  });

  window.dispatchEvent(new CustomEvent('performance-alarms:lasso-selected', {
    detail: {
      hasLasso: true,
      selectedKeys: Array.from(selectedKeys)
    }
  }));
}

function initPerformanceLassoTool() {
  if (!map || typeof L.Control.Draw === 'undefined') {
    console.warn('[alarm-map] Leaflet.Draw not available; lasso disabled');
    return;
  }

  lassoLayerGroup = new L.FeatureGroup();
  map.addLayer(lassoLayerGroup);

  const drawControl = new L.Control.Draw({
    position: 'topleft',
    draw: {
      polygon: {
        allowIntersection: false,
        showArea: true,
        shapeOptions: {
          color: '#0d6efd',
          weight: 2,
          fillOpacity: 0.08
        }
      },
      polyline: false,
      rectangle: false,
      circle: false,
      marker: false,
      circlemarker: false
    },
    edit: false
  });

  map.addControl(drawControl);

  const ClearLassoControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const link = L.DomUtil.create('a', '', container);
      link.href = '#';
      link.title = 'Clear lasso';
      link.setAttribute('role', 'button');
      link.setAttribute('aria-label', 'Clear lasso');
      link.innerHTML = '&times;';
      link.style.fontSize = '18px';
      link.style.lineHeight = '26px';
      link.style.textAlign = 'center';

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(link, 'click', (e) => {
        L.DomEvent.preventDefault(e);
        clearActiveLasso();
      });

      return container;
    }
  });

  map.addControl(new ClearLassoControl());

  map.on(L.Draw.Event.CREATED, (event) => {
    lassoLayerGroup.clearLayers();
    lassoLayerGroup.addLayer(event.layer);
    activeLassoLayer = event.layer;
    applyLassoToAlarmMarkers(activeLassoLayer);
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

function addMarker(lat, lon, popupHtml, alarm = null) {
  if (!map || !markersLayer) return;
  const m = L.circleMarker([lat, lon], {
    radius: 8,
    fillColor: "#dc3545",
    color: "#fff",
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9
  });
  if (popupHtml) {
    m.bindPopup(popupHtml, { maxWidth: 280 });
    m.bindTooltip(popupHtml, {
      direction: 'top',
      offset: [0, -45]
    });
  }
  m._alarmKey = alarm ? getPerformanceAlarmKey(alarm) : null;
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
      const coords = getLatLonFromAlarm(alarm);
      const lat = coords?.lat;
      const lon = coords?.lon;
      
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat==0 || lon==0) {
        console.log(`[alarm-map] Skipping alarm for ${alarm.site} - invalid coordinates: lat=${lat}, lon=${lon}`);
        continue;
      }
      
      const popupHtml = isPerformancePage()
        ? buildPerformancePopup(alarm)
        : buildCommunicationPopup(alarm);

      addMarker(lat, lon, popupHtml, alarm);
      validMarkerCount++;
    }

    console.log(`[alarm-map] Plotted ${validMarkerCount} alarm markers out of ${alarms.length} alarms`);

    if (validMarkerCount > 0) {
      fitToMarkers();
      if (isPerformancePage() && activeLassoLayer) {
        applyLassoToAlarmMarkers(activeLassoLayer);
      }
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

async function handleTableRendered(event) {
  console.log('[alarm-map] Alarms table rendered event received');
  
  // Get alarm data from the event
  const alarms = event.detail?.alarms || [];
  const selectedKeys = event.detail?.selectedKeys || [];
  if (isPerformancePage()) {
    activePerformanceAlarmKeys = new Set(selectedKeys);
  }
  latestAlarms = alarms;
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
  
  if (!map) {
    return;
  }

  let alarmsToPlot = alarms;

  if (isPerformancePage() && activePerformanceAlarmKeys.size > 0) {
    const selected = alarms.filter(a => activePerformanceAlarmKeys.has(getPerformanceAlarmKey(a)));
    if (selected.length > 0) {
      alarmsToPlot = selected;
    } else {
      activePerformanceAlarmKeys = new Set();
    }
  }

  if (alarmsToPlot.length > 0) {
    await loadVesselsAndPlot(alarmsToPlot);
    updateMapFilterStatus(isPerformancePage() ? alarmsToPlot : []);
    console.log('[alarm-map] Map updated with alarm data');
  } else {
    clearMarkers();
    updateMapFilterStatus([]);
  }
}

window.addEventListener('performance-alarms:table-rendered', handleTableRendered);
window.addEventListener('performance-alarms:row-selected', async (event) => {
  if (!isPerformancePage() || !map) {
    return;
  }

  const selectedAlarms = event.detail?.selectedAlarms || [];
  const selectedKeys = event.detail?.selectedKeys || [];
  activePerformanceAlarmKeys = new Set(selectedKeys);

  if (selectedAlarms.length === 0) {
    updateMapFilterStatus([]);
    await loadVesselsAndPlot(latestAlarms);
    return;
  }

  updateMapFilterStatus(selectedAlarms);
  await loadVesselsAndPlot(selectedAlarms);
});
window.addEventListener('performance-alarms:clear-lasso', () => {
  if (!isPerformancePage()) return;
  clearActiveLasso();
});
window.addEventListener('alarms:table-rendered', (event) => {
  if (isPerformancePage()) {
    return;
  }
  handleTableRendered(event);
});

document.addEventListener("DOMContentLoaded", async () => {
  console.log('[alarm-map] DOM loaded');

  updateMapFilterStatus([]);

  const clearBtn = document.getElementById('clearAlarmFiltersBtn');
  if (clearBtn) {
    clearBtn.style.display = '';
    clearBtn.disabled = true;
  }

  if (!map) {
    initMap();
  }
  
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
