import { fetchHistoricProbeNameMap, getExportUrl } from '../shared/api.js';

async function loadSerialsForFilter() {
    const serials = await fetchHistoricProbeNameMap();
    const dropdownMenu = document.getElementById('dropdown-menu');
    if (!dropdownMenu) return;

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
}

loadSerialsForFilter().catch((err) => {
    console.error('Failed to load probe name dropdown:', err);
});