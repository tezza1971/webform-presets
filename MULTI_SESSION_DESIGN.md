# Multi-Session Support Design

## Overview
Allow users to create multiple password-protected sessions, each with isolated presets. This enables use cases like:
- Separate work and personal presets
- Different password-protected profiles for different security contexts
- Testing environments vs production data

## Architecture Changes

### Storage Schema

#### Current Structure
```
chrome.storage.local:
  - verificationToken: string (password verification)
  - encryptionSalt: string (for key derivation)
  - syncHost: string
  - syncPort: string
  - preset_<domain>: PresetData[]
```

#### New Structure
```
chrome.storage.local:
  - sessions: {
      [sessionId]: {
        name: string,
        verificationToken: string,
        encryptionSalt: string,
        createdAt: number,
        lastUsedAt: number,
        isDefault: boolean
      }
    }
  - activeSessionId: string
  - syncHost: string (global)
  - syncPort: string (global)
  - session_<sessionId>_preset_<domain>: PresetData[]
```

### Key Components to Modify

#### 1. Session Manager (NEW)
**File**: `chromium/scripts/session-manager.js`
- Create new session
- Switch between sessions
- Delete session
- List all sessions
- Export/import session data

#### 2. Session UI (NEW)
**File**: `chromium/session.html`
- Session switcher interface
- Create new session dialog
- Session management (rename, delete)
- Visual indicator of active session

#### 3. Storage Adapter (MODIFY)
**File**: `chromium/background.js`
- Update all storage operations to use session-scoped keys
- Migrate existing data to default session on first run
- Session switching logic

#### 4. Unlock Page (MODIFY)
**File**: `chromium/scripts/unlock.js`
- Session selector on unlock page
- "Create new session" option when password doesn't match
- Session-aware password verification

#### 5. Options Page (MODIFY)
**File**: `chromium/scripts/options.js`
- Session switcher in header
- Session management button
- Show active session name

#### 6. Popup (MODIFY)
**File**: `chromium/scripts/popup.js`
- Show active session name
- Quick session switcher

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create session data model
2. Implement session manager module
3. Add migration logic for existing data
4. Update storage operations to be session-aware

### Phase 2: UI Components
1. Create session management UI (session.html)
2. Add session switcher to options page
3. Add session indicator to popup
4. Update unlock page for session selection

### Phase 3: Advanced Features
1. Session export/import
2. Session deletion with confirmation
3. Session renaming
4. Last used session auto-selection

### Phase 4: Polish
1. Session icons/colors for visual distinction
2. Keyboard shortcuts for session switching
3. Session statistics (preset count, last used)
4. Session search/filter

## Data Migration

### On First Launch with Multi-Session
```javascript
async function migrateToMultiSession() {
  const result = await chrome.storage.local.get(null);
  
  // Check if already migrated
  if (result.sessions) {
    return;
  }
  
  // Create default session from existing data
  const defaultSessionId = 'default';
  const sessions = {
    [defaultSessionId]: {
      name: 'Default',
      verificationToken: result.verificationToken || null,
      encryptionSalt: result.encryptionSalt || null,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      isDefault: true
    }
  };
  
  // Migrate existing presets to default session
  const migratedData = { sessions, activeSessionId: defaultSessionId };
  
  for (const [key, value] of Object.entries(result)) {
    if (key.startsWith('preset_')) {
      // Move to session-scoped key
      const newKey = `session_${defaultSessionId}_${key}`;
      migratedData[newKey] = value;
      // Will remove old key after migration
    } else if (!['verificationToken', 'encryptionSalt'].includes(key)) {
      // Keep global settings
      migratedData[key] = value;
    }
  }
  
  // Save migrated data
  await chrome.storage.local.set(migratedData);
  
  // Remove old preset keys
  const keysToRemove = Object.keys(result).filter(k => k.startsWith('preset_'));
  keysToRemove.push('verificationToken', 'encryptionSalt');
  await chrome.storage.local.remove(keysToRemove);
}
```

## Security Considerations

1. **Password Isolation**: Each session has its own password/encryption key
2. **No Cross-Session Access**: Presets in one session cannot be accessed by another
3. **Session Lock**: Switching sessions requires unlocking the new session
4. **Secure Session IDs**: Use crypto.randomUUID() for session IDs

## User Experience Flow

### Creating a New Session
1. User enters wrong password on unlock page
2. Extension shows: "Password doesn't match. Would you like to create a new session?"
3. User confirms and names the new session
4. New session created with the entered password
5. User is unlocked into the new empty session

### Switching Sessions
1. User clicks session indicator in options/popup
2. Session list shown with all available sessions
3. User selects different session
4. Extension locks current session
5. User prompted to unlock selected session
6. Once unlocked, UI shows presets from selected session

### Alternative: Wrong Password Creates New Session
Instead of showing error, offer:
```
"This password doesn't match the existing session.
Would you like to:
• Try again
• Create a new session with this password
• Reset existing session"
```

## Future Enhancements

1. **Session Templates**: Pre-configured session types (Work, Personal, Testing)
2. **Session Sharing**: Export/import specific sessions
3. **Session Sync**: Sync specific sessions to webform-sync service
4. **Session Backup**: Automatic backup of session data
5. **Session Groups**: Organize sessions into groups
6. **Session Search**: Search across all sessions (when unlocked)

## Implementation Notes

- Keep backward compatibility during migration
- Add feature flag to enable/disable multi-session
- Extensive testing of session isolation
- Consider memory impact of loading multiple sessions
- Document session limits (recommended max 5-10 sessions)

## Testing Scenarios

1. Fresh install - creates default session
2. Existing user - migrates data to default session
3. Create second session with different password
4. Switch between sessions
5. Delete non-default session
6. Export/import session data
7. Multiple windows with different sessions
8. Session data isolation verification
