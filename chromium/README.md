# Webform Presets - Chromium Extension

A browser extension to save and fill webform data securely with encrypted presets. Never stores passwords.

## Directory Structure

```
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
│   └── unlock.js         # Unlock page logic
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

## Features (MVP)

- **Secure Storage**: All data stored locally with AES-GCM encryption
- **Password Exclusion**: Never captures or stores password fields
- **Master Password**: In-memory encryption key, never persisted
- **Context Menu**: Right-click to save or fill forms
- **Smart Filling**: Two modes:
  - Overwrite: Replace all form values
  - Update Only: Fill only unchanged fields
- **Management Console**: View, edit, delete, and backup presets
- **Scope Support**: Save presets for entire domains or specific URLs

## Usage

### First Time Setup

1. Click the extension icon or use a context menu item
2. You'll be prompted to set a master password on the unlock page
3. Your password manager should detect and save this password

### Saving a Form

1. Fill out a form on any website
2. Right-click anywhere on the page
3. Select "Webform Presets" → "Save as Preset..."
4. Choose a name and scope for your preset
5. Select which fields to include

### Filling a Form

1. Navigate to a page with a saved preset
2. Right-click on the page
3. Select "Webform Presets" → "Fill with..." → [preset name]
4. Choose "Overwrite" or "Update Only" mode

### Managing Presets

1. Click the extension icon → "Manage Presets"
2. Or right-click → "Webform Presets" → "Manage Presets"
3. View, search, edit, or delete presets
4. Export/import backup files

## Security Notes

- **Encryption**: AES-GCM 256-bit encryption for all preset data
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **No Sync**: Data stays on your device only
- **Session Based**: Locks when browser closes
- **Password Managers**: Designed to work seamlessly with password managers

## Known Limitations (MVP)

- No multi-device sync
- Manual unlock required each browser session
- Basic form detection (may not work with all frameworks)
- No automatic form filling on page load

## Development

### File Purposes

- **manifest.json**: Defines extension metadata, permissions, and components
- **background.js**: Service worker handling encryption, storage, and coordination
- **content.js**: Injected into web pages to capture and fill forms
- **popup.html/js**: Quick access UI when clicking extension icon
- **options.html/js**: Full-featured management interface
- **unlock.html/js**: Secure password entry page

### Debugging

- Open DevTools on any extension page (right-click → Inspect)
- For background script: chrome://extensions → Details → Inspect views: service worker
- For content script: Open DevTools on the web page itself
- Check Console for log messages

## TODO

- [ ] Add actual icon files (currently using placeholders)
- [ ] Implement complete save flow with UI modal
- [ ] Implement complete fill flow with preset selection
- [ ] Add form detection improvements for SPA frameworks
- [ ] Add proper toast notifications instead of alerts
- [ ] Add keyboard shortcuts
- [ ] Add preset import/export encryption verification
- [ ] Add session timeout configuration
- [ ] Comprehensive testing across multiple websites

## License

See LICENSE file in the root directory.
