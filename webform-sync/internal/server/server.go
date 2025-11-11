package server

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"github.com/tezza1971/webform-sync/internal/config"
	"github.com/tezza1971/webform-sync/internal/logger"
	"github.com/tezza1971/webform-sync/internal/storage"
)

// Server represents the HTTP server
type Server struct {
	config     *config.Config
	storage    *storage.Storage
	logger     *logger.Logger
	httpServer *http.Server
	router     *mux.Router
	urlFilters *URLFilters
	ipFilters  *IPFilters
}

// URLFilters handles URL whitelist/blacklist
type URLFilters struct {
	whitelist          []*regexp.Regexp
	blacklist          []*regexp.Regexp
	enabled            bool
	whitelistOverrides bool
}

// IPFilters handles IP access control
type IPFilters struct {
	whitelist []*net.IPNet
	blacklist []*net.IPNet
	mode      string
}

// NewServer creates a new server instance
func NewServer(cfg *config.Config, store *storage.Storage, log *logger.Logger) (*Server, error) {
	// Initialize URL filters
	urlFilters, err := loadURLFilters(cfg.URLFilter, log)
	if err != nil {
		return nil, fmt.Errorf("failed to load URL filters: %w", err)
	}

	// Initialize IP filters
	ipFilters, err := loadIPFilters(cfg.AccessControl, log)
	if err != nil {
		return nil, fmt.Errorf("failed to load IP filters: %w", err)
	}

	srv := &Server{
		config:     cfg,
		storage:    store,
		logger:     log,
		urlFilters: urlFilters,
		ipFilters:  ipFilters,
	}

	// Setup router
	srv.setupRouter()

	return srv, nil
}

// setupRouter configures all HTTP routes
func (s *Server) setupRouter() {
	r := mux.NewRouter()

	// Middleware
	r.Use(s.loggingMiddleware)
	r.Use(s.ipFilterMiddleware)
	if s.config.Authentication.Enabled {
		r.Use(s.authMiddleware)
	}

	// API routes
	api := r.PathPrefix("/api/v1").Subrouter()

	// Health check
	api.HandleFunc("/health", s.handleHealth).Methods("GET")

	// Presets endpoints
	api.HandleFunc("/presets", s.handleGetPresets).Methods("GET")
	api.HandleFunc("/presets", s.handleSavePreset).Methods("POST")
	api.HandleFunc("/presets/{id}", s.handleGetPreset).Methods("GET")
	api.HandleFunc("/presets/{id}", s.handleUpdatePreset).Methods("PUT")
	api.HandleFunc("/presets/{id}", s.handleDeletePreset).Methods("DELETE")
	api.HandleFunc("/presets/{id}/usage", s.handleUpdateUsage).Methods("POST")

	// Scope-based retrieval
	api.HandleFunc("/presets/scope/{type}/{value}", s.handleGetPresetsByScope).Methods("GET")

	// Device management
	api.HandleFunc("/devices", s.handleGetDevices).Methods("GET")

	// Sync endpoints
	api.HandleFunc("/sync/log", s.handleGetSyncLogAll).Methods("GET")
	api.HandleFunc("/sync/log/{id}", s.handleGetSyncLog).Methods("GET")
	api.HandleFunc("/sync/status", s.handleSyncStatus).Methods("GET")
	api.HandleFunc("/sync/cleanup", s.handleCleanup).Methods("POST")

	// Setup CORS
	var handler http.Handler = r
	if s.config.CORS.Enabled {
		c := cors.New(cors.Options{
			AllowedOrigins:   s.config.CORS.AllowedOrigins,
			AllowedMethods:   s.config.CORS.AllowedMethods,
			AllowedHeaders:   s.config.CORS.AllowedHeaders,
			AllowCredentials: true,
			MaxAge:           s.config.CORS.MaxAge,
		})
		handler = c.Handler(r)
	}

	s.router = r
	s.httpServer = &http.Server{
		Handler:      handler,
		ReadTimeout:  time.Duration(s.config.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(s.config.Server.WriteTimeout) * time.Second,
	}
}

// Start starts the HTTP server
func (s *Server) Start() error {
	port := s.config.Server.Port
	addr := fmt.Sprintf("%s:%d", s.config.Server.Host, port)

	// Check if port is available
	if !isPortAvailable(s.config.Server.Host, port) {
		s.logger.Warn("Port %d is in use", port)

		// Try fallback ports
		if len(s.config.Server.FallbackPorts) > 0 {
			for _, fallbackPort := range s.config.Server.FallbackPorts {
				if isPortAvailable(s.config.Server.Host, fallbackPort) {
					s.logger.Info("Using fallback port %d", fallbackPort)
					port = fallbackPort
					addr = fmt.Sprintf("%s:%d", s.config.Server.Host, port)
					break
				}
			}
		}

		// If still no available port
		if !isPortAvailable(s.config.Server.Host, port) {
			return fmt.Errorf("no available ports found")
		}
	}

	s.httpServer.Addr = addr
	s.logger.Info("Starting server on %s", addr)
	s.logger.Info("Access control mode: %s", s.config.AccessControl.Mode)

	go func() {
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.logger.Error("Server error: %v", err)
		}
	}()

	return nil
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}

