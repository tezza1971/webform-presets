# Webform Sync - Quick Start Guide

## Prerequisites

- **Go 1.21+** (only for building from source)
- **GCC** (for SQLite support when building)

## Installation Options

### Option 1: Use Pre-Built Binary (Recommended)

1. Download the appropriate binary for your platform:
   - **Windows**: `webform-sync-windows-amd64.exe`
   - **Linux x64**: `webform-sync-linux-amd64`
   - **Linux ARM**: `webform-sync-linux-arm64`
   - **macOS Intel**: `webform-sync-darwin-amd64`
   - **macOS Apple Silicon**: `webform-sync-darwin-arm64`

2. Place in a directory (e.g., `C:\webform-sync\` or `/opt/webform-sync/`)

### Option 2: Build from Source

**Windows (PowerShell):**
```powershell
cd c:\Users\Terence\code\webform-presets\webform-sync
go mod download
go build -o webform-sync.exe .\cmd\webform-sync
```

**Linux/macOS (Bash):**
```bash
cd ~/webform-presets/webform-sync
go mod download
go build -o webform-sync ./cmd/webform-sync
```

**Using Build Script (PowerShell):**
```powershell
.\build.ps1 -Target current
```

**Using Makefile (Linux/macOS):**
```bash
make build
```

## First Run

### 1. Basic Configuration

The service comes with a default configuration file `webform-sync.yml`. For first-time use, the defaults work well:

- **Port**: 8765 (localhost only)
- **Access**: localhost/127.0.0.1 only
- **Logging**: Info level to console and file
- **Storage**: SQLite database in `./data/` directory

### 2. Start the Service

**Windows:**
```powershell
.\webform-sync.exe
```

**Linux/macOS:**
```bash
./webform-sync
```

You should see:
```
 __      __      _      __                             _____                    
/  \    /  \____| |____/ _| ___  ______ ____   ____  / ____\___ ___________   _____
\   \/\/   /  _ | _/  < |_ / _ \|  ___/  __ \_/ ___\/ /_  / _ \\___   ___\ /  ___/
 \        (  __/ |>    \  > (_) | |  | | | | / /__ \  __| \___/ / | |     /\___ \  
  \__/\  / \___/_|___/\_|  \___/|_|  |_| |_| \____/_/     \____/  |_|     /____  >
       \/                                                                        \/ 
                   ╭╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╮
                   ┆   Webform Preset Sync Service v1.0.0   ┆
                   ╰╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╯

[INFO] 2025/01/11 11:25:00 Starting webform-sync service...
[INFO] 2025/01/11 11:25:00 Loading configuration from: webform-sync.yml
[INFO] 2025/01/11 11:25:00 Server listening on http://127.0.0.1:8765
```

### 3. Test the Service

Open a browser and navigate to:
```
http://localhost:8765/api/v1/health
```

You should see:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-01-11T11:25:00Z"
}
```

## Configure Browser Extension

1. Open the **Webform Presets** extension options/settings
2. Navigate to **Sync Settings**
3. Enable "Use Sync Service"
4. Enter server URL: `http://localhost:8765`
5. Click "Test Connection"
6. Save settings

## Network Access (Multiple Devices)

To allow other devices on your network to sync:

### 1. Update Configuration

Edit `webform-sync.yml`:

```yaml
server:
  host: "0.0.0.0"  # Listen on all network interfaces
  port: 8765

access_control:
  mode: "whitelist"
  whitelist:
    - "127.0.0.1"           # localhost
    - "192.168.1.0/24"      # Your local network (adjust as needed)
    - "192.168.1.100"       # Specific device
```

### 2. Find Your Server IP

**Windows:**
```powershell
ipconfig | findstr IPv4
```

**Linux/macOS:**
```bash
ifconfig | grep "inet "
# or
ip addr show
```

### 3. Configure Firewall

**Windows Firewall:**
```powershell
New-NetFirewallRule -DisplayName "Webform Sync" -Direction Inbound -Protocol TCP -LocalPort 8765 -Action Allow
```

**Linux (ufw):**
```bash
sudo ufw allow 8765/tcp
```

**macOS:**
System Preferences → Security & Privacy → Firewall → Firewall Options → Add `webform-sync`

### 4. Connect from Other Devices

On other devices, configure the extension with:
```
http://192.168.1.XXX:8765
```
(Replace XXX with your server's IP)

## Common Configurations

### Home Use (Single Computer)

Default config works perfectly:
- `host: "127.0.0.1"` (localhost only)
- `mode: "allow_all"`

### Office/Multiple Workstations

```yaml
server:
  host: "0.0.0.0"
  port: 8765

access_control:
  mode: "whitelist"
  whitelist:
    - "192.168.1.0/24"    # Office network
    - "10.0.0.0/8"        # VPN network
```

### High Security Environment

```yaml
access_control:
  mode: "whitelist"
  whitelist:
    - "192.168.1.50"      # Only specific IPs
    - "192.168.1.51"

url_filter:
  enabled: true
  mode: "whitelist"
  whitelist_file: "whitelist.txt"  # Only allow specific domains

authentication:
  enabled: true
  type: "token"
  api_token: "your-secret-token-here"  # Generate a strong token
```

Then add to `whitelist.txt`:
```
^https://example\.com/.*$
^https://app\.company\.com/.*$
```

## URL Filtering

### Whitelist Mode (Recommended for Security)

Only save presets from trusted domains:

**whitelist.txt:**
```
^https://github\.com/.*$
^https://.*\.example\.com/.*$
^https://app\.internal\.company\.com/login$
```

### Blacklist Mode

Block specific domains:

**blacklist.txt:**
```
^https://malicious-site\.com/.*$
^https://.*\.ads\..*$
```

## Logging

### Debug Mode

For troubleshooting, edit `webform-sync.yml`:

```yaml
logging:
  level: "debug"
  log_requests: true
```

View logs:
```powershell
# Windows
Get-Content -Wait .\logs\webform-sync.log

# Linux/macOS
tail -f ./logs/webform-sync.log
```

### Log Rotation

Logs automatically rotate at 10MB by default. Configure in `webform-sync.yml`:

```yaml
logging:
  max_size_mb: 10
  max_backups: 5
  max_age_days: 30
```

## Troubleshooting

### Port Already in Use

The service will automatically try fallback ports (8766, 8767, 8768, 8769).

To use a specific port:
```yaml
server:
  port: 9000
```

### Can't Connect from Browser

1. Check service is running
2. Verify firewall allows connections
3. Check IP whitelist includes client IP
4. Test with: `curl http://localhost:8765/api/v1/health`

### Permission Denied (Linux/macOS)

```bash
chmod +x webform-sync-linux-amd64
```

### Presets Not Syncing

1. Check logs: `./logs/webform-sync.log`
2. Verify `device_id` is same across browsers
3. Check URL filters aren't blocking domains
4. Test API directly: `curl http://localhost:8765/api/v1/presets?device_id=test123`

## Running as a System Service

### Windows Service (NSSM)

Download [NSSM](https://nssm.cc/) then:

```powershell
nssm install WebformSync "C:\webform-sync\webform-sync.exe"
nssm set WebformSync AppDirectory "C:\webform-sync"
nssm start WebformSync
```

### Linux Systemd

Create `/etc/systemd/system/webform-sync.service`:

```ini
[Unit]
Description=Webform Sync Service
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/opt/webform-sync
ExecStart=/opt/webform-sync/webform-sync-linux-amd64
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable webform-sync
sudo systemctl start webform-sync
sudo systemctl status webform-sync
```

## Next Steps

- Configure URL filtering for your trusted domains
- Set up authentication for network access
- Configure automatic cleanup of old presets
- Review logs regularly for any issues
- Back up your `data/` directory periodically

## Support

For issues, questions, or feature requests:
- GitHub Issues: https://github.com/tezza1971/webform-presets/issues
- Discussions: https://github.com/tezza1971/webform-presets/discussions

## Security Best Practices

1. **Use localhost mode** when possible
2. **Enable authentication** for network access
3. **Configure URL whitelists** to limit data collection
4. **Review logs regularly** for suspicious activity
5. **Keep software updated** to latest version
6. **Back up database** in `./data/` directory
7. **Use HTTPS** if exposing beyond local network (requires reverse proxy)
