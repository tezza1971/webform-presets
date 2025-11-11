package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/tezza1971/webform-sync/internal/storage"
)

// Response helpers
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}

func (s *Server) respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (s *Server) respondError(w http.ResponseWriter, status int, message string) {
	s.respondJSON(w, status, APIResponse{
		Success: false,
		Error:   message,
	})
}

func (s *Server) respondSuccess(w http.ResponseWriter, data interface{}, message string) {
	s.respondJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    data,
		Message: message,
	})
}

// Health check endpoint
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.respondSuccess(w, map[string]interface{}{
		"status":  "ok",
		"version": "1.0.0",
		"uptime":  time.Since(time.Now()).String(),
	}, "Service is healthy")
}

// Get all presets for a device
func (s *Server) handleGetPresets(w http.ResponseWriter, r *http.Request) {
	deviceID := r.URL.Query().Get("device_id")
	if deviceID == "" {
		s.respondError(w, http.StatusBadRequest, "device_id parameter required")
		return
	}

	presets, err := s.storage.GetAllPresets(deviceID)
	if err != nil {
		s.logger.Error("Failed to get presets: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to retrieve presets")
		return
	}

	s.respondSuccess(w, presets, fmt.Sprintf("Retrieved %d presets", len(presets)))
}

// Get presets by scope
func (s *Server) handleGetPresetsByScope(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	scopeType := vars["type"]
	scopeValue := vars["value"]
	deviceID := r.URL.Query().Get("device_id")

	if scopeType == "" || scopeValue == "" {
		s.respondError(w, http.StatusBadRequest, "scope type and value required")
		return
	}

	// Check URL filter
	if !s.urlFilters.isAllowed(scopeValue) {
		s.logger.Warn("URL blocked by filter: %s", scopeValue)
		s.respondError(w, http.StatusForbidden, "URL not allowed")
		return
	}

	presets, err := s.storage.GetPresetsByScope(scopeType, scopeValue, deviceID)
	if err != nil {
		s.logger.Error("Failed to get presets by scope: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to retrieve presets")
		return
	}

	s.respondSuccess(w, presets, fmt.Sprintf("Retrieved %d presets", len(presets)))
}

// Get single preset
func (s *Server) handleGetPreset(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	deviceID := r.URL.Query().Get("device_id")

	presets, err := s.storage.GetAllPresets(deviceID)
	if err != nil {
		s.logger.Error("Failed to get preset: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to retrieve preset")
		return
	}

	for _, preset := range presets {
		if preset.ID == id {
			s.respondSuccess(w, preset, "Preset found")
			return
		}
	}

	s.respondError(w, http.StatusNotFound, "Preset not found")
}

// Save new preset
func (s *Server) handleSavePreset(w http.ResponseWriter, r *http.Request) {
	var preset storage.Preset
	if err := json.NewDecoder(r.Body).Decode(&preset); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate required fields
	if preset.DeviceID == "" {
		s.respondError(w, http.StatusBadRequest, "device_id is required")
		return
	}
	if preset.Name == "" {
		s.respondError(w, http.StatusBadRequest, "name is required")
		return
	}

	// Check URL filter only if scopeValue is provided
	if preset.ScopeValue != "" && !s.urlFilters.isAllowed(preset.ScopeValue) {
		s.logger.Warn("URL blocked by filter: %s", preset.ScopeValue)
		s.respondError(w, http.StatusForbidden, "URL not allowed")
		return
	}

	// Set timestamps if not provided
	if preset.CreatedAt.IsZero() {
		preset.CreatedAt = time.Now()
	}
	preset.UpdatedAt = time.Now()

	if err := s.storage.SavePreset(&preset); err != nil {
		s.logger.Error("Failed to save preset: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to save preset")
		return
	}

	s.logger.Info("Preset saved: %s (device: %s)", preset.ID, preset.DeviceID)

	// Return with 201 status for creation
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    map[string]interface{}{"preset": preset},
		Message: "Preset saved successfully",
	})
}

// Update existing preset
func (s *Server) handleUpdatePreset(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var preset storage.Preset
	if err := json.NewDecoder(r.Body).Decode(&preset); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	preset.ID = id
	preset.UpdatedAt = time.Now()

	// Check URL filter
	if !s.urlFilters.isAllowed(preset.ScopeValue) {
		s.logger.Warn("URL blocked by filter: %s", preset.ScopeValue)
		s.respondError(w, http.StatusForbidden, "URL not allowed")
		return
	}

	if err := s.storage.SavePreset(&preset); err != nil {
		s.logger.Error("Failed to update preset: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to update preset")
		return
	}

	s.logger.Info("Preset updated: %s (device: %s)", preset.ID, preset.DeviceID)
	s.respondSuccess(w, preset, "Preset updated successfully")
}

