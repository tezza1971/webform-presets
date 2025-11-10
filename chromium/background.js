/**
 * Background Service Worker for Webform Presets Extension
 * Handles encryption, storage management, context menus, and coordination
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let encryptionKey = null; // In-memory encryption key (never persisted)
let unlockCallbacks = []; // Pending actions waiting for unlock

// ============================================================================
// INITIALIZATION
// ============================================================================

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Webform Presets extension installed');
  await initializeExtension();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started, encryption key cleared');
  encryptionKey = null;
});

// Listen for tab updates to refresh context menus
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateContextMenusForPage(tab.url);
  }
});

// Listen for tab activation to refresh context menus
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    updateContextMenusForPage(tab.url);
  }
});

/**
 * Initialize the extension on first install
 */
async function initializeExtension() {
  // Create context menus
  await createContextMenus();
  
  // Check if salt exists, if not create one
  const { userSalt } = await chrome.storage.local.get('userSalt');
  if (!userSalt) {
    const salt = crypto.randomUUID();
    await chrome.storage.local.set({ userSalt: salt });
    console.log('Generated new user salt');
  }
}

/**
 * Create context menu items
 */
async function createContextMenus() {
  // Remove all existing menus first
  await chrome.contextMenus.removeAll();
  
  // Main menu
  chrome.contextMenus.create({
    id: 'webform-presets-main',
    title: 'Webform Presets',
    contexts: ['page', 'editable']
  });
  
  // Save submenu
  chrome.contextMenus.create({
    id: 'save-preset',
    parentId: 'webform-presets-main',
    title: 'Save as Preset...',
    contexts: ['page', 'editable']
  });
  
  // Separator
  chrome.contextMenus.create({
    id: 'separator-1',
    parentId: 'webform-presets-main',
    type: 'separator',
    contexts: ['page', 'editable']
  });
  
  // Fill submenu placeholder (will be populated dynamically)
  chrome.contextMenus.create({
    id: 'fill-preset-parent',
    parentId: 'webform-presets-main',
    title: 'Fill with...',
    contexts: ['page', 'editable']
  });
  
  chrome.contextMenus.create({
    id: 'no-presets',
    parentId: 'fill-preset-parent',
    title: 'No presets available',
    enabled: false,
    contexts: ['page', 'editable']
  });
  
  // Separator
  chrome.contextMenus.create({
    id: 'separator-2',
    parentId: 'webform-presets-main',
    type: 'separator',
    contexts: ['page', 'editable']
  });
  
  // Manage presets
  chrome.contextMenus.create({
    id: 'manage-presets',
    parentId: 'webform-presets-main',
    title: 'Manage Presets',
    contexts: ['page', 'editable']
  });
}

/**
 * Update context menus with presets for current page
 */
async function updateContextMenusForPage(url) {
  if (!encryptionKey) {
    return; // Can't show presets if locked
  }

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const fullUrl = urlObj.href;

    // Get presets for this page
    const domainPresets = await getPresetsForScope('domain', domain);
    const urlPresets = await getPresetsForScope('url', fullUrl);
    const allPresets = [...domainPresets, ...urlPresets];

    // Remove old preset menu items
    await chrome.contextMenus.remove('no-presets').catch(() => {});
    const existingItems = await chrome.contextMenus.getAll();
    for (const item of existingItems) {
      if (item.id && item.id.startsWith('preset-')) {
        await chrome.contextMenus.remove(item.id).catch(() => {});
      }
    }

    // Add preset items
    if (allPresets.length === 0) {
      chrome.contextMenus.create({
        id: 'no-presets',
        parentId: 'fill-preset-parent',
        title: 'No presets available',
        enabled: false,
        contexts: ['page', 'editable']
      });
    } else {
      allPresets.forEach((preset, index) => {
        chrome.contextMenus.create({
          id: `preset-${preset.id}`,
          parentId: 'fill-preset-parent',
          title: preset.name,
          contexts: ['page', 'editable']
        });
      });
    }
  } catch (error) {
    console.error('Error updating context menus:', error);
  }
}

// ============================================================================
// CONTEXT MENU HANDLERS
// ============================================================================

chrome.contextMenus.onClicked.addListener((info, tab) => {
  handleContextMenuClick(info.menuItemId, tab);
});

/**
 * Handle context menu clicks
 */
