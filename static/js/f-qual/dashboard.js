import { 
    fetchInstantTempProbeData, fetchInstantRttProbeData, fetchAverageRttProbeData, 
    fetchAverageRsrpProbeData, fetchInstantRsrpProbeData, fetchAverageSinrProbeData, 
    fetchInstantSinrProbeData, fetchLiveProbeNameMap, fetchProbeData, fetchHistoricProbeData
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
        this.updateSeq = 0; 
        this.infoControl = null;
    }

    async init() {
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

    _initInfoControl() {
        const self = this;
        
        const ProbeInfoControl = L.Control.extend({
            options: { position: 'topright' },

            onAdd: function () {
                this._div = L.DomUtil.create('div', 'probe-info-control');
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

    async updateForSerial(serial) {
        if (!this.map) return;
        
        const currentSeq = ++this.updateSeq;
        this._clearMarkers();
        this.infoControl.update();

        try {
            const data = await fetchProbeData(serial);
            
            if (currentSeq !== this.updateSeq || !data || data.length === 0) return;

            const bounds = [];
            let latestRow = null;

            data.forEach(row => {
                const lat = safeParseFloat(getFieldCaseInsensitive(row, ['latitude', 'lat']));
                const lon = safeParseFloat(getFieldCaseInsensitive(row, ['longitude', 'lon']));

                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
                if (!latestRow) latestRow = row;

                const marker = L.marker([lat, lon], { icon: this.customIcon })
                    .addTo(this.map);

                this.markers.push(marker);
                bounds.push([lat, lon]);
            });

            if (bounds.length > 0) {
                this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: CONFIG.MAP.MAX_ZOOM });
            }

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
// 3. CHART MANAGEMENT (Encapsulated State)
// ==========================================
class DashboardChart {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.chart = null;
        this.currentSerial = null;
        this.currentMetric = 'rsrp'; 
        this.currentDays = 1;        
        this.updateSeq = 0;
        
        this.availableBands = [];
        this.selectedBands = new Set();
        this.rawDataCache = []; 
        this.hasInitializedBands = false; 

        this.metricConfig = {
            rsrp: { label: 'RSRP', unit: 'dBm', keys: ['rsrp', 'RSRP'] },
            sinr: { label: 'SINR', unit: 'dB', keys: ['sinr', 'SINR'] },
            rtt:  { label: 'RTT', unit: 'ms', keys: ['rtt', 'RTT'] },
            temp: { label: 'Temperature', unit: '°C', keys: ['temp', 'TEMP', 'temperature'] }
        };

        this.colors = ['#a78bfa', '#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#06b6d4'];
    }

    init() {
        const ctx = document.getElementById(this.canvasId).getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [] },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { type: 'time', time: { tooltipFormat: 'PPpp' }, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                },
                plugins: {
                    legend: { display: true, labels: { color: '#e2e8f0' } }, 
                    tooltip: { enabled: true }
                }
            }
        });
        this._attachListeners();
    }

    _attachListeners() {
        document.getElementById('chart-metric-toggles').addEventListener('click', (e) => {
            const link = e.target.closest('.nav-link');
            if (!link) return;
            e.preventDefault();
            document.querySelectorAll('#chart-metric-toggles .nav-link').forEach(el => el.classList.remove('active'));
            link.classList.add('active');
            this.currentMetric = link.dataset.metric;
            this.renderChart(); 
        });

        document.getElementById('chart-time-toggles').addEventListener('change', (e) => {
            if (e.target.classList.contains('btn-check')) {
                this.currentDays = parseInt(e.target.dataset.days, 10);
                this.fetchData(); 
            }
        });

        document.getElementById('chart-band-menu').addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                const val = e.target.value;
                const isChecked = e.target.checked;
                
                if (val === 'SELECT_ALL') {
                    if (isChecked) {
                        this.availableBands.forEach(b => this.selectedBands.add(b));
                    } else {
                        this.selectedBands.clear();
                    }
                    document.querySelectorAll('.chart-band-checkbox').forEach(chk => chk.checked = isChecked);
                } else {
                    if (isChecked) this.selectedBands.add(val);
                    else this.selectedBands.delete(val);
                    
                    const allChk = document.getElementById('chk-band-all');
                    if (allChk) {
                        allChk.checked = (this.selectedBands.size === this.availableBands.length && this.availableBands.length > 0);
                    }
                }
                
                this.renderChart();
            }
        });
    }

    updateForSerial(serial) {
        if (this.currentSerial !== serial) {
            this.hasInitializedBands = false;
            this.selectedBands.clear();
        }
        this.currentSerial = serial;
        this.fetchData();
    }

    async fetchData() {
        if (!this.currentSerial) return;
        const currentSeq = ++this.updateSeq;

        const latestDate = new Date();
        const earlyDate = new Date();
        earlyDate.setDate(earlyDate.getDate() - this.currentDays);

        try {
            const response = await fetchHistoricProbeData(
                this.currentSerial, earlyDate.toISOString(), latestDate.toISOString(), 1, 1000 
            );
            if (currentSeq !== this.updateSeq) return;

            this.rawDataCache = response.data ? response.data : (Array.isArray(response) ? response : []);
            this._extractBandsAndBuildMenu();
            this.renderChart();

        } catch (err) {
            console.error(`[DashboardChart] Fetch failed:`, err);
        }
    }

    _extractBandsAndBuildMenu() {
        const bands = new Set();
        this.rawDataCache.forEach(row => {
            const b = getFieldCaseInsensitive(row, ['band', 'BAND', 'earfcn']);
            if (b) bands.add(String(b));
        });

        this.availableBands = Array.from(bands).sort();
        
        if (!this.hasInitializedBands && this.availableBands.length > 0) {
            this.selectedBands.clear();
            this.selectedBands.add(this.availableBands[0]);
            this.hasInitializedBands = true;
        }

        const menu = document.getElementById('chart-band-menu');
        menu.innerHTML = '';
        
        if (this.availableBands.length === 0) {
            menu.innerHTML = `<li><span class="dropdown-item-text text-muted small">No bands detected</span></li>`;
            return;
        }

        const allSelected = (this.selectedBands.size === this.availableBands.length && this.availableBands.length > 0);
        menu.innerHTML += `
            <li class="dropdown-item border-bottom mb-1 pb-2">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="SELECT_ALL" id="chk-band-all" ${allSelected ? 'checked' : ''}>
                    <label class="form-check-label fw-bold" style="cursor: pointer; width: 100%;" for="chk-band-all">
                        Select / Deselect All
                    </label>
                </div>
            </li>
        `;

        this.availableBands.forEach(band => {
            const isChecked = this.selectedBands.has(band) ? 'checked' : '';
            menu.innerHTML += `
                <li class="dropdown-item">
                    <div class="form-check">
                        <input class="form-check-input chart-band-checkbox" type="checkbox" value="${band}" id="chk-band-${band}" ${isChecked}>
                        <label class="form-check-label" style="cursor: pointer; width: 100%;" for="chk-band-${band}">
                            Band ${band}
                        </label>
                    </div>
                </li>
            `;
        });
    }

    renderChart() {
        const mConfig = this.metricConfig[this.currentMetric];
        const groupedData = {};
        
        this.rawDataCache.forEach(row => {
            const band = String(getFieldCaseInsensitive(row, ['band', 'BAND', 'earfcn']) || 'Unknown');
            
            if (this.selectedBands.has(band) || this.selectedBands.size === 0) {
                if (!groupedData[band]) groupedData[band] = [];
                
                const rawDate = getFieldCaseInsensitive(row, ['datetime', 'DATETIME', 'timestamp']);
                const rawVal = getFieldCaseInsensitive(row, mConfig.keys);
                
                const x = new Date(rawDate);
                const y = safeParseFloat(rawVal);
                
                if (!isNaN(x) && !isNaN(y)) {
                    groupedData[band].push({ x, y });
                }
            }
        });

        const datasets = Object.keys(groupedData).map((band, index) => {
            const color = this.colors[index % this.colors.length];
            return {
                label: `Band ${band}`,
                data: groupedData[band].sort((a, b) => a.x - b.x),
                borderColor: color,
                backgroundColor: color + '22',
                borderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 10,
                fill: false, 
                tension: 0.3
            };
        });

        this.chart.data = { datasets };
        this.chart.options.scales.y.title = { display: true, text: `${mConfig.label} (${mConfig.unit})`, color: '#e2e8f0' };
        this.chart.update();
    }
}