// Delete preset
func (s *Server) handleDeletePreset(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	deviceID := r.URL.Query().Get("device_id")

	if deviceID == "" {
		s.respondError(w, http.StatusBadRequest, "device_id parameter required")
		return
	}

	if err := s.storage.DeletePreset(id, deviceID); err != nil {
		s.logger.Error("Failed to delete preset: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to delete preset")
		return
	}

	s.logger.Info("Preset deleted: %s (device: %s)", id, deviceID)
	s.respondSuccess(w, nil, "Preset deleted successfully")
}

// Update preset usage
func (s *Server) handleUpdateUsage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if err := s.storage.UpdatePresetUsage(id); err != nil {
		s.logger.Error("Failed to update preset usage: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to update usage")
		return
	}

	s.respondSuccess(w, nil, "Usage updated successfully")
}

// Get sync log for a preset
func (s *Server) handleGetSyncLog(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	limit := 100 // Default limit

	logs, err := s.storage.GetSyncLog(id, limit)
	if err != nil {
		s.logger.Error("Failed to get sync log: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to retrieve sync log")
		return
	}

	s.respondSuccess(w, logs, fmt.Sprintf("Retrieved %d log entries", len(logs)))
}

// Get sync status
func (s *Server) handleSyncStatus(w http.ResponseWriter, r *http.Request) {
	deviceID := r.URL.Query().Get("device_id")
	if deviceID == "" {
		s.respondError(w, http.StatusBadRequest, "device_id parameter required")
		return
	}

	presets, err := s.storage.GetAllPresets(deviceID)
	if err != nil {
		s.logger.Error("Failed to get sync status: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to retrieve sync status")
		return
	}

	status := map[string]interface{}{
		"device_id":    deviceID,
		"preset_count": len(presets),
		"last_sync":    time.Now(),
		"status":       "synced",
	}

	s.respondSuccess(w, status, "Sync status retrieved")
}

// Middleware: Logging
func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.config.Logging.LogRequests {
			next.ServeHTTP(w, r)
			return
		}

		start := time.Now()

		// Create response writer wrapper to capture status code
		wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(wrapped, r)

		duration := time.Since(start).Milliseconds()
		s.logger.LogRequest(r.Method, r.URL.Path, r.RemoteAddr, wrapped.statusCode, float64(duration))
	})
}

// Get list of devices
func (s *Server) handleGetDevices(w http.ResponseWriter, r *http.Request) {
	devices, err := s.storage.GetDevices()
	if err != nil {
		s.logger.Error("Failed to get devices: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to retrieve devices")
		return
	}

	s.respondSuccess(w, devices, fmt.Sprintf("Retrieved %d devices", len(devices)))
}

// Get sync log (all entries)
func (s *Server) handleGetSyncLogAll(w http.ResponseWriter, r *http.Request) {
	// Parse limit from query
	limit := 50
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		fmt.Sscanf(limitStr, "%d", &limit)
	}

	// For now, return empty log
	// TODO: Implement sync log storage
	s.respondSuccess(w, []map[string]interface{}{}, "Sync log retrieved")
}

// Manual cleanup endpoint
func (s *Server) handleCleanup(w http.ResponseWriter, r *http.Request) {
	// Default to cleaning up presets older than 90 days
	days := 90
	if daysStr := r.URL.Query().Get("days"); daysStr != "" {
		fmt.Sscanf(daysStr, "%d", &days)
	}

	count, err := s.storage.CleanupOldPresets(days)
	if err != nil {
		s.logger.Error("Cleanup failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Cleanup failed")
		return
	}

	s.logger.Info("Manual cleanup completed: %d presets removed", count)
	s.respondSuccess(w, map[string]interface{}{
		"status":        "completed",
		"removed_count": count,
		"days":          days,
	}, fmt.Sprintf("Cleanup completed: %d presets removed", count))
}

// Middleware: IP filtering
func (s *Server) ipFilterMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract IP from RemoteAddr
		ip := strings.Split(r.RemoteAddr, ":")[0]

		if !s.ipFilters.isAllowed(ip) {
			s.logger.Warn("IP blocked: %s", ip)
			s.respondError(w, http.StatusForbidden, "Access denied")
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Middleware: Authentication
func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip auth for health check
		if r.URL.Path == "/api/v1/health" {
			next.ServeHTTP(w, r)
			return
		}

		authType := s.config.Authentication.Type

		switch authType {
		case "token":
			token := r.Header.Get("Authorization")
			if token == "" {
				token = r.URL.Query().Get("token")
			}

			expectedToken := "Bearer " + s.config.Authentication.APIToken
			if token != expectedToken && token != s.config.Authentication.APIToken {
				s.respondError(w, http.StatusUnauthorized, "Invalid or missing token")
				return
			}

		case "basic":
			username, password, ok := r.BasicAuth()
			if !ok {
				w.Header().Set("WWW-Authenticate", `Basic realm="Webform Sync"`)
				s.respondError(w, http.StatusUnauthorized, "Authentication required")
				return
			}

			if username != s.config.Authentication.Username || password != s.config.Authentication.Password {
				s.respondError(w, http.StatusUnauthorized, "Invalid credentials")
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}
