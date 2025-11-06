# YouTube Live Translator - Project Overview

## Project Status
**Current Status**: PREPARATION PHASE - No source code yet, only comprehensive documentation prepared

This is an Electron desktop application project for real-time translation of YouTube videos (English → French) with a target latency of < 2 seconds.

## Project Purpose
- Real-time translation of YouTube video audio
- English to French translation pipeline
- Desktop application for Windows, macOS, and Linux
- Target latency: < 2000ms end-to-end

## Tech Stack Summary
- **Framework**: Electron 28+ (Chromium 120+, Node.js 20+)
- **Language**: TypeScript 5.3+ (strict mode)
- **Backend**: Node.js with TypeScript
- **Frontend**: React 18 + TailwindCSS
- **State Management**: Zustand
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Build Tool**: Vite 5+
- **Packaging**: electron-builder

## Cloud Services (Budget: ~$70/month for intensive use)
- **STT**: Google Cloud Speech-to-Text (streaming, 400ms latency)
- **Translation**: DeepL API Pro (premium quality, 300ms latency)
- **TTS**: Google Cloud Text-to-Speech Neural2 (natural voices, 600ms latency)

## Latency Budget (Validated ✅)
```
YouTube Capture:        100ms
STT (Google):           400ms
Translation (DeepL):    300ms
TTS (Google Neural2):   600ms
Audio Playback:         100ms
──────────────────────────────
Total:                  1500ms  (< 2000ms target ✅)
Margin:                 500ms   (25%)
```

## Project Structure (When Created)
```
youtube-live-translator/
├── src/
│   ├── main/              # Electron main process
│   │   ├── services/      # STT, Translation, TTS services
│   │   ├── pipeline/      # Audio pipeline, buffering
│   │   ├── core/          # Config, logging, cache
│   │   └── utils/         # Retry, streams, helpers
│   ├── renderer/          # React UI
│   ├── preload/           # IPC bridge
│   └── shared/            # Types, constants
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── resources/             # Assets, binaries (yt-dlp, ffmpeg)
├── .claude/               # Claude Code configuration
└── docs/                  # Technical documentation
```

## Development Timeline
**Total**: 21-32 days
1. Phase 1 (2-3 days): Electron + TypeScript setup
2. Phase 2 (1-2 days): Cloud services configuration
3. Phase 3 (5-7 days): MVP Pipeline
4. Phase 4 (3-5 days): Optimizations
5. Phase 5 (3-4 days): React UI + monitoring
6. Phase 6 (2-3 days): Infrastructure (logging, metrics)
7. Phase 7 (3-5 days): Testing
8. Phase 8 (2-3 days): Packaging and release