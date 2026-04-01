# Error Handling Implementation Guide

## Overview
This error handling system provides a comprehensive catch-all for page load failures and runtime errors. When something goes wrong during page load or execution, users are redirected to a user-friendly error page instead of seeing a blank/broken page.

## Components

### 1. Error Page (`/templates/error.html`)
- **Route**: `/error`
- **Purpose**: User-friendly error display page
- **Features**:
  - Shows appropriate error title and message
  - Displays error code if available
  - Provides "Go Home" and "Reload Page" buttons
  - Optional technical details for debugging
  - Consistent styling with main platform

### 2. Error Handler Script (`/static/js/shared/error-handler.js`)
- **Purpose**: Global error detection and handling
- **Features**:
  - Catches unhandled JavaScript errors
  - Detects script/stylesheet loading failures
  - Handles promise rejections
  - Page load timeout detection (30 seconds default)
  - Logs all errors to console

## Integration Steps

### Step 1: Add Error Handler Script to Your Page
Include this script **as early as possible** in the `<head>` or immediately after `<body>`:

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Other head content -->
  <script src="/static/js/shared/error-handler.js"></script>
  <!-- Rest of head -->
</head>
<body>
  <!-- Page content -->
</body>
</html>
```

> **Important**: The error handler script must come before other scripts that might fail!

### Step 2: Mark Page as Successfully Loaded
Call `window.markPageAsLoaded()` in your page's initialization code when everything is fully loaded and ready:

**Example: In your page's JavaScript module:**
```javascript
async function init() {
  try {
    console.log('[Dashboard] Initializing');
    
    // ... all your initialization code ...
    
    await fetchAndRenderSerials();
    await initializeUI();
    
    // Mark page as successfully loaded
    window.markPageAsLoaded();
    console.log('[Dashboard] Initialization complete');
  } catch (error) {
    console.error('[Dashboard] Failed to initialize', error);
    // Don't mark as loaded - let error handler catch this
  }
}

// Start application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

### Step 3: Existing Pages to Update
Add the error handler script to these pages:
- `templates/4skelion/liveview.html`
- `templates/4skelion/alarms.html`
- `templates/4skelion/playback.html`
- `templates/4skelion/historic_details.html`
- `templates/4skelion/alarm_summary.html`
- `templates/4skelion/performance_alarm.html`
- `templates/4skelion/settings.html`
- (and others)

And in corresponding JavaScript files (e.g., `app.js`, `alarms.js`, `playback.js`), add `window.markPageAsLoaded()` at the end of initialization.

## Error Types Detected

| Type | Trigger | Example |
|------|---------|---------|
| `timeout` | Page load exceeds 30 seconds | Slow network/server |
| `javascript` | Unhandled JavaScript error | Null reference, undefined function |
| `script` | Script file fails to load | CDN down, 404 error |
| `network` | Network request fails | No internet, CORS error |

## Customization

### Change Page Load Timeout
Edit `/static/js/shared/error-handler.js`:
```javascript
const PAGE_LOAD_TIMEOUT = 60000; // 60 seconds instead of 30
```

### Add Custom Error Messages
From your page code:
```javascript
// Redirect with custom error
if (criticalDataMissing) {
  redirectToError(
    'data',
    'Missing Data',
    'Required data could not be loaded from the server',
    { requiredFields: ['SERIAL', 'NAME'] }
  );
}
```

### Disable Timeout for Specific Pages
```javascript
// At the end of init() in a long-loading page
window.markPageAsLoaded(); // Call this even if page is still loading
```

## Testing

### Test Timeout Error
1. Go to any page with error handler
2. Disable JavaScript execution in DevTools
3. Wait 30+ seconds
4. You'll be redirected to error page

### Test Script Loading Failure
1. Open network throttling in DevTools
2. Disable a CDN script manually in DevTools
3. Try to load a page
4. Error page should appear

### Test JavaScript Error
1. Go to browser console
2. Type: `throw new Error('Test error')`
3. You'll be redirected to error page with stack trace

## Error Page URL Parameters

The error page uses URL parameters to display error information:

```
/error?type=timeout&message=Page Load Timeout&details=...
```

- `type`: Error type (timeout, javascript, script, network)
- `message`: User-friendly error message
- `details`: Technical details (JSON-encoded)

## Logging and Debugging

All errors are logged to browser console with `[Page Handler]` prefix:
```
[Page Handler] Page marked as successfully loaded
[Page Handler] Unhandled error: TypeError: Cannot read property 'x' of null
[Page Handler] Redirecting to error page: JavaScript Error - ...
```

Check browser console (F12 > Console tab) to see detailed error information.

## Best Practices

1. **Always call `window.markPageAsLoaded()`** at the end of your page init
2. **Include error handler early** in HTML to catch early errors
3. **Use try-catch blocks** around critical operations
4. **Log errors** to console for debugging
5. **Test error scenarios** regularly
6. **Monitor error page hits** in production for common issues

## Common Issues

### "Redirecting to error page" happens immediately
- Check that critical scripts/stylesheets are loading
- Verify network connectivity
- Check browser console for specific error messages
- Ensure `window.markPageAsLoaded()` is being called

### Error page shows blank
- Verify `/error` route exists in `main.py`
- Check that `error.html` template exists
- Verify static assets are accessible

### Page never marks as loaded
- `window.markPageAsLoaded()` not being called
- JavaScript error preventing execution
- Page in infinite loading state

## Support

For issues with error handling:
1. Check browser console (F12)
2. Look for `[Page Handler]` log messages
3. Visit error page directly: `/error`
4. Check error page shows properly with path `/static/css/style.css`
