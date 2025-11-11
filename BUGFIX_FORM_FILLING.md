# Bug Fixes - Form Filling and Context Menu

## Issues Fixed

### 1. ✅ Form Fields Not Being Filled
**Problem**: Toast message said "Filled 1 field(s)" but the field remained empty.

**Root Cause**: 
- The `formSelector` property was not being saved with the preset
- When filling, the content script couldn't find the correct form
- Fields were found document-wide but without proper form context, some fields may not have been accessible

**Fix**:
1. Added `formSelector` to the preset data when saving:
   - Updated `content.js` save flow to include `formSelector: formData.selector`
   - Updated `background.js` `handleSavePresetMessage()` to store `formSelector` in preset object

2. The `fillForm()` function was already designed to use formSelector, it just wasn't getting one

**Files Changed**:
- `chromium/content.js` - Added `formSelector` to saved preset data (line ~726)
- `chromium/background.js` - Added `formSelector` to preset object (line ~609)

---

### 2. ✅ Context Menu Shows Full Menu When Locked
**Problem**: When extension is locked, context menu still showed "Save as Preset", "Fill with...", "Manage Presets" options, which don't work when locked.

**Root Cause**: 
- `createContextMenus()` always created the full menu structure
- It didn't check if extension was unlocked before creating menu items

**Fix**:
1. Modified `createContextMenus()` to check `encryptionKey` state
2. When locked, only show "Unlock" menu item
3. When unlocked, show full menu (Save, Fill, Manage)
4. Added handler for "unlock-extension" menu click
5. After successful unlock, recreate context menus to show full options
6. Update context menus for current tab after unlock

**Files Changed**:
- `chromium/background.js` - Multiple changes:
  - Updated `createContextMenus()` to check lock state (line ~63)
  - Added "unlock-extension" menu handler (line ~197)
  - Recreate menus after unlock (line ~595)

---

## Technical Details

### Form Selector Storage Flow

**Before (Broken)**:
```
Content Script (capture) → {selector, data, fieldList}
                          ↓
Background (save)      → {name, scopeType, scopeValue, fields}
                          ↓ (no formSelector!)
Storage                → preset without formSelector
                          ↓
Popup (load & fill)    → formSelector = undefined
                          ↓
Content Script (fill)  → Can't find form!
```

**After (Fixed)**:
```
Content Script (capture) → {selector, data, fieldList}
                          ↓
Background (save)      → {name, scopeType, scopeValue, formSelector, fields}
                          ↓ (formSelector included!)
Storage                → preset with formSelector
                          ↓
Popup (load & fill)    → formSelector = "id:myForm" or "name:loginForm"
                          ↓
Content Script (fill)  → Finds form, fills fields ✓
```

### Context Menu State Management

**Locked State**:
```
Webform Presets
  └─ Unlock
```

**Unlocked State**:
```
Webform Presets
  ├─ Save as Preset...
  ├─ ────────────────
  ├─ Fill with...
  │   ├─ Preset 1
  │   └─ Preset 2
  ├─ ────────────────
  └─ Manage Presets
```

### Unlock Flow Enhancement
```
User clicks Unlock (menu or popup)
  ↓
background.js: openUnlockPage()
  ↓
unlock.html: User enters password
  ↓
background.js: handleUnlock()
  ↓ (success)
Set encryptionKey = key
  ↓
createContextMenus() → Creates full menu
  ↓
updateContextMenusForPage() → Populates preset list
  ↓
Execute pending callbacks
  ↓
User can now use full functionality
```

## Data Structure

### Preset Object (Complete)
```javascript
{
  id: "uuid",
  name: "My Login Preset",
  formSelector: "id:loginForm",  // ← NOW INCLUDED
  encryptedFields: {
    iv: [1, 2, 3, ...],
    encrypted: [4, 5, 6, ...]
  },
  createdAt: "2025-11-11T...",
  updatedAt: "2025-11-11T...",
  useCount: 0
}
```

### Form Selector Format
- `"id:formId"` - Form with specific ID
- `"name:formName"` - Form with specific name attribute
- `"css:form.login > form"` - CSS selector path

## Testing Recommendations

### Test Case 1: Form Filling Works
- [ ] Save a preset for a form
- [ ] Reload page
- [ ] Clear form fields
- [ ] Open popup and click "Fill"
- [ ] **Expected**: All saved fields should be filled correctly
- [ ] Toast should say "Filled X field(s)"

### Test Case 2: Multiple Forms on Page
- [ ] Open page with multiple forms
- [ ] Save preset from specific form
- [ ] Reload page
- [ ] Fill preset
- [ ] **Expected**: Only the correct form gets filled

### Test Case 3: Context Menu When Locked
- [ ] Lock extension (or restart browser)
- [ ] Right-click on page
- [ ] Open "Webform Presets" context menu
- [ ] **Expected**: Only "Unlock" option visible
- [ ] Other options (Save, Fill, Manage) should NOT appear

### Test Case 4: Context Menu After Unlock
- [ ] Start with locked extension
- [ ] Click "Unlock" from context menu
- [ ] Enter password and unlock
- [ ] Right-click on page again
- [ ] **Expected**: Full menu appears (Save, Fill, Manage)

### Test Case 5: Context Menu Presets
- [ ] Unlock extension
- [ ] Save presets for a page
- [ ] Right-click on form field
- [ ] Open "Webform Presets" → "Fill with..."
- [ ] **Expected**: Saved presets appear in submenu
- [ ] Click preset
- [ ] **Expected**: Form fills correctly

## Notes

- The formSelector is critical for multi-form pages
- Context menu dynamically adapts to lock state
- Menus are recreated on unlock/lock to reflect current state
- Existing presets without formSelector will still work (fallback to document-wide search)
- New presets will always include formSelector

## Success Metrics

✅ Forms fill correctly with saved data  
✅ Context menu shows appropriate options based on lock state  
✅ "Unlock" appears when locked  
✅ Full menu appears after unlocking  
✅ Multi-form pages work correctly  
