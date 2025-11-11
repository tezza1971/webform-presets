/**
 * Popup Script for Webform Presets Extension
 */

// Store presets for current page
let currentPresets = [];

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
  setupEventListeners();
});

/**
 * Initialize the popup
 */
async function initializePopup() {
  // Check sync service connection
  updateSyncStatus();
  
  // Check if extension is unlocked
  const response = await chrome.runtime.sendMessage({ action: 'isUnlocked' });
  
  if (response.unlocked) {
    showUnlockedState();
    await loadPresetsForCurrentPage();
  } else {
    showLockedState();
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('unlock-btn')?.addEventListener('click', handleUnlock);
  document.getElementById('save-btn')?.addEventListener('click', handleSave);
  document.getElementById('manage-btn')?.addEventListener('click', handleManage);
  document.getElementById('test-forms-btn')?.addEventListener('click', handleTestForms);
  document.getElementById('toggle-domain-btn')?.addEventListener('click', handleToggleDomain);
}

// ============================================================================
// UI STATE MANAGEMENT
// ============================================================================

/**
 * Show locked state
 */
function showLockedState() {
  document.getElementById('locked-state').style.display = 'block';
  document.getElementById('unlocked-state').style.display = 'none';
}

/**
 * Show unlocked state
 */
async function showUnlockedState() {
  document.getElementById('locked-state').style.display = 'none';
  document.getElementById('unlocked-state').style.display = 'block';
  
  // Update toggle button state
  await updateToggleButton();
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle unlock button click
 */
async function handleUnlock() {
  // Get current tab to return to after unlock
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Store referrer URL
  await chrome.storage.session.set({ unlockReferrer: currentTab.url });
  
  const unlockUrl = chrome.runtime.getURL('unlock.html');
  await chrome.tabs.create({ url: unlockUrl });
  window.close();
}

/**
 * Handle save button click
 */
async function handleSave() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send to background script to coordinate the save
    const response = await chrome.runtime.sendMessage({
      action: 'triggerSavePreset',
      tabId: tab.id
    });
    
    if (response && response.error) {
      showNotification('Error', response.error, 'error');
      return;
    }
    
    // Close popup - the save modal will appear on the page
    window.close();
  } catch (error) {
    console.error('Error saving:', error);
    showNotification('Error', 'Could not initiate save', 'error');
  }
}

/**
 * Handle manage button click (reuses existing tab if present)
 */
async function handleManage() {
  const optionsUrl = chrome.runtime.getURL('options.html');
  
  // Check if options page is already open
  const tabs = await chrome.tabs.query({ url: optionsUrl });
  
  if (tabs.length > 0) {
    // Focus existing tab
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    // Create new tab
    await chrome.tabs.create({ url: optionsUrl });
  }
  
  window.close();
}

/**
 * Handle test forms button click
 */
async function handleTestForms() {
  const testFormsUrl = chrome.runtime.getURL('test-forms.html');
  
  // Check if test forms page is already open
  const tabs = await chrome.tabs.query({ url: testFormsUrl });
  
  if (tabs.length > 0) {
    // Focus existing tab
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    // Create new tab
    await chrome.tabs.create({ url: testFormsUrl });
  }
  
  window.close();
}

// ============================================================================
// PRESETS LOADING
// ============================================================================

/**
 * Load presets for the current page
 */
async function loadPresetsForCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if domain is enabled
    const url = new URL(tab.url);
    const domain = url.hostname;
    const domainStatus = await chrome.runtime.sendMessage({
      action: 'isDomainEnabled',
      domain: domain
    });
    
    if (!domainStatus.enabled) {
      // Domain is disabled, show empty state
      displayPresets([]);
      return;
    }
    
    // Request presets from background script
    const response = await chrome.runtime.sendMessage({ 
      action: 'getPresetsForPage',
      url: tab.url 
    });
    
    if (response.success) {
      // Filter presets to only those whose forms exist on the current page
      const validPresets = [];
      for (const preset of response.presets) {
        try {
          const checkResponse = await chrome.tabs.sendMessage(tab.id, {
            action: 'checkFormExists',
            formSelector: preset.formSelector
          });
          if (checkResponse.exists) {
            validPresets.push(preset);
          }
        } catch (error) {
          // If we can't check, include it anyway
          console.warn('Could not check form existence:', error);
          validPresets.push(preset);
        }
      }
      displayPresets(validPresets);
    } else {
      console.error('Failed to load presets:', response.error);
      const presetsList = document.getElementById('presets-list');
      presetsList.innerHTML = '<p class="no-presets">No presets for this page</p>';
    }
    
  } catch (error) {
    console.error('Error loading presets:', error);
    const presetsList = document.getElementById('presets-list');
    presetsList.innerHTML = '<p class="no-presets">No presets for this page</p>';
  }
}

/**
 * Display presets in the list
 */
