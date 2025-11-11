# Windows Build Instructions

## Building on Windows

SQLite requires CGO (C bindings), which needs a GCC compiler on Windows.

### Option 1: Install MinGW-w64 (Recommended)

1. Download and install [MSYS2](https://www.msys2.org/)
2. Open MSYS2 terminal and run:
   ```bash
   pacman -S mingw-w64-x86_64-gcc
   ```
3. Add MinGW to PATH:
   ```powershell
   $env:PATH += ";C:\msys64\mingw64\bin"
   ```
4. Build:
   ```powershell
   $env:CGO_ENABLED=1
   go build -o webform-sync.exe .\cmd\webform-sync
   ```

### Option 2: Use TDM-GCC

1. Download [TDM-GCC](https://jmeubank.github.io/tdm-gcc/)
2. Install (ensure it's added to PATH)
3. Build:
   ```powershell
   $env:CGO_ENABLED=1
   go build -o webform-sync.exe .\cmd\webform-sync
   ```

### Option 3: Use Pre-Built Binary

Download the pre-compiled Windows binary from the releases page instead of building from source.

### Option 4: Cross-Compile from Linux

On Linux, you can cross-compile for Windows:

```bash
# Install mingw-w64
sudo apt-get install mingw-w64

# Build for Windows
CGO_ENABLED=1 GOOS=windows GOARCH=amd64 CC=x86_64-w64-mingw32-gcc go build -o webform-sync.exe ./cmd/webform-sync
```

### Option 5: Use Docker Build

```powershell
docker build -t webform-sync .
docker create --name temp webform-sync
docker cp temp:/app/webform-sync webform-sync.exe
docker rm temp
```

## Using the Build Script

The PowerShell build script (`build.ps1`) will attempt to detect GCC and provide helpful error messages:

```powershell
# Build for current platform (requires GCC)
.\build.ps1 -Target current

# Build all platforms (requires cross-compilation setup)
.\build.ps1 -Target all

# Clean and rebuild
.\build.ps1 -Target current -Clean
```

## Troubleshooting

### "gcc not found"

Install MinGW or TDM-GCC as described above.

### "undefined reference to..."

Make sure you're using the correct GCC version:
```powershell
gcc --version
```

Should show MinGW-w64 8.0+ or TDM-GCC 10.0+

### Build is slow

CGO builds are slower than pure Go. This is normal. The first build will download and compile SQLite.

### PATH issues

Verify GCC is in PATH:
```powershell
$env:PATH -split ';' | Select-String gcc
```

Add to PATH permanently:
1. System Properties → Environment Variables
2. Edit PATH
3. Add `C:\msys64\mingw64\bin` or your GCC installation path

## Linux Build

Linux typically has GCC installed:

```bash
CGO_ENABLED=1 go build -o webform-sync ./cmd/webform-sync
```

## macOS Build

macOS has command line tools:

```bash
# Install Xcode Command Line Tools if needed
xcode-select --install

# Build
CGO_ENABLED=1 go build -o webform-sync ./cmd/webform-sync
```

## CI/CD Considerations

For automated builds, use Docker or Linux-based CI systems where GCC is readily available:

### GitHub Actions Example

```yaml
name: Build

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-go@v2
        with:
          go-version: 1.21
      - name: Install dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y gcc mingw-w64
      - name: Build all platforms
        run: make build-all
```

## Binary Size

CGO-enabled binaries are larger (~9-12 MB) due to SQLite being statically linked. This is expected and necessary for the service to work without external SQLite libraries.
