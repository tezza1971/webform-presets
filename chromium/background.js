/**
 * Background Service Worker for Webform Presets Extension
 * Handles encryption, storage management, context menus, and coordination
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let encryptionKey = null; // In-memory encryption key (never persisted)
let unlockCallbacks = []; // Pending actions waiting for unlock
let presetMenuItems = new Set(); // Track preset menu item IDs
let keepAliveInterval = null; // Interval to keep service worker alive
let keepAlivePorts = new Set(); // Connected ports to keep service worker alive

// Keep service worker alive while unlocked using both interval and ports
function startKeepAlive() {
  if (keepAliveInterval) return;
  
  // Method 1: Interval ping every 20 seconds
  keepAliveInterval = setInterval(() => {
    if (encryptionKey) {
      console.log('[KEEPALIVE] Ping - service worker kept alive');
    } else {
      // No longer unlocked, stop keeping alive
      stopKeepAlive();
    }
  }, 20000);
  
  console.log('[KEEPALIVE] Started');
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('[KEEPALIVE] Stopped');
  }
  
  // Disconnect all keep-alive ports
  keepAlivePorts.forEach(port => {
    try {
      port.disconnect();
    } catch (e) {
      // Already disconnected
    }
  });
  keepAlivePorts.clear();
}

// Handle long-lived connections that keep the service worker alive
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keepalive') {
    console.log('[KEEPALIVE] Port connected');
    keepAlivePorts.add(port);
    
    port.onDisconnect.addListener(() => {
      console.log('[KEEPALIVE] Port disconnected');
      keepAlivePorts.delete(port);
    });
  }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Webform Presets extension installed');
  await initializeExtension();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[STARTUP] Browser started, encryption key cleared');
  encryptionKey = null;
  stopKeepAlive();
});

// Detect when service worker wakes up from idle
self.addEventListener('activate', async (event) => {
  console.log('[SERVICE_WORKER] Service worker activated/woke up');
  
  // Check if we should still be unlocked
  const sessionState = await chrome.storage.session.get(['isUnlocked', 'unlockedAt']);
  
  if (sessionState.isUnlocked && !encryptionKey) {
    console.log('[SERVICE_WORKER] Session indicates unlocked but encryption key lost');
    console.log('[SERVICE_WORKER] User will need to unlock again');
    
    // Clear the session state since we lost the key
    await chrome.storage.session.remove(['isUnlocked', 'unlockedAt']);
  } else if (encryptionKey) {
    console.log('[SERVICE_WORKER] Encryption key still in memory');
    // Restart keep-alive if needed
    if (!keepAliveInterval) {
      startKeepAlive();
    }
  }
});

// Listen for tab updates to refresh context menus
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Don't await - let it run in background, errors handled internally
    updateContextMenusForPage(tab.url).catch(err => {
      // Silently ignore errors from context menu updates
      // These commonly occur when tabs close or content scripts aren't ready
    });
  }
});

// Listen for tab activation to refresh context menus
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      // Don't await - let it run in background, errors handled internally
      updateContextMenusForPage(tab.url).catch(err => {
        // Silently ignore errors from context menu updates
      });
    }
  } catch (error) {
    // Tab may have been closed before we could get it
  }
});

/**
 * Initialize the extension on first install
 */
async function initializeExtension() {
  console.log('[INIT] Initializing extension...');
  
  // Create initial context menus
  await createContextMenus();
  
  // Sync disabled domains from service if available
  try {
    await syncDisabledDomains();
  } catch (error) {
    console.warn('[INIT] Could not sync disabled domains:', error);
  }
  
  // Update for current tab if available
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].url) {
      await updateContextMenusForPage(tabs[0].url);
    }
  } catch (error) {
    console.warn('[INIT] Could not update menus for current tab:', error);
  }
  
  // Check if salt exists, if not create one
  const { userSalt } = await chrome.storage.local.get('userSalt');
  if (!userSalt) {
    const salt = crypto.randomUUID();
    await chrome.storage.local.set({ userSalt: salt });
    console.log('[INIT] Generated new user salt');
  } else {
    console.log('[INIT] User salt already exists');
  }
  
  console.log('[INIT] Extension initialization complete');
}

/**
 * Create context menu items
 */
