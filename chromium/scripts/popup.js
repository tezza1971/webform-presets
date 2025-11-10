/**
 * Popup Script for Webform Presets Extension
 */

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
function showUnlockedState() {
  document.getElementById('locked-state').style.display = 'none';
  document.getElementById('unlocked-state').style.display = 'block';
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle unlock button click
 */
async function handleUnlock() {
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
 * Handle manage button click
 */
function handleManage() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('options.html')
  });
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
    const url = new URL(tab.url);
    const domain = url.hostname;
    
    // TODO: Load presets from storage
    // For now, show placeholder
    const presetsList = document.getElementById('presets-list');
    presetsList.innerHTML = '<p class="no-presets">No presets for this page</p>';
    
  } catch (error) {
    console.error('Error loading presets:', error);
  }
}

/**
 * Display presets in the list
 */
function displayPresets(presets) {
  const presetsList = document.getElementById('presets-list');
  
  if (presets.length === 0) {
    presetsList.innerHTML = '<p class="no-presets">No presets for this page</p>';
    return;
  }
  
  presetsList.innerHTML = '';
  
  presets.forEach(preset => {
    const presetItem = document.createElement('div');
    presetItem.className = 'preset-item';
    presetItem.innerHTML = `
      <div class="preset-name">${escapeHtml(preset.name)}</div>
      <div class="preset-actions">
        <button class="fill-btn" data-id="${preset.id}" data-mode="overwrite">Fill</button>
        <button class="fill-btn update" data-id="${preset.id}" data-mode="update">Update</button>
      </div>
    `;
    presetsList.appendChild(presetItem);
  });
  
  // Add event listeners to fill buttons
  document.querySelectorAll('.fill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const presetId = e.target.dataset.id;
      const mode = e.target.dataset.mode;
      handleFillPreset(presetId, mode);
    });
  });
}

/**
 * Handle fill preset
 */
async function handleFillPreset(presetId, mode) {
  try {
    // TODO: Load preset data
    // TODO: Send to content script
    showNotification('Info', 'Fill functionality not yet implemented', 'info');
  } catch (error) {
    console.error('Error filling preset:', error);
    showNotification('Error', 'Could not fill preset', 'error');
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Show a notification
 */
function showNotification(title, message, type = 'info') {
  // TODO: Implement proper notification UI
  console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
  alert(`${title}\n\n${message}`);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
