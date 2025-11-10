# Webform Presets - Chromium Extension

A browser extension to save and fill webform data securely with encrypted presets. Never stores passwords.

## Directory Structure

```text
chromium/
├── manifest.json           # Extension manifest (Manifest V3)
├── background.js          # Service worker (handles encryption, storage, context menus)
├── content.js             # Content script (captures/fills forms)
├── popup.html             # Extension popup UI
├── options.html           # Management console
├── unlock.html            # Master password unlock page
├── icons/                 # Extension icons (16x16, 32x32, 48x48, 128x128)
│   └── icon*.png         # TODO: Add actual icon files
├── scripts/
│   ├── popup.js          # Popup logic
│   ├── options.js        # Management console logic
│   ├── unlock.js         # Unlock page logic
│   └── utils.js          # Shared utility functions
└── styles/
    ├── popup.css         # Popup styles
    ├── options.css       # Management console styles
    └── unlock.css        # Unlock page styles
```

## Installation for Testing

### Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chromium` folder
5. The extension should now appear in your extensions list

### Brave

1. Open Brave and navigate to `brave://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chromium` folder
5. The extension should now appear in your extensions list

## Quick Start Testing

1. Load the extension in Chrome/Brave (see Installation above)
2. Open `test-form.html` from the project root in your browser
3. Click the extension icon and set a master password
4. Fill out some fields in the test form
5. Right-click → "Webform Presets" → "Save as Preset..."
6. Name your preset and click Save
7. Clear the form and right-click again
8. Select "Webform Presets" → "Fill with..." → [your preset name]
9. Form fields should auto-fill (except password field)

## Features

- **Secure Storage**: All data stored locally with AES-GCM 256-bit encryption
- **Password Exclusion**: Never captures or stores password fields
- **Master Password**: In-memory encryption key derived with PBKDF2 (100,000 iterations)
- **Context Menu Integration**: Right-click to save or fill forms
- **Smart Filling**: Overwrite mode fills all fields, Update mode skips modified fields
- **Management Console**: View, edit, delete, search, and backup presets
- **Scope Support**: Save presets for entire domains or specific URLs
- **Dynamic Menus**: Available presets shown in context menu automatically

## Usage

### First Time Setup

1. Click the extension icon or use a context menu item
2. You'll be prompted to set a master password on the unlock page
3. Enter a strong password (recommended: use a password manager)
4. Extension is now unlocked for this browser session

### Saving a Form

1. Fill out a form on any website
2. Right-click anywhere on the page
3. Select "Webform Presets" → "Save as Preset..."
4. A modal will appear with:
   - Preset name field
   - Scope selection (Domain or Exact URL)
   - List of detected fields with checkboxes
5. Choose which fields to include (passwords are automatically excluded)
6. Click "Save Preset"
7. Success toast notification will appear

### Filling a Form

1. Navigate to a page with a saved preset
2. Right-click on the page
3. Select "Webform Presets" → "Fill with..." → [preset name]
4. Form fields will be automatically filled
5. Success toast shows number of fields filled

### Managing Presets

1. Click the extension icon → "Manage Presets"
2. Or right-click → "Webform Presets" → "Manage Presets"
3. View all saved presets organized by scope
4. Use search bar to filter presets
5. Export presets as encrypted JSON file
6. Import previously exported presets
7. Delete individual presets

## Security Notes

- **Encryption**: AES-GCM 256-bit encryption for all preset data
- **Key Derivation**: PBKDF2-SHA256 with 100,000 iterations
- **In-Memory Key**: Encryption key never written to disk
- **No Cloud Sync**: All data stays on your device only
- **Session Based**: Automatically locks when browser closes
- **Password Exclusion**: Password fields never captured or stored
- **XSS Protection**: All user data is HTML-escaped before rendering

## Known Limitations

- No multi-device sync (by design)
- Manual unlock required each browser session
- Context menu updates require page refresh after saving first preset
- Form detection may not work with heavily dynamic SPAs
- No automatic form filling on page load
- No encrypted master password verification (wrong password won't show error until decrypt fails)

## Development

### File Purposes

- **manifest.json**: Extension metadata, permissions, and component definitions
- **background.js**: Service worker handling encryption, storage, and context menu coordination
- **content.js**: Injected into pages to detect forms, capture data, and fill fields
- **scripts/utils.js**: Shared utilities for modals, toasts, and HTML escaping
- **popup.html/js**: Quick access UI when clicking extension icon
- **options.html/js**: Full-featured management interface with search/export/import
- **unlock.html/js**: Secure password entry and key derivation

### Debugging

- **Extension pages**: Right-click on popup/options/unlock → Inspect
- **Background script**: `chrome://extensions` → Details → Inspect service worker
- **Content script**: Open DevTools on the web page (F12)
- **Console logs**: All components output debug information
- **Storage inspection**: DevTools → Application → Storage → Local

### Architecture

```text
┌─────────────┐
│  Background │  ← Service Worker (persistent encryption key)
│   Worker    │  ← Handles encryption/decryption
└──────┬──────┘  ← Manages chrome.storage.local
       │         ← Updates context menus
       │
   ┌───┴───┬──────────┬────────────┐
   │       │          │            │
┌──▼───┐ ┌▼─────┐ ┌──▼──────┐ ┌───▼────┐
│Popup │ │Options│ │Content  │ │Unlock  │
│  UI  │ │  UI   │ │ Script  │ │  Page  │
└──────┘ └───────┘ └─────────┘ └────────┘
                       │
                   ┌───▼────┐
                   │ Web    │
                   │ Forms  │
                   └────────┘
```

## Completed Implementation

- [x] Complete extension boilerplate with Manifest V3
- [x] AES-GCM encryption with PBKDF2 key derivation
- [x] Master password unlock system
- [x] Form detection and data capture
- [x] Password field exclusion
- [x] Save preset modal with field selection
- [x] Fill preset functionality
- [x] Dynamic context menus showing available presets
- [x] Management console with search
- [x] Export/import encrypted presets
- [x] Toast notification system
- [x] Modal UI system with styling isolation
- [x] Lock/unlock flow
- [x] Session-based security (key cleared on browser close)

## Future Enhancements

- [ ] Add actual icon files (currently using placeholders)
- [ ] Keyboard shortcuts for quick access
- [ ] Fill mode selection (overwrite vs update)
- [ ] Preset templates and categories
- [ ] Field mapping/transformation (e.g., "First Name" → "fname")
- [ ] Auto-lock timer (configurable session timeout)
- [ ] Enhanced form detection for React/Vue/Angular apps
- [ ] Preset sharing via encrypted exports with password
- [ ] Statistics dashboard (most used presets, etc.)
- [ ] Dark mode support

## License

See LICENSE file in the root directory.
