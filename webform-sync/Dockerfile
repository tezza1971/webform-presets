# Multi-stage build for webform-sync service
FROM golang:1.21 AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y gcc g++ sqlite3 libsqlite3-dev

WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary (dynamic linking for SQLite compatibility)
RUN CGO_ENABLED=1 GOOS=linux go build -o webform-sync ./cmd/webform-sync

# Final stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y ca-certificates sqlite3 libsqlite3-0 wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/webform-sync .

# Copy config files
COPY webform-sync.yml .
COPY whitelist.txt .
COPY blacklist.txt .

# Create data and logs directories
RUN mkdir -p /app/data /app/logs

# Expose default port
EXPOSE 8765

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8765/api/v1/health || exit 1

# Run as non-root user
RUN useradd -m -u 1000 webform && chown -R webform:webform /app
USER webform

# Run the service
CMD ["./webform-sync"]