async function createContextMenus() {
  // Remove all existing menus first
  await chrome.contextMenus.removeAll();
  
  // Check if extension is unlocked
  if (!encryptionKey) {
    // Show only Unlock option when locked
    chrome.contextMenus.create({
      id: 'unlock-extension',
      title: '🔒 Unlock Webform Presets',
      contexts: ['editable']
    });
    return;
  }
  
  // When unlocked, show flat menu structure
  // Save option
  chrome.contextMenus.create({
    id: 'save-preset',
    title: '💾 Save Webform Preset',
    contexts: ['editable']
  });
  
  // Manage presets
  chrome.contextMenus.create({
    id: 'manage-presets',
    title: '⚙️ Manage Webform Presets',
    contexts: ['editable']
  });
  
  // Preset items will be added dynamically by updateContextMenusForPage
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
    
    // Check if domain is disabled
    const { disabledDomains = [] } = await chrome.storage.local.get('disabledDomains');
    const isDomainDisabled = disabledDomains.includes(domain);
    
    // Remove all menus and recreate based on disabled state
    await chrome.contextMenus.removeAll();
    presetMenuItems.clear();
    
    if (isDomainDisabled) {
      // Show only "Enable Webform Presets" option when domain is disabled
      chrome.contextMenus.create({
        id: 'enable-for-domain',
        title: '✅ Enable Webform Presets',
        contexts: ['editable']
      });
      return;
    }
    
    // Domain is enabled - show normal menu structure
    chrome.contextMenus.create({
      id: 'save-preset',
      title: '💾 Save Webform Preset',
      contexts: ['editable']
    });
    
    chrome.contextMenus.create({
      id: 'manage-presets',
      title: '⚙️ Manage Webform Presets',
      contexts: ['editable']
    });

    // Get presets for this page
    const domainPresets = await getPresetsForScope('domain', domain);
    const urlPresets = await getPresetsForScope('url', fullUrl);
    const allPresets = [...domainPresets, ...urlPresets];
    
    // Get the current tab to check form existence
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let validPresets = allPresets;
    
    if (tabs.length > 0) {
      // Filter presets to only those whose forms exist on the page
      // Use Promise.allSettled to avoid Promise rejection cascades
      const formChecks = await Promise.allSettled(
        allPresets.map(async preset => {
          try {
            const response = await chrome.tabs.sendMessage(tabs[0].id, {
              action: 'checkFormExists',
              formSelector: preset.formSelector
            });
            return response.exists ? preset : null;
          } catch (error) {
            // Content script may not be loaded or tab may be closed
            // Silently return the preset - it might be valid
            return preset;
          }
        })
      );
      // Extract fulfilled values
      validPresets = formChecks
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);
    }

    // Add preset items at top level (no parent, no nesting)
    if (validPresets.length > 0) {
      // Add separator before presets
      const separatorId = 'presets-separator';
      chrome.contextMenus.create({
        id: separatorId,
        type: 'separator',
        contexts: ['editable']
      });
      presetMenuItems.add(separatorId);
      
      // Add each preset as a top-level item
      validPresets.forEach((preset, index) => {
        const menuId = `preset-${preset.id}`;
        chrome.contextMenus.create({
          id: menuId,
          title: `� Fill: ${preset.name}`,
          contexts: ['editable']
        });
        presetMenuItems.add(menuId);
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
  if (menuItemId === 'unlock-extension') {
    await openUnlockPage();
  } else if (menuItemId === 'enable-for-domain') {
    // Enable domain from context menu
    const url = new URL(tab.url);
    const domain = url.hostname;
    const { disabledDomains = [] } = await chrome.storage.local.get('disabledDomains');
    const index = disabledDomains.indexOf(domain);
    if (index > -1) {
      disabledDomains.splice(index, 1);
      await chrome.storage.local.set({ disabledDomains });
      await updateContextMenusForPage(tab.url);
    }
  } else if (menuItemId === 'save-preset') {
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
    
    // Handle multiple forms or single form
    if (response.multipleForms) {
      // Show form selection modal
      await chrome.tabs.sendMessage(tab.id, {
        action: 'showFormSelectionModal',
        forms: response.forms
      });
    } else {
      // Show save modal directly
      await chrome.tabs.sendMessage(tab.id, {
        action: 'showSaveModal',
        formData: response
      });
    }
  } catch (error) {
    console.error('Error in handleSavePreset:', error);
    // If content script isn't loaded, try to inject it
    if (error.message && error.message.includes('Could not establish connection')) {
      console.log('Content script not loaded, attempting to inject...');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['scripts/utils.js', 'content.js']
        });
        // Try again after injection
        setTimeout(() => handleSavePreset(tab), 500);
      } catch (injectError) {
        console.error('Failed to inject content script:', injectError);
      }
    }
  }
}

/**
 * Handle fill preset action
 */
