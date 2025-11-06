# Suggested Commands - YouTube Live Translator

## Project Status
⚠️ **IMPORTANT**: This project is in PREPARATION phase. No source code exists yet - only comprehensive documentation.

## Commands to Use AFTER Project Setup

### Development Commands (npm scripts)
```bash
npm run dev              # Launch app in dev mode with hot reload
npm test                 # Run unit tests (Vitest)
npm run test:e2e         # Run E2E tests (Playwright)
npm run test:coverage    # Run tests with coverage report
npm run lint             # Run ESLint + TypeScript checks
npm run format           # Format code with Prettier
```

### Build and Packaging Commands
```bash
npm run build            # Build production version
npm run package          # Package for current OS
npm run package:win      # Package for Windows
npm run package:mac      # Package for macOS
npm run package:linux    # Package for Linux
```

### Claude Code Slash Commands (available after setup)
```bash
/dev-setup               # Complete environment setup guide
/fix-latency             # Diagnose and optimize latency issues
/test-pipeline           # Comprehensive pipeline testing
/debug-api               # Debug STT/Translation/TTS problems
/build-release           # Multi-platform build and packaging
/review-code             # Code review focused on performance/security
```

## Project Setup Commands (First Time)

### 1. Create Git Repository
```bash
cd ~/projects
git clone https://github.com/your-username/youtube-live-translator.git
cd youtube-live-translator
```

### 2. Copy Prepared Configuration
```bash
# Copy Claude Code configuration
cp -r /path/to/preparation/.claude .
cp /path/to/preparation/CLAUDE.md .

# Copy documentation (optional)
mkdir -p docs
cp /path/to/preparation/*.md docs/
```

### 3. Initialize Electron Project
```bash
npm create @quick-start/electron
# Choose: Vite + TypeScript + React

# Install dependencies
npm install zustand @google-cloud/speech @google-cloud/text-to-speech deepl-node
npm install -D vitest @playwright/test eslint prettier tailwindcss
```

### 4. Google Cloud Setup
```bash
# Create project
gcloud projects create youtube-live-translator
gcloud config set project youtube-live-translator

# Enable APIs
gcloud services enable speech.googleapis.com texttospeech.googleapis.com

# Create service account
gcloud iam service-accounts create ytlt-service
gcloud iam service-accounts keys create ./credentials/google-cloud-key.json \
  --iam-account=ytlt-service@youtube-live-translator.iam.gserviceaccount.com
```

### 5. DeepL Setup
- Create account at https://www.deepl.com/pro-api
- Copy API key to `.env` file

## System Utilities (Linux)
Standard Linux commands are available:
- `ls` - List files and directories
- `cd` - Change directory
- `grep` - Search text patterns
- `find` - Find files
- `git` - Version control
- `npm` / `npx` - Node package manager

## Next Steps
1. Create the actual project repository
2. Copy the prepared configuration
3. Run `/dev-setup` in Claude Code to begin guided development
4. Follow the 8-phase development timeline