async function handleContextMenuClick(menuItemId, tab) {
  if (menuItemId === 'save-preset') {
    await ensureUnlocked(() => handleSavePreset(tab));
  } else if (menuItemId.startsWith('preset-')) {
    // Extract preset ID
    const presetId = menuItemId.replace('preset-', '');
    await ensureUnlocked(() => handleFillPreset(tab, presetId));
  } else if (menuItemId === 'manage-presets') {
    await ensureUnlocked(() => openManagementConsole());
  }
}

/**
 * Handle save preset action
 */
async function handleSavePreset(tab) {
  try {
    // Send message to content script to capture form data
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'captureFormData'
    });
    
    if (response.error) {
      console.error('Error capturing form data:', response.error);
      return;
    }
    
    // TODO: Open save modal with captured data
    console.log('Captured form data:', response);
  } catch (error) {
    console.error('Error in handleSavePreset:', error);
  }
}

/**
 * Handle fill preset action
 */
async function handleFillPreset(tab, presetId) {
  try {
    // Get all presets for current page
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getCurrentUrl'
    });
    
    if (response.error) {
      console.error('Error getting current URL:', response.error);
      return;
    }

    const url = response.url;
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const fullUrl = urlObj.href;

    // Get presets
    const domainPresets = await getPresetsForScope('domain', domain);
    const urlPresets = await getPresetsForScope('url', fullUrl);
    const allPresets = [...domainPresets, ...urlPresets];

    // Find the selected preset
    const preset = allPresets.find(p => p.id === presetId);
    if (!preset) {
      console.error('Preset not found:', presetId);
      return;
    }

    // Decrypt fields
    const fields = await decryptData(preset.encryptedFields);

    // Send fill command to content script
    await chrome.tabs.sendMessage(tab.id, {
      action: 'fillForm',
      fields: fields,
      mode: 'overwrite' // TODO: Add user preference
    });

    // Update use count
    preset.useCount = (preset.useCount || 0) + 1;
    preset.lastUsed = new Date().toISOString();
    await updatePresetInStorage(preset, urlObj);

  } catch (error) {
    console.error('Error in handleFillPreset:', error);
  }
}

/**
 * Open management console
 */
function openManagementConsole() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('options.html')
  });
}

// ============================================================================
// UNLOCK/AUTHENTICATION
// ============================================================================

/**
 * Ensure the extension is unlocked before performing an action
 */
async function ensureUnlocked(callback) {
  if (encryptionKey) {
    // Already unlocked
    await callback();
  } else {
    // Need to unlock
    unlockCallbacks.push(callback);
    await openUnlockPage();
  }
}

/**
 * Open the unlock page
 */
async function openUnlockPage() {
  const unlockUrl = chrome.runtime.getURL('unlock.html');
  
  // Check if unlock tab is already open
  const tabs = await chrome.tabs.query({ url: unlockUrl });
  if (tabs.length > 0) {
    // Focus existing unlock tab
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    // Create new unlock tab
    await chrome.tabs.create({ url: unlockUrl });
  }
}

/**
 * Derive encryption key from master password
 */
async function deriveKey(masterPassword, salt) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(masterPassword);
  const saltBuffer = encoder.encode(salt);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive AES-GCM key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  
  return key;
}

// ============================================================================
// ENCRYPTION/DECRYPTION
// ============================================================================

/**
 * Encrypt data using AES-GCM
 */
async function encryptData(data) {
  if (!encryptionKey) {
    throw new Error('Encryption key not available');
  }
  
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(data));
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    encryptionKey,
    dataBuffer
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using AES-GCM
 */
async function decryptData(encryptedData) {
  if (!encryptionKey) {
    throw new Error('Encryption key not available');
  }
  
  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    encryptionKey,
    encrypted
  );
  
  const decoder = new TextDecoder();
  const decryptedText = decoder.decode(decryptedBuffer);
  
  return JSON.parse(decryptedText);
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep message channel open for async response
});

