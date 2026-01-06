# Testing & Validation Overview

Comprehensive testing and validation system for Politeia with self-contained sandbox environment.

---

## Overview

The testing system enables independent validation of Politeia's scraping functionality without requiring external system integration. Testers can run validation tests against real municipality websites and compare results with actual data.

**Key Features:**
- ✅ Self-contained test execution
- ✅ Real municipality website validation
- ✅ Reproducible test results with timestamps
- ✅ Human-readable output (Markdown)
- ✅ Machine-readable output (JSON)
- ✅ Comprehensive logs for debugging
- ✅ Monthly test runs for regression detection

---

## Testing Architecture

```mermaid
graph TB
    subgraph "Test Execution"
        TestRunner[Test Runner]
        Config[Test Configuration]
        Validator[Result Validator]
    end

    subgraph "Politeia Service"
        API[Politeia API]
        Engine[Scraper Engine]
        BB[Browserbase]
    end

    subgraph "Real Websites"
        NOTUBIZ[NOTUBIZ Site<br/>Oirschot]
        IBIS[IBIS Site<br/>Best]
    end

    subgraph "Output Repository"
        OutputDir[output/{timestamp}/]
        Logs[logs/]
        Results[results/]
        Artifacts[artifacts/]
    end

    TestRunner --> Config
    TestRunner --> API
    API --> Engine
    Engine --> BB
    BB --> NOTUBIZ
    BB --> IBIS

    API --> Results
    TestRunner --> Validator
    Validator --> Results

    Results --> OutputDir
    OutputDir --> Logs
    OutputDir --> Results
    OutputDir --> Artifacts
```

---

## Test Municipalities

### NOTUBIZ: Oirschot

**URL:** https://oirschot.bestuurlijkeinformatie.nl

**Platform:** NOTUBIZ v2.0.0

**Why Oirschot:**
- Relatively small municipality (consistent data)
- Regular meeting schedule
- Good document availability
- Stable website structure
- Active use of agenda items

**Typical Monthly Meetings:** 2-4

### IBIS: Best

**URL:** https://best.raadsinformatie.nl

**Platform:** IBIS v1.0.0

**Why Best:**
- Medium-sized municipality
- Comprehensive agenda structures
- Multiple document types
- Well-structured IBIS implementation
- Adjacent to Oirschot (similar governance structure)

**Typical Monthly Meetings:** 3-6

---

## Test Types

### 1. Sandbox Tests (Automated)

**Purpose:** Validate basic functionality without external dependencies

**Scope:**
- Configuration loading
- Date parsing
- Selector validation
- Error handling
- Data normalization

**Execution:** `npm run test:sandbox`

### 2. Integration Tests (Semi-automated)

**Purpose:** Validate against real websites

**Scope:**
- Full scraping workflow
- Real Browserbase sessions
- Actual municipality websites
- Result validation

**Execution:** `npm run test:integration`

### 3. Monthly Validation Tests (Manual/Scheduled)

**Purpose:** Monthly regression testing with recent data

**Scope:**
- Most recently completed month
- All meetings from test municipalities
- Full agenda and document extraction
- Human validation possible

**Execution:** `npm run test:monthly`

---

## Output Structure

### Directory Layout

```
output/
├── 2025-10-15T14-30-00Z/          # Timestamp of test run
│   ├── metadata.json              # Test run metadata
│   ├── summary.md                 # Human-readable summary
│   ├── logs/
│   │   ├── test-execution.log     # Full execution log
│   │   ├── oirschot.log           # NOTUBIZ test logs
│   │   └── best.log               # IBIS test logs
│   ├── results/
│   │   ├── oirschot/
│   │   │   ├── overview.md        # Monthly overview
│   │   │   ├── meetings.json      # All meetings (machine-readable)
│   │   │   └── meetings/
│   │   │       ├── 2025-10-03-gemeenteraad.md
│   │   │       ├── 2025-10-03-gemeenteraad.json
│   │   │       ├── 2025-10-03-gemeenteraad-agenda.md
│   │   │       ├── 2025-10-03-gemeenteraad-documents.md
│   │   │       ├── 2025-10-17-gemeenteraad.md
│   │   │       └── ...
│   │   └── best/
│   │       ├── overview.md
│   │       ├── meetings.json
│   │       └── meetings/
│   │           └── ...
│   └── artifacts/
│       ├── screenshots/           # Session screenshots
│       └── browserbase-sessions/  # Session recordings URLs
```

### metadata.json

