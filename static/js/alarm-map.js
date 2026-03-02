// static/js/alarms-map.js
// Leaflet map for Communication Alarms page

let map;
let markersLayer;

function initMap() {
  const mapDiv = document.getElementById("alarmMap");
  if (!mapDiv || typeof L === "undefined") return;

  map = L.map("alarmMap", {
    zoomControl: true,
    attributionControl: true,
  }).setView([37.9838, 23.7275], 6); // Greece default

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
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
    if (!res.ok) return;

    const data = await res.json();

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
    // Map still works even if API fails
    console.warn("[alarms-map] Failed to load vessels:", e);
  }
  
  // Hide loading overlay after markers are loaded
  hideMapLoading();
}

// Optional: if your alarms.js dispatches an event with alarm vessels, we can listen:
// window.dispatchEvent(new CustomEvent("alarms:update", { detail: alarmsArray }))
window.addEventListener("alarms:update", (ev) => {
  const alarms = ev.detail;
  if (!Array.isArray(alarms)) return;

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
});

document.addEventListener("DOMContentLoaded", async () => {
  initMap();
  await loadVesselsAndPlot();
});
