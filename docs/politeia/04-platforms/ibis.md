# IBIS Platform Configuration

Complete configuration documentation for the IBIS platform.

---

## Overview

**IBIS** is a meeting management system used by major Dutch cities including Amsterdam, Rotterdam, and The Hague.

### Characteristics

- **Vendor:** IBIS
- **URL Pattern:** `https://{municipality}.ibabs.eu`
- **Rendering:** Mixed (server-side + JavaScript)
- **JavaScript Required:** Yes (for some features)
- **Version:** Current configuration targets IBIS 2025 version

---

## Configuration Schema

```yaml
platform:
  type: IBIS
  version: "0.9.0"
  vendor: IBIS

baseUrl: "https://{municipality}.ibabs.eu"

features:
  - meetings-list
  - meeting-details
  # Note: attachment extraction pending validation

selectors:
  calendar:
    container: ".meeting-calendar"
    meetingList: ".meeting-list"
    meetingItem: ".meeting-item"
    meetingLink: 'a[href*="/vergadering/"]'

  meetingList:
    container: ".meetings-overview"
    items: ".meeting-row"
    title: ".meeting-title"
    date: ".meeting-date"
    time: ".meeting-time"
    status: ".meeting-status"

  meetingDetails:
    mainContent: "#meeting-content"
    header: ".meeting-header"
    title: "h1.meeting-title"
    metadata: ".meeting-info"
    agendaContainer: "#agenda-container"
    agendaItem: ".agenda-item"
    agendaNumber: ".item-number"
    agendaTitle: ".item-title"
    agendaDescription: ".item-description"
    attachmentsContainer: "#attachments"
    attachment: ".attachment-link"

extraction:
  meetingIdPattern: "/vergadering/([0-9]+)"
  dateFormat: "DD-MM-YYYY"
  timeFormat: "HH:mm"
```

---

## IBIS vs NOTUBIZ Comparison

### Key Differences

| Feature | NOTUBIZ | IBIS |
|---------|---------|------|
| **URL Pattern** | `/Agenda/Index/{uuid}` | `/vergadering/{numeric-id}` |
| **Meeting ID** | UUID (36 chars) | Numeric (6-8 digits) |
| **Calendar Nav** | Dropdowns | Calendar widget |
| **Metadata** | `<dl>` definition list | Structured divs |
| **Agenda Items** | Nested divs | Flat list with levels |
| **JavaScript** | Optional | Required for calendar |
| **Load Time** | Fast (1-2s) | Slower (3-5s) |

### Selector Comparison

| Element | NOTUBIZ | IBIS |
|---------|---------|------|
| **Month Selector** | `#CurrentMonth` | `.calendar-month` |
| **Year Selector** | `#CurrentYear` | `.calendar-year` |
| **Meeting Links** | `a[href*="/Agenda/Index/"]` | `a[href*="/vergadering/"]` |
| **Metadata** | `<dl><dt><dd>` | `.meeting-info > div` |
| **Agenda Items** | `.agendapunt` | `.agenda-item` |

---

## Meeting List Extraction

### HTML Structure

**IBIS Meeting List:**
```html
<div class="meetings-overview">
  <div class="meeting-row">
    <a href="/vergadering/1234567">
      <span class="meeting-title">Raadsvergadering</span>
      <span class="meeting-date">15-10-2025</span>
      <span class="meeting-time">19:00 - 22:00</span>
      <span class="meeting-status">Gepland</span>
    </a>
  </div>
</div>
```

### Extraction Code

