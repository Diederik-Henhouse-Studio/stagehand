# Validation Examples

Real-world examples of test outputs and validation results for the Politeia testing system.

---

## Example 1: Successful Full Test Run

### Test Metadata

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
      "municipalityId": "oirschot",
      "municipalityName": "Oirschot",
      "platform": "NOTUBIZ",
      "platformVersion": "2.0.0",
      "meetingsCount": 3,
      "totalAgendaItems": 24,
      "totalDocuments": 67,
      "validationsPassed": 3,
      "validationsFailed": 0,
      "status": "success"
    },
    {
      "municipalityId": "best",
      "municipalityName": "Best",
      "platform": "IBIS",
      "platformVersion": "1.0.0",
      "meetingsCount": 4,
      "totalAgendaItems": 31,
      "totalDocuments": 89,
      "validationsPassed": 4,
      "validationsFailed": 0,
      "status": "success"
    }
  ],
  "results": {
    "totalMeetings": 7,
    "totalAgendaItems": 55,
    "totalDocuments": 156,
    "successRate": 100,
    "failedMeetings": []
  },
  "duration": {
    "total": 245000,
    "perMunicipality": {
      "oirschot": 118000,
      "best": 127000
    }
  }
}
```

### Summary Output

```markdown
# Test Run Summary

**Test ID:** 2025-10-15T14-30-00Z
**Executed:** October 15, 2025 at 14:30:00 UTC
**Test Type:** Monthly Validation (October 2025)

## Overview

✅ **SUCCESS** - 100.0% success rate

| Municipality | Platform | Meetings | Agenda Items | Documents | Status |
|--------------|----------|----------|--------------|-----------|--------|
| Oirschot     | NOTUBIZ v2.0.0 | 3 | 24 | 67 | ✅ PASS |
| Best         | IBIS v1.0.0    | 4 | 31 | 89 | ✅ PASS |

## Execution Details

- **Total Duration:** 4.1m
- **Success Rate:** 100.0%
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

## Example 2: Oirschot (NOTUBIZ) Meeting Output

### meetings.json (Excerpt)

```json
{
  "municipality": "oirschot",
  "month": 9,
  "year": 2025,
  "scrapedAt": "2025-10-15T14:30:15.234Z",
  "meetingsCount": 3,
  "meetings": [
    {
      "id": "meeting-001",
      "title": "Gemeenteraad",
      "date": "2025-10-03T19:30:00.000Z",
      "time": "19:30",
      "location": "Raadzaal",
      "status": "Definitief",
      "url": "https://oirschot.bestuurlijkeinformatie.nl/Vergaderingen/Gemeenteraad/2025/03-oktober/19:30",
      "agendaItemsCount": 8,
      "documentsCount": 23,
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
        },
        {
          "number": "3",
          "title": "Vragenhalfuurtje inwoners",
          "description": "Gelegenheid voor inwoners om vragen te stellen aan het college"
        },
        {
          "number": "4",
          "title": "Mededelingen en ingekomen stukken",
          "description": null
        },
        {
          "number": "5",
          "title": "Vaststellen verslag vorige vergadering",
          "description": "Vaststellen verslag raadsvergadering d.d. 19 september 2025"
        },
        {
          "number": "6",
          "title": "Besluitenlijst",
          "description": "Overzicht van besluiten uit de raadsvergadering van 19 september 2025"
        },
        {
          "number": "7",
          "title": "Hamerstukken",
          "description": "Stukken die zonder discussie worden aangenomen"
        },
        {
          "number": "8",
          "title": "Bespreekstukken",
          "description": "8.1 Vaststelling Perspectiefnota 2026\n8.2 Wijziging bestemmingsplan Centrum\n8.3 Krediet renovatie sporthal"
        }
      ],
      "documents": [
        {
          "title": "Agenda",
          "type": "Agenda",
          "url": "https://oirschot.bestuurlijkeinformatie.nl/Documents/Agenda-03102025.pdf",
          "size": 245760
        },
        {
          "title": "Vergaderstukken",
          "type": "Raadsstuk",
          "url": "https://oirschot.bestuurlijkeinformatie.nl/Documents/Vergaderstukken-03102025.pdf",
          "size": 1247854
        },
        {
          "title": "Besluitenlijst vorige vergadering",
          "type": "Besluitenlijst",
          "url": "https://oirschot.bestuurlijkeinformatie.nl/Documents/Besluitenlijst-19092025.pdf",
          "size": 184320
        },
        {
          "title": "Raadsvoorstel Perspectiefnota 2026",
          "type": "Raadsvoorstel",
          "url": "https://oirschot.bestuurlijkeinformatie.nl/Documents/RV-Perspectiefnota-2026.pdf",
          "size": 523478
        }
        // ... 19 more documents
      ]
    }
    // ... 2 more meetings
  ]
}
```

