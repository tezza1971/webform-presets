/**
 * Shared utilities for Webform Presets Extension
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
  `;

  const modal = document.createElement('div');
  modal.className = 'wfp-modal';
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: ${options.width || '500px'};
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  `;

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