```json
{
  "testRunId": "2025-10-15T14-30-00Z",
  "executedAt": "2025-10-15T14:30:00.000Z",
  "testType": "monthly-validation",
  "testedMonth": {
    "month": 9,
    "year": 2025,
    "label": "October 2025"
  },
  "municipalities": [
    {
      "id": "oirschot",
      "name": "Oirschot",
      "platform": "NOTUBIZ",
      "platformVersion": "2.0.0"
    },
    {
      "id": "best",
      "name": "Best",
      "platform": "IBIS",
      "platformVersion": "1.0.0"
    }
  ],
  "configuration": {
    "browserbase": {
      "projectId": "prj_xxx",
      "sessionTimeout": 60000
    },
    "politeia": {
      "version": "1.0.0",
      "apiEndpoint": "http://localhost:3000"
    }
  },
  "results": {
    "totalMeetings": 7,
    "totalAgendaItems": 45,
    "totalDocuments": 128,
    "successRate": 100,
    "failedMeetings": []
  },
  "duration": {
    "total": 245000,
    "perMunicipality": {
      "oirschot": 120000,
      "best": 125000
    }
  }
}
```

### summary.md

```markdown
# Test Run Summary

**Test ID:** 2025-10-15T14-30-00Z
**Executed:** October 15, 2025 at 14:30:00 UTC
**Test Type:** Monthly Validation (October 2025)

## Overview

✅ **SUCCESS** - All municipalities tested successfully

| Municipality | Platform | Meetings | Agenda Items | Documents | Status |
|--------------|----------|----------|--------------|-----------|--------|
| Oirschot     | NOTUBIZ v2.0.0 | 3 | 18 | 52 | ✅ PASS |
| Best         | IBIS v1.0.0    | 4 | 27 | 76 | ✅ PASS |

## Execution Details

- **Total Duration:** 4m 5s
- **Success Rate:** 100%
- **Failed Meetings:** 0

## Validation Instructions

To validate results:

1. **Compare with actual websites:**
   - Oirschot: https://oirschot.bestuurlijkeinformatie.nl
   - Best: https://best.raadsinformatie.nl

2. **Check meeting counts:** Verify total meetings matches website calendar

3. **Spot-check meeting details:** Open random meetings and compare:
   - Meeting title and date
   - Agenda item count and titles
   - Document availability

4. **Review logs:** Check `logs/` directory for any warnings or errors

## Next Steps

- [ ] Manual validation completed
- [ ] Results approved
- [ ] Issues documented (if any)
- [ ] Archive test run
```

---

## Validation Process

### Automated Validation

```typescript
// tests/validators/meeting-validator.ts
interface ValidationRule {
  name: string;
  validate: (meeting: Meeting) => ValidationResult;
}

const VALIDATION_RULES: ValidationRule[] = [
  {
    name: 'Meeting has title',
    validate: (m) => ({
      passed: !!m.title && m.title.length > 0,
      message: 'Meeting must have a title'
    })
  },
  {
    name: 'Meeting has valid date',
    validate: (m) => ({
      passed: m.date instanceof Date && !isNaN(m.date.getTime()),
      message: 'Meeting must have a valid date'
    })
  },
  {
    name: 'Meeting has agenda items',
    validate: (m) => ({
      passed: m.agendaItems && m.agendaItems.length > 0,
      message: 'Meeting should have at least one agenda item'
    })
  },
  {
    name: 'Documents have valid URLs',
    validate: (m) => ({
      passed: m.documents.every(d => d.url.startsWith('http')),
      message: 'All documents must have valid URLs'
    })
  }
];
```

### Manual Validation Checklist

```markdown
## Manual Validation Checklist

### For Each Municipality:

- [ ] **Meeting Count Matches**
  - Open municipality website calendar for tested month
  - Count total meetings listed
  - Compare with `overview.md` meeting count
  - ✅ Match / ❌ Mismatch (document difference)

- [ ] **Random Meeting Spot Check** (3 meetings)
  - Pick 3 random meetings from results
  - Open actual meeting page on website
  - Compare:
    - [ ] Meeting title matches exactly
    - [ ] Meeting date matches
    - [ ] Meeting time matches
    - [ ] Agenda item count matches
    - [ ] First and last agenda item titles match
    - [ ] Document count is similar (±2 documents acceptable)

- [ ] **Document Accessibility**
  - Open 5 random document URLs from results
  - Verify:
    - [ ] URLs are valid (not 404)
    - [ ] Documents download/open correctly
    - [ ] Document titles match actual filenames

- [ ] **Data Quality**
  - Check `meetings.json` structure
  - Verify:
    - [ ] All required fields present
    - [ ] Dates in ISO 8601 format
    - [ ] No null/undefined values in required fields

### Overall Assessment:

- [ ] All automated tests passed
- [ ] Manual spot checks completed
- [ ] No critical discrepancies found
- [ ] Minor discrepancies documented (if any)
- [ ] Test run approved for baseline

**Validated by:** _______________
**Date:** _______________
**Notes:**
```

