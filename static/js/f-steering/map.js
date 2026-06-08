// static/js/f-steering/map.js
// F-Steering intentionally reuses the maintained 4skelion map implementation.
// Keep F-Steering-specific filtering/API routing in shared/config.js and app/data_source.py.
// This prevents the F-Steering LiveView map from drifting when 4skelion map behavior is updated.

export * from '../4skelion/map.js';
