import { 
    fetchInstantTempProbeData, fetchInstantRttProbeData, fetchAverageRttProbeData, 
    fetchAverageRsrpProbeData, fetchInstantRsrpProbeData, fetchAverageSinrProbeData, 
    fetchInstantSinrProbeData, fetchLiveProbeNameMap, fetchProbeData 
} from '../shared/api.js';
import { CONFIG } from '../shared/config.js';
import { getFieldCaseInsensitive, safeParseFloat } from '../shared/utils.js';

// ==========================================
// 1. MAP MANAGEMENT (Encapsulated State)
// ==========================================
class DashboardMap {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.markers = [];
        this.customIcon = null;
        this.updateSeq = 0; // Prevents race conditions during rapid clicking
        this.infoControl = null;
    }

    async init() {
        // Initialize Leaflet map attached to this instance
        this.map = L.map(this.containerId).setView(
            [CONFIG.MAP.INITIAL_LAT, CONFIG.MAP.INITIAL_LON],
            CONFIG.MAP.INITIAL_ZOOM
        );

        L.tileLayer(CONFIG.MAP.TILE_URL, {
            maxZoom: CONFIG.MAP.MAX_ZOOM,
            attribution: CONFIG.MAP.TILE_ATTRIBUTION
        }).addTo(this.map);

        this._initInfoControl();
        await this._preloadIcon();
    }

    /**
     * Initializes the Leaflet Custom Control for the floating info box
     */
    _initInfoControl() {
        const self = this;
        
        // Define a custom Leaflet Control
        const ProbeInfoControl = L.Control.extend({
            options: { position: 'topright' },

            onAdd: function () {
                this._div = L.DomUtil.create('div', 'probe-info-control');
                
                // CRITICAL: Stop map from zooming/panning when interacting with the box
                L.DomEvent.disableClickPropagation(this._div);
                L.DomEvent.disableScrollPropagation(this._div);
                
                this.update();
                return this._div;
            },

            update: function (props) {
                if (!props) {
                    this._div.classList.remove('active');
                    return;
                }

                this._div.classList.add('active');
                this._div.innerHTML = `
                    <h6><i class="bi bi-broadcast me-2"></i>${props.name || 'Unknown Probe'}</h6>
                    <div class="probe-info-row">
                        <span class="probe-info-label">Serial</span>
                        <span class="probe-info-value">${props.serial}</span>
                    </div>
                    <div class="probe-info-row">
                        <span class="probe-info-label">Latitude</span>
                        <span class="probe-info-value">${props.lat.toFixed(6)}°</span>
                    </div>
                    <div class="probe-info-row">
                        <span class="probe-info-label">Longitude</span>
                        <span class="probe-info-value">${props.lon.toFixed(6)}°</span>
                    </div>
                    <div class="probe-info-row">
                        <span class="probe-info-label">Last Updated</span>
                        <span class="probe-info-value">${props.lastUpdated}</span>
                    </div>
                `;
            }
        });

        this.infoControl = new ProbeInfoControl();
        this.infoControl.addTo(this.map);
    }

    _preloadIcon() {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.customIcon = L.icon({
                    iconUrl: CONFIG.MARKER.PNG_PATH,
                    iconSize: CONFIG.MARKER.ICON_SIZE,
                    iconAnchor: CONFIG.MARKER.ICON_ANCHOR,
                    popupAnchor: CONFIG.MARKER.POPUP_ANCHOR
                });
                resolve();
            };
            img.onerror = () => {
                console.warn(`[DashboardMap] Failed to load custom icon, falling back to default.`);
                this.customIcon = new L.Icon.Default(); 
                resolve();
            };
            img.src = CONFIG.MARKER.PNG_PATH;
        });
    }

    _clearMarkers() {
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];
    }
    // Note: Tooltip generation removed in favor of the floating info box, but can be re-added if needed in the future
    // _buildTooltip(row, serial) {
    //     const lat = safeParseFloat(getFieldCaseInsensitive(row, ['latitude', 'lat']));
    //     const lon = safeParseFloat(getFieldCaseInsensitive(row, ['longitude', 'lon']));
    //     const rsrp = getFieldCaseInsensitive(row, ['rsrp', 'RSRP']);
    //     const name = getFieldCaseInsensitive(row, ['name', 'NAME']);
        
    //     return `
    //         <b>${name ?? 'Unknown System'}</b><br>
    //         Serial: ${serial}<br>
    //         Coordinates: ${lat}, ${lon}<br>
    //         RSRP: ${rsrp !== null ? safeParseFloat(rsrp).toFixed(1) + ' dBm' : 'N/A'}
    //     `;
    // }

    async updateForSerial(serial) {
        if (!this.map) return;
        
        const currentSeq = ++this.updateSeq;
        this._clearMarkers();

        // Hide the control while loading or if switching
        this.infoControl.update();

        try {
            const data = await fetchProbeData(serial);
            
            // Abort if user clicked another serial while we were fetching
            if (currentSeq !== this.updateSeq || !data || data.length === 0) return;

            const bounds = [];
            let latestRow = null;

            data.forEach(row => {
                const lat = safeParseFloat(getFieldCaseInsensitive(row, ['latitude', 'lat']));
                const lon = safeParseFloat(getFieldCaseInsensitive(row, ['longitude', 'lon']));

                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

                // Keep track of the latest row for the floating box (assuming data is sorted or the first/last is newest)
                if (!latestRow) latestRow = row;

                const marker = L.marker([lat, lon], { icon: this.customIcon })
                    .addTo(this.map)
                    // .bindPopup(this._buildTooltip(row, serial));         // Removed tooltip because we have the floating box now

                this.markers.push(marker);
                bounds.push([lat, lon]);
            });

            if (bounds.length > 0) {
                this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: CONFIG.MAP.MAX_ZOOM });
            }

            // Populate and show the floating box with the most relevant data point
            if (latestRow) {
                this.infoControl.update({
                    name: getFieldCaseInsensitive(latestRow, ['name', 'NAME']),
                    serial: serial,
                    lat: safeParseFloat(getFieldCaseInsensitive(latestRow, ['latitude', 'lat'])),
                    lon: safeParseFloat(getFieldCaseInsensitive(latestRow, ['longitude', 'lon'])),
                    lastUpdated: new Date(getFieldCaseInsensitive(latestRow, ['datetime', 'DATETIME'])).toLocaleString() || 'N/A'
                });
            }

        } catch (err) {
            console.error(`[DashboardMap] Error fetching data for ${serial}:`, err);
        }
    }
}

