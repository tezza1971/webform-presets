/**
 * Content Script for Webform Presets Extension
 * Captures form data and fills forms with saved presets
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let formSnapshots = new Map(); // Store initial state of forms
let lastRightClickedElement = null; // Track which element was right-clicked

// Track right-click events to know which form element was clicked
document.addEventListener('contextmenu', (e) => {
  lastRightClickedElement = e.target;
  console.log('Right-clicked element:', lastRightClickedElement);
}, true);

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
 * Get label text for a form field
 */
function getFieldLabel(element) {
  // Try to find associated label
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      return label.textContent.trim();
    }
  }
  
  // Try to find parent label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    return parentLabel.textContent.trim();
  }
  
  // Try to find nearby label (previous sibling)
  let sibling = element.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === 'LABEL') {
      return sibling.textContent.trim();
    }
    sibling = sibling.previousElementSibling;
  }
  
  return null;
}

/**
 * Get all form fields (input, select, textarea)
 */
function getFormFields(form) {
  const fields = [];
  
  // Get all input elements
  form.querySelectorAll('input').forEach(input => {
    // Use name if available, otherwise use id
    const identifier = input.name || input.id;
    if (identifier) {
      fields.push({
        element: input,
        name: identifier,
        label: getFieldLabel(input),
        type: input.type || 'text',
        value: input.value
      });
    }
  });
  
  // Get all select elements
  form.querySelectorAll('select').forEach(select => {
    const identifier = select.name || select.id;
    if (identifier) {
      fields.push({
        element: select,
        name: identifier,
        label: getFieldLabel(select),
        type: 'select',
        value: select.value
      });
    }
  });
  
  // Get all textarea elements
  form.querySelectorAll('textarea').forEach(textarea => {
    const identifier = textarea.name || textarea.id;
    if (identifier) {
      fields.push({
        element: textarea,
        name: identifier,
        label: getFieldLabel(textarea),
        type: 'textarea',
        value: textarea.value
      });
    }
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
  const emptyFields = [];
  const hiddenFields = [];
  let passwordFieldsFound = 0;
  
  fields.forEach(field => {
    // Skip password fields but count them
    if (field.type === 'password') {
      passwordFieldsFound++;
      console.warn(`Password field excluded: ${field.name || field.id || 'unnamed'}`);
      return;
    }
    
    if (field.name) {
      const value = getFieldValue(field);
      const isEmpty = !value || value.trim() === '';
      
      // Safely check if field is hidden
      let isHidden = false;
      try {
        if (field.type === 'hidden') {
          isHidden = true;
        } else if (field instanceof Element) {
          // Check if element is not visible
          isHidden = field.offsetParent === null || 
                     window.getComputedStyle(field).display === 'none' ||
                     window.getComputedStyle(field).visibility === 'hidden';
        }
      } catch (error) {
        console.warn(`Could not determine visibility for field ${field.name}:`, error);
        isHidden = false;
      }
      
      const fieldInfo = {
        name: field.name,
        type: field.type,
        value: value,
        isEmpty: isEmpty,
        isHidden: isHidden
      };
      
      // Checkboxes and radios always included (explicit state)
      if (field.type === 'checkbox' || field.type === 'radio') {
        data[field.name] = value;
        fieldList.push(fieldInfo);
      } 
      // Non-empty, visible fields included by default
      else if (!isEmpty && !isHidden) {
        data[field.name] = value;
        fieldList.push(fieldInfo);
      }
      // Hidden fields (whether empty or not) - add to hidden list only
      else if (isHidden) {
        hiddenFields.push(fieldInfo);
        console.log(`Hidden field (excluded by default): ${field.name}`);
      }
      // Empty but visible fields - add to empty list
      else if (isEmpty) {
        emptyFields.push(fieldInfo);
        console.log(`Empty field (excluded by default): ${field.name}`);
      }
    }
  });
  
  console.log('Captured data:', data);
  console.log('Field list:', fieldList);
  console.log('Empty fields:', emptyFields.length);
  console.log('Hidden fields:', hiddenFields.length);
  if (passwordFieldsFound > 0) {
    console.warn(`⚠️ ${passwordFieldsFound} password field(s) excluded from preset for security`);
  }
  
  return {
    selector: formSelector,
    data,
    fieldList,
    emptyFields,
    hiddenFields,
    passwordFieldsExcluded: passwordFieldsFound
  };
}

// ============================================================================
// FORM FILLING
// ============================================================================

/**
 * Fill a form with preset data
 */
function fillForm(formSelector, presetData, mode = 'overwrite') {
  console.log('fillForm called with:', { formSelector, presetData, mode });
  
  let form = null;
  
  // Try to find form by selector if provided
  if (formSelector) {
    form = findFormBySelector(formSelector);
    console.log('Form found by selector:', form);
    
    // If form doesn't exist on this page, don't try to fill
    if (!form) {
      console.warn('Form not found on this page, selector:', formSelector);
      return {
        success: false,
        error: 'Form not found on this page',
        filledCount: 0,
        skippedCount: 0
      };
    }
  }
  
  const initialState = formSelector ? (formSnapshots.get(formSelector) || {}) : {};
  let filledCount = 0;
  let skippedCount = 0;
  let passwordFieldsSkipped = 0;
  const filledFields = {};
  
  // Iterate through preset data
  for (const [fieldName, fieldValue] of Object.entries(presetData)) {
    console.log(`Attempting to fill field: ${fieldName} = ${fieldValue}`);
    
    let field = null;
    
    // Try to find field in specific form first, then in entire document
    // Search by name attribute first, then by id attribute
    if (form) {
      field = form.querySelector(`[name="${fieldName}"]`);
      console.log(`Field search in form for [name="${fieldName}"]:`, field);
      if (!field) {
        field = form.querySelector(`[id="${fieldName}"]`);
        console.log(`Field search in form for [id="${fieldName}"]:`, field);
      }
    }
    
    if (!field) {
      field = document.querySelector(`[name="${fieldName}"]`);
      console.log(`Field search in document for [name="${fieldName}"]:`, field);
      if (!field) {
        field = document.querySelector(`[id="${fieldName}"]`);
        console.log(`Field search in document for [id="${fieldName}"]:`, field);
      }
    }
    
    if (!field) {
      console.warn(`Field not found: ${fieldName}`);
      continue;
    }
    
    // Skip password fields
    if (field.type === 'password') {
      console.warn(`Skipping password field: ${fieldName}`);
      passwordFieldsSkipped++;
      continue;
    }
    
    // Check fill mode
    if (mode === 'update') {
      const initialValue = initialState[fieldName] || '';
      const currentValue = getFieldValue({ element: field, type: field.type });
      
      console.log(`[UPDATE MODE] Field ${fieldName}:`, {
        initialValue,
        currentValue,
        hasChanged: currentValue !== initialValue
      });
      
      // Only fill if field hasn't been modified by user
      if (currentValue !== initialValue) {
        console.log(`[UPDATE MODE] Skipping ${fieldName} - field has been modified`);
        skippedCount++;
        continue;
      }
      console.log(`[UPDATE MODE] Filling ${fieldName} - field unchanged`);
    }
    
    // Set field value
    const beforeValue = field.value;
    if (setFieldValue(field, fieldValue)) {
      const afterValue = field.value;
      console.log(`Field ${fieldName}: "${beforeValue}" → "${afterValue}"`);
      filledFields[fieldName] = afterValue;
      filledCount++;
    }
  }
  
  // Verify fields after a short delay (for React/Vue/Angular)
  setTimeout(() => {
    console.log('Verifying filled fields...');
    let verifiedCount = 0;
    let failedFields = [];
    
    for (const [fieldName, expectedValue] of Object.entries(filledFields)) {
      let field = null;
      
      // Search by name first, then by id (same logic as filling)
      if (form) {
        field = form.querySelector(`[name="${fieldName}"]`);
        if (!field) {
          field = form.querySelector(`[id="${fieldName}"]`);
        }
      }
      if (!field) {
        field = document.querySelector(`[name="${fieldName}"]`);
        if (!field) {
          field = document.querySelector(`[id="${fieldName}"]`);
        }
      }
      
      if (field) {
        const actualValue = field.value;
        if (actualValue === expectedValue) {
          verifiedCount++;
        } else {
          console.warn(`Field ${fieldName} verification failed: expected "${expectedValue}", got "${actualValue}"`);
          failedFields.push(fieldName);
        }
      }
    }
    
    if (verifiedCount === filledCount) {
      const passwordNote = passwordFieldsSkipped > 0 ? ' (passwords skipped)' : '';
      const modeNote = mode === 'update' && skippedCount > 0 ? `, ${skippedCount} unchanged` : '';
      showToast(`✓ Verified ${verifiedCount} field(s)${modeNote}${passwordNote}`, 'success');
    } else {
      const passwordNote = passwordFieldsSkipped > 0 ? ' (passwords skipped)' : '';
      const modeNote = mode === 'update' && skippedCount > 0 ? `, ${skippedCount} unchanged` : '';
      showToast(`⚠ Filled ${filledCount} but only verified ${verifiedCount} field(s)${modeNote}${passwordNote}`, 'warning');
    }
  }, 200);
  
  return {
    success: true,
    filledCount,
    skippedCount,
    passwordFieldsSkipped,
    message: `Filled ${filledCount} field(s)${skippedCount > 0 ? `, skipped ${skippedCount} modified` : ''}${passwordFieldsSkipped > 0 ? ', passwords skipped' : ''}`
  };
}

/**
 * Set the value of a form field
 */
function setFieldValue(element, value) {
  try {
    console.log(`setFieldValue called for ${element.name || element.id}:`, {
      type: element.type,
      tagName: element.tagName,
      currentValue: element.value,
      newValue: value
    });
    
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
    
    // Additional events for some frameworks
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    
    console.log(`Field value after setting:`, element.value);
    
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
          // Only one form, use it
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
          // Multiple forms - try to detect which one was right-clicked
          let targetForm = null;
          
          if (lastRightClickedElement) {
            // Find the form that contains the right-clicked element
            let currentElement = lastRightClickedElement;
            while (currentElement && currentElement !== document.body) {
              if (currentElement.tagName === 'FORM') {
                // Found the parent form
                const formIndex = Array.from(document.querySelectorAll('form')).indexOf(currentElement);
                if (formIndex >= 0 && formIndex < forms.length) {
                  targetForm = forms[formIndex];
                  console.log('Detected form from right-click:', targetForm);
                }
                break;
              }
              currentElement = currentElement.parentElement;
            }
          }
          
          if (targetForm) {
            // Capture the detected form
            const data = captureFormData(targetForm.selector);
            console.log('Captured form data from right-clicked form:', data);
            if (data.error) {
              sendResponse({ error: data.error });
            } else if (!data.fieldList || data.fieldList.length === 0) {
              sendResponse({ error: 'No fields with names found in form' });
            } else {
              sendResponse(data);
            }
          } else {
            // Couldn't detect form, show selection modal
            sendResponse({ 
              multipleForms: true, 
              forms: forms 
            });
          }
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
        // Don't show toast here - let the caller decide
        // (verification toast is shown in fillForm itself for successful fills)
        sendResponse(fillResult);
        break;
        
      case 'getCurrentUrl':
        sendResponse({ url: window.location.href });
        break;
        
      case 'checkFormExists':
        // Check if a form with the given selector exists
        const formExists = message.formSelector ? 
          (findFormBySelector(message.formSelector) !== null) : 
          false;
        sendResponse({ exists: formExists });
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
  
  // Helper function to generate descriptive form label
  const getFormLabel = (form, index) => {
    // Try to get the actual form element to inspect it
    const formElement = document.querySelector(form.selector);
    if (!formElement) {
      return `Form ${index + 1}`;
    }
    
    // Priority 1: Form ID
    if (formElement.id) {
      return formElement.id;
    }
    
    // Priority 2: Form name attribute
    if (formElement.name) {
      return formElement.name;
    }
    
    // Priority 3: First heading or legend inside form
    const heading = formElement.querySelector('h1, h2, h3, legend');
    if (heading && heading.textContent.trim()) {
      return heading.textContent.trim().slice(0, 40);
    }
    
    // Priority 4: Describe by fields (first 2-3 field names)
    const fields = formElement.querySelectorAll('input[name], select[name], textarea[name]');
    if (fields.length > 0) {
      const fieldNames = Array.from(fields)
        .slice(0, 3)
        .map(f => f.name || f.type)
        .join(', ');
      return `${fieldNames}${fields.length > 3 ? '...' : ''}`;
    }
    
    // Fallback
    return `Form ${index + 1}`;
  };
  
  const formOptions = forms.map((form, index) => {
    const label = getFormLabel(form, index);
    const fieldText = form.fieldCount === 1 ? 'field' : 'fields';
    
    return `
    <label class="wfp-form-option" style="
      display: block;
      padding: 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    " onmouseover="this.style.borderColor='#667eea'; this.style.background='#f9fafb'" 
       onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='transparent'">
      <input type="radio" name="wfp-form-select" value="${escapeHtml(form.selector)}" style="
        margin-right: 10px;
        cursor: pointer;
      " />
      <span style="font-weight: 600;">${escapeHtml(label)}</span>
      <div style="font-size: 12px; color: #6b7280; margin-left: 24px;">
        ${form.fieldCount} ${fieldText} • ${escapeHtml(form.selector.split(':')[1])}
      </div>
    </label>
  `}).join('');

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
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button id="wfp-cancel-btn" style="
        padding: 8px 16px;
        background: #f3f4f6;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      ">Cancel</button>
      <button id="wfp-continue-btn" style="
        padding: 8px 16px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      " disabled>Continue</button>
    </div>
  `;

  const modal = createModal(modalContent, { width: '450px' });
  document.body.appendChild(modal);

  const continueBtn = modal.querySelector('#wfp-continue-btn');
  const radioButtons = modal.querySelectorAll('input[type="radio"]');
  
  // Enable continue button when a form is selected
  radioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
      continueBtn.disabled = false;
      continueBtn.style.opacity = '1';
      continueBtn.style.cursor = 'pointer';
    });
  });
  
  // Handle continue button
  continueBtn.addEventListener('click', async () => {
    const selectedRadio = modal.querySelector('input[name="wfp-form-select"]:checked');
    if (!selectedRadio) return;
    
    const selector = selectedRadio.value;
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
  
  // Function to generate field checkbox HTML
  const createFieldCheckbox = (field, isDefaultVisible = true) => {
    const displayName = field.label || field.name;
    const secondaryInfo = field.label ? field.name : '';
    const valueDisplay = field.value ? escapeHtml(field.value.substring(0, 50)) + (field.value.length > 50 ? '...' : '') : '(empty)';
    const fieldTypeDisplay = field.isHidden ? `${field.type} • 👁️‍🗨️ hidden` : field.type;
    const dataAttrs = `data-is-empty="${field.isEmpty ? 'true' : 'false'}" data-is-hidden="${field.isHidden ? 'true' : 'false'}"`;
    
    return `
    <label style="
      display: ${isDefaultVisible ? 'inline-flex' : 'none'};
      align-items: flex-start;
      padding: 10px 12px;
      border: 2px solid #e5e7eb;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      margin: 4px;
      min-width: 200px;
      flex: 1 1 auto;
      background: white;
    " class="wfp-field-checkbox" ${dataAttrs} onmouseover="this.style.borderColor='#667eea'; this.style.background='#f5f7ff'" onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='white'">
      <input type="checkbox" ${isDefaultVisible ? 'checked' : ''} value="${escapeHtml(field.name)}" style="
        margin-right: 10px;
        margin-top: 2px;
        width: 18px;
        height: 18px;
        cursor: pointer;
        flex-shrink: 0;
      ">
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 500; font-size: 13px; margin-bottom: 2px; word-break: break-word;">${escapeHtml(displayName)}</div>
        <div style="font-size: 11px; color: #6b7280; word-break: break-word;">
          ${secondaryInfo ? escapeHtml(secondaryInfo) + ' • ' : ''}${escapeHtml(fieldTypeDisplay)} • ${valueDisplay}
        </div>
      </div>
    </label>
  `;
  };
  
  // Generate all field checkboxes (visible by default, empty hidden, hidden hidden)
  const allFields = [
    ...formData.fieldList.map(f => createFieldCheckbox(f, true)),
    ...formData.emptyFields.map(f => createFieldCheckbox(f, false)),
    ...formData.hiddenFields.map(f => createFieldCheckbox(f, false))
  ].join('');
  
  const totalFieldCount = formData.fieldList.length + formData.emptyFields.length + formData.hiddenFields.length;

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
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <label style="font-weight: 500; font-size: 14px;">
            Fields to Include: (<span id="wfp-visible-count">${formData.fieldList.length}</span>/<span id="wfp-total-count">${totalFieldCount}</span>)
          </label>
          <div style="display: flex; gap: 12px; align-items: center;">
            ${formData.emptyFields.length > 0 ? `
            <label style="display: flex; align-items: center; font-size: 13px; cursor: pointer;">
              <input type="checkbox" id="wfp-show-empty" style="margin-right: 6px;">
              <span>Include empty fields (${formData.emptyFields.length})</span>
            </label>
            ` : ''}
            ${formData.hiddenFields.length > 0 ? `
            <label style="display: flex; align-items: center; font-size: 13px; cursor: pointer;">
              <input type="checkbox" id="wfp-show-hidden" style="margin-right: 6px;">
              <span>Include hidden fields (${formData.hiddenFields.length})</span>
            </label>
            ` : ''}
          </div>
        </div>
        <div id="wfp-field-list" style="
          display: flex;
          flex-wrap: wrap;
          gap: 0;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 8px;
          background: #f9fafb;
        ">
          ${allFields}
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
          ">Select All Visible</button>
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
        ${formData.passwordFieldsExcluded > 0 ? `
        <div style="
          margin-top: 12px;
          padding: 10px 12px;
          background: #fef3c7;
          border: 1px solid #fbbf24;
          border-radius: 6px;
          font-size: 13px;
          color: #92400e;
        ">
          <span style="font-weight: 600;">🔒 Security Note:</span>
          ${formData.passwordFieldsExcluded} password field(s) excluded for security
        </div>
        ` : ''}
        ${(formData.emptyFields.length > 0 || formData.hiddenFields.length > 0) ? `
        <div style="
          margin-top: 12px;
          padding: 10px 12px;
          background: #e0f2fe;
          border: 1px solid #0ea5e9;
          border-radius: 6px;
          font-size: 12px;
          color: #0c4a6e;
        ">
          <span style="font-weight: 600;">💡 Tip:</span>
          Empty fields will be cleared during fill operations. Hidden fields can be overwritten with this extension (normally impossible to modify).
        </div>
        ` : ''}
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

  const modal = createModal(modalContent, { width: '900px', closeOnOverlayClick: false });
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
  const updateVisibleCount = () => {
    const visibleFields = modal.querySelectorAll('.wfp-field-checkbox[style*="display: inline-flex"]').length;
    const visibleCountEl = modal.querySelector('#wfp-visible-count');
    if (visibleCountEl) {
      visibleCountEl.textContent = visibleFields;
    }
  };
  
  modal.querySelector('#wfp-select-all').addEventListener('click', () => {
    // Only select checkboxes that are visible
    modal.querySelectorAll('.wfp-field-checkbox').forEach(label => {
      if (label.style.display !== 'none') {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = true;
      }
    });
  });

  modal.querySelector('#wfp-select-none').addEventListener('click', () => {
    modal.querySelectorAll('#wfp-field-list input[type="checkbox"]').forEach(cb => cb.checked = false);
  });
  
  // Show/hide empty fields toggle
  const showEmptyCheckbox = modal.querySelector('#wfp-show-empty');
  if (showEmptyCheckbox) {
    showEmptyCheckbox.addEventListener('change', (e) => {
      const show = e.target.checked;
      modal.querySelectorAll('.wfp-field-checkbox[data-is-empty="true"]').forEach(label => {
        label.style.display = show ? 'inline-flex' : 'none';
      });
      updateVisibleCount();
    });
  }
  
  // Show/hide hidden fields toggle
  const showHiddenCheckbox = modal.querySelector('#wfp-show-hidden');
  if (showHiddenCheckbox) {
    showHiddenCheckbox.addEventListener('change', (e) => {
      const show = e.target.checked;
      modal.querySelectorAll('.wfp-field-checkbox[data-is-hidden="true"]').forEach(label => {
        label.style.display = show ? 'inline-flex' : 'none';
      });
      updateVisibleCount();
    });
  }

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

    // Build a map of all fields (including empty and hidden) for lookup
    const allFieldsMap = new Map();
    
    // Add regular fields
    formData.fieldList.forEach(field => {
      allFieldsMap.set(field.name, field.value);
    });
    
    // Add empty fields
    formData.emptyFields.forEach(field => {
      allFieldsMap.set(field.name, field.value);
    });
    
    // Add hidden fields
    formData.hiddenFields.forEach(field => {
      allFieldsMap.set(field.name, field.value);
    });
    
    // Filter to only include selected fields
    const filteredData = {};
    selectedFields.forEach(fieldName => {
      if (allFieldsMap.has(fieldName)) {
        filteredData[fieldName] = allFieldsMap.get(fieldName);
      }
    });
    
    console.log('Selected fields:', selectedFields);
    console.log('All fields map:', allFieldsMap);
    console.log('Filtered data to save:', filteredData);

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
          formUrl: pageInfo.url, // Always send the actual form URL
          formSelector: formData.selector,
          fields: filteredData
        }
      });
      
      console.log('Save response:', response);

      if (response.error) {
        throw new Error(response.error);
      }

      modal.remove();
      
      // Add password note if the form has password fields
      const passwordNote = formData.hasPasswordField ? ' (passwords not included)' : '';
      showToast(`Preset saved successfully!${passwordNote}`, 'success');
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
