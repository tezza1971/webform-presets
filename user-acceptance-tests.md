# User Acceptance Tests (UAT)

## Test Environment

**Primary Test Site:** https://dnschecker.org/smtp-test-tool.php

**Browsers:**
- Chrome (latest)
- Brave (latest)

**Prerequisites:**
- Extension installed and loaded in developer mode
- Fresh browser session (no cached data)

---

## Test Suite 1: Initial Setup & First-Time Experience

### Test 1.1: Extension Installation
**Objective:** Verify extension loads correctly

**Steps:**
1. Open Chrome/Brave
2. Navigate to `chrome://extensions/` or `brave://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `chromium` folder
6. Verify extension appears in extension list

**Expected Result:**
- Extension loads without errors
- Extension icon appears in toolbar (even if generic)
- Extension shows as enabled

**Status:** ☐ Pass ☐ Fail

---

### Test 1.2: First Unlock - Master Password Setup
**Objective:** Test initial master password creation flow

**Steps:**
1. Click extension icon in toolbar
2. Note that you should see "Extension is locked" message
3. Click "Unlock" button
4. New tab opens with unlock.html page
5. Enter a master password in the field (e.g., "TestPassword123!")
6. Note if password manager prompts to save password
7. Click "Unlock" button

**Expected Result:**
- Unlock page displays cleanly with password field
- Password managers should detect the field
- After unlock, tab closes automatically
- Extension popup now shows unlocked state

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

## Test Suite 2: Saving Presets

### Test 2.1: Save Single Form (SMTP Test Tool)
**Objective:** Save a form with multiple non-password fields

**Steps:**
1. Navigate to https://dnschecker.org/smtp-test-tool.php
2. Fill in the form with test data:
   - SMTP Server: `smtp.gmail.com`
   - Port: `587`
   - Username: `test@example.com`
   - Password: `dummypassword123`
   - From Email: `sender@test.com`
   - To Email: `recipient@test.com`
   - Subject: `Test Subject`
   - Message Body: `This is a test message`
3. Right-click anywhere on the page
4. Select "Webform Presets" → "Save as Preset..."

**Expected Result:**
- Context menu appears with "Webform Presets" option
- Submenu shows "Save as Preset..." option
- Clicking triggers save flow (may show console message if UI not implemented)
- Password field should NOT be captured

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### Test 2.2: Context Menu Visibility
**Objective:** Verify context menu is accessible

**Steps:**
1. On any webpage, right-click in different areas:
   - In a text field
   - On the page background
   - On a button
   - Inside a form
2. Check for "Webform Presets" menu item

**Expected Result:**
- "Webform Presets" appears in context menu consistently
- Menu has submenu arrow indicator
- Menu items are readable and properly formatted

**Status:** ☐ Pass ☐ Fail

---

### Test 2.3: Extension Popup - Save Button
**Objective:** Test save functionality via popup

**Steps:**
1. Navigate to https://dnschecker.org/smtp-test-tool.php
2. Fill in several form fields
3. Click extension icon in toolbar
4. Click "Save Current Form" button

**Expected Result:**
- Popup opens showing unlocked state
- "Save Current Form" button is visible and clickable
- Clicking triggers save flow (may show alert if full UI not ready)

**Status:** ☐ Pass ☐ Fail

---

## Test Suite 3: Form Detection

### Test 3.1: Single Form Detection
**Objective:** Verify extension detects forms correctly

**Steps:**
1. Navigate to https://dnschecker.org/smtp-test-tool.php
2. Open browser DevTools (F12)
3. Go to Console tab
4. Send message to content script (via extension popup or context menu action)
5. Check console for form detection logs

**Expected Result:**
- Console shows "Webform Presets content script loaded"
- Console shows form detection count
- No JavaScript errors

**Status:** ☐ Pass ☐ Fail

---

### Test 3.2: Password Field Exclusion
**Objective:** Ensure password fields are never captured

**Steps:**
1. Navigate to https://dnschecker.org/smtp-test-tool.php
2. Fill in all fields including password
3. Open DevTools → Console
4. Attempt to capture form data
5. Inspect the captured data structure in console

**Expected Result:**
- Password field is explicitly excluded from captured data
- Other fields are captured correctly
- Console shows password fields were filtered

**Status:** ☐ Pass ☐ Fail

---

## Test Suite 4: Storage & Encryption

### Test 4.1: Data Persistence
**Objective:** Verify encrypted data is stored

**Steps:**
1. After saving a preset (or attempting to)
2. Open DevTools
3. Go to Application tab → Storage → Local Storage
4. Find the extension's storage
5. Inspect stored data

**Expected Result:**
- Extension storage contains data
- Data appears encrypted (not readable plaintext)
- Salt is stored
- Data structure matches spec

**Status:** ☐ Pass ☐ Fail

---

### Test 4.2: Session Lock on Browser Close
**Objective:** Verify extension locks when browser closes

**Steps:**
1. Unlock extension
2. Verify it's in unlocked state
3. Close browser completely
4. Reopen browser
5. Click extension icon

**Expected Result:**
- Extension shows locked state
- Requires master password again
- Previous data still exists in storage (encrypted)

**Status:** ☐ Pass ☐ Fail

---

## Test Suite 5: Management Console

### Test 5.1: Open Management Console
**Objective:** Access the options/management page

**Steps:**
1. Method A: Click extension icon → "Manage Presets"
2. Method B: Right-click page → "Webform Presets" → "Manage Presets"
3. Method C: chrome://extensions → Extension details → "Extension options"

**Expected Result:**
- Management console opens in new tab
- Page displays properly with sidebar and main content
- Shows locked state if not unlocked
- Shows unlock button

**Status:** ☐ Pass ☐ Fail

---

### Test 5.2: Management Console - Statistics
**Objective:** Verify statistics display

**Steps:**
1. Open management console (ensure unlocked)
2. Check sidebar statistics section
3. Note "Total Presets" and "Domains" counts

**Expected Result:**
- Statistics section is visible
- Counts match actual data (may be 0 if none saved yet)
- Statistics update when presets added/removed

**Status:** ☐ Pass ☐ Fail

---

### Test 5.3: Export Functionality
**Objective:** Test backup/export feature

**Steps:**
1. Open management console
2. Click "Export All" button in sidebar
3. Save the downloaded JSON file
4. Open file in text editor
5. Inspect contents

**Expected Result:**
- JSON file downloads automatically
- Filename includes timestamp
- File contains valid JSON
- Data is encrypted (not readable)
- Includes version and metadata

**Status:** ☐ Pass ☐ Fail

---

### Test 5.4: Import Functionality
**Objective:** Test backup/import feature

**Steps:**
1. Have an exported JSON file ready
2. Open management console
3. Click "Import" button
4. Select the JSON file
5. Confirm import warning

**Expected Result:**
- File picker opens
- Warning dialog appears before import
- Import completes successfully
- Data is loaded and visible

**Status:** ☐ Pass ☐ Fail

---

## Test Suite 6: Security Tests

### Test 6.1: Master Password Validation
**Objective:** Test incorrect password handling

**Steps:**
1. Lock extension (close browser or clear session)
2. Open unlock page
3. Enter incorrect password
4. Click "Unlock"
5. Try 3 times with wrong password

**Expected Result:**
- Shows error message for incorrect password
- Shows remaining attempts counter
- After 3 attempts, suggests data reset option
- Does not unlock with wrong password

**Status:** ☐ Pass ☐ Fail

---

### Test 6.2: Data Reset
**Objective:** Test emergency data reset feature

**Steps:**
1. From unlock page, click "Reset All Data"
2. Read warning dialog
3. Confirm reset

**Expected Result:**
- Multiple confirmation dialogs appear
- Warns about permanent deletion
- After confirmation, all storage is cleared
- Can set new master password

**Status:** ☐ Pass ☐ Fail

---

### Test 6.3: Encryption Verification
**Objective:** Ensure data is actually encrypted

**Steps:**
1. Save a preset with identifiable data (e.g., "MySecretValue123")
2. Open DevTools → Application → Storage
3. View extension's local storage
4. Search for the plain text value

**Expected Result:**
- Plain text values are NOT visible in storage
- All data appears as encrypted strings
- Cannot read preset data without decryption

**Status:** ☐ Pass ☐ Fail

---

## Test Suite 7: Fill Functionality (Future)

### Test 7.1: Fill Form - Overwrite Mode
**Objective:** Test filling form with overwrite

**Status:** ⏸️ Pending Implementation

**Steps:**
1. Navigate to https://dnschecker.org/smtp-test-tool.php
2. Fill form with different values
3. Right-click → "Webform Presets" → "Fill with..." → [preset] → "Overwrite"

**Expected Result:**
- All fields get replaced with preset values
- Password fields remain empty
- Form is ready to submit

---

### Test 7.2: Fill Form - Update Only Mode
**Objective:** Test smart fill that preserves user edits

**Status:** ⏸️ Pending Implementation

**Steps:**
1. Navigate to https://dnschecker.org/smtp-test-tool.php
2. Fill SMTP Server field with custom value
3. Leave other fields empty
4. Right-click → "Webform Presets" → "Fill with..." → [preset] → "Update Only"

**Expected Result:**
- Custom SMTP Server value is preserved
- Empty fields get filled from preset
- Password field remains empty

---

## Test Suite 8: Edge Cases & Error Handling

### Test 8.1: No Forms on Page
**Objective:** Handle pages without forms gracefully

**Steps:**
1. Navigate to a page with no forms (e.g., google.com)
2. Right-click → "Webform Presets"
3. Try to save preset

**Expected Result:**
- Shows appropriate message "No forms found on page"
- Does not crash or show errors
- Context menu still appears

**Status:** ☐ Pass ☐ Fail

---

### Test 8.2: Very Large Form
**Objective:** Test with forms containing many fields

**Steps:**
1. Find or create a page with 50+ form fields
2. Fill multiple fields
3. Attempt to save as preset

**Expected Result:**
- Extension handles large forms
- No performance issues
- Data saves successfully

**Status:** ☐ Pass ☐ Fail

---

### Test 8.3: Special Characters in Data
**Objective:** Test data with special characters

**Steps:**
1. Fill form with special characters:
   - Quotes: `"test"` and `'test'`
   - Unicode: `café`, `日本語`, `🎉`
   - HTML: `<script>alert('test')</script>`
   - JSON: `{"key": "value"}`
2. Save preset
3. Verify data in storage
4. Fill form with preset

**Expected Result:**
- Special characters preserved correctly
- No XSS vulnerabilities
- Unicode characters display properly
- No JSON parsing errors

**Status:** ☐ Pass ☐ Fail

---

## Test Suite 9: Browser Compatibility

### Test 9.1: Chrome Compatibility
**Objective:** Verify full functionality in Chrome

**Browser:** Chrome (latest version)

**Steps:**
- Run all tests above in Chrome

**Expected Result:**
- All features work correctly
- No browser-specific errors

**Status:** ☐ Pass ☐ Fail

---

### Test 9.2: Brave Compatibility
**Objective:** Verify full functionality in Brave

**Browser:** Brave (latest version)

**Steps:**
- Run all tests above in Brave

**Expected Result:**
- All features work correctly
- No browser-specific errors
- Brave's additional privacy features don't interfere

**Status:** ☐ Pass ☐ Fail

---

## Test Suite 10: Performance

### Test 10.1: Page Load Impact
**Objective:** Measure extension's impact on page load

**Steps:**
1. Open DevTools → Performance tab
2. Start recording
3. Navigate to https://dnschecker.org/smtp-test-tool.php
4. Stop recording after page loads
5. Review performance metrics

**Expected Result:**
- Page load time increase < 100ms
- No blocking operations during load
- Content script runs efficiently

**Status:** ☐ Pass ☐ Fail

---

### Test 10.2: Memory Usage
**Objective:** Check memory consumption

**Steps:**
1. Open Chrome Task Manager (Shift+Esc)
2. Find extension process
3. Note memory usage with:
   - No presets
   - 10 presets
   - 100 presets

**Expected Result:**
- Memory usage remains reasonable (<50MB)
- No memory leaks during extended use

**Status:** ☐ Pass ☐ Fail

---

## Critical Issues Log

Use this section to document any critical issues found during testing:

| Test # | Issue Description | Severity | Status |
|--------|------------------|----------|--------|
| | | | |
| | | | |
| | | | |

---

## Test Summary

**Total Tests:** 26  
**Passed:** _____  
**Failed:** _____  
**Pending:** 2  
**Pass Rate:** _____%

**Tested By:** _________________  
**Date:** _________________  
**Browser:** _________________  
**Extension Version:** 1.0.0

---

## Notes & Observations

Use this space for general observations, suggestions, or additional findings:

_______________________________________
_______________________________________
_______________________________________
_______________________________________
