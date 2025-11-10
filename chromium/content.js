/**
 * Content Script for Webform Presets Extension
 * Captures form data and fills forms with saved presets
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let formSnapshots = new Map(); // Store initial state of forms

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize content script when page loads
 */
function initialize() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', captureInitialState);
  } else {
    captureInitialState();
  }
  
  console.log('Webform Presets content script loaded');
}

/**
 * Capture initial state of all forms on the page
 */
function captureInitialState() {
  const forms = document.querySelectorAll('form');
  
  forms.forEach((form, index) => {
    const formId = getFormIdentifier(form, index);
    const snapshot = captureFormState(form);
    formSnapshots.set(formId, snapshot);
  });
  
  console.log(`Captured initial state of ${forms.length} form(s)`);
}

// ============================================================================
// FORM DETECTION AND IDENTIFICATION
// ============================================================================

/**
 * Get a unique identifier for a form
 */
function getFormIdentifier(form, index) {
  if (form.id) {
    return `id:${form.id}`;
  } else if (form.name) {
    return `name:${form.name}`;
  } else {
    // Generate a CSS selector
    const selector = generateCssSelector(form);
    return `css:${selector}`;
  }
}

/**
 * Generate a CSS selector for an element
 */
function generateCssSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  const path = [];
  let current = element;
  
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.nodeName.toLowerCase();
    
    if (current.className) {
      selector += '.' + current.className.trim().split(/\s+/).join('.');
    }
    
    path.unshift(selector);
    current = current.parentElement;
    
    if (path.length > 5) break; // Limit depth
  }
  
  return path.join(' > ');
}

/**
 * Get all forms on the page with their identifiers
 */
function getAllForms() {
  const forms = document.querySelectorAll('form');
  return Array.from(forms).map((form, index) => {
    const fields = getFormFields(form);
    const nonPasswordFields = fields.filter(f => f.type !== 'password');
    
    return {
      selector: getFormIdentifier(form, index),
      fieldCount: nonPasswordFields.length,
      hasPasswordField: fields.some(f => f.type === 'password')
    };
  });
}

// ============================================================================
// FORM DATA CAPTURE
// ============================================================================

/**
 * Capture current state of a form
 */
function captureFormState(form) {
  const fields = getFormFields(form);
  const state = {};
  
  fields.forEach(field => {
    // Skip password fields
    if (field.type === 'password') {
      return;
    }
    
    if (field.name) {
      state[field.name] = getFieldValue(field);
    }
  });
  
  return state;
}

/**
 * Get all form fields (input, select, textarea)
 */
function getFormFields(form) {
  const fields = [];
  
  // Get all input elements
  form.querySelectorAll('input').forEach(input => {
    fields.push({
      element: input,
      name: input.name,
      type: input.type || 'text',
      value: input.value
    });
  });
  
  // Get all select elements
  form.querySelectorAll('select').forEach(select => {
    fields.push({
      element: select,
      name: select.name,
      type: 'select',
      value: select.value
    });
  });
  
  // Get all textarea elements
  form.querySelectorAll('textarea').forEach(textarea => {
    fields.push({
      element: textarea,
      name: textarea.name,
      type: 'textarea',
      value: textarea.value
    });
  });
  
  return fields;
}

/**
 * Get the value of a form field
 */
function getFieldValue(field) {
  const element = field.element;
  
  if (field.type === 'checkbox') {
    return element.checked ? 'true' : 'false';
  } else if (field.type === 'radio') {
    // For radio buttons, only return value if checked
    return element.checked ? element.value : '';
  } else {
    return element.value;
  }
}

/**
 * Capture form data for saving
 */
function captureFormData(formSelector) {
  console.log('Attempting to capture form with selector:', formSelector);
  const form = findFormBySelector(formSelector);
  
  if (!form) {
    console.error('Form not found for selector:', formSelector);
    return { error: 'Form not found' };
  }
  
  console.log('Form found:', form);
  const fields = getFormFields(form);
  console.log('Fields found:', fields.length);
  const data = {};
  const fieldList = [];
  
  fields.forEach(field => {
    // Skip password fields
    if (field.type === 'password') {
      return;
    }
    
    if (field.name) {
      data[field.name] = getFieldValue(field);
      fieldList.push({
        name: field.name,
        type: field.type,
        value: getFieldValue(field)
      });
    }
  });
  
  return {
    selector: formSelector,
    data,
    fieldList
  };
}

