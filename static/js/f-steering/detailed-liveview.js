// static/js/f-steering/detailed-liveview.js
// F-Steering Detailed LiveView intentionally reuses the maintained 4skelion detailed map implementation.
// The template sets window.NMS_PLATFORM = 'f-steering' before this module loads, so shared/config.js
// still calls /f-steering/... endpoints while inheriting 4skelion map/cell-reference updates.

import '../4skelion/detailed-liveview.js';
