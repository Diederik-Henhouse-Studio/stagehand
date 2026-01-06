# Politeia - Scraping-as-a-Service

> Configuration-driven scraping platform for governmental and public information

**Status:** 🚧 Phase 0 - Project Setup
**Version:** 1.0.0-alpha
**Last Updated:** January 6, 2026

---

## 🎯 Overview

Politeia is a standalone scraping system designed for extracting and validating governmental data from municipal portals. This implementation focuses on NOTUBIZ and IBIS platforms with monthly self-testing capabilities.

**Key Features:**
- ✅ Configuration-driven platform adapters
- ✅ Automated monthly validation tests
- ✅ Human-readable (Markdown) + Machine-readable (JSON) outputs
- ✅ Browserbase session monitoring and recording
- ✅ Comprehensive logging and error handling
- ✅ Demo-ready for stakeholder presentations

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Browserbase account (API key required)
- Git

### Installation

```bash
# Clone repository (if not already done)
cd examples/politeia

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your Browserbase API key and project ID

# Build project
npm run build

# Run type checking
npm run typecheck
```

### First Test Run

```bash
# Test Oirschot (NOTUBIZ)
npm run test:oirschot

# View results
cat output/latest/summary.md
```

---

## 📁 Project Structure

```
examples/politeia/
├── src/
│   ├── core/                    # Core scraping engine
│   │   ├── scraper-engine.ts
│   │   ├── browserbase-client.ts
│   │   └── types.ts
│   ├── platforms/               # Platform-specific adapters
│   │   ├── notubiz/
│   │   │   ├── notubiz-adapter.ts
│   │   │   ├── selectors.ts
│   │   │   └── parser.ts
│   │   └── ibis/
│   │       ├── ibis-adapter.ts
│   │       ├── selectors.ts
│   │       └── parser.ts
│   ├── testing/                 # Test runner & validators
│   │   ├── monthly-validator.ts
│   │   ├── validator.ts
│   │   └── quality-checks.ts
│   ├── output/                  # Output generators
│   │   ├── json-generator.ts
│   │   ├── markdown-generator.ts
│   │   └── summary-generator.ts
│   └── utils/                   # Shared utilities
│       ├── logger.ts
│       ├── date-utils.ts
│       └── file-utils.ts
├── tests/
│   ├── unit/                    # Unit tests
│   └── integration/             # Integration tests
├── config/
│   ├── platforms/               # Platform configurations
│   │   ├── notubiz-v2.0.0.ts
│   │   └── ibis-v1.0.0.ts
│   └── municipalities/          # Municipality settings
│       ├── oirschot.ts
│       └── tilburg.ts
├── scripts/
│   ├── politeia-cli.ts          # CLI tool
│   ├── monthly-validator.ts     # Monthly test runner
│   └── demo.ts                  # Interactive demo
├── output/                      # Test results (gitignored)
└── logs/                        # Application logs (gitignored)
```

---

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available options.

**Required:**
- `BROWSERBASE_API_KEY` - Your Browserbase API key
- `BROWSERBASE_PROJECT_ID` - Your Browserbase project ID

**Optional:**
- `POLITEIA_OUTPUT_DIR` - Output directory (default: `./output`)
- `POLITEIA_LOG_LEVEL` - Logging level (default: `info`)
- `TEST_MONTH` - Month to test (default: `auto` = previous month)
- `TEST_YEAR` - Year to test (default: `auto` = current/previous year)

### Municipality Configuration

Municipalities are configured in `config/municipalities/`:

```typescript
// config/municipalities/oirschot.ts
export const oirschotConfig = {
  id: 'oirschot',
  name: 'Gemeente Oirschot',
  platform: 'NOTUBIZ',
  platformVersion: '2.0.0',
  urls: {
    base: 'https://oirschot.bestuurlijkeinformatie.nl',
    calendar: 'https://oirschot.bestuurlijkeinformatie.nl/Vergaderingen'
  },
  scraping: {
    timeout: 60000,
    retries: 3
  }
};
```

---

## 📋 Available Commands

### Development

```bash
npm run dev          # Run in development mode
npm run build        # Build TypeScript
npm run typecheck    # Type checking only
npm run lint         # Lint code
```

### Testing

```bash
npm run test              # Run all tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:monthly      # Monthly validation (auto-detects month)
npm run test:oirschot     # Test Oirschot only
npm run test:tilburg      # Test Tilburg only
```

### CLI Tool

```bash
npm run cli -- test --municipality=oirschot
npm run cli -- test --month=9 --year=2025
npm run cli -- scrape --url=https://...
npm run cli -- --help
```

### Demo

```bash
npm run demo         # Interactive demo with live scraping
```

---

## 📊 Output Structure

Each test run creates a timestamped directory:

```
output/2026-01-06T10-30-00Z/
├── metadata.json              # Test run metadata
├── summary.md                 # Human-readable summary
├── logs/
│   ├── test-execution.log     # Full execution log
│   ├── oirschot.log           # Municipality logs
│   └── tilburg.log
├── results/
│   ├── oirschot/
│   │   ├── overview.md        # Monthly overview
│   │   ├── meetings.json      # All meetings data
│   │   └── meetings/
│   │       ├── 2025-10-03-gemeenteraad.md
│   │       ├── 2025-10-03-gemeenteraad.json
│   │       ├── 2025-10-03-gemeenteraad-agenda.md
│   │       └── 2025-10-03-gemeenteraad-documents.md
│   └── tilburg/
│       └── ...
└── artifacts/
    ├── screenshots/
    └── browserbase-sessions.json
```

---

## 🧪 Testing Workflow

### 1. Run Monthly Test

```bash
npm run test:monthly
```

### 2. Review Summary

```bash
cat output/latest/summary.md
```

### 3. Validate Results

- Open municipality website
- Compare meeting count
- Spot-check 3 random meetings
- Verify document URLs

### 4. Check Logs

```bash
cat output/latest/logs/test-execution.log
```

---

## 📚 Documentation

- **[Implementation Roadmap](../../docs/politeia/IMPLEMENTATION-ROADMAP.md)** - Complete implementation plan
- **[Executive Summary](../../docs/politeia/IMPLEMENTATION-SUMMARY.md)** - Quick overview
- **[Testing Overview](../../docs/politeia/10-testing/testing-overview.md)** - Testing architecture
- **[Quick Reference](../../docs/politeia/10-testing/quick-reference.md)** - CLI cheat sheet

---

## 🚧 Development Status

### Phase 0: Project Setup ✅
- [x] Project structure created
- [x] Dependencies configured
- [x] Environment setup
- [ ] Initial build test

### Phase 1: NOTUBIZ/Oirschot 🚧
- [ ] Core scraper engine
- [ ] NOTUBIZ adapter
- [ ] Test runner
- [ ] Output generation
- [ ] Logging system
- [ ] Session monitoring

### Phase 2: IBIS/Tilburg 📋
- [ ] IBIS adapter
- [ ] Multi-platform support
- [ ] Comparative testing

### Phase 3: Demo & Documentation 📋
- [ ] Interactive demo
- [ ] Performance dashboard
- [ ] Presentation materials

---

## 🤝 Contributing

This is an internal project. For questions or contributions, contact the development team.

---

## 📞 Support

- **Issues:** Create issue in repository
- **Documentation:** See `docs/politeia/`
- **Questions:** Contact project team

---

## 📝 License

MIT

---

**Project Lead:** Politeia Team
**Started:** January 6, 2026
**Current Phase:** Phase 0 - Setup

---

[← Back to Main Documentation](../../docs/politeia/README.md)