```typescript
async function extractIbisMeetings(page: Page): Promise<Meeting[]> {
  return await page.evaluate(() => {
    const meetingItems = document.querySelectorAll('.meeting-row a');
    const meetings: Meeting[] = [];

    meetingItems.forEach(item => {
      const href = item.getAttribute('href') || '';
      const id = href.match(/\/vergadering\/(\d+)/)?.[1] || '';

      meetings.push({
        id,
        title: item.querySelector('.meeting-title')?.textContent?.trim() || '',
        date: item.querySelector('.meeting-date')?.textContent?.trim() || '',
        time: item.querySelector('.meeting-time')?.textContent?.trim() || '',
        status: item.querySelector('.meeting-status')?.textContent?.trim() || '',
        url: window.location.origin + href
      });
    });

    return meetings;
  });
}
```

---

## Meeting Details Page

### Page Structure

**IBIS Details Layout:**
```html
<div id="meeting-content">
  <div class="meeting-header">
    <h1 class="meeting-title">Raadsvergadering</h1>
    <div class="meeting-info">
      <div class="info-item">
        <span class="label">Datum:</span>
        <span class="value">15 oktober 2025</span>
      </div>
      <div class="info-item">
        <span class="label">Tijd:</span>
        <span class="value">19:00 - 22:00</span>
      </div>
      <div class="info-item">
        <span class="label">Locatie:</span>
        <span class="value">Raadzaal</span>
      </div>
    </div>
  </div>

  <div id="agenda-container">
    <div class="agenda-item" data-level="1">
      <span class="item-number">1</span>
      <span class="item-title">Opening</span>
    </div>
    <div class="agenda-item" data-level="2">
      <span class="item-number">1.1</span>
      <span class="item-title">Welkom</span>
    </div>
  </div>

  <div id="attachments">
    <a href="/document/download/abc123" class="attachment-link">
      Agenda.pdf
    </a>
  </div>
</div>
```

### Metadata Extraction

```typescript
async function extractIbisMetadata(page: Page): Promise<Record<string, string>> {
  return await page.evaluate(() => {
    const infoItems = document.querySelectorAll('.info-item');
    const metadata: Record<string, string> = {};

    infoItems.forEach(item => {
      const label = item.querySelector('.label')?.textContent?.trim().replace(':', '') || '';
      const value = item.querySelector('.value')?.textContent?.trim() || '';
      metadata[label] = value;
    });

    return metadata;
  });
}
```

---

## Agenda Items Extraction

### IBIS Nesting Model

IBIS uses **data-level** attribute for hierarchy:

```html
<div class="agenda-item" data-level="1">
  <span class="item-number">1</span>
  <span class="item-title">Opening</span>
</div>

<div class="agenda-item" data-level="2">
  <span class="item-number">1.1</span>
  <span class="item-title">Welkom</span>
</div>

<div class="agenda-item" data-level="2">
  <span class="item-number">1.2</span>
  <span class="item-title">Mededelingen</span>
</div>

<div class="agenda-item" data-level="1">
  <span class="item-number">2</span>
  <span class="item-title">Hamerstukken</span>
</div>
```

### Extraction with Hierarchy

```typescript
interface IbisAgendaItem {
  index: number;
  number: string;
  title: string;
  level: number;
  parentIndex?: number;
}

async function extractIbisAgendaItems(page: Page): Promise<IbisAgendaItem[]> {
  return await page.evaluate(() => {
    const items = document.querySelectorAll('.agenda-item');
    const results: IbisAgendaItem[] = [];
    const levelStack: number[] = [];

    items.forEach((item, index) => {
      const level = parseInt(item.getAttribute('data-level') || '1');
      const number = item.querySelector('.item-number')?.textContent?.trim() || '';
      const title = item.querySelector('.item-title')?.textContent?.trim() || '';

      // Determine parent
      let parentIndex: number | undefined;
      if (level > 1) {
        // Find most recent item with level = current level - 1
        for (let i = results.length - 1; i >= 0; i--) {
          if (results[i].level === level - 1) {
            parentIndex = i;
            break;
          }
        }
      }

      results.push({
        index,
        number,
        title,
        level,
        parentIndex
      });
    });

    return results;
  });
}
```

---

## Calendar Navigation