### overview.md

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
**URL:** https://oirschot.bestuurlijkeinformatie.nl/Vergaderingen/Gemeenteraad/2025/03-oktober/19:30

**Agenda Items:** 8
**Documents:** 23

**Agenda Overview:**
1. Opening
2. Vaststellen agenda
3. Vragenhalfuurtje inwoners
4. Mededelingen en ingekomen stukken
5. Vaststellen verslag vorige vergadering

**Key Documents:**
- Agenda (240 KB)
- Vergaderstukken (1.2 MB)
- Besluitenlijst vorige vergadering (180 KB)

---

### 2. Commissievergadering Samenleving - October 10, 2025

**Time:** 20:00
**Location:** Raadzaal
**Status:** Definitief
**URL:** https://oirschot.bestuurlijkeinformatie.nl/Vergaderingen/Commissie-Samenleving/2025/10-oktober/20:00

**Agenda Items:** 6
**Documents:** 15

**Agenda Overview:**
1. Opening en vaststellen agenda
2. Mededelingen
3. Bespreekpunten
4. Jeugdzorg budget 2026
5. Plan aanpak sociale wijkteams

**Key Documents:**
- Agenda commissievergadering (156 KB)
- Notitie jeugdzorg (345 KB)
- Plan sociale wijkteams (678 KB)

---

### 3. Gemeenteraad - October 24, 2025

**Time:** 19:30
**Location:** Raadzaal
**Status:** Concept
**URL:** https://oirschot.bestuurlijkeinformatie.nl/Vergaderingen/Gemeenteraad/2025/24-oktober/19:30

**Agenda Items:** 10
**Documents:** 29

**Agenda Overview:**
1. Opening
2. Vaststellen agenda
3. Vragenhalfuurtje inwoners
4. Mededelingen en ingekomen stukken
5. Vaststellen verslag vorige vergadering
... and 5 more

**Key Documents:**
- Agenda (289 KB)
- Vergaderstukken (2.1 MB)
- Begroting 2026 (3.4 MB)

---
```

### Individual Meeting: 2025-10-03-gemeenteraad.md

```markdown
# Gemeenteraad

**Date:** Thursday, October 3, 2025
**Time:** 19:30
**Location:** Raadzaal
**Status:** Definitief
**URL:** https://oirschot.bestuurlijkeinformatie.nl/Vergaderingen/Gemeenteraad/2025/03-oktober/19:30

## Summary

- **Agenda Items:** 8
- **Documents:** 23

## Agenda

### 1. Opening

### 2. Vaststellen agenda

De raad wordt voorgesteld de agenda vast te stellen

### 3. Vragenhalfuurtje inwoners

Gelegenheid voor inwoners om vragen te stellen aan het college

### 4. Mededelingen en ingekomen stukken

### 5. Vaststellen verslag vorige vergadering

Vaststellen verslag raadsvergadering d.d. 19 september 2025

