/**
 * Options Page Script for Webform Presets Extension
 */

let allPresets = [];
let isUnlocked = false;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await initialize();
  setupEventListeners();
});

/**
 * Initialize the options page
 */
async function initialize() {
  // Check if unlocked
  const response = await chrome.runtime.sendMessage({ action: 'isUnlocked' });
  isUnlocked = response.unlocked;
  
  if (isUnlocked) {
    showUnlockedView();
    await loadAllPresets();
  } else {
    showLockedView();
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('unlock-options-btn')?.addEventListener('click', handleUnlock);
  document.getElementById('lock-btn')?.addEventListener('click', handleLock);
  document.getElementById('export-btn')?.addEventListener('click', handleExport);
  document.getElementById('import-btn')?.addEventListener('click', handleImport);
  document.getElementById('search-input')?.addEventListener('input', handleSearch);
  document.getElementById('expand-all-btn')?.addEventListener('click', expandAll);
  document.getElementById('collapse-all-btn')?.addEventListener('click', collapseAll);
  document.getElementById('file-input')?.addEventListener('change', handleFileSelect);
}

// ============================================================================
// UI STATE
// ============================================================================

/**
 * Show locked view
 */
function showLockedView() {
  document.getElementById('locked-view').style.display = 'flex';
  document.getElementById('unlocked-view').style.display = 'none';
}

/**
 * Show unlocked view
 */
function showUnlockedView() {
  document.getElementById('locked-view').style.display = 'none';
  document.getElementById('unlocked-view').style.display = 'flex';
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle unlock button
 */
async function handleUnlock() {
  const unlockUrl = chrome.runtime.getURL('unlock.html');
  await chrome.tabs.create({ url: unlockUrl });
  
  // Listen for unlock completion
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'unlocked') {
      initialize();
    }
  });
}

/**
 * Handle lock button
 */
function handleLock() {
  // TODO: Implement lock functionality (clear key from background)
  showLockedView();
  isUnlocked = false;
}

/**
 * Handle export button
 */
async function handleExport() {
  try {
    // Get all data from storage
    const allData = await chrome.storage.local.get(null);
    
    // Create export object
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: allData
    };
    
    // Create download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webform-presets-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Success', 'Backup exported successfully', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showNotification('Error', 'Failed to export data', 'error');
  }
}

/**
 * Handle import button
 */
function handleImport() {
  document.getElementById('file-input').click();
}

/**
 * Handle file selection for import
 */
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    // Validate import data
    if (!importData.version || !importData.data) {
      throw new Error('Invalid backup file format');
    }
    
    // Confirm import
    const confirmed = confirm(
      '⚠️ WARNING ⚠️\n\n' +
      'This will replace ALL your current presets with the imported data.\n\n' +
      'Are you sure you want to continue?'
    );
    
    if (!confirmed) return;
    
    // Clear existing data and import
    await chrome.storage.local.clear();
    await chrome.storage.local.set(importData.data);
    
    showNotification('Success', 'Data imported successfully', 'success');
    await loadAllPresets();
  } catch (error) {
    console.error('Import error:', error);
    showNotification('Error', 'Failed to import data: ' + error.message, 'error');
  }
  
  // Reset file input
  event.target.value = '';
}

/**
 * Handle search input
 */
function handleSearch(event) {
  const query = event.target.value.toLowerCase();
  
  if (!query) {
    displayPresets(allPresets);
    return;
  }
  
  // Filter presets
  const filtered = allPresets.filter(scope => {
    // Check scope name
    if (scope.scopeKey.toLowerCase().includes(query)) {
      return true;
    }
    
    // Check preset names
    return scope.presets.some(preset => 
      preset.name.toLowerCase().includes(query)
    );
  });
  
  displayPresets(filtered);
}

/**
 * Expand all preset groups
 */
function expandAll() {
  document.querySelectorAll('.scope-item').forEach(item => {
    item.classList.add('expanded');
  });
}

/**
 * Collapse all preset groups
 */
function collapseAll() {
  document.querySelectorAll('.scope-item').forEach(item => {
    item.classList.remove('expanded');
  });
}

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Load all presets from storage
 */
async function loadAllPresets() {
  try {
    const allData = await chrome.storage.local.get(null);
    allPresets = [];
    
    // Process all scope keys
    for (const [key, value] of Object.entries(allData)) {
      if (key === 'userSalt') continue; // Skip salt
      
      if (value.presets && Array.isArray(value.presets)) {
        allPresets.push({
          scopeKey: key,
          scopeType: value.scopeType,
          presets: value.presets
        });
      }
    }
    
    // Update statistics
    updateStatistics();
    
    // Display presets
    displayPresets(allPresets);
  } catch (error) {
    console.error('Error loading presets:', error);
    showNotification('Error', 'Failed to load presets', 'error');
  }
}

