# Webform Sync Service

A lightweight Go service for synchronizing webform presets across multiple browsers and devices on a local network.

## Features

- 🔒 **Secure Local Storage** - All data stored locally on your network
- 🌐 **Multi-Browser Support** - Works with Chrome, Brave, Edge, and other Chromium browsers
- 🖥️ **Multi-Device** - Sync across multiple workstations without cloud accounts
- 🛡️ **Access Control** - IP whitelist/blacklist and URL filtering
- 📝 **Comprehensive Logging** - Debug and monitor with configurable log levels
- ⚡ **Fast & Lightweight** - Written in Go for maximum performance
- 🔧 **Flexible Configuration** - YAML-based configuration file
- 💾 **SQLite Storage** - No external database required

## Quick Start

### Installation

Download the appropriate binary for your platform from the [releases page](https://github.com/tezza1971/webform-presets/releases):

- **Windows x86/x64**: `webform-sync-windows-amd64.exe`
- **Linux x86/x64**: `webform-sync-linux-amd64`
- **Linux ARM** (Raspberry Pi): `webform-sync-linux-arm64`
- **macOS Intel**: `webform-sync-darwin-amd64`
- **macOS Apple Silicon**: `webform-sync-darwin-arm64`

### Running the Service

1. Place the binary in a directory
2. Create or edit `webform-sync.yml` configuration file
3. Run the service:

**Windows:**
```powershell
.\webform-sync-windows-amd64.exe
```

**Linux/macOS:**
```bash
chmod +x webform-sync-linux-amd64
./webform-sync-linux-amd64
```

The service will start on port 8765 by default (configurable in `webform-sync.yml`).

### Configuration

Edit `webform-sync.yml` to customize:

```yaml
server:
  port: 8765
  host: "127.0.0.1"  # localhost only, or "0.0.0.0" for all interfaces

access_control:
  mode: "whitelist"  # whitelist, blacklist, or allow_all
  whitelist:
    - "127.0.0.1"
    - "192.168.1.0/24"  # Allow local network

logging:
  level: "info"  # debug, info, warn, error
  output: "both"  # console, file, or both
  log_file: "./logs/webform-sync.log"
```

See `webform-sync.yml` for all available options.

## Configuration Options

### Server Settings

- **port**: Port number to listen on (default: 8765)
- **fallback_ports**: Alternative ports if primary is in use
- **host**: Bind address (`127.0.0.1` for localhost, `0.0.0.0` for all interfaces)

### Access Control

**IP-based filtering:**
- `mode`: `whitelist`, `blacklist`, or `allow_all`
- `whitelist`: List of allowed IPs/ranges (CIDR notation)
- `blacklist`: List of blocked IPs/ranges

**URL filtering:**
- `whitelist.txt`: Allowed domains/URLs (one per line)
- `blacklist.txt`: Blocked domains/URLs (one per line)
- Supports regex patterns for flexible matching
- Whitelist overrides blacklist

### Logging

- **level**: `debug`, `info`, `warn`, `error`
- **output**: `console`, `file`, or `both`
- **log_file**: Path to log file
- **max_size_mb**: Max log file size before rotation
- **log_requests**: Enable HTTP request logging

## Browser Extension Configuration

In the Webform Presets browser extension settings:

1. Enable "Use Sync Service"
2. Set sync server URL: `http://localhost:8765`
3. (Optional) Enter API token if authentication is enabled

## API Endpoints

The service exposes a REST API for the browser extension:

- `GET /api/v1/health` - Health check
- `GET /api/v1/presets?device_id={id}` - Get all presets
- `POST /api/v1/presets` - Save new preset
- `PUT /api/v1/presets/{id}` - Update preset
- `DELETE /api/v1/presets/{id}?device_id={id}` - Delete preset
- `GET /api/v1/presets/scope/{type}/{value}` - Get presets by scope

See [API Documentation](docs/API.md) for detailed endpoint information.

## Building from Source

### Prerequisites

- Go 1.21 or later
- GCC (for SQLite support)

### Build Commands

```bash
# Clone repository
git clone https://github.com/tezza1971/webform-presets.git
cd webform-presets/webform-sync

# Install dependencies
go mod download

# Build for current platform
go build -o webform-sync ./cmd/webform-sync

# Build for all platforms
make build-all
```

### Cross-Compilation

```bash
# Windows
GOOS=windows GOARCH=amd64 go build -o webform-sync-windows-amd64.exe ./cmd/webform-sync

# Linux
GOOS=linux GOARCH=amd64 go build -o webform-sync-linux-amd64 ./cmd/webform-sync

# Linux ARM (Raspberry Pi)
GOOS=linux GOARCH=arm64 go build -o webform-sync-linux-arm64 ./cmd/webform-sync

# macOS Intel
GOOS=darwin GOARCH=amd64 go build -o webform-sync-darwin-amd64 ./cmd/webform-sync

# macOS Apple Silicon
GOOS=darwin GOARCH=arm64 go build -o webform-sync-darwin-arm64 ./cmd/webform-sync
```

## Running as a Service

### Windows (using NSSM)

1. Download [NSSM](https://nssm.cc/download)
2. Install service:
```powershell
nssm install WebformSync "C:\path\to\webform-sync.exe"
nssm start WebformSync
```

### Linux (systemd)

Create `/etc/systemd/system/webform-sync.service`:

```ini
[Unit]
Description=Webform Sync Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/opt/webform-sync
ExecStart=/opt/webform-sync/webform-sync-linux-amd64
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable webform-sync
sudo systemctl start webform-sync
```

### macOS (launchd)

Create `~/Library/LaunchAgents/com.webform-sync.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.webform-sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/webform-sync</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

Load service:
```bash
launchctl load ~/Library/LaunchAgents/com.webform-sync.plist
```

## Security Considerations

- **Default configuration allows localhost only** - Safe for single-machine use
- **Enable authentication for network access** - Use API tokens or basic auth
- **Use URL filtering** - Prevent storing data from untrusted sites
- **Keep logs for auditing** - Monitor access and detect issues
- **Run on private networks only** - Not designed for internet exposure

## Troubleshooting

### Port Already in Use

The service automatically tries fallback ports. Check `webform-sync.yml` to configure alternatives.

### Can't Connect from Browser

1. Check firewall settings
2. Verify `host` is set correctly (`0.0.0.0` for network access)
3. Check IP whitelist includes your client IP
4. Verify CORS is enabled in config

### Presets Not Syncing

1. Check logs: `./logs/webform-sync.log`
2. Verify device_id is consistent across browsers
3. Check URL filters aren't blocking domains
4. Ensure browser extension points to correct server

### High CPU/Memory Usage

1. Enable `auto_cleanup` in config
2. Reduce `log_level` from `debug` to `info`
3. Disable `log_requests` if not needed
4. Check for runaway sync loops in logs

## Development

### Project Structure

```
webform-sync/
├── cmd/
│   └── webform-sync/
│       └── main.go           # Entry point
├── internal/
│   ├── config/
│   │   └── config.go         # Configuration loading
│   ├── logger/
│   │   └── logger.go         # Logging system
│   ├── server/
│   │   ├── server.go         # HTTP server
│   │   └── handlers.go       # API handlers
│   └── storage/
│       └── storage.go        # Database operations
├── webform-sync.yml          # Configuration file
├── whitelist.txt             # URL whitelist
├── blacklist.txt             # URL blacklist
├── go.mod                    # Go dependencies
└── Makefile                  # Build automation
```

### Running Tests

```bash
go test ./...
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

See LICENSE file in the repository root.

## Support

- **Issues**: https://github.com/tezza1971/webform-presets/issues
- **Discussions**: https://github.com/tezza1971/webform-presets/discussions

## Changelog

### v1.0.0 (2025-01-01)
- Initial release
- Multi-platform support
- IP and URL filtering
- SQLite storage
- CORS support
- Authentication options
- Comprehensive logging
