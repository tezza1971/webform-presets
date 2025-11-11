package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Config represents the complete configuration
type Config struct {
	Server         ServerConfig         `yaml:"server"`
	AccessControl  AccessControlConfig  `yaml:"access_control"`
	URLFilter      URLFilterConfig      `yaml:"url_filter"`
	Storage        StorageConfig        `yaml:"storage"`
	Logging        LoggingConfig        `yaml:"logging"`
	CORS           CORSConfig           `yaml:"cors"`
	Authentication AuthenticationConfig `yaml:"authentication"`
	Performance    PerformanceConfig    `yaml:"performance"`
	Maintenance    MaintenanceConfig    `yaml:"maintenance"`
}

// ServerConfig contains server-specific settings
type ServerConfig struct {
	Port          int    `yaml:"port"`
	FallbackPorts []int  `yaml:"fallback_ports"`
	Host          string `yaml:"host"`
	ReadTimeout   int    `yaml:"read_timeout"`
	WriteTimeout  int    `yaml:"write_timeout"`
}

// AccessControlConfig contains IP access control settings
type AccessControlConfig struct {
	Mode      string   `yaml:"mode"`
	Whitelist []string `yaml:"whitelist"`
	Blacklist []string `yaml:"blacklist"`
}

// URLFilterConfig contains URL filtering settings
type URLFilterConfig struct {
	Enabled            bool   `yaml:"enabled"`
	WhitelistFile      string `yaml:"whitelist_file"`
	BlacklistFile      string `yaml:"blacklist_file"`
	UseRegex           bool   `yaml:"use_regex"`
	WhitelistOverrides bool   `yaml:"whitelist_overrides"`
}

// StorageConfig contains storage settings
type StorageConfig struct {
	DataDir       string       `yaml:"data_dir"`
	DBFile        string       `yaml:"db_file"`
	EncryptAtRest bool         `yaml:"encrypt_at_rest"`
	EncryptionKey string       `yaml:"encryption_key"`
	Backup        BackupConfig `yaml:"backup"`
}

// BackupConfig contains backup settings
type BackupConfig struct {
	Enabled       bool   `yaml:"enabled"`
	IntervalHours int    `yaml:"interval_hours"`
	MaxBackups    int    `yaml:"max_backups"`
	BackupDir     string `yaml:"backup_dir"`
}

// LoggingConfig contains logging settings
type LoggingConfig struct {
	Level       string `yaml:"level"`
	Output      string `yaml:"output"`
	LogFile     string `yaml:"log_file"`
	MaxSizeMB   int    `yaml:"max_size_mb"`
	MaxBackups  int    `yaml:"max_backups"`
	MaxAgeDays  int    `yaml:"max_age_days"`
	LogRequests bool   `yaml:"log_requests"`
}

// CORSConfig contains CORS settings
type CORSConfig struct {
	Enabled        bool     `yaml:"enabled"`
	AllowedOrigins []string `yaml:"allowed_origins"`
	AllowedMethods []string `yaml:"allowed_methods"`
	AllowedHeaders []string `yaml:"allowed_headers"`
	MaxAge         int      `yaml:"max_age"`
}

// AuthenticationConfig contains authentication settings
type AuthenticationConfig struct {
	Enabled  bool   `yaml:"enabled"`
	Type     string `yaml:"type"`
	APIToken string `yaml:"api_token"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
}

// PerformanceConfig contains performance settings
type PerformanceConfig struct {
	MaxConcurrentRequests int         `yaml:"max_concurrent_requests"`
	RateLimit             int         `yaml:"rate_limit"`
	EnableCompression     bool        `yaml:"enable_compression"`
	Cache                 CacheConfig `yaml:"cache"`
}

// CacheConfig contains caching settings
type CacheConfig struct {
	Enabled    bool `yaml:"enabled"`
	TTLSeconds int  `yaml:"ttl_seconds"`
	MaxEntries int  `yaml:"max_entries"`
}

// MaintenanceConfig contains maintenance settings
type MaintenanceConfig struct {
	AutoCleanup          bool `yaml:"auto_cleanup"`
	DeleteAfterDays      int  `yaml:"delete_after_days"`
	CleanupIntervalHours int  `yaml:"cleanup_interval_hours"`
}

// LoadConfig loads configuration from a YAML file
func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Set defaults
	if cfg.Server.Port == 0 {
		cfg.Server.Port = 8765
	}
	if cfg.Server.Host == "" {
		cfg.Server.Host = "127.0.0.1"
	}
	if cfg.Logging.Level == "" {
		cfg.Logging.Level = "info"
	}

	return &cfg, nil
}
