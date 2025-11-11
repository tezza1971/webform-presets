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
  // Check JSZip library availability
  console.log('[INIT] Checking JSZip library...');
  if (typeof JSZip !== 'undefined') {
    console.log('[INIT] ✓ JSZip loaded successfully, version:', JSZip.version || 'unknown');
  } else {
    console.error('[INIT] ✗ JSZip library not loaded!');
    console.error('[INIT] Export functionality will not work');
    console.error('[INIT] Check options.html for JSZip script tag');
    console.error('[INIT] Check browser console for CSP violations or network errors');
  }
  
  // Update sync service status
  updateSyncStatus();
  
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
  document.getElementById('delete-all-btn')?.addEventListener('click', handleDeleteAll);
  document.getElementById('export-confirm-btn')?.addEventListener('click', handleExportConfirm);
  document.getElementById('export-cancel-btn')?.addEventListener('click', handleExportCancel);
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
  
  // Create a promise to wait for unlock
  const waitForUnlock = new Promise((resolve) => {
    const interval = setInterval(async () => {
      const response = await chrome.runtime.sendMessage({ action: 'isUnlocked' });
      if (response.unlocked) {
        clearInterval(interval);
        resolve();
      }
    }, 500);
  });
  
  await chrome.tabs.create({ url: unlockUrl });
  
  // Wait for unlock and then reload
  await waitForUnlock;
  await initialize();
}

/**
 * Handle lock button
 */
async function handleLock() {
  try {
    // Send lock message to background
    const response = await chrome.runtime.sendMessage({ action: 'lock' });
    
    if (response.success) {
      showLockedView();
      isUnlocked = false;
      allPresets = [];
    }
  } catch (error) {
    console.error('Error locking:', error);
    showNotification('Error', 'Failed to lock', 'error');
  }
}

/**
 * Handle delete all collections button with two-click confirmation
 */
let deleteAllConfirming = false;
async function handleDeleteAll() {
  const btn = document.getElementById('delete-all-btn');
  
  if (!deleteAllConfirming) {
    // First click: change to confirmation state
    deleteAllConfirming = true;
    btn.classList.add('confirming');
    btn.innerHTML = '<span class="icon">⚠️</span> Click Again to Confirm Delete';
    
    // Reset after 3 seconds if not clicked again
    setTimeout(() => {
      if (deleteAllConfirming) {
        deleteAllConfirming = false;
        btn.classList.remove('confirming');
        btn.innerHTML = '<span class="icon">🗑️</span> Delete All Collections';
      }
    }, 3000);
  } else {
    // Second click: actually delete
    try {
      // Preserve the salt before clearing
      const { userSalt } = await chrome.storage.local.get('userSalt');
      
      // Clear all chrome storage
      await chrome.storage.local.clear();
      
      // Restore the salt
      if (userSalt) {
        await chrome.storage.local.set({ userSalt });
        console.log('[DELETE_ALL] Salt preserved after deletion');
      }
      
      // Send message to background to reset
      await chrome.runtime.sendMessage({ action: 'lock' });
      
      // Show success and reload
      showNotification('Success', 'All collections deleted', 'success');
      
      // Reset state
      deleteAllConfirming = false;
      btn.classList.remove('confirming');
      btn.innerHTML = '<span class="icon">🗑️</span> Delete All Collections';
      
      // Reload after brief delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Error deleting all:', error);
      showNotification('Error', 'Failed to delete all collections', 'error');
      deleteAllConfirming = false;
      btn.classList.remove('confirming');
      btn.innerHTML = '<span class="icon">🗑️</span> Delete All Collections';
    }
  }
}


/**
 * Handle export button - show dialog
 */
function handleExport() {
  document.getElementById('export-dialog').style.display = 'flex';
}

/**
 * Export confirmation handler
 */
