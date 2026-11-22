const q = new URLSearchParams(location.search);
addEventListener('error', e => { window.__err = String(e.message || e); });
addEventListener('unhandledrejection', e => { window.__err = String((e.reason && (e.reason.stack || e.reason.message)) || e.reason); });
try { await import('/vw3d/' + (q.get('job') || 'scenes') + '.js'); } catch (e) { window.__err = String(e.stack || e); }
