package logging

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	rotatelogs "github.com/lestrrat-go/file-rotatelogs"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Config configures the logger.
type Config struct {
	Directory     string
	Filename      string
	Level         string
	RotationTime  time.Duration
	MaxAge        time.Duration
	DisableStdout bool
}

var (
	mu      sync.RWMutex
	logger  *zap.Logger
	sugared *zap.SugaredLogger
)

// Init configures the global logger instance. Re-initialising replaces the existing logger.
func Init(cfg Config) (*zap.Logger, error) {
	mu.Lock()
	defer mu.Unlock()

	if cfg.Directory == "" {
		cfg.Directory = "logs"
	}
	if cfg.Filename == "" {
		cfg.Filename = "application"
	}
	if cfg.RotationTime <= 0 {
		cfg.RotationTime = 24 * time.Hour
	}
	if cfg.MaxAge <= 0 {
		cfg.MaxAge = 7 * 24 * time.Hour
	}

	if err := os.MkdirAll(cfg.Directory, 0o755); err != nil {
		return nil, fmt.Errorf("create log directory: %w", err)
	}

	level := zapcore.InfoLevel
	if cfg.Level != "" {
		var parsed zapcore.Level
		if err := parsed.Set(strings.ToLower(cfg.Level)); err != nil {
			return nil, fmt.Errorf("parse log level %q: %w", cfg.Level, err)
		}
		level = parsed
	}

	basePath := filepath.Join(cfg.Directory, cfg.Filename)
	writer, err := rotatelogs.New(
		basePath+"-%Y%m%d.log",
		rotatelogs.WithLinkName(basePath+".log"),
		rotatelogs.WithRotationTime(cfg.RotationTime),
		rotatelogs.WithMaxAge(cfg.MaxAge),
	)
	if err != nil {
		return nil, fmt.Errorf("configure log rotation: %w", err)
	}

	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.TimeKey = "timestamp"
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	encoderConfig.EncodeDuration = zapcore.MillisDurationEncoder

	fileCore := zapcore.NewCore(
		zapcore.NewJSONEncoder(encoderConfig),
		zapcore.AddSync(writer),
		level,
	)

	core := fileCore
	if !cfg.DisableStdout {
		consoleEncoder := zapcore.NewConsoleEncoder(encoderConfig)
		consoleCore := zapcore.NewCore(consoleEncoder, zapcore.AddSync(os.Stdout), level)
		core = zapcore.NewTee(fileCore, consoleCore)
	}

	if logger != nil {
		_ = logger.Sync()
	}

	logger = zap.New(core, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))
	sugared = logger.Sugar()

	return logger, nil
}

// L returns the global structured logger. It falls back to a no-op logger if Init has not been called.
func L() *zap.Logger {
	mu.RLock()
	defer mu.RUnlock()
	if logger == nil {
		return zap.NewNop()
	}
	return logger
}

// S returns the sugared logger for printf-style logging.
func S() *zap.SugaredLogger {
	mu.RLock()
	defer mu.RUnlock()
	if sugared == nil {
		return zap.NewNop().Sugar()
	}
	return sugared
}

// Sync flushes any buffered log entries.
func Sync() error {
	mu.RLock()
	defer mu.RUnlock()
	if logger == nil {
		return nil
	}
	return logger.Sync()
}

// With returns a logger pre-populated with the supplied fields.
func With(fields ...zapcore.Field) *zap.Logger {
	return L().With(fields...)
}

// Info logs at info level.
func Info(message interface{}, fields ...zapcore.Field) {
	msg, extra := normaliseMessage(message)
	L().Info(msg, append(fields, extra...)...)
}

// Warn logs at warn level.
func Warn(message interface{}, fields ...zapcore.Field) {
	msg, extra := normaliseMessage(message)
	L().Warn(msg, append(fields, extra...)...)
}

// Error logs at error level. If the first argument is an error it will be
// recorded and its error message used automatically.
func Error(message interface{}, fields ...zapcore.Field) {
	msg, extra := normaliseMessage(message)
	L().Error(msg, append(fields, extra...)...)
}

// Infof logs using fmt.Sprintf formatting.
func Infof(format string, args ...interface{}) {
	L().Info(fmt.Sprintf(format, args...))
}

// Errorf logs an error using fmt.Sprintf formatting.
func Errorf(format string, args ...interface{}) {
	L().Error(fmt.Sprintf(format, args...))
}

// InfoContext logs an info message with fields stored in the context.
func InfoContext(ctx context.Context, msg string, fields ...zapcore.Field) {
	FromContext(ctx).Info(msg, fields...)
}

// ErrorContext logs an error message with fields stored in the context.
func ErrorContext(ctx context.Context, msg string, fields ...zapcore.Field) {
	FromContext(ctx).Error(msg, fields...)
}

type contextKey string

const contextFieldsKey contextKey = "logging.fields"

// ContextWithFields stores log fields on the provided context.
func ContextWithFields(ctx context.Context, fields ...zapcore.Field) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	existing := fieldsFromContext(ctx)
	combined := append(existing, fields...)
	return context.WithValue(ctx, contextFieldsKey, combined)
}

// FromContext returns a logger augmented with fields stored on the context.
func FromContext(ctx context.Context) *zap.Logger {
	return With(fieldsFromContext(ctx)...)
}

func fieldsFromContext(ctx context.Context) []zapcore.Field {
	if ctx == nil {
		return nil
	}
	if v, ok := ctx.Value(contextFieldsKey).([]zapcore.Field); ok && len(v) > 0 {
		// Create a shallow copy to avoid accidental modification.
		out := make([]zapcore.Field, len(v))
		copy(out, v)
		return out
	}
	return nil
}

func normaliseMessage(message interface{}) (string, []zapcore.Field) {
	if message == nil {
		return "", nil
	}
	switch v := message.(type) {
	case string:
		return v, nil
	case fmt.Stringer:
		return v.String(), nil
	case error:
		return v.Error(), []zapcore.Field{zap.Error(v)}
	default:
		return fmt.Sprint(v), nil
	}
}