### IBIS Calendar Widget

IBIS uses a JavaScript calendar widget instead of dropdowns:

```html
<div class="meeting-calendar">
  <div class="calendar-header">
    <button class="prev-month">&lt;</button>
    <span class="calendar-month">Oktober</span>
    <span class="calendar-year">2025</span>
    <button class="next-month">&gt;</button>
  </div>

  <div class="calendar-grid">
    <!-- Calendar days -->
  </div>
</div>
```

### Navigation Code

```typescript
async function navigateToMonth(page: Page, month: number, year: number) {
  // Wait for calendar widget
  await page.waitForSelector('.meeting-calendar');

  // Click until we reach target month/year
  while (true) {
    const currentMonth = await page.$eval('.calendar-month',
      el => el.textContent?.trim()
    );
    const currentYear = await page.$eval('.calendar-year',
      el => parseInt(el.textContent?.trim() || '0')
    );

    const monthNames = ['Januari', 'Februari', 'Maart', ...];
    const targetMonthName = monthNames[month];

    if (currentMonth === targetMonthName && currentYear === year) {
      break;
    }

    // Navigate forward or backward
    if (currentYear < year || (currentYear === year && monthNames.indexOf(currentMonth) < month)) {
      await page.click('.next-month');
    } else {
      await page.click('.prev-month');
    }

    await page.waitForTimeout(500); // Wait for calendar to update
  }
}
```

---

## Example Municipalities

### Active IBIS Municipalities

| Municipality | Province | Base URL | Population |
|--------------|----------|----------|------------|
| **Amsterdam** | Noord-Holland | https://amsterdam.ibabs.eu | 900,000+ |
| **Rotterdam** | Zuid-Holland | https://rotterdam.ibabs.eu | 650,000+ |
| **Den Haag** | Zuid-Holland | https://denhaag.ibabs.eu | 550,000+ |
| **Utrecht** | Utrecht | https://utrecht.ibabs.eu | 360,000+ |
| **Almere** | Flevoland | https://almere.ibabs.eu | 215,000+ |

---

## Migration from NOTUBIZ

### Configuration Changes

```typescript
// Before (NOTUBIZ)
const config = {
  platformType: 'NOTUBIZ',
  baseUrl: 'https://oirschot.bestuurlijkeinformatie.nl',
  selectors: {
    calendar: {
      monthDropdown: '#CurrentMonth',
      yearDropdown: '#CurrentYear'
    }
  }
};

// After (IBIS)
const config = {
  platformType: 'IBIS',
  baseUrl: 'https://amsterdam.ibabs.eu',
  selectors: {
    calendar: {
      monthSelector: '.calendar-month',
      yearSelector: '.calendar-year',
      nextButton: '.next-month',
      prevButton: '.prev-month'
    }
  }
};
```

### Code Adaptation

```typescript
async function scrapeMeetingsList(
  config: MunicipalityConfig,
  month: number,
  year: number
): Promise<Meeting[]> {
  if (config.platformType === 'NOTUBIZ') {
    return scrapeNotubizMeetings(config, month, year);
  } else if (config.platformType === 'IBIS') {
    return scrapeIbisMeetings(config, month, year);
  }

  throw new Error(`Unsupported platform: ${config.platformType}`);
}
```

---

## Known Limitations

### Current Status

**Validated:**
- ✅ Meeting list extraction
- ✅ Meeting details page structure
- ✅ Metadata extraction
- ✅ Agenda items (basic)

**Pending Validation:**
- ⏳ Attachment extraction
- ⏳ Nested agenda items (complex hierarchies)
- ⏳ Calendar navigation (all municipalities)
- ⏳ Status detection

**Not Supported:**
- ❌ Video recordings extraction
- ❌ Live streaming integration
- ❌ Voting results (requires separate API)

---

## Error Handling

### IBIS-Specific Errors

#### 1. Calendar Widget Not Loaded

