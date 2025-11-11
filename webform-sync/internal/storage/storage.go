package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/tezza1971/webform-sync/internal/config"
	"github.com/tezza1971/webform-sync/internal/logger"
)

// Storage handles all database operations
type Storage struct {
	db     *sql.DB
	cfg    config.StorageConfig
	logger *logger.Logger
}

// Preset represents a saved form preset
type Preset struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	ScopeType       string                 `json:"scopeType,omitempty"`
	ScopeValue      string                 `json:"scopeValue,omitempty"`
	Fields          map[string]interface{} `json:"fields,omitempty"`          // For API input
	EncryptedFields string                 `json:"encryptedFields,omitempty"` // For storage
	Encrypted       bool                   `json:"encrypted,omitempty"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
	LastUsed        *time.Time             `json:"lastUsed,omitempty"`
	UseCount        int                    `json:"useCount"`
	DeviceID        string                 `json:"deviceId"` // camelCase for JavaScript/JSON standard
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// NewStorage creates a new storage instance
func NewStorage(cfg config.StorageConfig, log *logger.Logger) (*Storage, error) {
	// Ensure data directory exists
	if err := os.MkdirAll(cfg.DataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	// Open database
	dbPath := filepath.Join(cfg.DataDir, cfg.DBFile)
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	storage := &Storage{
		db:     db,
		cfg:    cfg,
		logger: log,
	}

	// Initialize schema
	if err := storage.initSchema(); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	log.Info("Storage initialized successfully: %s", dbPath)
	return storage, nil
}

// initSchema creates database tables if they don't exist
func (s *Storage) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS presets (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		scope_type TEXT NOT NULL,
		scope_value TEXT NOT NULL,
		encrypted_fields TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		last_used DATETIME,
		use_count INTEGER DEFAULT 0,
		device_id TEXT NOT NULL,
		metadata TEXT,
		UNIQUE(scope_type, scope_value, name, device_id)
	);

	CREATE INDEX IF NOT EXISTS idx_presets_scope ON presets(scope_type, scope_value);
	CREATE INDEX IF NOT EXISTS idx_presets_device ON presets(device_id);
	CREATE INDEX IF NOT EXISTS idx_presets_last_used ON presets(last_used);

	CREATE TABLE IF NOT EXISTS sync_log (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		preset_id TEXT NOT NULL,
		action TEXT NOT NULL,
		device_id TEXT NOT NULL,
		timestamp DATETIME NOT NULL,
		FOREIGN KEY(preset_id) REFERENCES presets(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_sync_log_preset ON sync_log(preset_id);
	CREATE INDEX IF NOT EXISTS idx_sync_log_timestamp ON sync_log(timestamp);
	`

	_, err := s.db.Exec(schema)
	return err
}

// SavePreset saves or updates a preset
func (s *Storage) SavePreset(preset *Preset) error {
	// Convert Fields map to EncryptedFields JSON string if present
	if preset.Fields != nil && preset.EncryptedFields == "" {
		fieldsJSON, err := json.Marshal(preset.Fields)
		if err != nil {
			return fmt.Errorf("failed to marshal fields: %w", err)
		}
		preset.EncryptedFields = string(fieldsJSON)
	}

	// Generate ID if not present
	if preset.ID == "" {
		preset.ID = fmt.Sprintf("preset_%d", time.Now().UnixNano())
	}

	// Serialize metadata
	var metadataJSON []byte
	if preset.Metadata != nil {
		var err error
		metadataJSON, err = json.Marshal(preset.Metadata)
		if err != nil {
			return fmt.Errorf("failed to marshal metadata: %w", err)
		}
	}

	query := `
	INSERT INTO presets (id, name, scope_type, scope_value, encrypted_fields, 
		created_at, updated_at, last_used, use_count, device_id, metadata)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		name = excluded.name,
		encrypted_fields = excluded.encrypted_fields,
		updated_at = excluded.updated_at,
		last_used = excluded.last_used,
		use_count = excluded.use_count,
		metadata = excluded.metadata
	`

	_, err := s.db.Exec(query,
		preset.ID,
		preset.Name,
		preset.ScopeType,
		preset.ScopeValue,
		preset.EncryptedFields,
		preset.CreatedAt,
		preset.UpdatedAt,
		preset.LastUsed,
		preset.UseCount,
		preset.DeviceID,
		metadataJSON,
	)

	if err != nil {
		return fmt.Errorf("failed to save preset: %w", err)
	}

	// Log sync action
	s.logSync(preset.ID, "save", preset.DeviceID)
	s.logger.Debug("Saved preset: %s (device: %s)", preset.ID, preset.DeviceID)

	return nil
}

// GetPresetsByScope retrieves all presets for a given scope
func (s *Storage) GetPresetsByScope(scopeType, scopeValue string, deviceID string) ([]*Preset, error) {
	query := `
	SELECT id, name, scope_type, scope_value, encrypted_fields,
		created_at, updated_at, last_used, use_count, device_id, metadata
	FROM presets
	WHERE scope_type = ? AND scope_value = ?
	ORDER BY updated_at DESC
	`

	rows, err := s.db.Query(query, scopeType, scopeValue)
	if err != nil {
		return nil, fmt.Errorf("failed to query presets: %w", err)
	}
	defer rows.Close()

	var presets []*Preset
	for rows.Next() {
		preset, err := s.scanPreset(rows)
		if err != nil {
			return nil, err
		}
		presets = append(presets, preset)
	}

	return presets, nil
}

