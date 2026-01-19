// static/js/utils.js
// Utility functions for the NMS Platform

/**
 * Debounce function to limit rate of function execution
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(fn, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Extract field value from object with case-insensitive key matching
 * @param {Object} obj - Object to search
 * @param {string[]} keys - Array of possible key names to match
 * @returns {any|null} Value if found, null otherwise
 */
export function getFieldCaseInsensitive(obj, keys) {
  for (const [key, val] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (keys.some(k => k.toLowerCase() === lower)) {
      return val;
    }
  }
  return null;
}

/**
 * Safely parse float with fallback
 * @param {any} value - Value to parse
 * @param {number} defaultValue - Default if parsing fails
 * @returns {number}
 */
export function safeParseFloat(value, defaultValue = 0) {
  if (value === null || value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Initialize tab navigation
 */
export function initTabs() {
  const tabButtons = document.querySelectorAll('.nav-pills button[data-tab]');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      
      // Update active button state
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show/hide tab content
      const allContent = document.querySelectorAll('.tab-content');
      allContent.forEach(content => {
        content.style.display = 'none';
      });
      
      const activeContent = document.getElementById(`content-${tabId}`);
      if (activeContent) {
        activeContent.style.display = 'block';
      }
      
      // Dispatch custom event for tab change
      window.dispatchEvent(new CustomEvent('tab-changed', { detail: { tabId } }));
    });
  });
}
