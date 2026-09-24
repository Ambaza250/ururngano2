// Count one page view each time a public page is loaded.
fetch('/api/analytics/page-view', { method: 'POST', keepalive: true }).catch(() => {});
