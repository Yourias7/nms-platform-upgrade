/**
 * Global Error Handler
 * Detects and handles page load errors, redirecting to error page when needed
 * Include this script as early as possible in your HTML (right after <body> tag)
 */

// Track if page loaded successfully
let pageLoadedSuccessfully = false;
let hasUnhandledErrors = false;

// Set a timeout for page load - if JavaScript doesn't mark success within timeout, show error
const PAGE_LOAD_TIMEOUT = 60000; // 30 seconds

// Timer for page load timeout
let pageLoadTimer = setTimeout(() => {
  if (!pageLoadedSuccessfully && !hasUnhandledErrors) {
    redirectToError('timeout', 'Page Load Timeout', 'The page took too long to load. Please try again.');
  }
}, PAGE_LOAD_TIMEOUT);

/**
 * Mark page as successfully loaded
 * Call this from your page initialization code when everything is ready
 */
window.markPageAsLoaded = function() {
  clearTimeout(pageLoadTimer);
  pageLoadedSuccessfully = true;
  console.log('[Page Handler] Page marked as successfully loaded');
};

/**
 * Redirect to error page with details
 */
function redirectToError(type, title, message, details = null) {
  if (hasUnhandledErrors) return; // Prevent multiple redirects
  
  hasUnhandledErrors = true;
  clearTimeout(pageLoadTimer);
  
  const params = new URLSearchParams();
  params.append('type', type);
  params.append('title', title);
  params.append('message', message);
  
  if (details) {
    params.append('details', JSON.stringify(details, null, 2));
  }
  
  console.error(`[Page Handler] Redirecting to error page: ${title} - ${message}`);
  window.location.href = `/error?${params.toString()}`;
}

// Global error handler for unhandled exceptions
window.addEventListener('error', (event) => {
  console.error('[Page Handler] Unhandled error:', event.error);
  redirectToError(
    'javascript',
    'JavaScript Error',
    event.error?.message || 'An unexpected error occurred',
    {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      message: event.error?.message,
      stack: event.error?.stack
    }
  );
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Page Handler] Unhandled promise rejection:', event.reason);
  redirectToError(
    'javascript',
    'Promise Rejection Error',
    event.reason?.message || 'An unexpected error occurred',
    {
      reason: String(event.reason),
      stack: event.reason?.stack
    }
  );
});

// Monitor script loading failures
document.addEventListener('error', (event) => {
  if (event.target.tagName === 'SCRIPT') {
    console.error('[Page Handler] Script failed to load:', event.target.src);
    redirectToError(
      'script',
      'Script Loading Failed',
      `Failed to load required script: ${event.target.src}`,
      {
        script: event.target.src
      }
    );
  } else if (event.target.tagName === 'LINK') {
    console.error('[Page Handler] Stylesheet failed to load:', event.target.href);
    redirectToError(
      'script',
      'Stylesheet Loading Failed',
      `Failed to load required stylesheet: ${event.target.href}`,
      {
        stylesheet: event.target.href
      }
    );
  }
}, true);

// Detect network errors during fetch/XHR (log but don't treat as fatal)
// This helps track network issues without breaking the app when optional features fail
const originalFetch = window.fetch;
window.fetch = function(...args) {
  return originalFetch.apply(this, args).catch((error) => {
    // Only log as error if it's a critical failure
    // Most network errors are handled by the calling code's try-catch
    if (error.message && error.message.includes('NetworkError')) {
      console.debug('[Page Handler] Network error (will be handled by caller):', error.message);
    } else {
      console.warn('[Page Handler] Fetch error (will be handled by caller):', error);
    }
    // Re-throw to allow normal error handling
    throw error;
  });
};

console.log('[Page Handler] Global error handler initialized');