async function handleExportConfirm() {
  const exportType = document.querySelector('input[name="export-type"]:checked').value;
  
  console.log('[EXPORT] Starting export, type:', exportType);
  console.log('[EXPORT] JSZip available:', typeof JSZip !== 'undefined');
  
  // Hide dialog
  document.getElementById('export-dialog').style.display = 'none';
  
  // Show notification that export is starting
  showNotification('Info', 'Preparing export...', 'info');
  
  try {
    if (exportType === 'current') {
      console.log('[EXPORT] Exporting current collection');
      await exportCurrentCollection();
    } else {
      console.log('[EXPORT] Exporting all collections');
      await exportAllCollections();
    }
  } catch (error) {
    console.error('[EXPORT] Export error:', error);
    console.error('[EXPORT] Error stack:', error.stack);
    showNotification('Error', 'Failed to export: ' + error.message, 'error');
  }
}

/**
 * Export cancel handler
 */
function handleExportCancel() {
  document.getElementById('export-dialog').style.display = 'none';
}

/**
 * Export current collection only
 */
async function exportCurrentCollection() {
  try {
    console.log('[EXPORT] Starting export current collection...');
    const manifest = chrome.runtime.getManifest();
    const exportData = {
      version: manifest.version,
      appName: 'Webform Presets',
      exportDate: new Date().toISOString(),
      exportType: 'current-collection',
      collections: []
    };
    
    // Get all storage data
    const allData = await chrome.storage.local.get(null);
    
    // Collect all scope data (domain:xxx or url:xxx keys)
    const scopeData = {};
    const domains = new Set();
    let presetCount = 0;
    
    for (const [key, value] of Object.entries(allData)) {
      // Skip system keys
      if (key === 'userSalt' || key === 'verificationToken' || key.startsWith('verificationToken_') || key === 'disabledDomains') {
        continue;
      }
      
      // Check if this is scope data (has presets array)
      if (value && value.presets && Array.isArray(value.presets)) {
        console.log('[EXPORT] Found scope:', key, 'with', value.presets.length, 'presets');
        scopeData[key] = value;
        presetCount += value.presets.length;
        
        // Extract domain/url for metadata
        const [scopeType, ...valueParts] = key.split(':');
        const scopeValue = valueParts.join(':');
        if (scopeType === 'domain') {
          domains.add(scopeValue);
        } else if (scopeType === 'url') {
          try {
            const urlObj = new URL(scopeValue);
            domains.add(urlObj.hostname);
          } catch (e) {
            // Invalid URL, skip
          }
        }
      }
    }
    
    console.log('[EXPORT] Found', presetCount, 'presets across', Object.keys(scopeData).length, 'scopes');
    
    exportData.collections.push({
      name: 'Current Collection',
      verificationToken: allData.verificationToken,
      userSalt: allData.userSalt,
      encryptedData: scopeData,
      metadata: {
        presetCount: presetCount,
        domains: Array.from(domains),
        scopeCount: Object.keys(scopeData).length,
        exportDate: new Date().toISOString()
      }
    });
    
    await createAndDownloadZip(exportData, 'current');
    
  } catch (error) {
    console.error('[EXPORT] Export current error:', error);
    console.error('[EXPORT] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Export all collections
 */
async function exportAllCollections() {
  try {
    console.log('[EXPORT] Starting export all collections...');
    const manifest = chrome.runtime.getManifest();
    const exportData = {
      version: manifest.version,
      appName: 'Webform Presets',
      exportDate: new Date().toISOString(),
      exportType: 'all-collections',
      collections: []
    };
    
    // Get all storage data
    const allData = await chrome.storage.local.get(null);
    console.log('[EXPORT] All storage keys:', Object.keys(allData));
    
    // Collect all scope data (domain:xxx or url:xxx keys)
    const scopeData = {};
    const domains = new Set();
    let presetCount = 0;
    
    for (const [key, value] of Object.entries(allData)) {
      // Skip system keys
      if (key === 'userSalt' || key === 'verificationToken' || key.startsWith('verificationToken_') || key === 'disabledDomains') {
        continue;
      }
      
      // Check if this is scope data (has presets array)
      if (value && value.presets && Array.isArray(value.presets)) {
        console.log('[EXPORT] Found scope:', key, 'with', value.presets.length, 'presets');
        scopeData[key] = value;
        presetCount += value.presets.length;
        
        // Extract domain/url for metadata
        const [scopeType, ...valueParts] = key.split(':');
        const scopeValue = valueParts.join(':');
        if (scopeType === 'domain') {
          domains.add(scopeValue);
        } else if (scopeType === 'url') {
          try {
            const urlObj = new URL(scopeValue);
            domains.add(urlObj.hostname);
          } catch (e) {
            // Invalid URL, skip
          }
        }
      }
    }
    
    console.log('[EXPORT] Found', presetCount, 'presets across', Object.keys(scopeData).length, 'scopes');
    
    // Create single collection with all data
    exportData.collections.push({
      name: 'Main Collection',
      verificationToken: allData.verificationToken,
      userSalt: allData.userSalt,
      encryptedData: scopeData,
      metadata: {
        domains: Array.from(domains),
        presetCount: presetCount,
        scopeCount: Object.keys(scopeData).length,
        exportDate: new Date().toISOString()
      }
    });
    
    console.log('[EXPORT] Export data prepared:', {
      collections: exportData.collections.length,
      presets: presetCount,
      domains: domains.size
    });
    
    await createAndDownloadZip(exportData, 'all');
    
  } catch (error) {
    console.error('[EXPORT] Export all error:', error);
    console.error('[EXPORT] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Create ZIP file and trigger download
 */
async function createAndDownloadZip(exportData, type) {
  console.log('[EXPORT] Creating ZIP for type:', type);
  console.log('[EXPORT] Checking JSZip availability...');
  
  try {
    if (typeof JSZip === 'undefined') {
      const errorMsg = 'JSZip library not loaded. Check console for CSP issues or network errors.';
      console.error('[EXPORT] CRITICAL:', errorMsg);
      console.error('[EXPORT] Verify JSZip script tag in options.html');
      console.error('[EXPORT] Check browser console for CSP violations');
      throw new Error(errorMsg);
    }
    
    console.log('[EXPORT] JSZip version:', JSZip.version || 'unknown');
    console.log('[EXPORT] Export data:', {
      type: exportData.exportType,
      version: exportData.version,
      collections: exportData.collections.length
    });
    
    console.log('[EXPORT] Initializing ZIP archive...');
    const zip = new JSZip();
    
    // Create JSON data string
    console.log('[EXPORT] Stringifying export data...');
    const jsonData = JSON.stringify(exportData, null, 2);
    console.log('[EXPORT] JSON data size:', jsonData.length, 'bytes');
    
    // Verify JSON integrity
    console.log('[EXPORT] Verifying JSON integrity...');
    try {
      JSON.parse(jsonData);
      console.log('[EXPORT] JSON integrity check passed');
    } catch (e) {
      console.error('[EXPORT] JSON integrity check failed:', e);
      throw new Error('Data integrity check failed - invalid JSON');
    }
    
    // Add JSON file to ZIP
    console.log('[EXPORT] Adding webform-presets-export.json to archive...');
    zip.file('webform-presets-export.json', jsonData);
    
    // Add README
    console.log('[EXPORT] Creating README.txt...');
    const readme = `Webform Presets Export
======================

Export Type: ${exportData.exportType}
App Version: ${exportData.version}
Export Date: ${exportData.exportDate}
Collections: ${exportData.collections.length}

This archive contains encrypted preset data from the Webform Presets extension.
The data remains encrypted and can only be decrypted with the correct collection password(s).

To import:
1. Install the Webform Presets extension (version ${exportData.version} or compatible)
2. Open the preset manager
3. Click "Import" and select this ZIP file
4. Enter the collection password when prompted

Note: Passwords are not included in this export for security reasons.
You must remember your collection password(s) to import this data.
`;
    
    console.log('[EXPORT] Adding README.txt to archive...');
    zip.file('README.txt', readme);
    
    // Generate ZIP blob
    console.log('[EXPORT] Generating ZIP blob with DEFLATE compression level 9...');
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });
    
    console.log('[EXPORT] ZIP blob generated, size:', zipBlob.size, 'bytes');
    console.log('[EXPORT] Compression ratio:', ((1 - zipBlob.size / jsonData.length) * 100).toFixed(2) + '%');
    
    // Create download
    console.log('[EXPORT] Creating download link...');
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    a.download = `webform-presets-${type}-${timestamp}.zip`;
    
    console.log('[EXPORT] Triggering download:', a.download);
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('[EXPORT] Export completed successfully');
    showNotification('Success', `Exported ${exportData.collections.length} collection(s) successfully`, 'success');
    
  } catch (error) {
    console.error('[EXPORT] ZIP creation error:', error);
    console.error('[EXPORT] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw new Error('Failed to create ZIP file: ' + error.message);
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
  
  console.log('[IMPORT] File selected:', file.name, 'size:', file.size, 'bytes');
  
  try {
    // Determine if it's a ZIP or JSON file
    if (file.name.endsWith('.zip')) {
      console.log('[IMPORT] Detected ZIP file');
      await handleZipImport(file);
    } else if (file.name.endsWith('.json')) {
      console.log('[IMPORT] Detected JSON file');
      await handleJsonImport(file);
    } else {
      throw new Error('Unsupported file format. Please use .zip or .json files.');
    }
  } catch (error) {
    console.error('[IMPORT] Import error:', error);
    console.error('[IMPORT] Error stack:', error.stack);
    showNotification('Error', 'Failed to import: ' + error.message, 'error');
  }
  
  // Reset file input
  event.target.value = '';
}

/**
 * Handle ZIP file import
 */
async function handleZipImport(file) {
  try {
    console.log('[IMPORT] Checking JSZip availability...');
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library not loaded');
    }
    
    console.log('[IMPORT] Loading ZIP file...');
    const zip = await JSZip.loadAsync(file);
    console.log('[IMPORT] ZIP loaded, files:', Object.keys(zip.files));
    
    // Look for the JSON file
    const jsonFile = zip.file('webform-presets-export.json');
    if (!jsonFile) {
      console.error('[IMPORT] JSON file not found in ZIP');
      throw new Error('Invalid export file - missing data file');
    }
    
    console.log('[IMPORT] Extracting JSON data...');
    // Extract and parse JSON
    const jsonText = await jsonFile.async('text');
    console.log('[IMPORT] JSON text length:', jsonText.length, 'bytes');
    
    const importData = JSON.parse(jsonText);
    console.log('[IMPORT] Parsed import data:', {
      version: importData.version,
      exportType: importData.exportType,
      collections: importData.collections?.length
    });
    
    // Validate import data
    await validateAndImport(importData);
    
  } catch (error) {
    console.error('[IMPORT] ZIP import error:', error);
    throw error;
  }
}

/**
 * Handle legacy JSON import
 */
async function handleJsonImport(file) {
  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    // Check if it's new format or legacy format
    if (importData.collections) {
      await validateAndImport(importData);
    } else if (importData.data) {
      // Legacy format
      await importLegacyFormat(importData);
    } else {
      throw new Error('Invalid backup file format');
    }
  } catch (error) {
    console.error('JSON import error:', error);
    throw error;
  }
}

/**
 * Validate and import data
 */
async function validateAndImport(importData) {
  console.log('[IMPORT] Validating import data...');
  
  // Version check
  const manifest = chrome.runtime.getManifest();
  const importVersion = importData.version;
  const currentVersion = manifest.version;
  
  console.log(`[IMPORT] Importing from version ${importVersion} into version ${currentVersion}`);
  
  // Validate structure
  if (!importData.collections || !Array.isArray(importData.collections)) {
    throw new Error('Invalid export format - missing collections');
  }
  
  if (importData.collections.length === 0) {
    throw new Error('Export file contains no collections');
  }
  
  console.log('[IMPORT] Collections found:', importData.collections.length);
  
  // Log collection details
  importData.collections.forEach((collection, i) => {
    console.log(`[IMPORT] Collection ${i + 1}:`, {
      name: collection.name,
      presetCount: collection.metadata?.presetCount,
      domains: collection.metadata?.domains,
      scopeCount: collection.metadata?.scopeCount,
      encryptedDataKeys: Object.keys(collection.encryptedData || {})
    });
  });
  
  // Version compatibility check
  const importMajor = parseInt(importVersion.split('.')[0]);
  const currentMajor = parseInt(currentVersion.split('.')[0]);
  
  if (importMajor > currentMajor) {
    throw new Error(`This export was created with a newer version (${importVersion}). Please update the extension to import this file.`);
  }
  
  // Show import confirmation
  const collectionInfo = importData.collections.map((c, i) => 
    `  ${i + 1}. ${c.name} (${c.metadata.presetCount} presets across ${c.metadata.domains.length} domains)`
  ).join('\n');
  
  const message = `Import ${importData.collections.length} collection(s)?\n\n${collectionInfo}\n\nThis will REPLACE all existing data!`;
  
  // TODO: Replace with non-modal confirmation dialog
  const confirmed = confirm('⚠️ WARNING ⚠️\n\n' + message);
  
  if (!confirmed) {
    console.log('[IMPORT] Import cancelled by user');
    return;
  }
  
  console.log('[IMPORT] Starting import process...');
  
  // Import collections
  console.log('[IMPORT] Clearing existing storage...');
  await chrome.storage.local.clear();
  
  for (const collection of importData.collections) {
    console.log('[IMPORT] Importing collection:', collection.name);
    
    // Import verification token
    if (collection.verificationToken) {
      console.log('[IMPORT] Setting verification token');
      await chrome.storage.local.set({ verificationToken: collection.verificationToken });
    }
    
    // Import user salt
    if (collection.userSalt) {
      console.log('[IMPORT] Setting user salt');
      await chrome.storage.local.set({ userSalt: collection.userSalt });
    }
    
    // Import encrypted data
    if (collection.encryptedData) {
      const keys = Object.keys(collection.encryptedData);
      console.log('[IMPORT] Importing', keys.length, 'scope data entries:', keys);
      await chrome.storage.local.set(collection.encryptedData);
    }
  }
  
  console.log('[IMPORT] Import completed successfully');
  showNotification('Success', `Imported ${importData.collections.length} collection(s)`, 'success');
  
  // Reload to unlock page (user needs to enter password)
  setTimeout(() => {
    console.log('[IMPORT] Reloading page...');
    window.location.reload();
  }, 1500);
}

/**
 * Import legacy format
 */
async function importLegacyFormat(importData) {
  const confirmed = confirm(
    '⚠️ WARNING ⚠️\n\n' +
    'This appears to be a legacy backup format.\n' +
    'This will REPLACE all your current presets.\n\n' +
    'Continue?'
  );
  
  if (!confirmed) return;
  
  await chrome.storage.local.clear();
  await chrome.storage.local.set(importData.data);
  
  showNotification('Success', 'Legacy data imported successfully', 'success');
  
  setTimeout(() => {
    window.location.reload();
  }, 1500);
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
async function updateStatistics() {
  const totalPresets = allPresets.reduce((sum, scope) => sum + scope.presets.length, 0);
  const totalDomains = allPresets.length;
  
  // Count collections by counting distinct verification tokens
  const result = await chrome.storage.local.get(null);
  let collectionCount = 0;
  
  // Look for all verification tokens (each collection has one)
  for (const key in result) {
    if (key.startsWith('verificationToken_')) {
      collectionCount++;
    }
  }
  
  // If no tokens found but presets exist, there's at least 1 collection
  if (collectionCount === 0 && (result.userSalt || result.verificationToken)) {
    collectionCount = 1;
  }
  
  document.getElementById('total-collections').textContent = collectionCount;
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
  console.log('[DISPLAY] Displaying', scopes.length, 'scopes');
  
  const container = document.getElementById('presets-container');
  
  if (scopes.length === 0) {
    console.log('[DISPLAY] No scopes to display');
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
  
  scopes.forEach((scope, index) => {
    console.log('[DISPLAY] Creating scope element', index, 'for:', scope.scopeKey);
    const scopeEl = createScopeElement(scope);
    container.appendChild(scopeEl);
  });
  
  console.log('[DISPLAY] All scope elements appended to container');
}

/**
 * Create a scope element
 */
function createScopeElement(scope) {
  console.log('[SCOPE_CREATE] Creating scope element:', {
    scopeKey: scope.scopeKey,
    scopeType: scope.scopeType,
    presetCount: scope.presets?.length
  });
  
  const div = document.createElement('div');
  div.className = 'scope-item';
  
  const [scopeType, ...scopeValueParts] = scope.scopeKey.split(':');
  const scopeValue = scopeValueParts.join(':'); // Rejoin in case URL has colons
  const icon = scopeType === 'domain' ? '🌐' : '🔗';
  
  // Get the form URL from the first preset (all presets in a scope should have the same form URL)
  let formUrl = '';
  if (scope.presets && scope.presets.length > 0 && scope.presets[0].formUrl) {
    formUrl = scope.presets[0].formUrl;
    console.log('[SCOPE_CREATE] Form URL from first preset:', formUrl);
  } else {
    // Fallback to constructing URL from scope
    formUrl = scopeType === 'url' ? scopeValue : `https://${scopeValue}`;
    console.log('[SCOPE_CREATE] Form URL fallback:', formUrl);
  }
  
  const targetName = `wfp-scope-${scopeType}-${encodeURIComponent(scopeValue)}`;
  
  console.log('[SCOPE_CREATE] Parsed scope:', {
    scopeType: scopeType,
    scopeValue: scopeValue,
    icon: icon,
    formUrl: formUrl,
    targetName: targetName
  });
  
  div.innerHTML = `
    <div class="scope-header scope-clickable" data-url="${escapeHtml(formUrl)}" data-target="${escapeHtml(targetName)}" style="cursor: pointer;">
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
  const scopeHeader = div.querySelector('.scope-header');
  const expandBtn = div.querySelector('.expand-btn');
  const deleteScopeBtn = div.querySelector('.delete-scope-btn');
  
  // Handle scope header click to open form URL
  scopeHeader.addEventListener('click', (e) => {
    // Don't open if clicking on buttons
    if (e.target.classList.contains('expand-btn') || 
        e.target.classList.contains('delete-scope-btn') ||
        e.target.closest('.scope-actions')) {
      console.log('[SCOPE_CLICK] Click was on action button, ignoring');
      return;
    }
    
    const url = scopeHeader.dataset.url;
    const target = scopeHeader.dataset.target;
    console.log('[SCOPE_CLICK] Opening form URL:', url, 'in target:', target);
    
    try {
      const newWindow = window.open(url, target);
      console.log('[SCOPE_CLICK] Window.open returned:', newWindow);
    } catch (error) {
      console.error('[SCOPE_CLICK] Error opening window:', error);
    }
  });
  
  // Handle expand/collapse
  expandBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Don't trigger scope header click
    div.classList.toggle('expanded');
  });
  
  // Handle delete scope
  deleteScopeBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Don't trigger scope header click
    handleDeleteScope(deleteScopeBtn.dataset.scope);
  });
  
  // Add event listeners for preset actions (just delete buttons now)
  div.querySelectorAll('.delete-preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent any parent clicks
      handleDeletePreset(e.target.dataset.scope, e.target.dataset.id);
    });
  });
  
  console.log('[SCOPE_CREATE] Scope element created with', scope.presets.length, 'presets');
  
  return div;
}

/**
 * Create preset HTML
 */
function createPresetHTML(preset, scopeKey) {
  const createdDate = new Date(preset.createdAt).toLocaleDateString();
  
  // Extract scope type and value from scopeKey (format: "type:value")
  const [scopeType, ...valueParts] = scopeKey.split(':');
  const scopeValue = valueParts.join(':'); // Rejoin in case URL has colons
  
  console.log('[PRESET_HTML] Creating preset:', {
    name: preset.name,
    id: preset.id,
    scopeKey: scopeKey,
    formUrl: preset.formUrl
  });
  
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
 * Show notification
 */
function showNotification(title, message, type = 'info') {
  // Create a toast notification at the bottom right
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
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
    z-index: 10000;
    max-width: 350px;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  
  toast.innerHTML = `
    <strong>${title}</strong><br>
    ${message}
  `;
  
  // Add animation style if not exists
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
