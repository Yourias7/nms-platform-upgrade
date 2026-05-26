import { fetchInstantTempProbeData, fetchInstantRttProbeData, fetchAverageRttProbeData, fetchAverageRsrpProbeData, fetchInstantRsrpProbeData, fetchAverageSinrProbeData, fetchInstantSinrProbeData, fetchLiveProbeNameMap } from '../shared/api.js';
import { initMap, preloadCustomIcon, updateMapMarkers, getMarkers, getMap, hideMapLoading } from './map.js';

// Initialize the map when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    await initMap();
    preloadCustomIcon();
});

async function loadSerialsForFilter() {
    const serials = await fetchLiveProbeNameMap();
    const dropdownMenu = document.getElementById('dropdown-menu');
    if (!dropdownMenu) return;

    const dropdown = dropdownMenu.closest('.dropdown');
    const dropdownButton = dropdown?.querySelector('.dropdown-toggle');

    dropdownMenu.innerHTML = '';

    Object.entries(serials).forEach(([serial, name]) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'dropdown-item';
        link.href = '#';
        link.dataset.serial = serial;
        link.textContent = name || serial;
        item.appendChild(link);
        dropdownMenu.appendChild(item);
    });

    if (dropdownMenu && dropdownButton) {
        dropdownMenu.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const itemLink = target.closest('a.dropdown-item');
            if (!itemLink) return;

            event.preventDefault();
            dropdownButton.textContent = itemLink.textContent || 'Select system';
            dropdownButton.dataset.selectedSerial = itemLink.dataset.serial || '';
        });

        // Auto-select first item
        const firstLink = dropdownMenu.querySelector('a.dropdown-item');
        if (firstLink) {
            dropdownButton.textContent = firstLink.textContent || 'Select system';
            dropdownButton.dataset.selectedSerial = firstLink.dataset.serial || '';
        }
    }
}

/**
 * Load RSRP data using current filter values and update the card
 */
async function loadRsrpData() {
    const dropdownButton = document.getElementById('dropdown-toggle');
    const rsrpDescElement = document.getElementById('rsrp-desc');
    const rsrpTitleElement = document.getElementById('rsrp-title');

    const serial = dropdownButton?.dataset.selectedSerial;

    if (!serial) {
        rsrpDescElement.textContent = 'Please select a system';
        return;
    }

    try {
        rsrpDescElement.textContent = 'Loading...';
        const datamain = await fetchInstantRsrpProbeData(serial);
        const data = await fetchAverageRsrpProbeData(serial);
        
        if (datamain && typeof datamain === 'object') {
            // Format and display the data
            const diff = (datamain.instant_rsrp - data.average_rsrp) / data.average_rsrp * 100;
            console.log(`Instant RSRP: ${datamain.instant_rsrp}, Average RSRP: ${data.average_rsrp}, Diff: ${diff}%`);
            if (!data.average_rsrp) {
                rsrpDescElement.textContent = `No historical data available for comparison`;
                rsrpDescElement.style.color = 'white';
            }
            else if (diff < 0) {
                rsrpDescElement.textContent = `↓ ${Math.abs(diff).toFixed(1)}% Lower than avg of last 30 days`;
                rsrpDescElement.style.color = 'red';
            } else if (diff > 0) {
                rsrpDescElement.textContent = `↑ ${diff.toFixed(1)}% Higher than avg of last 30 days`;
                rsrpDescElement.style.color = 'green';
            }
            else if (diff === 0) {
                rsrpDescElement.textContent = `Same as avg of last 30 days`;
                rsrpDescElement.style.color = 'white';
            }
            rsrpTitleElement.textContent = `${datamain.instant_rsrp.toFixed(2)} dBm`;
        } else {
            rsrpTitleElement.textContent = `N/A`;
            rsrpDescElement.textContent = 'No data available';
        }
    } catch (err) {
        console.error('Failed to load RSRP data:', err);
        rsrpTitleElement.textContent = `N/A`;
        rsrpDescElement.textContent = `Error loading data: ${err.message}`;
    }
}

/**
 * Load SINR data using current filter values and update the card
 */
async function loadSinrData() {
    const dropdownButton = document.getElementById('dropdown-toggle');
    const sinrDescElement = document.getElementById('sinr-desc');
    const sinrTitleElement = document.getElementById('sinr-title');

    const serial = dropdownButton?.dataset.selectedSerial;

    if (!serial) {
        sinrDescElement.textContent = 'Please select a system';
        return;
    }

    try {
        sinrDescElement.textContent = 'Loading...';
        const datamain = await fetchInstantSinrProbeData(serial);
        const data = await fetchAverageSinrProbeData(serial);
        
        if (datamain && typeof datamain === 'object') {
            // Format and display the data
            const diff = (datamain.instant_sinr - data.average_sinr) / data.average_sinr * 100;
            console.log(`Instant SINR: ${datamain.instant_sinr}, Average SINR: ${data.average_sinr}, Diff: ${diff}%`);
            if (!data.average_sinr) {
                sinrDescElement.textContent = `No historical data available for comparison`;
                sinrDescElement.style.color = 'white';
            }
            else if (diff < 0) {
                sinrDescElement.textContent = `↓ ${Math.abs(diff).toFixed(1)}% Lower than avg of last 30 days`;
                sinrDescElement.style.color = 'red';
            } else if (diff > 0) {
                sinrDescElement.textContent = `↑ ${diff.toFixed(1)}% Higher than avg of last 30 days`;
                sinrDescElement.style.color = 'green';
            }
            else if (diff === 0) {
                sinrDescElement.textContent = `Same as avg of last 30 days`;
                sinrDescElement.style.color = 'white';
            }
            sinrTitleElement.textContent = `${datamain.instant_sinr.toFixed(2)} dB`;
        } else {
            sinrTitleElement.textContent = `N/A`;
            sinrDescElement.textContent = 'No data available';
        }
    } catch (err) {
        console.error('Failed to load SINR data:', err);
        sinrTitleElement.textContent = `N/A`;
        sinrDescElement.textContent = `Error loading data: ${err.message}`;
    }
}