### 6. Besluitenlijst

Overzicht van besluiten uit de raadsvergadering van 19 september 2025

### 7. Hamerstukken

Stukken die zonder discussie worden aangenomen

### 8. Bespreekstukken

8.1 Vaststelling Perspectiefnota 2026
8.2 Wijziging bestemmingsplan Centrum
8.3 Krediet renovatie sporthal

## Documents

- [Agenda](https://oirschot.bestuurlijkeinformatie.nl/Documents/Agenda-03102025.pdf) (240 KB)
  - Type: Agenda
- [Vergaderstukken](https://oirschot.bestuurlijkeinformatie.nl/Documents/Vergaderstukken-03102025.pdf) (1218 KB)
  - Type: Raadsstuk
- [Besluitenlijst vorige vergadering](https://oirschot.bestuurlijkeinformatie.nl/Documents/Besluitenlijst-19092025.pdf) (180 KB)
  - Type: Besluitenlijst
- [Raadsvoorstel Perspectiefnota 2026](https://oirschot.bestuurlijkeinformatie.nl/Documents/RV-Perspectiefnota-2026.pdf) (511 KB)
  - Type: Raadsvoorstel
... and 19 more documents
```

### Agenda Separate: 2025-10-03-gemeenteraad-agenda.md

```markdown
# Agenda: Gemeenteraad

**Date:** October 3, 2025
**Time:** 19:30

## Agenda Items (8)

### 1. Opening

---

### 2. Vaststellen agenda

De raad wordt voorgesteld de agenda vast te stellen

---

### 3. Vragenhalfuurtje inwoners

Gelegenheid voor inwoners om vragen te stellen aan het college

---

### 4. Mededelingen en ingekomen stukken

---

### 5. Vaststellen verslag vorige vergadering

Vaststellen verslag raadsvergadering d.d. 19 september 2025

---

### 6. Besluitenlijst

Overzicht van besluiten uit de raadsvergadering van 19 september 2025

---

### 7. Hamerstukken

Stukken die zonder discussie worden aangenomen

---

### 8. Bespreekstukken

8.1 Vaststelling Perspectiefnota 2026
8.2 Wijziging bestemmingsplan Centrum
8.3 Krediet renovatie sporthal

---
```

### Documents Separate: 2025-10-03-gemeenteraad-documents.md

```markdown
# Documents: Gemeenteraad

**Total Documents:** 23

## Agenda (1)

1. [Agenda](https://oirschot.bestuurlijkeinformatie.nl/Documents/Agenda-03102025.pdf) - 240 KB

## Raadsstuk (12)

1. [Vergaderstukken](https://oirschot.bestuurlijkeinformatie.nl/Documents/Vergaderstukken-03102025.pdf) - 1218 KB
2. [Raadsvoorstel Perspectiefnota 2026](https://oirschot.bestuurlijkeinformatie.nl/Documents/RV-Perspectiefnota-2026.pdf) - 511 KB
3. [Raadsvoorstel Bestemmingsplan](https://oirschot.bestuurlijkeinformatie.nl/Documents/RV-Bestemmingsplan.pdf) - 867 KB
4. [Raadsvoorstel Krediet Sporthal](https://oirschot.bestuurlijkeinformatie.nl/Documents/RV-Krediet-Sporthal.pdf) - 423 KB
5. [Bijlage Perspectiefnota](https://oirschot.bestuurlijkeinformatie.nl/Documents/Bijlage-Perspectiefnota.pdf) - 234 KB
6. [Advies Rekenkamer](https://oirschot.bestuurlijkeinformatie.nl/Documents/Advies-Rekenkamer.pdf) - 156 KB
... and 6 more

## Besluitenlijst (2)

1. [Besluitenlijst vorige vergadering](https://oirschot.bestuurlijkeinformatie.nl/Documents/Besluitenlijst-19092025.pdf) - 180 KB
2. [Besluitenlijst commissievergadering](https://oirschot.bestuurlijkeinformatie.nl/Documents/Besluitenlijst-Comm-26092025.pdf) - 145 KB

## Notitie (3)

1. [Notitie Budget 2026](https://oirschot.bestuurlijkeinformatie.nl/Documents/Notitie-Budget-2026.pdf) - 198 KB
2. [Notitie Sportvoorzieningen](https://oirschot.bestuurlijkeinformatie.nl/Documents/Notitie-Sport.pdf) - 234 KB
3. [Notitie Participatie](https://oirschot.bestuurlijkeinformatie.nl/Documents/Notitie-Participatie.pdf) - 156 KB

## Bijlage (3)

1. [Bijlage A - Financieel overzicht](https://oirschot.bestuurlijkeinformatie.nl/Documents/Bijlage-A.pdf) - 89 KB
2. [Bijlage B - Kaart bestemmingsplan](https://oirschot.bestuurlijkeinformatie.nl/Documents/Bijlage-B.pdf) - 1234 KB
3. [Bijlage C - Tekeningen sporthal](https://oirschot.bestuurlijkeinformatie.nl/Documents/Bijlage-C.pdf) - 678 KB

## Other (2)

1. [Presentatie Perspectiefnota](https://oirschot.bestuurlijkeinformatie.nl/Documents/Presentatie-Perspectiefnota.pdf) - 456 KB
2. [Overzicht moties](https://oirschot.bestuurlijkeinformatie.nl/Documents/Overzicht-Moties.pdf) - 123 KB
```

---

## Example 3: Test Execution Log

### logs/oirschot.log

```
[2025-10-15T14:30:15.234Z] Starting test for Oirschot
[2025-10-15T14:30:15.235Z] Platform: NOTUBIZ 2.0.0
[2025-10-15T14:30:15.236Z] Base URL: https://oirschot.bestuurlijkeinformatie.nl
[2025-10-15T14:30:16.145Z] Fetching meetings for 9/2025...
[2025-10-15T14:30:23.567Z] Found 3 meetings
[2025-10-15T14:30:23.568Z] Scraping meeting: Gemeenteraad
[2025-10-15T14:30:35.789Z]   ✓ 8 agenda items
[2025-10-15T14:30:35.790Z]   ✓ 23 documents
[2025-10-15T14:30:37.890Z] Scraping meeting: Commissievergadering Samenleving
[2025-10-15T14:30:45.123Z]   ✓ 6 agenda items
[2025-10-15T14:30:45.124Z]   ✓ 15 documents
[2025-10-15T14:30:47.224Z] Scraping meeting: Gemeenteraad
[2025-10-15T14:30:58.456Z]   ✓ 10 agenda items
[2025-10-15T14:30:58.457Z]   ✓ 29 documents
[2025-10-15T14:31:13.234Z] Test completed successfully
```

---

## Example 4: Validation Checklist (Completed)

```markdown
## Manual Validation Checklist - Test Run 2025-10-15T14-30-00Z

### Oirschot (NOTUBIZ v2.0.0):

- [x] **Meeting Count Matches**
  - Website shows: 3 meetings in October 2025
  - Test results: 3 meetings
  - ✅ Match

- [x] **Random Meeting Spot Check** (3 meetings)

  **Meeting 1: Gemeenteraad (Oct 3)**
  - [x] Meeting title matches: "Gemeenteraad" ✅
  - [x] Meeting date matches: Oct 3, 2025 ✅
  - [x] Meeting time matches: 19:30 ✅
  - [x] Agenda item count matches: 8 items ✅
  - [x] First agenda item: "Opening" ✅
  - [x] Last agenda item: "Bespreekstukken" ✅
  - [x] Document count similar: 23 vs ~25 on website (within ±2) ✅

  **Meeting 2: Commissievergadering (Oct 10)**
  - [x] Meeting title matches ✅
  - [x] Meeting date matches ✅
  - [x] Meeting time matches ✅
  - [x] Agenda items correct ✅
  - [x] Documents correct ✅

  **Meeting 3: Gemeenteraad (Oct 24)**
  - [x] Meeting title matches ✅
  - [x] Meeting date matches ✅
  - [x] Status: "Concept" (correctly identified as not final) ✅
  - [x] Agenda items correct ✅
  - [x] Documents correct ✅

- [x] **Document Accessibility**
  - Tested 5 random documents:
    1. Agenda Oct 3 - ✅ Opens correctly (PDF)
    2. Vergaderstukken - ✅ Opens correctly (PDF, 1.2MB)
    3. Perspectiefnota - ✅ Opens correctly
    4. Besluitenlijst - ✅ Opens correctly
    5. Notitie Budget - ✅ Opens correctly
  - All URLs valid, no 404 errors ✅

- [x] **Data Quality**
  - meetings.json structure correct ✅
  - All dates in ISO 8601 format ✅
  - No null values in required fields ✅
  - Agenda item numbering sequential ✅

### Best (IBIS v1.0.0):

- [x] **Meeting Count Matches**
  - Website shows: 4 meetings
  - Test results: 4 meetings
  - ✅ Match

- [x] **Random Meeting Spot Check** (completed for 3 meetings)
  - All checks passed ✅

- [x] **Document Accessibility** - All tested documents accessible ✅
- [x] **Data Quality** - All checks passed ✅

### Overall Assessment:

- [x] All automated tests passed
- [x] Manual spot checks completed
- [x] No critical discrepancies found
- [ ] Minor discrepancies documented: None
- [x] Test run approved for baseline

**Validated by:** Jane Tester
**Date:** October 15, 2025
**Notes:** Excellent results. All scraped data matches actual website content. Document counts have minor variations (±1-2) which is acceptable given dynamic nature of document attachments. Recommended as baseline for future regression testing.
```

---

## Example 5: Failed Test (Partial)

### Metadata with Errors

```json
{
  "testRunId": "2025-11-02T10-15-00Z",
  "executedAt": "2025-11-02T10:15:00.000Z",
  "testType": "monthly-validation",
  "results": {
    "totalMeetings": 6,
    "totalAgendaItems": 42,
    "totalDocuments": 98,
    "successRate": 85.7,
    "failedMeetings": [
      {
        "municipality": "oirschot",
        "meetingId": "meeting-003",
        "error": "TimeoutError: Navigation timeout of 30000 ms exceeded",
        "url": "https://oirschot.bestuurlijkeinformatie.nl/Vergaderingen/..."
      }
    ]
  }
}
```

### Summary with Warnings

```markdown
# Test Run Summary

**Test ID:** 2025-11-02T10-15-00Z
**Executed:** November 2, 2025 at 10:15:00 UTC

## Overview

⚠️ **PARTIAL** - 85.7% success rate

| Municipality | Platform | Meetings | Status |
|--------------|----------|----------|--------|
| Oirschot     | NOTUBIZ v2.0.0 | 2/3 | ⚠️ PARTIAL |
| Best         | IBIS v1.0.0    | 4/4 | ✅ PASS |

## Failed Meetings

### Oirschot - Meeting 3
- **Error:** TimeoutError: Navigation timeout of 30000 ms exceeded
- **URL:** https://oirschot.bestuurlijkeinformatie.nl/Vergaderingen/...
- **Recommendation:** Retry with increased timeout or investigate website performance

## Next Steps

- [ ] Investigate timeout issue for Oirschot meeting
- [ ] Retry failed meeting
- [ ] Update test if website has changed
```

---

## Related Documentation

- [Testing Overview](./testing-overview.md)
- [Testing Implementation](./testing-implementation.md)
- [Output Format Specification](./output-format.md)

---

[← Back to Documentation Index](../README.md)