async function handleFillPreset(tab, presetId) {
  try {
    // First, ensure content script is loaded
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'getCurrentUrl' });
    } catch (pingError) {
      // Content script not loaded, inject it
      console.log('Content script not loaded, injecting...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['scripts/utils.js', 'content.js']
      });
      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Get current URL from content script
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
    
    console.log('About to fill preset:', preset.name);
    console.log('Fields to fill:', fields);
    console.log('Number of fields:', Object.keys(fields).length);

    // Send fill command to content script
    const fillResponse = await chrome.tabs.sendMessage(tab.id, {
      action: 'fillForm',
      formSelector: preset.formSelector,
      fields: fields,
      mode: 'overwrite'
    });
    
    console.log('Fill response:', fillResponse);
    
    // Only update use count if fill was successful
    if (fillResponse.success) {
      // Update use count
      preset.useCount = (preset.useCount || 0) + 1;
      preset.lastUsed = new Date().toISOString();
      await updatePresetInStorage(preset, urlObj);
    }

  } catch (error) {
    console.error('Error in handleFillPreset:', error);
  }
}

/**
 * Open management console (reuses existing tab if present)
 */
async function openManagementConsole() {
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
 * Open unlock page
 */
async function openUnlockPage() {
  const unlockUrl = chrome.runtime.getURL('unlock.html');
  
  // Get current active tab to return to after unlock
  try {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentTab && !currentTab.url.includes('unlock.html')) {
      await chrome.storage.session.set({ unlockReferrer: currentTab.url });
    }
  } catch (error) {
    console.error('Error storing referrer:', error);
  }
  
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
        return;
        
      case 'createNewCollection':
        await handleCreateNewCollection(message.password, sendResponse);
        return;
        
      case 'isUnlocked':
        // Check if we have encryption key in memory
        const hasKey = encryptionKey !== null;
        
        // Check if session says we should be unlocked
        const sessionState = await chrome.storage.session.get(['isUnlocked', 'unlockedAt']);
        const sessionUnlocked = sessionState.isUnlocked === true;
        
        if (sessionUnlocked && !hasKey) {
          // Service worker restarted and lost the key, but session says we were unlocked
          console.log('[IS_UNLOCKED] Session unlocked but key lost - need to re-unlock');
          sendResponse({ 
            unlocked: false, 
            needsReunlock: true,
            lastUnlockedAt: sessionState.unlockedAt 
          });
        } else {
          sendResponse({ unlocked: hasKey });
        }
        return;
        
      case 'lock':
        encryptionKey = null;
        await chrome.storage.session.remove(['isUnlocked', 'unlockedAt']); // Clear session unlock state
        stopKeepAlive(); // Stop keeping service worker alive
        presetMenuItems.clear();
        await createContextMenus(); // Reset context menus
        sendResponse({ success: true });
        return;
        
      case 'encrypt':
        const encrypted = await encryptData(message.data);
        sendResponse({ encrypted });
        return;
        
      case 'decrypt':
        const decrypted = await decryptData(message.data);
        sendResponse({ decrypted });
        return;
        
      case 'savePreset':
        await handleSavePresetMessage(message.preset, sendResponse);
        return;
        
      case 'getPresetsForPage':
        await handleGetPresetsForPage(message.url, sendResponse);
        return;
        
      case 'toggleDomainEnabled':
        await handleToggleDomainEnabled(message.domain, sendResponse);
        return;
        
      case 'isDomainEnabled':
        await handleIsDomainEnabled(message.domain, sendResponse);
        return;
        
      case 'triggerSavePreset':
        // Delegate to the existing handleSavePreset logic
        const tab = await chrome.tabs.get(message.tabId);
        await ensureUnlocked(async () => {
          await handleSavePreset(tab);
          sendResponse({ success: true });
        });
        return;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('[MESSAGE_HANDLER] Error handling message:', error);
    console.error('[MESSAGE_HANDLER] Error stack:', error.stack);
    sendResponse({ error: error.message });
  }
}

/**
 * Handle unlock attempt
 */