// isPortAvailable checks if a port is available
func isPortAvailable(host string, port int) bool {
	addr := fmt.Sprintf("%s:%d", host, port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return false
	}
	listener.Close()
	return true
}

// loadURLFilters loads and compiles URL filter patterns
func loadURLFilters(cfg config.URLFilterConfig, log *logger.Logger) (*URLFilters, error) {
	if !cfg.Enabled {
		return &URLFilters{enabled: false}, nil
	}

	filters := &URLFilters{
		enabled:            true,
		whitelistOverrides: cfg.WhitelistOverrides,
	}

	// Load whitelist
	if cfg.WhitelistFile != "" {
		patterns, err := loadFilterFile(cfg.WhitelistFile, cfg.UseRegex)
		if err != nil {
			log.Warn("Failed to load whitelist file: %v", err)
		} else {
			filters.whitelist = patterns
			log.Info("Loaded %d whitelist patterns", len(patterns))
		}
	}

	// Load blacklist
	if cfg.BlacklistFile != "" {
		patterns, err := loadFilterFile(cfg.BlacklistFile, cfg.UseRegex)
		if err != nil {
			log.Warn("Failed to load blacklist file: %v", err)
		} else {
			filters.blacklist = patterns
			log.Info("Loaded %d blacklist patterns", len(patterns))
		}
	}

	return filters, nil
}

// loadIPFilters parses IP ranges for access control
func loadIPFilters(cfg config.AccessControlConfig, log *logger.Logger) (*IPFilters, error) {
	filters := &IPFilters{
		mode: cfg.Mode,
	}

	// Parse whitelist IPs/ranges
	for _, ipStr := range cfg.Whitelist {
		_, ipNet, err := net.ParseCIDR(ipStr)
		if err != nil {
			// Try as single IP
			ip := net.ParseIP(ipStr)
			if ip == nil {
				log.Warn("Invalid IP/CIDR in whitelist: %s", ipStr)
				continue
			}
			// Convert single IP to /32 or /128 network
			if ip.To4() != nil {
				_, ipNet, _ = net.ParseCIDR(ipStr + "/32")
			} else {
				_, ipNet, _ = net.ParseCIDR(ipStr + "/128")
			}
		}
		filters.whitelist = append(filters.whitelist, ipNet)
	}

	// Parse blacklist IPs/ranges
	for _, ipStr := range cfg.Blacklist {
		_, ipNet, err := net.ParseCIDR(ipStr)
		if err != nil {
			ip := net.ParseIP(ipStr)
			if ip == nil {
				log.Warn("Invalid IP/CIDR in blacklist: %s", ipStr)
				continue
			}
			if ip.To4() != nil {
				_, ipNet, _ = net.ParseCIDR(ipStr + "/32")
			} else {
				_, ipNet, _ = net.ParseCIDR(ipStr + "/128")
			}
		}
		filters.blacklist = append(filters.blacklist, ipNet)
	}

	log.Info("IP filters loaded: %d whitelist, %d blacklist", len(filters.whitelist), len(filters.blacklist))
	return filters, nil
}

// loadFilterFile loads filter patterns from a file
func loadFilterFile(path string, useRegex bool) ([]*regexp.Regexp, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	lines := strings.Split(string(content), "\n")
	var patterns []*regexp.Regexp

	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		var pattern *regexp.Regexp
		if useRegex {
			pattern, err = regexp.Compile(line)
			if err != nil {
				return nil, fmt.Errorf("invalid regex pattern '%s': %w", line, err)
			}
		} else {
			// Convert glob to regex
			escaped := regexp.QuoteMeta(line)
			escaped = strings.ReplaceAll(escaped, "\\*", ".*")
			pattern, err = regexp.Compile("^" + escaped + "$")
			if err != nil {
				return nil, fmt.Errorf("invalid pattern '%s': %w", line, err)
			}
		}

		patterns = append(patterns, pattern)
	}

	return patterns, nil
}

// Helper functions for filters
func (f *URLFilters) isAllowed(url string) bool {
	if !f.enabled {
		return true
	}

	// Check whitelist first if it overrides
	if f.whitelistOverrides && len(f.whitelist) > 0 {
		for _, pattern := range f.whitelist {
			if pattern.MatchString(url) {
				return true
			}
		}
		// If whitelist exists and nothing matched, deny
		return false
	}

	// Check blacklist
	for _, pattern := range f.blacklist {
		if pattern.MatchString(url) {
			// Check if whitelist overrides this blacklist match
			if f.whitelistOverrides {
				for _, wlPattern := range f.whitelist {
					if wlPattern.MatchString(url) {
						return true
					}
				}
			}
			return false
		}
	}

	// If no whitelist, default allow
	if len(f.whitelist) == 0 {
		return true
	}

	// Check whitelist
	for _, pattern := range f.whitelist {
		if pattern.MatchString(url) {
			return true
		}
	}

	return false
}

func (f *IPFilters) isAllowed(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}

	switch f.mode {
	case "whitelist":
		for _, ipNet := range f.whitelist {
			if ipNet.Contains(ip) {
				return true
			}
		}
		return false

	case "blacklist":
		for _, ipNet := range f.blacklist {
			if ipNet.Contains(ip) {
				return false
			}
		}
		return true

	case "allow_all":
		return true

	default:
		return false
	}
}