// ==========================================
// 2. METRICS CONFIGURATION
// ==========================================
const METRIC_CONFIG = {
    rsrp: {
        titleId: 'rsrp-title', descId: 'rsrp-desc', unit: 'dBm',
        fetchInstant: fetchInstantRsrpProbeData, fetchAverage: fetchAverageRsrpProbeData,
        valueKey: 'instant_rsrp', avgKey: 'average_rsrp', invertColors: false 
    },
    sinr: {
        titleId: 'sinr-title', descId: 'sinr-desc', unit: 'dB',
        fetchInstant: fetchInstantSinrProbeData, fetchAverage: fetchAverageSinrProbeData,
        valueKey: 'instant_sinr', avgKey: 'average_sinr', invertColors: false 
    },
    rtt: {
        titleId: 'rtt-title', descId: 'rtt-desc', unit: 'ms',
        fetchInstant: fetchInstantRttProbeData, fetchAverage: fetchAverageRttProbeData,
        valueKey: 'instant_rtt', avgKey: 'average_rtt', invertColors: true 
    }
};

// ==========================================
// 3. APPLICATION STATE & INITIALIZATION
// ==========================================
let dashboardMapInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Instantiate map attached to specific DOM element
    dashboardMapInstance = new DashboardMap('dashboard-map');
    await dashboardMapInstance.init();
    
    await initDashboard();
});