// ============================================================================
// FORM FILLING
// ============================================================================

/**
 * Fill a form with preset data
 */
function fillForm(formSelector, presetData, mode = 'overwrite') {
  let form = null;
  
  // Try to find form by selector if provided
  if (formSelector) {
    form = findFormBySelector(formSelector);
  }
  
  const initialState = formSelector ? (formSnapshots.get(formSelector) || {}) : {};
  let filledCount = 0;
  let skippedCount = 0;
  
  // Iterate through preset data
  for (const [fieldName, fieldValue] of Object.entries(presetData)) {
    let field = null;
    
    // Try to find field in specific form first, then in entire document
    if (form) {
      field = form.querySelector(`[name="${fieldName}"]`);
    }
    
    if (!field) {
      field = document.querySelector(`[name="${fieldName}"]`);
    }
    
    if (!field) {
      console.warn(`Field not found: ${fieldName}`);
      continue;
    }
    
    // Skip password fields
    if (field.type === 'password') {
      console.warn(`Skipping password field: ${fieldName}`);
      continue;
    }
    
    // Check fill mode
    if (mode === 'update') {
      const initialValue = initialState[fieldName] || '';
      const currentValue = getFieldValue({ element: field, type: field.type });
      
      // Only fill if field hasn't been modified by user
      if (currentValue !== initialValue) {
        skippedCount++;
        continue;
      }
    }
    
    // Set field value
    if (setFieldValue(field, fieldValue)) {
      filledCount++;
    }
  }
  
  return {
    success: true,
    filledCount,
    skippedCount,
    message: `Filled ${filledCount} field(s)${skippedCount > 0 ? `, skipped ${skippedCount}` : ''}`
  };
}

/**
 * Set the value of a form field
 */
function setFieldValue(element, value) {
  try {
    const fieldType = element.type;
    
    if (fieldType === 'checkbox') {
      element.checked = (value === 'true' || value === true);
    } else if (fieldType === 'radio') {
      if (element.value === value) {
        element.checked = true;
      }
    } else {
      element.value = value;
    }
    
    // Trigger events for framework compatibility
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    return true;
  } catch (error) {
    console.error('Error setting field value:', error);
    return false;
  }
}

/**
 * Find a form by its selector
 */
