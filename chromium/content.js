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
  const form = findFormBySelector(formSelector);
  
  if (!form) {
    return { error: 'Form not found' };
  }
  
  const fields = getFormFields(form);
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
  const form = findFormBySelector(formSelector);
  
  if (!form) {
    return { error: 'Form not found' };
  }
  
  const initialState = formSnapshots.get(formSelector) || {};
  let filledCount = 0;
  let skippedCount = 0;
  
  // Iterate through preset data
  for (const [fieldName, fieldValue] of Object.entries(presetData)) {
    const field = form.querySelector(`[name="${fieldName}"]`);
    
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
    skippedCount
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sendResponse);
  return true; // Keep message channel open
});

/**
 * Handle messages from background script
 */
async function handleMessage(message, sendResponse) {
  try {
    switch (message.action) {
      case 'captureFormData':
        const forms = getAllForms();
        if (forms.length === 0) {
          sendResponse({ error: 'No forms found on page' });
        } else if (forms.length === 1) {
          const data = captureFormData(forms[0].selector);
          sendResponse(data);
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
        
      case 'fillForm':
        const result = fillForm(
          message.formSelector,
          message.data,
          message.mode
        );
        sendResponse(result);
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
// INITIALIZATION
// ============================================================================

initialize();
