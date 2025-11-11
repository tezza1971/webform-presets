package logger

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/tezza1971/webform-sync/internal/config"
	"gopkg.in/natefinch/lumberjack.v2"
)

// LogLevel represents logging levels
type LogLevel int

const (
	LevelDebug LogLevel = iota
	LevelInfo
	LevelWarn
	LevelError
)

// Logger handles application logging
type Logger struct {
	debug *log.Logger
	info  *log.Logger
	warn  *log.Logger
	err   *log.Logger
	level LogLevel
}

// NewLogger creates a new logger instance
func NewLogger(cfg config.LoggingConfig) *Logger {
	level := parseLogLevel(cfg.Level)

	var writer io.Writer

	// Determine output destination
	switch strings.ToLower(cfg.Output) {
	case "console":
		writer = os.Stdout
	case "file":
		writer = createFileWriter(cfg)
	case "both":
		writer = io.MultiWriter(os.Stdout, createFileWriter(cfg))
	default:
		writer = os.Stdout
	}

	return &Logger{
		debug: log.New(writer, "[DEBUG] ", log.Ldate|log.Ltime|log.Lshortfile),
		info:  log.New(writer, "[INFO]  ", log.Ldate|log.Ltime),
		warn:  log.New(writer, "[WARN]  ", log.Ldate|log.Ltime),
		err:   log.New(writer, "[ERROR] ", log.Ldate|log.Ltime|log.Lshortfile),
		level: level,
	}
}

// createFileWriter creates a rotating file writer
func createFileWriter(cfg config.LoggingConfig) io.Writer {
	// Ensure log directory exists
	logDir := filepath.Dir(cfg.LogFile)
	if err := os.MkdirAll(logDir, 0755); err != nil {
		log.Printf("Failed to create log directory: %v", err)
		return os.Stdout
	}

	return &lumberjack.Logger{
		Filename:   cfg.LogFile,
		MaxSize:    cfg.MaxSizeMB,
		MaxBackups: cfg.MaxBackups,
		MaxAge:     cfg.MaxAgeDays,
		Compress:   true,
	}
}

// parseLogLevel converts string to LogLevel
func parseLogLevel(level string) LogLevel {
	switch strings.ToLower(level) {
	case "debug":
		return LevelDebug
	case "info":
		return LevelInfo
	case "warn", "warning":
		return LevelWarn
	case "error":
		return LevelError
	default:
		return LevelInfo
	}
}

// Debug logs debug messages
func (l *Logger) Debug(format string, v ...interface{}) {
	if l.level <= LevelDebug {
		l.debug.Printf(format, v...)
	}
}

// Info logs informational messages
func (l *Logger) Info(format string, v ...interface{}) {
	if l.level <= LevelInfo {
		l.info.Printf(format, v...)
	}
}

// Warn logs warning messages
func (l *Logger) Warn(format string, v ...interface{}) {
	if l.level <= LevelWarn {
		l.warn.Printf(format, v...)
	}
}

// Error logs error messages
func (l *Logger) Error(format string, v ...interface{}) {
	if l.level <= LevelError {
		l.err.Printf(format, v...)
	}
}

// Fatal logs error message and exits
func (l *Logger) Fatal(format string, v ...interface{}) {
	l.err.Printf(format, v...)
	os.Exit(1)
}

// LogRequest logs HTTP request details
func (l *Logger) LogRequest(method, path, remoteAddr string, statusCode int, duration float64) {
	l.Info("%s %s [%s] %d %.2fms", method, path, remoteAddr, statusCode, duration)
}