// GetAllPresets retrieves all presets for a device
func (s *Storage) GetAllPresets(deviceID string) ([]*Preset, error) {
	query := `
	SELECT id, name, scope_type, scope_value, encrypted_fields,
		created_at, updated_at, last_used, use_count, device_id, metadata
	FROM presets
	WHERE device_id = ? OR device_id = ''
	ORDER BY updated_at DESC
	`

	rows, err := s.db.Query(query, deviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to query presets: %w", err)
	}
	defer rows.Close()

	var presets []*Preset
	for rows.Next() {
		preset, err := s.scanPreset(rows)
		if err != nil {
			return nil, err
		}
		presets = append(presets, preset)
	}

	return presets, nil
}

// DeletePreset deletes a preset by ID
func (s *Storage) DeletePreset(id, deviceID string) error {
	query := `DELETE FROM presets WHERE id = ? AND device_id = ?`
	result, err := s.db.Exec(query, id, deviceID)
	if err != nil {
		return fmt.Errorf("failed to delete preset: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("preset not found or access denied")
	}

	s.logSync(id, "delete", deviceID)
	s.logger.Debug("Deleted preset: %s (device: %s)", id, deviceID)

	return nil
}

// UpdatePresetUsage updates last_used timestamp and use_count
func (s *Storage) UpdatePresetUsage(id string) error {
	query := `
	UPDATE presets 
	SET last_used = ?, use_count = use_count + 1
	WHERE id = ?
	`

	_, err := s.db.Exec(query, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update preset usage: %w", err)
	}

	return nil
}

// CleanupOldPresets removes presets not accessed in specified days
func (s *Storage) CleanupOldPresets(days int) (int, error) {
	if days <= 0 {
		return 0, nil
	}

	cutoff := time.Now().AddDate(0, 0, -days)
	query := `DELETE FROM presets WHERE last_used < ? OR (last_used IS NULL AND created_at < ?)`

	result, err := s.db.Exec(query, cutoff, cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup old presets: %w", err)
	}

	rows, _ := result.RowsAffected()
	s.logger.Info("Cleaned up %d old presets", rows)

	return int(rows), nil
}

// GetSyncLog retrieves sync history for a preset
func (s *Storage) GetSyncLog(presetID string, limit int) ([]map[string]interface{}, error) {
	query := `
	SELECT action, device_id, timestamp
	FROM sync_log
	WHERE preset_id = ?
	ORDER BY timestamp DESC
	LIMIT ?
	`

	rows, err := s.db.Query(query, presetID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query sync log: %w", err)
	}
	defer rows.Close()

	var logs []map[string]interface{}
	for rows.Next() {
		var action, deviceID string
		var timestamp time.Time
		if err := rows.Scan(&action, &deviceID, &timestamp); err != nil {
			return nil, err
		}

		logs = append(logs, map[string]interface{}{
			"action":    action,
			"device_id": deviceID,
			"timestamp": timestamp,
		})
	}

	return logs, nil
}

// logSync records a sync action
func (s *Storage) logSync(presetID, action, deviceID string) {
	query := `INSERT INTO sync_log (preset_id, action, device_id, timestamp) VALUES (?, ?, ?, ?)`
	_, err := s.db.Exec(query, presetID, action, deviceID, time.Now())
	if err != nil {
		s.logger.Warn("Failed to log sync action: %v", err)
	}
}

// scanPreset scans a database row into a Preset struct
func (s *Storage) scanPreset(row interface{ Scan(...interface{}) error }) (*Preset, error) {
	var preset Preset
	var metadataJSON []byte
	var lastUsed sql.NullTime

	err := row.Scan(
		&preset.ID,
		&preset.Name,
		&preset.ScopeType,
		&preset.ScopeValue,
		&preset.EncryptedFields,
		&preset.CreatedAt,
		&preset.UpdatedAt,
		&lastUsed,
		&preset.UseCount,
		&preset.DeviceID,
		&metadataJSON,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to scan preset: %w", err)
	}

	if lastUsed.Valid {
		preset.LastUsed = &lastUsed.Time
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &preset.Metadata); err != nil {
			s.logger.Warn("Failed to unmarshal preset metadata: %v", err)
		}
	}

	// Convert EncryptedFields JSON string back to Fields map for API response
	if preset.EncryptedFields != "" {
		if err := json.Unmarshal([]byte(preset.EncryptedFields), &preset.Fields); err != nil {
			s.logger.Warn("Failed to unmarshal encrypted fields: %v", err)
		}
	}

	return &preset, nil
}

// GetDevices returns a list of all unique device IDs
func (s *Storage) GetDevices() ([]string, error) {
	rows, err := s.db.Query(`
		SELECT DISTINCT device_id 
		FROM presets 
		WHERE device_id != ''
		ORDER BY device_id
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query devices: %w", err)
	}
	defer rows.Close()

	var devices []string
	for rows.Next() {
		var deviceID string
		if err := rows.Scan(&deviceID); err != nil {
			return nil, fmt.Errorf("failed to scan device: %w", err)
		}
		devices = append(devices, deviceID)
	}

	return devices, rows.Err()
}

// Close closes the database connection
func (s *Storage) Close() error {
	s.logger.Info("Closing storage")
	return s.db.Close()
}