/**
 * Update statistics display
 */
function updateStatistics() {
  const totalPresets = allPresets.reduce((sum, scope) => sum + scope.presets.length, 0);
  const totalDomains = allPresets.length;
  
  document.getElementById('total-presets').textContent = totalPresets;
  document.getElementById('total-domains').textContent = totalDomains;
}

// ============================================================================
// DISPLAY
// ============================================================================

/**
 * Display presets in the UI
 */
function displayPresets(scopes) {
  const container = document.getElementById('presets-container');
  
  if (scopes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No Presets Found</h3>
        <p>Try adjusting your search or create a new preset</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  scopes.forEach(scope => {
    const scopeEl = createScopeElement(scope);
    container.appendChild(scopeEl);
  });
}

/**
 * Create a scope element
 */
function createScopeElement(scope) {
  const div = document.createElement('div');
  div.className = 'scope-item';
  
  const [scopeType, scopeValue] = scope.scopeKey.split(':', 2);
  const icon = scopeType === 'domain' ? '🌐' : '🔗';
  
  div.innerHTML = `
    <div class="scope-header">
      <div class="scope-info">
        <span class="scope-icon">${icon}</span>
        <span class="scope-name">${escapeHtml(scopeValue)}</span>
        <span class="scope-badge">${scope.presets.length} preset(s)</span>
      </div>
      <div class="scope-actions">
        <button class="btn-icon expand-btn" title="Expand/Collapse">▼</button>
        <button class="btn-icon delete-scope-btn" data-scope="${escapeHtml(scope.scopeKey)}" title="Delete All">🗑️</button>
      </div>
    </div>
    <div class="scope-content">
      ${scope.presets.map(preset => createPresetHTML(preset, scope.scopeKey)).join('')}
    </div>
  `;
  
  // Add event listeners
  div.querySelector('.expand-btn').addEventListener('click', () => {
    div.classList.toggle('expanded');
  });
  
  div.querySelector('.delete-scope-btn').addEventListener('click', (e) => {
    handleDeleteScope(e.target.dataset.scope);
  });
  
  // Add event listeners for preset actions
  div.querySelectorAll('.delete-preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleDeletePreset(e.target.dataset.scope, e.target.dataset.id);
    });
  });
  
  return div;
}

/**
 * Create preset HTML
 */
function createPresetHTML(preset, scopeKey) {
  const createdDate = new Date(preset.createdAt).toLocaleDateString();
  
  return `
    <div class="preset-item">
      <div class="preset-info">
        <div class="preset-name">${escapeHtml(preset.name)}</div>
        <div class="preset-meta">
          Created: ${createdDate}
        </div>
      </div>
      <div class="preset-actions">
        <button class="btn-small delete-preset-btn" 
                data-scope="${escapeHtml(scopeKey)}" 
                data-id="${escapeHtml(preset.id)}">
          Delete
        </button>
      </div>
    </div>
  `;
}

// ============================================================================
// PRESET MANAGEMENT
// ============================================================================

/**
 * Handle delete scope
 */
async function handleDeleteScope(scopeKey) {
  const confirmed = confirm(
    `Are you sure you want to delete ALL presets for "${scopeKey}"?\n\nThis action cannot be undone.`
  );
  
  if (!confirmed) return;
  
  try {
    await chrome.storage.local.remove(scopeKey);
    showNotification('Success', 'Scope deleted successfully', 'success');
    await loadAllPresets();
  } catch (error) {
    console.error('Error deleting scope:', error);
    showNotification('Error', 'Failed to delete scope', 'error');
  }
}

/**
 * Handle delete preset
 */
async function handleDeletePreset(scopeKey, presetId) {
  const confirmed = confirm('Are you sure you want to delete this preset?');
  
  if (!confirmed) return;
  
  try {
    const result = await chrome.storage.local.get(scopeKey);
    const scopeData = result[scopeKey];
    
    if (!scopeData) {
      throw new Error('Scope not found');
    }
    
    // Remove preset from array
    scopeData.presets = scopeData.presets.filter(p => p.id !== presetId);
    
    if (scopeData.presets.length === 0) {
      // If no presets left, delete the entire scope
      await chrome.storage.local.remove(scopeKey);
    } else {
      // Save updated scope
      await chrome.storage.local.set({ [scopeKey]: scopeData });
    }
    
    showNotification('Success', 'Preset deleted successfully', 'success');
    await loadAllPresets();
  } catch (error) {
    console.error('Error deleting preset:', error);
    showNotification('Error', 'Failed to delete preset', 'error');
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Show notification
 */
function showNotification(title, message, type = 'info') {
  // TODO: Implement proper toast notification
  console.log(`[${type}] ${title}: ${message}`);
  alert(`${title}\n\n${message}`);
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