async function initDashboard() {
    const serials = await fetchLiveProbeNameMap().catch(() => ({}));
    const dropdownMenu = document.getElementById('dropdown-menu');
    const dropdownButton = document.getElementById('dropdown-toggle');
    
    if (!dropdownMenu || !dropdownButton) return;

    dropdownMenu.innerHTML = '';
    Object.entries(serials).forEach(([serial, name]) => {
        const item = document.createElement('li');
        item.innerHTML = `<a class="dropdown-item" href="#" data-serial="${serial}">${name || serial}</a>`;
        dropdownMenu.appendChild(item);
    });

    dropdownMenu.addEventListener('click', (event) => {
        const itemLink = event.target.closest('a.dropdown-item');
        if (!itemLink) return;
        event.preventDefault();

        const selectedSerial = itemLink.dataset.serial;
        dropdownButton.textContent = itemLink.textContent;
        dropdownButton.dataset.selectedSerial = selectedSerial;

        triggerDataRefresh(selectedSerial);
    });

    // Auto-select first item
    const firstLink = dropdownMenu.querySelector('a.dropdown-item');
    if (firstLink) {
        dropdownButton.textContent = firstLink.textContent;
        dropdownButton.dataset.selectedSerial = firstLink.dataset.serial;
        triggerDataRefresh(firstLink.dataset.serial);
    }
}

function triggerDataRefresh(serial) {
    if (!serial) return;
    loadGenericMetric(serial, METRIC_CONFIG.rsrp);
    loadGenericMetric(serial, METRIC_CONFIG.sinr);
    loadGenericMetric(serial, METRIC_CONFIG.rtt);
    loadTempData(serial);
    
    // Use the class instance method instead of the generic map.js function
    dashboardMapInstance.updateForSerial(serial);
}

// ==========================================
// 4. DATA FETCHERS
// ==========================================
async function loadGenericMetric(serial, config) {
    const descEl = document.getElementById(config.descId);
    const titleEl = document.getElementById(config.titleId);
    
    descEl.textContent = 'Loading...';
    
    try {
        const [instantData, avgData] = await Promise.all([
            config.fetchInstant(serial),
            config.fetchAverage(serial)
        ]);

        if (instantData && instantData[config.valueKey] !== undefined) {
            const instantVal = instantData[config.valueKey];
            titleEl.textContent = `${instantVal.toFixed(2)} ${config.unit}`;
            const avgVal = avgData ? avgData[config.avgKey] : null;

            if (!avgVal) {
                descEl.textContent = `No historical data available`;
                descEl.style.color = 'white';
            } else {
                const diff = ((instantVal - avgVal) / Math.abs(avgVal)) * 100;
                const isLower = diff < 0;
                const isBad = config.invertColors ? !isLower : isLower;
                descEl.textContent = diff === 0 ? `Same as 30-day avg` : `${isLower ? '↓' : '↑'} ${Math.abs(diff).toFixed(1)}% vs 30-day avg`;
                descEl.style.color = diff === 0 ? 'white' : (isBad ? 'red' : 'green');
            }
        } else {
            titleEl.textContent = `N/A`;
            descEl.textContent = 'No data available';
        }
    } catch (err) {
        titleEl.textContent = `N/A`;
        descEl.textContent = `Error loading data`;
    }
}

async function loadTempData(serial) {
    const descEl = document.getElementById('temp-desc');
    const titleEl = document.getElementById('temp-title');
    descEl.textContent = 'Loading...';

    try {
        const datamain = await fetchInstantTempProbeData(serial);
        if (datamain && datamain.instant_temp !== undefined) {
            const temp = datamain.instant_temp;
            titleEl.textContent = `${temp} °C`;
            descEl.textContent = temp >= 50 ? `High temperature - potential overheating` : `Normal`;
            descEl.style.color = temp >= 50 ? 'red' : 'green';
        } else {
            throw new Error('No data');
        }
    } catch (err) {
        titleEl.textContent = `N/A`;
        descEl.textContent = 'Error loading data';
    }
}