function displayPresets(presets) {
  // Store presets for later use
  currentPresets = presets;
  
  const presetsList = document.getElementById('presets-list');
  
  if (presets.length === 0) {
    // Check if we need to show "disabled" message
    checkIfDomainDisabled().then(isDisabled => {
      if (isDisabled) {
        presetsList.innerHTML = '<p class="no-presets">Disabled for this domain</p>';
      } else {
        presetsList.innerHTML = '<p class="no-presets">No presets for this page</p>';
      }
    });
    return;
  }
  
  presetsList.innerHTML = '';
  
  presets.forEach((preset, index) => {
    const presetItem = document.createElement('div');
    presetItem.className = 'preset-item';
    presetItem.innerHTML = `
      <div class="preset-name">${escapeHtml(preset.name)}</div>
      <div class="preset-actions">
        <button class="fill-btn" data-index="${index}" data-mode="overwrite" title="Fill all fields, overwriting existing values">Fill</button>
        <button class="fill-btn update" data-index="${index}" data-mode="update" title="Only fill fields that haven't been modified yet">Update</button>
      </div>
    `;
    presetsList.appendChild(presetItem);
  });
  
  // Add event listeners to fill buttons
  document.querySelectorAll('.fill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const presetIndex = parseInt(e.target.dataset.index);
      const mode = e.target.dataset.mode;
      handleFillPreset(presetIndex, mode);
    });
  });
}

/**
 * Check if current domain is disabled
 */
async function checkIfDomainDisabled() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    const domain = url.hostname;
    
    const response = await chrome.runtime.sendMessage({
      action: 'isDomainEnabled',
      domain: domain
    });
    
    return !response.enabled;
  } catch (error) {
    console.error('Error checking domain status:', error);
    return false;
  }
}

/**
 * Handle fill preset
 */
async function handleFillPreset(presetIndex, mode) {
  try {
    const preset = currentPresets[presetIndex];
    if (!preset) {
      showNotification('Error', 'Preset not found', 'error');
      return;
    }
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send fill command to content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'fillForm',
      formSelector: preset.formSelector,
      fields: preset.fields,
      mode: mode
    });
    
    if (response && response.success) {
      // Don't show notification - content script already shows toast
      window.close();
    } else {
      showNotification('Error', response?.error || 'Could not fill form', 'error');
    }
  } catch (error) {
    console.error('Error filling preset:', error);
    showNotification('Error', 'Could not fill preset', 'error');
  }
}

/**
 * Handle toggle domain button click
 */
async function handleToggleDomain() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    const domain = url.hostname;
    
    const response = await chrome.runtime.sendMessage({
      action: 'toggleDomainEnabled',
      domain: domain
    });
    
    if (response.success) {
      await updateToggleButton();
      await loadPresetsForCurrentPage();
      showNotification('Success', response.enabled ? 
        `Webform Presets enabled for ${domain}` : 
        `Webform Presets disabled for ${domain}`, 'success');
    } else {
      showNotification('Error', response.error, 'error');
    }
  } catch (error) {
    console.error('Error toggling domain:', error);
    showNotification('Error', 'Could not toggle domain', 'error');
  }
}

/**
 * Update toggle domain button state
 */
async function updateToggleButton() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    const domain = url.hostname;
    
    const response = await chrome.runtime.sendMessage({
      action: 'isDomainEnabled',
      domain: domain
    });
    
    const btn = document.getElementById('toggle-domain-btn');
    const text = document.getElementById('toggle-domain-text');
    const icon = btn.querySelector('.icon');
    
    if (response.enabled) {
      text.textContent = 'Disable for this domain';
      icon.textContent = '🚫';
    } else {
      text.textContent = 'Enable for this domain';
      icon.textContent = '✅';
    }
  } catch (error) {
    console.error('Error updating toggle button:', error);
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Update sync service connection status
 */
async function updateSyncStatus() {
  const statusEl = document.getElementById('sync-status');
  const statusDot = statusEl.querySelector('.status-dot');
  const statusText = statusEl.querySelector('.status-text');
  
  try {
    const result = await testSyncServiceConnection();
    
    if (result.success) {
      statusEl.className = 'sync-status connected';
      statusText.textContent = 'Sync Service';
      statusEl.title = 'Connected to webform-sync service';
    } else {
      statusEl.className = 'sync-status disconnected';
      statusText.textContent = 'Local Storage';
      statusEl.title = 'Using browser local storage (sync service unavailable)';
    }
  } catch (error) {
    statusEl.className = 'sync-status error';
    statusText.textContent = 'Error';
    statusEl.title = `Connection error: ${error.message}`;
  }
}

/**
 * Show a notification using a status message (non-modal)
 */
function showNotification(title, message, type = 'info') {
  // Create a status div at the bottom of the popup
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    position: fixed;
    bottom: 10px;
    left: 10px;
    right: 10px;
    padding: 12px;
    background: ${type === 'error' ? '#fee' : type === 'success' ? '#efe' : '#eef'};
    border: 1px solid ${type === 'error' ? '#fcc' : type === 'success' ? '#cec' : '#cce'};
    border-radius: 4px;
    font-size: 13px;
    z-index: 1000;
    animation: slideUp 0.3s ease-out;
  `;
  notification.innerHTML = `
    <strong>${title}</strong><br>
    ${message}
  `;
  
  // Add animation style if not exists
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideUp 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
