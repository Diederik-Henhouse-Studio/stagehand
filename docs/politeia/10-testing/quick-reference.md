# Testing Quick Reference

Quick reference guide for running and validating Politeia tests.

---

## Quick Start

### Run Monthly Validation

```bash
# Test most recently completed month (automatic)
npm run test:monthly

# Test specific month
npm run test:monthly -- --month=9 --year=2025

# Test single municipality
npm run test:monthly -- --municipality=oirschot

# Verbose output
npm run test:monthly -- --verbose
```

### Output Location

```
output/
└── 2025-10-15T14-30-00Z/     # Your test run
    ├── metadata.json          # Test metadata
    ├── summary.md             # Human-readable summary
    ├── logs/                  # Execution logs
    ├── results/               # Test results per municipality
    └── artifacts/             # Screenshots, session URLs
```

---

## Test Municipalities

| Municipality | Platform | URL | Typical Meetings/Month |
|--------------|----------|-----|------------------------|
| **Oirschot** | NOTUBIZ v2.0.0 | [Link](https://oirschot.bestuurlijkeinformatie.nl) | 2-4 |
| **Best** | IBIS v1.0.0 | [Link](https://best.raadsinformatie.nl) | 3-6 |

---

## Validation Workflow

### 1. Run Test
```bash
npm run test:monthly
```

### 2. Check Summary
```bash
cat output/2025-10-15T14-30-00Z/summary.md
```

### 3. Verify Meeting Count
- Open municipality website calendar
- Compare total meetings with results

### 4. Spot Check (3 random meetings)
For each meeting:
- ✅ Title matches
- ✅ Date matches
- ✅ Agenda item count matches (±1 acceptable)
- ✅ Documents count similar (±2 acceptable)

### 5. Test Documents (5 random)
- ✅ URLs work (no 404)
- ✅ PDFs open correctly
- ✅ File sizes reasonable

### 6. Review Logs
```bash
cat output/2025-10-15T14-30-00Z/logs/test-execution.log
```
Look for warnings or errors

### 7. Approve or Reject
- ✅ **Approve:** 100% success rate, spot checks pass
- ⚠️ **Review:** 90-99% success rate, minor issues
- ❌ **Reject:** <90% success rate, major discrepancies

---

## Output Files Explanation

### Per Municipality

```
results/oirschot/
├── overview.md                    # Monthly overview (human-readable)
├── meetings.json                  # All meetings (machine-readable)
└── meetings/
    ├── 2025-10-03-gemeenteraad.md         # Complete meeting
    ├── 2025-10-03-gemeenteraad.json       # Meeting data (JSON)
    ├── 2025-10-03-gemeenteraad-agenda.md  # Agenda only
    └── 2025-10-03-gemeenteraad-documents.md  # Documents only
```

### Key Files

- **metadata.json** - Test run metadata, execution times, overall results
- **summary.md** - Human-readable summary with validation instructions
- **overview.md** - Monthly meeting overview per municipality
- **meetings.json** - Complete machine-readable meeting data
- **{meeting}.md** - Complete meeting details
- **{meeting}-agenda.md** - Just the agenda items
- **{meeting}-documents.md** - Just the documents list

---

## Common Issues

### Issue: Meeting Count Mismatch

**Symptom:** Test found 3 meetings, website shows 4

**Causes:**
- Future meetings not yet published
- Past meetings archived
- Website date filter different

**Solution:**
1. Check website date range
2. Verify month parameter (0-indexed: Oct = 9)
3. Check meeting status (Concept vs Definitief)

### Issue: Timeout Errors

**Symptom:** `TimeoutError: Navigation timeout exceeded`

**Causes:**
- Website slow/down
- Network issues
- Heavy page with many resources

**Solution:**
```bash
# Increase timeout
export BROWSERBASE_TIMEOUT=60000
npm run test:monthly
```

### Issue: Missing Documents

**Symptom:** Test found fewer documents than expected

**Causes:**
- Documents uploaded after meeting scraped
- Document access restricted
- Selector mismatch

**Solution:**
1. Check actual website
2. Review logs for errors
3. Validate platform configuration

### Issue: Wrong Month

**Symptom:** No meetings found

**Causes:**
- Month parameter incorrect (0-indexed)
- Year parameter incorrect
- No meetings in that month

**Solution:**
```bash
# October = month 9 (not 10!)
npm run test:monthly -- --month=9 --year=2025
```

---

## CLI Options

```bash
npm run test:monthly -- [options]

Options:
  -m, --month <number>       Month to test (0-11), default: previous month
  -y, --year <number>        Year to test, default: current or previous year
  --municipality <id>        Test specific municipality (oirschot, best)
  -v, --verbose              Verbose output
  -h, --help                 Display help
```

---

## Validation Checklist (Quick)

```markdown
Quick Validation Checklist:

Municipality: _____________
Test Run: _____________

- [ ] Meeting count matches website
- [ ] 3 random meetings spot-checked:
  - [ ] Meeting 1: Title, date, agenda ✓
  - [ ] Meeting 2: Title, date, agenda ✓
  - [ ] Meeting 3: Title, date, agenda ✓
- [ ] 5 random documents open correctly
- [ ] No critical errors in logs
- [ ] Data quality checks passed

Result: [ ] Approved  [ ] Needs Review  [ ] Rejected

Notes:
```

---

## Success Criteria

### ✅ PASS Criteria

- Success rate: 100%
- Meeting count matches website (±1 for timing differences)
- Spot checks: All pass
- Document URLs: All valid
- No critical errors in logs

### ⚠️ REVIEW Criteria

- Success rate: 90-99%
- Minor discrepancies (±2 documents)
- Some warnings in logs
- Most spot checks pass

### ❌ FAIL Criteria

- Success rate: <90%
- Major discrepancies in meeting count
- Multiple spot check failures
- Critical errors in logs
- Many invalid document URLs

---

## Useful Commands

```bash
# View test summary
cat output/latest/summary.md

# View meeting count
jq '.meetingsCount' output/latest/results/oirschot/meetings.json

# Count total documents
jq '[.meetings[].documents | length] | add' output/latest/results/oirschot/meetings.json

# Find failed meetings
jq '.results.failedMeetings' output/latest/metadata.json

# View last 20 log lines
tail -n 20 output/latest/logs/test-execution.log

# Search logs for errors
grep -i error output/latest/logs/*.log
```

---

## Environment Variables

```bash
# Required
BROWSERBASE_API_KEY=bb_your_key
BROWSERBASE_PROJECT_ID=prj_your_project

# Optional
BROWSERBASE_TIMEOUT=30000              # Session timeout (ms)
TEST_OUTPUT_DIR=./output               # Output directory
TEST_PARALLEL=false                    # Run municipalities in parallel
LOG_LEVEL=info                         # info, debug, error
```

---

## CI/CD Integration

### GitHub Actions (Manual Trigger)

```yaml
# .github/workflows/test-validation.yml
name: Test Validation
on:
  workflow_dispatch:
    inputs:
      month:
        description: 'Month (0-11)'
        required: false
      year:
        description: 'Year'
        required: false

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:monthly
        env:
          BROWSERBASE_API_KEY: ${{ secrets.BROWSERBASE_API_KEY }}
          BROWSERBASE_PROJECT_ID: ${{ secrets.BROWSERBASE_PROJECT_ID }}
      - uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: output/
```

---

## Related Documentation

- [Testing Overview](./testing-overview.md) - Comprehensive testing guide
- [Testing Implementation](./testing-implementation.md) - Implementation details
- [Validation Examples](./validation-examples.md) - Example outputs
- [Troubleshooting](../09-operations/troubleshooting.md) - Common issues

---

[← Back to Documentation Index](../README.md)
