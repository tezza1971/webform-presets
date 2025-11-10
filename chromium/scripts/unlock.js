/**
 * Unlock Page Script for Webform Presets Extension
 */

let failedAttempts = 0;
const MAX_ATTEMPTS = 3;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkIfAlreadyUnlocked();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('unlock-form').addEventListener('submit', handleUnlock);
  document.getElementById('reset-btn').addEventListener('click', handleReset);
}

/**
 * Check if already unlocked
 */
async function checkIfAlreadyUnlocked() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'isUnlocked' });
    if (response.unlocked) {
      // Already unlocked, close this tab
      window.close();
    }
  } catch (error) {
    console.error('Error checking unlock status:', error);
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle unlock form submission
 */
async function handleUnlock(event) {
  event.preventDefault();
  
  const passwordInput = document.getElementById('master-password');
  const password = passwordInput.value;
  const unlockBtn = document.getElementById('unlock-btn');
  
  if (!password) {
    showError('Please enter your master password');
    return;
  }
  
  // Disable form during unlock attempt
  unlockBtn.disabled = true;
  unlockBtn.textContent = 'Unlocking...';
  hideError();
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'unlock',
      password: password
    });
    
    if (response.success) {
      // Success! Show success message and close
      showSuccess();
      setTimeout(() => {
        window.close();
      }, 1000);
    } else {
      // Failed
      failedAttempts++;
      
      if (failedAttempts >= MAX_ATTEMPTS) {
        showError(`Incorrect password. ${MAX_ATTEMPTS} attempts failed. You may need to reset your data.`);
      } else {
        showError(`Incorrect password. ${MAX_ATTEMPTS - failedAttempts} attempt(s) remaining.`);
      }
      
      passwordInput.value = '';
      passwordInput.focus();
    }
  } catch (error) {
    console.error('Error unlocking:', error);
    showError('An error occurred while unlocking. Please try again.');
  } finally {
    unlockBtn.disabled = false;
    unlockBtn.textContent = 'Unlock';
  }
}

/**
 * Handle reset button click
 */
async function handleReset() {
  const confirmed = confirm(
    '⚠️ WARNING ⚠️\n\n' +
    'This will permanently delete ALL your saved presets!\n\n' +
    'This action cannot be undone.\n\n' +
    'Are you sure you want to continue?'
  );
  
  if (!confirmed) {
    return;
  }
  
  const doubleConfirmed = confirm(
    'Final confirmation:\n\n' +
    'Type YES in the prompt to confirm deletion of all data.'
  );
  
  if (!doubleConfirmed) {
    return;
  }
  
  try {
    // Clear all storage
    await chrome.storage.local.clear();
    
    // Show success message
    alert('All data has been reset. You can now set a new master password.');
    
    // Reload the page
    window.location.reload();
  } catch (error) {
    console.error('Error resetting data:', error);
    showError('An error occurred while resetting data.');
  }
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Show error message
 */
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError() {
  const errorDiv = document.getElementById('error-message');
  errorDiv.style.display = 'none';
}

/**
 * Show success message
 */
function showSuccess() {
  const form = document.getElementById('unlock-form');
  form.innerHTML = `
    <div class="success-message">
      <div class="success-icon">✓</div>
      <h2>Unlocked!</h2>
      <p>Returning to your page...</p>
    </div>
  `;
}