/**
 * Handle messages from content scripts and UI pages
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.action) {
      case 'unlock':
        await handleUnlock(message.password, sendResponse);
        break;
        
      case 'isUnlocked':
        sendResponse({ unlocked: encryptionKey !== null });
        break;
        
      case 'encrypt':
        const encrypted = await encryptData(message.data);
        sendResponse({ encrypted });
        break;
        
      case 'decrypt':
        const decrypted = await decryptData(message.data);
        sendResponse({ decrypted });
        break;
        
      case 'savePreset':
        await handleSavePresetMessage(message.preset, sendResponse);
        break;
        
      case 'getPresetsForPage':
        await handleGetPresetsForPage(message.url, sendResponse);
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
}

/**
 * Handle unlock attempt
 */
async function handleUnlock(password, sendResponse) {
  try {
    const { userSalt } = await chrome.storage.local.get('userSalt');
    
    if (!userSalt) {
      sendResponse({ success: false, error: 'No salt found' });
      return;
    }
    
    // Derive key
    encryptionKey = await deriveKey(password, userSalt);
    
    // TODO: Verify key is correct by trying to decrypt a test value
    
    // Execute pending callbacks
    for (const callback of unlockCallbacks) {
      await callback();
    }
    unlockCallbacks = [];
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Unlock error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

/**
 * Handle save preset from content script
 */
async function handleSavePresetMessage(presetData, sendResponse) {
  try {
    if (!encryptionKey) {
      sendResponse({ success: false, error: 'Not unlocked' });
      return;
    }

    // Generate preset object
    const preset = {
      id: crypto.randomUUID(),
      name: presetData.name,
      fields: presetData.fields,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      useCount: 0
    };

    // Encrypt the fields
    const encryptedFields = await encryptData(preset.fields);
    preset.encryptedFields = encryptedFields;
    delete preset.fields; // Remove plaintext

    // Save to storage based on scope
    await savePreset(presetData.scopeType, presetData.scopeValue, preset);

    sendResponse({ 
      success: true, 
      presetId: preset.id,
      message: `Preset "${preset.name}" saved successfully`
    });
  } catch (error) {
    console.error('Error saving preset:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Get presets for current page
 */
async function handleGetPresetsForPage(url, sendResponse) {
  try {
    if (!encryptionKey) {
      sendResponse({ success: false, error: 'Not unlocked' });
      return;
    }

    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const fullUrl = urlObj.href;

    // Get domain-level presets
    const domainPresets = await getPresetsForScope('domain', domain);
    
    // Get URL-level presets
    const urlPresets = await getPresetsForScope('url', fullUrl);

    // Combine and decrypt
    const allPresets = [...domainPresets, ...urlPresets];
    
    // Decrypt fields for each preset
    for (const preset of allPresets) {
      if (preset.encryptedFields) {
        preset.fields = await decryptData(preset.encryptedFields);
        delete preset.encryptedFields; // Remove encrypted version from response
      }
    }

    sendResponse({ 
      success: true, 
      presets: allPresets 
    });
  } catch (error) {
    console.error('Error getting presets:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Get presets for a specific scope
 */
async function getPresetsForScope(scopeType, scopeValue) {
  const scopeKey = `${scopeType}:${scopeValue}`;
  const result = await chrome.storage.local.get(scopeKey);
  return result[scopeKey]?.presets || [];
}

/**
 * Save preset to storage
 */
async function savePreset(scopeType, scopeValue, preset) {
  const scopeKey = `${scopeType}:${scopeValue}`;
  const result = await chrome.storage.local.get(scopeKey);
  
  const scopeData = result[scopeKey] || {
    scopeType,
    presets: []
  };
  
  scopeData.presets.push(preset);
  
  await chrome.storage.local.set({ [scopeKey]: scopeData });
}

/**
 * Update an existing preset in storage
 */
async function updatePresetInStorage(preset, urlObj) {
  // Determine which scope this preset belongs to
  const domain = urlObj.hostname;
  const fullUrl = urlObj.href;
  
  // Try domain first
  let scopeKey = `domain:${domain}`;
  let result = await chrome.storage.local.get(scopeKey);
  let scopeData = result[scopeKey];
  
  if (!scopeData) {
    // Try URL
    scopeKey = `url:${fullUrl}`;
    result = await chrome.storage.local.get(scopeKey);
    scopeData = result[scopeKey];
  }
  
  if (scopeData) {
    const index = scopeData.presets.findIndex(p => p.id === preset.id);
    if (index !== -1) {
      scopeData.presets[index] = preset;
      await chrome.storage.local.set({ [scopeKey]: scopeData });
    }
  }
}

console.log('Background service worker loaded');