async function handleUnlock(password, sendResponse) {
  try {
    let { userSalt, verificationToken } = await chrome.storage.local.get(['userSalt', 'verificationToken']);
    
    console.log('[UNLOCK] Starting unlock process');
    console.log('[UNLOCK] Salt exists:', !!userSalt);
    console.log('[UNLOCK] Verification token exists:', !!verificationToken);
    
    // If salt is missing, create one (handles case where storage was cleared)
    if (!userSalt) {
      console.warn('[UNLOCK] Salt missing, creating new salt');
      userSalt = crypto.randomUUID();
      await chrome.storage.local.set({ userSalt });
      console.log('[UNLOCK] New salt created');
    }
    
    // Derive key
    const key = await deriveKey(password, userSalt);
    
    // Verify key is correct if verification token exists
    if (verificationToken) {
      console.log('[UNLOCK] Verifying password against existing collection');
      try {
        const testData = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(verificationToken.iv) },
          key,
          new Uint8Array(verificationToken.encrypted)
        );
        const decoder = new TextDecoder();
        const testString = decoder.decode(testData);
        
        if (testString !== 'VERIFIED') {
          console.warn('[UNLOCK] Password verification failed: incorrect password');
          sendResponse({ success: false, error: 'Incorrect password' });
          return;
        }
        console.log('[UNLOCK] Password verified successfully');
      } catch (error) {
        console.warn('[UNLOCK] Password verification failed:', error.message);
        sendResponse({ success: false, error: 'Incorrect password' });
        return;
      }
    } else {
      // First unlock - create verification token
      console.log('[UNLOCK] First-time setup: creating new collection');
      const encoder = new TextEncoder();
      const testData = encoder.encode('VERIFIED');
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        testData
      );
      
      await chrome.storage.local.set({
        verificationToken: {
          iv: Array.from(iv),
          encrypted: Array.from(new Uint8Array(encrypted))
        }
      });
      console.log('[UNLOCK] First collection created successfully');
    }
    
    // Set the encryption key
    encryptionKey = key;
    
    // Store unlock state in session storage (survives service worker restarts)
    await chrome.storage.session.set({ isUnlocked: true, unlockedAt: Date.now() });
    
    // Start keep-alive to prevent service worker from sleeping
    startKeepAlive();
    
    console.log('[UNLOCK] Extension unlocked successfully');
    
    // Send success response immediately before doing other work
    sendResponse({ success: true });
    
    // Recreate context menus now that we're unlocked (don't block response)
    try {
      await createContextMenus();
      
      // Update menus for current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].url) {
        await updateContextMenusForPage(tabs[0].url);
      }
    } catch (error) {
      console.warn('Could not update context menus after unlock:', error);
    }
    
    // Execute pending callbacks
    try {
      for (const callback of unlockCallbacks) {
        await callback();
      }
      unlockCallbacks = [];
    } catch (error) {
      console.error('Error executing unlock callbacks:', error);
    }
  } catch (error) {
    console.error('[UNLOCK] ERROR: Unlock failed:', error);
    console.error('[UNLOCK] Error stack:', error.stack);
    sendResponse({ success: false, error: `Unlock failed: ${error.message}` });
  }
}

/**
 * Handle create new collection
 */
async function handleCreateNewCollection(password, sendResponse) {
  try {
    console.log('[CREATE_COLLECTION] Starting new collection creation');
    
    // Get the salt, create if missing
    let { userSalt } = await chrome.storage.local.get('userSalt');
    
    if (!userSalt) {
      console.warn('[CREATE_COLLECTION] Salt missing, creating new salt');
      userSalt = crypto.randomUUID();
      await chrome.storage.local.set({ userSalt });
      console.log('[CREATE_COLLECTION] New salt created');
    }
    
    console.log('[CREATE_COLLECTION] Salt found, deriving key');
    
    // Derive key from new password
    const key = await deriveKey(password, userSalt);
    
    console.log('[CREATE_COLLECTION] Key derived, creating verification token');
    
    // Create verification token for this new collection
    const encoder = new TextEncoder();
    const testData = encoder.encode('VERIFIED');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      testData
    );
    
    console.log('[CREATE_COLLECTION] Verification token created, storing to chrome.storage');
    
    // Store the new verification token (this creates a new "collection")
    await chrome.storage.local.set({
      verificationToken: {
        iv: Array.from(iv),
        encrypted: Array.from(new Uint8Array(encrypted))
      }
    });
    
    console.log('[CREATE_COLLECTION] Verification token stored successfully');
    
    // Set the encryption key
    encryptionKey = key;
    
    // Store unlock state in session storage
    await chrome.storage.session.set({ isUnlocked: true, unlockedAt: Date.now() });
    
    // Start keep-alive to prevent service worker from sleeping
    startKeepAlive();
    
    console.log('[CREATE_COLLECTION] New collection created successfully!');
    
    // Send success response immediately
    sendResponse({ success: true });
    
    // Set up context menus (don't block response)
    try {
      console.log('[CREATE_COLLECTION] Setting up context menus');
      await createContextMenus();
      
      // Update menus for current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].url) {
        await updateContextMenusForPage(tabs[0].url);
      }
    } catch (error) {
      console.warn('[CREATE_COLLECTION] Could not update context menus:', error);
    }
  } catch (error) {
    console.error('[CREATE_COLLECTION] ERROR: Failed to create collection:', error);
    console.error('[CREATE_COLLECTION] Error stack:', error.stack);
    sendResponse({ success: false, error: `Failed to create collection: ${error.message}` });
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
    
    console.log('handleSavePresetMessage received:', presetData);
    console.log('Fields to save:', presetData.fields);
    console.log('Number of fields:', Object.keys(presetData.fields).length);

    // Generate preset object
    const preset = {
      id: crypto.randomUUID(),
      name: presetData.name,
      formSelector: presetData.formSelector,
      formUrl: presetData.formUrl, // Store the exact form URL
      fields: presetData.fields,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      useCount: 0
    };
    
    console.log('[SAVE_PRESET] Saving preset with formUrl:', preset.formUrl);

    // Encrypt the fields
    const encryptedFields = await encryptData(preset.fields);
    preset.encryptedFields = encryptedFields;
    delete preset.fields; // Remove plaintext

    // Save to storage based on scope
    await savePreset(presetData.scopeType, presetData.scopeValue, preset);

    // Update context menus for current tab
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].url) {
        await updateContextMenusForPage(tabs[0].url);
      }
    } catch (menuError) {
      console.warn('Could not update context menus:', menuError);
    }

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
 * Sync disabled domains from service (called on init)
 */