**Error:**
```
TimeoutError: Waiting for selector '.meeting-calendar' failed
```

**Solution:**
```typescript
try {
  await page.waitForSelector('.meeting-calendar', { timeout: 10000 });
} catch (error) {
  // Try alternative selector
  await page.waitForSelector('.calendar-container', { timeout: 5000 });
}
```

#### 2. JavaScript Required

**Error:**
```
Meeting list is empty (JavaScript not executed)
```

**Solution:**
- **MUST use Browserbase** for IBIS
- Direct HTTP + Cheerio will NOT work
- Enable JavaScript in browser context

```typescript
const stagehand = new Stagehand({
  env: 'BROWSERBASE',
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  browserOptions: {
    headless: true,
    // JavaScript is enabled by default
  }
});
```

---

## Performance Considerations

### Load Times

| Operation | NOTUBIZ | IBIS | Reason |
|-----------|---------|------|--------|
| **Page Load** | 1-2s | 3-5s | JavaScript execution |
| **Calendar Nav** | Instant | 0.5-1s | AJAX requests |
| **Total Scrape** | 4-6s | 8-12s | Cumulative |

### Optimization Tips

1. **Reuse Browser Sessions**
```typescript
// Instead of new session per municipality
const stagehand = await createSession();
for (const municipality of ibisMunicipalities) {
  await scrapeMunicipality(stagehand, municipality);
}
await stagehand.close();
```

2. **Parallel Scraping**
```typescript
// Scrape multiple IBIS municipalities in parallel
const promises = municipalities.map(m =>
  scrapeMunicipality(m)
);
const results = await Promise.all(promises);
```

3. **Cache Calendar Data**
```typescript
// Calendar structure rarely changes
const calendarHtml = await redis.get(`ibis:calendar:${municipality}`);
if (!calendarHtml) {
  const html = await page.content();
  await redis.set(`ibis:calendar:${municipality}`, html, 'EX', 86400);
}
```

---

## Testing Strategy

### Validation Checklist

- [ ] Calendar widget detection
- [ ] Calendar navigation (forward/backward)
- [ ] Meeting list extraction
- [ ] Meeting ID parsing (numeric)
- [ ] Meeting details page load
- [ ] Metadata extraction (structured divs)
- [ ] Agenda items with levels
- [ ] Parent-child relationships
- [ ] Attachments (pending)
- [ ] Multi-municipality testing

### Test Script

```typescript
async function validateIbisMunicipality(config: MunicipalityConfig) {
  const results = {
    calendarWidget: false,
    navigation: false,
    meetingsExtracted: 0,
    detailsScraped: 0,
    errors: []
  };

  const stagehand = new Stagehand({ /* config */ });

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];

    await page.goto(config.baseUrl);

    // Check calendar widget
    const hasCalendar = await page.$('.meeting-calendar');
    results.calendarWidget = !!hasCalendar;

    // Test navigation
    await navigateToMonth(page, 10, 2025);
    results.navigation = true;

    // Extract meetings
    const meetings = await extractIbisMeetings(page);
    results.meetingsExtracted = meetings.length;

    // Test details
    for (const meeting of meetings.slice(0, 2)) {
      await page.goto(`${config.baseUrl}/vergadering/${meeting.id}`);
      const metadata = await extractIbisMetadata(page);
      const agendaItems = await extractIbisAgendaItems(page);

      if (metadata && agendaItems.length > 0) {
        results.detailsScraped++;
      }
    }

  } catch (error) {
    results.errors.push(error.message);
  } finally {
    await stagehand.close();
  }

  return results;
}
```

---

## Related Documentation

- [NOTUBIZ Platform](./notubiz.md)
- [Version Management](./version-management.md)
- [Adding New Platforms](./adding-new-platforms.md)
- [Browserbase Integration](../05-browserbase/session-management.md)

---

[← Back to Documentation Index](../README.md)
