# Webform Sync Service - Makefile
# Cross-platform build automation

# Binary name
BINARY_NAME=webform-sync

# Build directory
BUILD_DIR=./build

# Version information
VERSION=$(shell git describe --tags --always --dirty 2>/dev/null || echo "v1.0.0")
BUILD_TIME=$(shell date -u '+%Y-%m-%d_%H:%M:%S')
LDFLAGS=-ldflags "-X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME)"

# Go build flags
GO=go
GOFLAGS=-trimpath
CGO_ENABLED=1

# Platforms
PLATFORMS=windows/amd64 linux/amd64 linux/arm64 darwin/amd64 darwin/arm64

.PHONY: all build build-all clean test run deps help install

## help: Display this help message
help:
	@echo "Webform Sync Service - Build Targets"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@grep -E '^## ' Makefile | sed 's/## /  /'

## all: Build for all platforms
all: clean deps build-all

## build: Build for current platform
build: deps
	@echo "Building for current platform..."
	@mkdir -p $(BUILD_DIR)
	CGO_ENABLED=$(CGO_ENABLED) $(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/webform-sync
	@echo "Built: $(BUILD_DIR)/$(BINARY_NAME)"

## build-all: Build for all platforms
build-all: deps
	@echo "Building for all platforms..."
	@mkdir -p $(BUILD_DIR)
	
	@echo "Building for Windows amd64..."
	CGO_ENABLED=1 GOOS=windows GOARCH=amd64 CC=x86_64-w64-mingw32-gcc $(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe ./cmd/webform-sync
	
	@echo "Building for Linux amd64..."
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 $(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 ./cmd/webform-sync
	
	@echo "Building for Linux arm64..."
	CGO_ENABLED=1 GOOS=linux GOARCH=arm64 CC=aarch64-linux-gnu-gcc $(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-arm64 ./cmd/webform-sync
	
	@echo "Building for macOS amd64..."
	CGO_ENABLED=1 GOOS=darwin GOARCH=amd64 $(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-amd64 ./cmd/webform-sync
	
	@echo "Building for macOS arm64..."
	CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 $(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-arm64 ./cmd/webform-sync
	
	@echo ""
	@echo "Build complete! Binaries in $(BUILD_DIR)/"
	@ls -lh $(BUILD_DIR)/

## build-windows: Build for Windows only
build-windows: deps
	@echo "Building for Windows amd64..."
	@mkdir -p $(BUILD_DIR)
	CGO_ENABLED=1 GOOS=windows GOARCH=amd64 CC=x86_64-w64-mingw32-gcc $(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe ./cmd/webform-sync

## build-linux: Build for Linux (amd64 and arm64)
build-linux: deps
	@echo "Building for Linux..."
	@mkdir -p $(BUILD_DIR)
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 $(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 ./cmd/webform-sync
	CGO_ENABLED=1 GOOS=linux GOARCH=arm64 CC=aarch64-linux-gnu-gcc $(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-arm64 ./cmd/webform-sync

## build-macos: Build for macOS (Intel and Apple Silicon)
build-macos: deps
	@echo "Building for macOS..."
	@mkdir -p $(BUILD_DIR)
	CGO_ENABLED=1 GOOS=darwin GOARCH=amd64 $(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-amd64 ./cmd/webform-sync
	CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 $(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-arm64 ./cmd/webform-sync

## deps: Download dependencies
deps:
	@echo "Downloading dependencies..."
	$(GO) mod download
	$(GO) mod tidy

## test: Run tests
test:
	@echo "Running tests..."
	$(GO) test -v -race -coverprofile=coverage.out ./...
	@echo ""
	@echo "Coverage report:"
	$(GO) tool cover -func=coverage.out

## test-short: Run short tests only
test-short:
	@echo "Running short tests..."
	$(GO) test -v -short ./...

## run: Run the service locally
run: build
	@echo "Starting webform-sync service..."
	$(BUILD_DIR)/$(BINARY_NAME)

## install: Install to GOPATH/bin
install: deps
	@echo "Installing to GOPATH/bin..."
	CGO_ENABLED=$(CGO_ENABLED) $(GO) install $(GOFLAGS) $(LDFLAGS) ./cmd/webform-sync

## clean: Remove build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(BUILD_DIR)
	rm -f coverage.out
	rm -rf ./data/*.db
	rm -rf ./logs/*.log
	@echo "Clean complete!"

## fmt: Format code
fmt:
	@echo "Formatting code..."
	$(GO) fmt ./...
	gofmt -s -w .

## lint: Run linters
lint:
	@echo "Running linters..."
	golangci-lint run ./...

## vet: Run go vet
vet:
	@echo "Running go vet..."
	$(GO) vet ./...

## dev: Quick development build and run
dev: fmt vet build run

## docker-build: Build Docker image
docker-build:
	@echo "Building Docker image..."
	docker build -t webform-sync:$(VERSION) .

## docker-run: Run in Docker container
docker-run:
	@echo "Running Docker container..."
	docker run -p 8765:8765 -v $(PWD)/data:/app/data -v $(PWD)/logs:/app/logs webform-sync:$(VERSION)

## release: Create release archives
release: build-all
	@echo "Creating release archives..."
	@mkdir -p $(BUILD_DIR)/releases
	cd $(BUILD_DIR) && tar -czf releases/$(BINARY_NAME)-windows-amd64-$(VERSION).tar.gz $(BINARY_NAME)-windows-amd64.exe
	cd $(BUILD_DIR) && tar -czf releases/$(BINARY_NAME)-linux-amd64-$(VERSION).tar.gz $(BINARY_NAME)-linux-amd64
	cd $(BUILD_DIR) && tar -czf releases/$(BINARY_NAME)-linux-arm64-$(VERSION).tar.gz $(BINARY_NAME)-linux-arm64
	cd $(BUILD_DIR) && tar -czf releases/$(BINARY_NAME)-darwin-amd64-$(VERSION).tar.gz $(BINARY_NAME)-darwin-amd64
	cd $(BUILD_DIR) && tar -czf releases/$(BINARY_NAME)-darwin-arm64-$(VERSION).tar.gz $(BINARY_NAME)-darwin-arm64
	@echo "Release archives created in $(BUILD_DIR)/releases/"

## version: Display version information
version:
	@echo "Version: $(VERSION)"
	@echo "Build Time: $(BUILD_TIME)"

## info: Display build information
info:
	@echo "Build Configuration:"
	@echo "  Go Version: $(shell $(GO) version)"
	@echo "  Binary Name: $(BINARY_NAME)"
	@echo "  Build Directory: $(BUILD_DIR)"
	@echo "  Version: $(VERSION)"
	@echo "  CGO Enabled: $(CGO_ENABLED)"
	@echo ""
	@echo "Target Platforms:"
	@echo "  $(PLATFORMS)" | tr ' ' '\n' | sed 's/^/  - /'
