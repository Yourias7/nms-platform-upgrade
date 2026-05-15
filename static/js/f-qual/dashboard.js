import { fetchHistoricProbeNameMap, getExportUrl, fetchAverageRsrpProbeData, fetchInstantRsrpProbeData, fetchLiveProbeNameMap } from '../shared/api.js';

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



async function loadDashboard() {

    // Initial Load of probe name dropdown
    await loadSerialsForFilter().catch((err) => {
        console.error('Failed to load probe name dropdown:', err);
    });

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
        });
    }

}
loadDashboard();
