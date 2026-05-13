import { fetchHistoricProbeNameMap, getExportUrl } from '../shared/api.js';

async function loadSerialsForFilter() {
    const serials = await fetchHistoricProbeNameMap();
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



loadSerialsForFilter().catch((err) => {
    console.error('Failed to load probe name dropdown:', err);
});