async function syncDisabledDomains() {
  try {
    const { localOnlyMode } = await chrome.storage.local.get('localOnlyMode');
    if (localOnlyMode) {
      console.log('[SYNC] Local-only mode, skipping disabled domains sync');
      return { success: true, synced: false };
    }
    
    // For now, just return success - actual sync service integration can be added later
    console.log('[SYNC] Disabled domains sync not yet implemented');
    return { success: true, synced: false };
  } catch (error) {
    console.warn('[SYNC] Error syncing disabled domains:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Disable a domain (with optional sync)
 */
async function disableDomainSync(domain) {
  try {
    const { disabledDomains = [] } = await chrome.storage.local.get('disabledDomains');
    
    if (!disabledDomains.includes(domain)) {
      disabledDomains.push(domain);
      await chrome.storage.local.set({ disabledDomains });
      console.log('[DOMAIN] Disabled:', domain);
    }
    
    // Optionally sync with service
    const { localOnlyMode } = await chrome.storage.local.get('localOnlyMode');
    if (!localOnlyMode) {
      // TODO: Sync with webform-sync service
      console.log('[SYNC] Would sync disabled domain to service:', domain);
    }
    
    return { success: true, synced: false };
  } catch (error) {
    console.error('[DOMAIN] Error disabling domain:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Enable a domain (with optional sync)
 */
async function enableDomainSync(domain) {
  try {
    const { disabledDomains = [] } = await chrome.storage.local.get('disabledDomains');
    const index = disabledDomains.indexOf(domain);
    
    if (index > -1) {
      disabledDomains.splice(index, 1);
      await chrome.storage.local.set({ disabledDomains });
      console.log('[DOMAIN] Enabled:', domain);
    }
    
    // Optionally sync with service
    const { localOnlyMode } = await chrome.storage.local.get('localOnlyMode');
    if (!localOnlyMode) {
      // TODO: Sync with webform-sync service
      console.log('[SYNC] Would sync enabled domain to service:', domain);
    }
    
    return { success: true, synced: false };
  } catch (error) {
    console.error('[DOMAIN] Error enabling domain:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Toggle domain enabled/disabled
 */
async function handleToggleDomainEnabled(domain, sendResponse) {
  try {
    const { disabledDomains = [] } = await chrome.storage.local.get('disabledDomains');
    const index = disabledDomains.indexOf(domain);
    
    let result;
    if (index > -1) {
      // Enable domain
      result = await enableDomainSync(domain);
    } else {
      // Disable domain
      result = await disableDomainSync(domain);
    }
    
    if (result.success) {
      // Update context menus for current page
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].url) {
        await updateContextMenusForPage(tabs[0].url);
      }
      
      sendResponse({ 
        success: true, 
        enabled: index > -1,
        synced: result.synced || false
      });
    } else {
      sendResponse({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error toggling domain:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Check if domain is enabled
 */
async function handleIsDomainEnabled(domain, sendResponse) {
  try {
    const { disabledDomains = [] } = await chrome.storage.local.get('disabledDomains');
    const enabled = !disabledDomains.includes(domain);
    sendResponse({ success: true, enabled });
  } catch (error) {
    console.error('Error checking domain status:', error);
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