/**
 * Load RTT data using current filter values and update the card
 */
async function loadRttData() {
    const dropdownButton = document.getElementById('dropdown-toggle');
    const rttDescElement = document.getElementById('rtt-desc');
    const rttTitleElement = document.getElementById('rtt-title');

    const serial = dropdownButton?.dataset.selectedSerial;

    if (!serial) {
        rttDescElement.textContent = 'Please select a system';
        return;
    }

    try {
        rttDescElement.textContent = 'Loading...';
        const datamain = await fetchInstantRttProbeData(serial);
        const data = await fetchAverageRttProbeData(serial);
        
        if (datamain && typeof datamain === 'object') {
            // Format and display the data
            const diff = (datamain.instant_rtt - data.average_rtt) / data.average_rtt * 100;
            console.log(`Instant RTT: ${datamain.instant_rtt}, Average RTT: ${data.average_rtt}, Diff: ${diff}%`);
            if (!data.average_rtt) {
                rttDescElement.textContent = `No historical data available for comparison`;
                rttDescElement.style.color = 'white';
            }
            else if (diff < 0) {
                rttDescElement.textContent = `↓ ${Math.abs(diff).toFixed(1)}% Lower than avg of last 30 days`;
                rttDescElement.style.color = 'green';
            } else if (diff > 0) {
                rttDescElement.textContent = `↑ ${diff.toFixed(1)}% Higher than avg of last 30 days`;
                rttDescElement.style.color = 'red';
            }
            else if (diff === 0) {
                rttDescElement.textContent = `Same as avg of last 30 days`;
                rttDescElement.style.color = 'white';
            }
            rttTitleElement.textContent = `${datamain.instant_rtt.toFixed(2)} ms`;
        } else {
            rttTitleElement.textContent = `N/A`;
            rttDescElement.textContent = 'No data available';
        }
    } catch (err) {
        console.error('Failed to load RTT data:', err);
        rttTitleElement.textContent = `N/A`;
        rttDescElement.textContent = `Error loading data: ${err.message}`;
    }
}


/**
 * Load temperature data using current filter values and update the card
 */
async function loadTempData() {
    const dropdownButton = document.getElementById('dropdown-toggle');
    const tempDescElement = document.getElementById('temp-desc');
    const tempTitleElement = document.getElementById('temp-title');

    const serial = dropdownButton?.dataset.selectedSerial;

    if (!serial) {
        tempDescElement.textContent = 'Please select a system';
        return;
    }

    try {
        tempDescElement.textContent = 'Loading...';
        const datamain = await fetchInstantTempProbeData(serial);
        
        if (datamain && typeof datamain === 'object') {
            // Format and display the data
            console.log(`Instant Temperature: ${datamain.instant_temp} °C`);
            if (datamain.instant_temp >= 50) {
                tempDescElement.textContent = `High temperature - potential overheating`;
                tempDescElement.style.color = 'red';
            } else if (datamain.instant_temp >= 0 && datamain.instant_temp < 50) {
                tempDescElement.textContent = `Normal`;
                tempDescElement.style.color = 'green';
            }
            tempTitleElement.textContent = `${datamain.instant_temp} °C`;
        } else {
            tempTitleElement.textContent = `N/A`;
            tempDescElement.textContent = 'No data available';
        }
    } catch (err) {
        console.error('Failed to load temperature data:', err);
        tempTitleElement.textContent = `N/A`;
        tempDescElement.textContent = `Error loading data: ${err.message}`;
    }
}



async function loadDashboard() {

    // Initial Load of probe name dropdown, then load all cards with the default serial
    await loadSerialsForFilter().catch((err) => {
        console.error('Failed to load probe name dropdown:', err);
    });
    loadRsrpData();
    loadSinrData();
    loadRttData();
    loadTempData();

    const dropdownButton = document.getElementById('dropdown-toggle');
    if (dropdownButton) {
        dropdownButton.addEventListener('click', async () => {
            await loadSerialsForFilter().catch((err) => {
                console.error('Failed to reload probe name dropdown:', err);
            });
        });
    }

    const dropdownMenu = document.getElementById('dropdown-menu');

    if (dropdownMenu) {
        dropdownMenu.addEventListener('click', () => {
            // Delay to ensure dropdown is closed and data attribute is set
            setTimeout(loadRsrpData, 100);
            setTimeout(loadSinrData, 100);
            setTimeout(loadRttData, 100);
            setTimeout(loadTempData, 100);
            setTimeout(() => {
                initMap();
                preloadCustomIcon();
            }, 100);
        });
    }

}
loadDashboard();