---

## Running Tests

### Setup

```bash
# Install dependencies
npm install

# Configure test environment
cp .env.example .env.test

# Set required variables
BROWSERBASE_API_KEY=bb_your_key
BROWSERBASE_PROJECT_ID=prj_your_project
```

### Execute Monthly Validation

```bash
# Run full monthly validation for most recent completed month
npm run test:monthly

# Run for specific month/year
npm run test:monthly -- --month=9 --year=2025

# Run for specific municipality only
npm run test:monthly -- --municipality=oirschot

# Verbose output
npm run test:monthly -- --verbose
```

### Execute Quick Validation

```bash
# Quick validation (fewer meetings, faster)
npm run test:quick

# Single meeting validation
npm run test:meeting -- --url="https://oirschot.bestuurlijkeinformatie.nl/Vergaderingen/..."
```

---

## Output Formats

### meetings.json (Machine-Readable)

```json
{
  "municipality": "oirschot",
  "month": 9,
  "year": 2025,
  "scrapedAt": "2025-10-15T14:30:00.000Z",
  "meetingsCount": 3,
  "meetings": [
    {
      "id": "meeting-001",
      "title": "Gemeenteraad",
      "date": "2025-10-03T19:30:00.000Z",
      "location": "Raadzaal",
      "status": "Definitief",
      "url": "https://oirschot.bestuurlijkeinformatie.nl/...",
      "agendaItemsCount": 8,
      "documentsCount": 15,
      "agendaItems": [
        {
          "number": "1",
          "title": "Opening",
          "description": null
        },
        {
          "number": "2",
          "title": "Vaststellen agenda",
          "description": "De raad wordt voorgesteld de agenda vast te stellen"
        }
      ],
      "documents": [
        {
          "title": "Agenda",
          "type": "Agenda",
          "url": "https://...",
          "size": 245760
        }
      ]
    }
  ]
}
```

### overview.md (Human-Readable)

```markdown
# Oirschot - October 2025 Meetings

**Platform:** NOTUBIZ v2.0.0
**Scraped:** October 15, 2025 at 14:30:00 UTC
**Total Meetings:** 3

## Meetings

### 1. Gemeenteraad - October 3, 2025

**Time:** 19:30
**Location:** Raadzaal
**Status:** Definitief
**URL:** https://oirschot.bestuurlijkeinformatie.nl/Vergaderingen/...

**Agenda Items:** 8
**Documents:** 15

**Agenda Overview:**
1. Opening
2. Vaststellen agenda
3. Vragenhalfuurtje inwoners
4. Mededelingen en ingekomen stukken
5. Vaststellen verslag vorige vergadering
6. Besluitenlijst
7. Hamerstukken
8. Bespreekstukken

**Key Documents:**
- Agenda (245 KB)
- Vergaderstukken (1.2 MB)
- Besluitenlijst vorige vergadering (180 KB)

---

### 2. Gemeenteraad - October 17, 2025

...
```

---

## Continuous Testing

### GitHub Actions Workflow

```yaml
# .github/workflows/monthly-validation.yml
name: Monthly Validation

on:
  schedule:
    # Run on the 5th of each month at 2 AM UTC
    - cron: '0 2 5 * *'
  workflow_dispatch:  # Allow manual trigger

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run monthly validation
        env:
          BROWSERBASE_API_KEY: ${{ secrets.BROWSERBASE_API_KEY }}
          BROWSERBASE_PROJECT_ID: ${{ secrets.BROWSERBASE_PROJECT_ID }}
        run: npm run test:monthly

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: validation-results
          path: output/
          retention-days: 90

      - name: Create issue if failed
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Monthly validation failed',
              body: 'Automated monthly validation failed. Check workflow logs.'
            })
```

---

## Related Documentation

- [Testing Implementation](./testing-implementation.md)
- [Output Format Specification](./output-format.md)
- [Validation Examples](./validation-examples.md)
- [CI/CD Integration](./cicd-integration.md)

---

[← Back to Documentation Index](../README.md)
