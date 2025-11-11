/**
 * Shared utilities for NDX Webform Presets Extension
 */

// ============================================================================
// DOM UTILITIES
// ============================================================================

/**
 * Create a modal overlay
 */
function createModal(content, options = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'wfp-modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 16px;
  `;

  const modal = document.createElement('div');
  modal.className = 'wfp-modal';
  
  // Responsive width: 90% on desktop with max-width, 100% on mobile
  const width = options.width || '800px';
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: ${width};
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  `;
  
  // Mobile adjustments
  const mobileStyles = document.createElement('style');
  mobileStyles.textContent = `
    @media (max-width: 768px) {
      .wfp-modal {
        width: 100% !important;
        max-width: 100% !important;
        max-height: 100vh !important;
        border-radius: 0 !important;
      }
      .wfp-modal-overlay {
        padding: 0 !important;
      }
    }
  `;
  if (!document.getElementById('wfp-modal-styles')) {
    mobileStyles.id = 'wfp-modal-styles';
    document.head.appendChild(mobileStyles);
  }

  modal.innerHTML = content;
  overlay.appendChild(modal);

  // Close on overlay click
  if (options.closeOnOverlayClick !== false) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  return overlay;
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `wfp-toast wfp-toast-${type}`;
  
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${colors[type] || colors.info};
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 1000000;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    animation: wfp-slide-in 0.3s ease-out;
  `;

  toast.innerHTML = `
    <span style="font-size: 20px;">${icons[type] || icons.info}</span>
    <span>${escapeHtml(message)}</span>
  `;

  // Add animation styles
  if (!document.getElementById('wfp-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'wfp-toast-styles';
    style.textContent = `
      @keyframes wfp-slide-in {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes wfp-slide-out {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'wfp-slide-out 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);

  return toast;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe) {
  const div = document.createElement('div');
  div.textContent = unsafe;
  return div.innerHTML;
}

/**
 * Get current page info
 */
function getCurrentPageInfo() {
  const url = new URL(window.location.href);
  return {
    url: url.href,
    domain: url.hostname,
    pathname: url.pathname
  };
}

// ============================================================================
// SYNC SERVICE UTILITIES
// ============================================================================

/**
 * Get the sync service base URL
 */
async function getSyncServiceUrl() {
  try {
    const result = await chrome.storage.local.get(['syncHost', 'syncPort']);
    const host = result.syncHost || 'localhost';
    const port = result.syncPort || '8765';
    return `http://${host}:${port}/api/v1`;
  } catch (error) {
    console.error('Error getting sync service URL:', error);
    return 'http://localhost:8765/api/v1';
  }
}

/**
 * Test connection to sync service
 */
async function testSyncServiceConnection() {
  try {
    const baseUrl = await getSyncServiceUrl();
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get or create session ID for this browser
 */
async function getSessionId() {
  try {
    let result = await chrome.storage.local.get('sessionId');
    if (!result.sessionId) {
      // Generate a new session ID
      result.sessionId = crypto.randomUUID();
      await chrome.storage.local.set({ sessionId: result.sessionId });
    }
    return result.sessionId;
  } catch (error) {
    console.error('Error getting session ID:', error);
    return 'default-session';
  }
}

/**
 * Sync disabled domains with the sync service
 */
async function syncDisabledDomains() {
  try {
    const syncTest = await testSyncServiceConnection();
    if (!syncTest.success) {
      return { success: false, error: 'Sync service not available' };
    }

    const sessionId = await getSessionId();
    const baseUrl = await getSyncServiceUrl();
    
    // Get disabled domains from sync service
    const response = await fetch(`${baseUrl}/disabled-domains?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    if (data.success) {
      // Update local storage with synced domains
      await chrome.storage.local.set({ disabledDomains: data.data.domains || [] });
      return { success: true, domains: data.data.domains || [] };
    }
    
    return { success: false, error: data.error || 'Unknown error' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Disable domain (sync to service if available)
 */
async function disableDomainSync(domain) {
  try {
    const syncTest = await testSyncServiceConnection();
    const sessionId = await getSessionId();
    
    if (syncTest.success) {
      // Sync to service
      const baseUrl = await getSyncServiceUrl();
      const response = await fetch(`${baseUrl}/disabled-domains/${encodeURIComponent(domain)}?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Also update local storage
          const { disabledDomains = [] } = await chrome.storage.local.get('disabledDomains');
          if (!disabledDomains.includes(domain)) {
            disabledDomains.push(domain);
            await chrome.storage.local.set({ disabledDomains });
          }
          return { success: true, synced: true };
        }
      }
    }
    
    // Fallback to local storage only
    const { disabledDomains = [] } = await chrome.storage.local.get('disabledDomains');
    if (!disabledDomains.includes(domain)) {
      disabledDomains.push(domain);
      await chrome.storage.local.set({ disabledDomains });
    }
    return { success: true, synced: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Enable domain (sync to service if available)
 */
async function enableDomainSync(domain) {
  try {
    const syncTest = await testSyncServiceConnection();
    const sessionId = await getSessionId();
    
    if (syncTest.success) {
      // Sync to service
      const baseUrl = await getSyncServiceUrl();
      const response = await fetch(`${baseUrl}/disabled-domains/${encodeURIComponent(domain)}?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Also update local storage
          const { disabledDomains = [] } = await chrome.storage.local.get('disabledDomains');
          const index = disabledDomains.indexOf(domain);
          if (index > -1) {
            disabledDomains.splice(index, 1);
            await chrome.storage.local.set({ disabledDomains });
          }
          return { success: true, synced: true };
        }
      }
    }
    
    // Fallback to local storage only
    const { disabledDomains = [] } = await chrome.storage.local.get('disabledDomains');
    const index = disabledDomains.indexOf(domain);
    if (index > -1) {
      disabledDomains.splice(index, 1);
      await chrome.storage.local.set({ disabledDomains });
    }
    return { success: true, synced: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
