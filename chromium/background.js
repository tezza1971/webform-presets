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
  
  // Fill submenu (dynamic, will be populated on page)
  chrome.contextMenus.create({
    id: 'fill-preset',
    parentId: 'webform-presets-main',
    title: 'Fill with...',
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
  } else if (menuItemId === 'fill-preset') {
    await ensureUnlocked(() => handleFillPreset(tab));
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
async function handleFillPreset(tab) {
  try {
    // TODO: Get presets for current page
    // TODO: Show preset selection UI
    // TODO: Send fill command to content script
    console.log('Fill preset for tab:', tab.id);
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

console.log('Background service worker loaded');