function findFormBySelector(selector) {
  const [type, value] = selector.split(':', 2);
  
  switch (type) {
    case 'id':
      return document.getElementById(value);
    case 'name':
      return document.querySelector(`form[name="${value}"]`);
    case 'css':
      return document.querySelector(value);
    default:
      return null;
  }
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Handle messages from background script
 */
async function handleMessage(message, sendResponse) {
  try {
    switch (message.action) {
      case 'captureFormData':
        const forms = getAllForms();
        console.log('Forms found:', forms.length, forms);
        if (forms.length === 0) {
          sendResponse({ error: 'No forms found on page' });
        } else if (forms.length === 1) {
          const data = captureFormData(forms[0].selector);
          console.log('Captured form data:', data);
          if (data.error) {
            sendResponse({ error: data.error });
          } else if (!data.fieldList || data.fieldList.length === 0) {
            sendResponse({ error: 'No fields with names found in form' });
          } else {
            sendResponse(data);
          }
        } else {
          // Multiple forms, need user to select
          sendResponse({ 
            multipleForms: true, 
            forms: forms 
          });
        }
        break;
        
      case 'captureSpecificForm':
        const formData = captureFormData(message.formSelector);
        sendResponse(formData);
        break;
        
      case 'showSaveModal':
        showSaveModal(message.formData);
        sendResponse({ success: true });
        break;
        
      case 'showFormSelectionModal':
        showFormSelectionModal(message.forms);
        sendResponse({ success: true });
        break;
        
      case 'fillForm':
        const fillResult = fillForm(
          message.formSelector || null,
          message.fields,
          message.mode || 'overwrite'
        );
        if (fillResult.success) {
          showToast(fillResult.message, 'success');
        } else {
          showToast(fillResult.error || 'Failed to fill form', 'error');
        }
        sendResponse(fillResult);
        break;
        
      case 'getCurrentUrl':
        sendResponse({ url: window.location.href });
        break;
        
      case 'getForms':
        sendResponse({ forms: getAllForms() });
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error in content script:', error);
    sendResponse({ error: error.message });
  }
}

// ============================================================================
// SAVE MODAL UI
// ============================================================================

/**
 * Show form selection modal when multiple forms exist
 */
function showFormSelectionModal(forms) {
  const pageInfo = getCurrentPageInfo();
  
  const formOptions = forms.map((form, index) => `
    <div class="wfp-form-option" data-selector="${escapeHtml(form.selector)}" style="
      padding: 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    " onmouseover="this.style.borderColor='#667eea'" onmouseout="this.style.borderColor='#e5e7eb'">
      <div style="font-weight: 600; margin-bottom: 4px;">Form ${index + 1}</div>
      <div style="font-size: 12px; color: #6b7280;">
        ${escapeHtml(form.selector.split(':')[1])} • ${form.fieldCount} fields
      </div>
    </div>
  `).join('');

  const modalContent = `
    <div style="text-align: center;">
      <div style="font-size: 32px; margin-bottom: 12px;">📋</div>
      <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #111827;">Select a Form</h2>
      <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">
        Multiple forms detected on this page. Which one would you like to save?
      </p>
    </div>
    <div id="wfp-form-list" style="margin-bottom: 16px;">
      ${formOptions}
    </div>
    <div style="text-align: right;">
      <button id="wfp-cancel-btn" style="
        padding: 8px 16px;
        background: #f3f4f6;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      ">Cancel</button>
    </div>
  `;

  const modal = createModal(modalContent, { width: '450px' });
  document.body.appendChild(modal);

  // Handle form selection
  modal.querySelectorAll('.wfp-form-option').forEach(option => {
    option.addEventListener('click', async () => {
      const selector = option.dataset.selector;
      modal.remove();
      
      // Capture the selected form
      const formData = captureFormData(selector);
      if (formData.error) {
        showToast(formData.error, 'error');
        return;
      }
      
      // Show save modal
      showSaveModal(formData);
    });
  });

  // Cancel button
  modal.querySelector('#wfp-cancel-btn').addEventListener('click', () => {
    modal.remove();
  });
}

/**
 * Show save preset modal
 */
function showSaveModal(formData) {
  const pageInfo = getCurrentPageInfo();
  
  const fieldCheckboxes = formData.fieldList.map(field => `
    <label style="
      display: flex;
      align-items: center;
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
    " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='transparent'">
      <input type="checkbox" checked value="${escapeHtml(field.name)}" style="
        margin-right: 8px;
        width: 16px;
        height: 16px;
        cursor: pointer;
      ">
      <div style="flex: 1;">
        <div style="font-weight: 500; font-size: 14px;">${escapeHtml(field.name)}</div>
        <div style="font-size: 12px; color: #6b7280;">
          ${escapeHtml(field.type)} • ${escapeHtml(field.value.substring(0, 50))}${field.value.length > 50 ? '...' : ''}
        </div>
      </div>
    </label>
  `).join('');

  const modalContent = `
    <form id="wfp-save-form">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 32px; margin-bottom: 12px;">💾</div>
        <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #111827;">Save Form Preset</h2>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          ${escapeHtml(pageInfo.domain)}
        </p>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">
          Preset Name <span style="color: #ef4444;">*</span>
        </label>
        <input 
          type="text" 
          id="wfp-preset-name" 
          placeholder="e.g., Admin Account, Test User"
          required
          style="
            width: 100%;
            padding: 10px;
            border: 2px solid #e5e7eb;
            border-radius: 6px;
            font-size: 14px;
            box-sizing: border-box;
          "
        >
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 10px; font-weight: 500; font-size: 14px;">
          Save for:
        </label>
        <div style="display: flex; gap: 12px;">
          <label style="
            flex: 1;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
          " id="wfp-scope-domain-label">
            <input type="radio" name="scope" value="domain" checked style="margin-right: 8px;">
            <div>
              <div style="font-weight: 500; font-size: 14px;">This Domain</div>
              <div style="font-size: 12px; color: #6b7280;">${escapeHtml(pageInfo.domain)}</div>
            </div>
          </label>
          <label style="
            flex: 1;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
          " id="wfp-scope-url-label">
            <input type="radio" name="scope" value="url" style="margin-right: 8px;">
            <div>
              <div style="font-weight: 500; font-size: 14px;">Exact URL</div>
              <div style="font-size: 12px; color: #6b7280;">This page only</div>
            </div>
          </label>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 10px; font-weight: 500; font-size: 14px;">
          Fields to Include: (${formData.fieldList.length})
        </label>
        <div id="wfp-field-list" style="
          max-height: 200px;
          overflow-y: auto;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 8px;
        ">
          ${fieldCheckboxes}
        </div>
        <div style="margin-top: 8px; display: flex; gap: 8px;">
          <button type="button" id="wfp-select-all" style="
            font-size: 12px;
            padding: 4px 8px;
            background: none;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            cursor: pointer;
            color: #667eea;
          ">Select All</button>
          <button type="button" id="wfp-select-none" style="
            font-size: 12px;
            padding: 4px 8px;
            background: none;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            cursor: pointer;
            color: #667eea;
          ">Select None</button>
        </div>
      </div>

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" id="wfp-cancel-save" style="
          padding: 10px 20px;
          background: #f3f4f6;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">Cancel</button>
        <button type="submit" id="wfp-save-btn" style="
          padding: 10px 20px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">Save Preset</button>
      </div>
    </form>
  `;

  const modal = createModal(modalContent, { width: '550px', closeOnOverlayClick: false });
  document.body.appendChild(modal);

  // Radio button styling
  const updateRadioStyles = () => {
    const domainLabel = modal.querySelector('#wfp-scope-domain-label');
    const urlLabel = modal.querySelector('#wfp-scope-url-label');
    const domainRadio = modal.querySelector('input[value="domain"]');
    const urlRadio = modal.querySelector('input[value="url"]');
    
    domainLabel.style.borderColor = domainRadio.checked ? '#667eea' : '#e5e7eb';
    domainLabel.style.background = domainRadio.checked ? '#f5f7ff' : 'transparent';
    urlLabel.style.borderColor = urlRadio.checked ? '#667eea' : '#e5e7eb';
    urlLabel.style.background = urlRadio.checked ? '#f5f7ff' : 'transparent';
  };

  modal.querySelectorAll('input[name="scope"]').forEach(radio => {
    radio.addEventListener('change', updateRadioStyles);
  });
  updateRadioStyles();

  // Select all/none buttons
  modal.querySelector('#wfp-select-all').addEventListener('click', () => {
    modal.querySelectorAll('#wfp-field-list input[type="checkbox"]').forEach(cb => cb.checked = true);
  });

  modal.querySelector('#wfp-select-none').addEventListener('click', () => {
    modal.querySelectorAll('#wfp-field-list input[type="checkbox"]').forEach(cb => cb.checked = false);
  });

  // Cancel button
  modal.querySelector('#wfp-cancel-save').addEventListener('click', () => {
    modal.remove();
  });

  // Form submission
  modal.querySelector('#wfp-save-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = modal.querySelector('#wfp-preset-name').value.trim();
    const scope = modal.querySelector('input[name="scope"]:checked').value;
    const selectedFields = Array.from(modal.querySelectorAll('#wfp-field-list input[type="checkbox"]:checked'))
      .map(cb => cb.value);

    if (!name) {
      showToast('Please enter a preset name', 'error');
      return;
    }

    if (selectedFields.length === 0) {
      showToast('Please select at least one field', 'error');
      return;
    }

    // Filter form data to only include selected fields
    const filteredData = {};
    selectedFields.forEach(fieldName => {
      if (formData.data[fieldName] !== undefined) {
        filteredData[fieldName] = formData.data[fieldName];
      }
    });

    // Send to background for encryption and storage
    const saveBtn = modal.querySelector('#wfp-save-btn');
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'savePreset',
        preset: {
          name: name,
          scopeType: scope,
          scopeValue: scope === 'domain' ? pageInfo.domain : pageInfo.url,
          fields: filteredData
        }
      });

      if (response.error) {
        throw new Error(response.error);
      }

      modal.remove();
      showToast('Preset saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving preset:', error);
      showToast('Failed to save preset: ' + error.message, 'error');
      saveBtn.textContent = 'Save Preset';
      saveBtn.disabled = false;
    }
  });
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sendResponse);
  return true; // Keep message channel open
});

// ============================================================================
// INITIALIZATION
// ============================================================================

initialize();