// ==========================================
// 4. APPLICATION STATE & INITIALIZATION
// ==========================================
let dashboardMapInstance = null;
let dashboardChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    dashboardMapInstance = new DashboardMap('dashboard-map');
    await dashboardMapInstance.init();
    
    dashboardChartInstance = new DashboardChart('evolution-chart');
    dashboardChartInstance.init();
    
    await initDashboard();
});

async function initDashboard() {
    const serials = await fetchLiveProbeNameMap().catch(() => ({}));
    const sysDropdownMenu = document.getElementById('dropdown-menu');
    const sysDropdownButton = document.getElementById('dropdown-toggle');
    
    // Setup System Dropdown
    Object.entries(serials).forEach(([serial, name]) => {
        sysDropdownMenu.innerHTML += `<li><a class="dropdown-item" href="#" data-serial="${serial}">${name || serial}</a></li>`;
    });

    sysDropdownMenu.addEventListener('click', (e) => {
        const itemLink = e.target.closest('a.dropdown-item');
        if (!itemLink) return;
        e.preventDefault();
        sysDropdownButton.textContent = itemLink.textContent;
        sysDropdownButton.dataset.selectedSerial = itemLink.dataset.serial;
        triggerDataRefresh(itemLink.dataset.serial);
    });

    // Auto-select first system
    const firstLink = sysDropdownMenu.querySelector('a.dropdown-item');
    if (firstLink) {
        sysDropdownButton.textContent = firstLink.textContent;
        sysDropdownButton.dataset.selectedSerial = firstLink.dataset.serial;
        triggerDataRefresh(firstLink.dataset.serial);
    }
}

async function triggerDataRefresh(serial) {
    if (!serial) return;
    refreshSystemCards();
    dashboardMapInstance.updateForSerial(serial);
    dashboardChartInstance.updateForSerial(serial);
}

function refreshSystemCards() {
    const serial = document.getElementById('dropdown-toggle').dataset.selectedSerial;
    if (!serial) return;
    
    loadGenericMetric(serial, METRIC_CONFIG.rsrp);
    loadGenericMetric(serial, METRIC_CONFIG.sinr);
    loadGenericMetric(serial, METRIC_CONFIG.rtt);
    loadTempData(serial);
}

// ==========================================
// 5. DATA FETCHERS
// ==========================================
async function loadGenericMetric(serial, config) {
    const descEl = document.getElementById(config.descId);
    const titleEl = document.getElementById(config.titleId);
    
    descEl.textContent = 'Loading...';
    descEl.style.color = 'inherit';
    
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
    descEl.style.color = 'inherit';

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