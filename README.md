# Dev Tools

Production-level HTML interface for developer utilities. Fully client-side, no API calls.

## Tools

| Tool | Path | Description |
|------|------|-------------|
| **UUID** | `/uuid` | Generate UUID v4/v1, convert string ↔ UUID |
| **Epoch Converter** | `/epoch-converter` | Current time, timezone converter, epoch ↔ date, Go-style duration (ns) |

## Run Locally

Serve the directory with any static file server:

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .

# PHP
php -S localhost:8080
```

Then open `http://localhost:8080` in your browser.

## Structure

```
dev-tools/
├── index.html          # Landing page
├── uuid/
│   └── index.html     # UUID generator & converter
├── epoch-converter/
│   └── index.html     # Epoch & timezone converter
├── css/
│   └── styles.css     # Shared styles
└── js/
    ├── shared.js             # Clipboard, theme, debounce
    ├── uuid.js               # UUID logic
    ├── format-go-duration.js # Nanoseconds → human string (Go time.Duration)
    └── epoch-converter.js    # Time/epoch logic
```

## Features

- **UUID**: v4 (random), v1 (timestamp), string→UUID v5, UUID→canonical string
- **Epoch**: Current time (UTC), timezone conversion, epoch↔date, batch/tools, **duration**: nanoseconds → human (`formatDurationNanoseconds`)
- Dark/light theme with system preference detection
- Copy-to-clipboard on all outputs
- Responsive layout
- No external API calls
