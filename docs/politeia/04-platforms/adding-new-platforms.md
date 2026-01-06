# Adding New Platforms

Complete guide for adding support for new governmental or social media platforms.

---

## Overview

Politeia is designed to be extensible. This guide walks through adding a new platform configuration.

**Examples:**
- New governmental portal (e.g., OpenGov, GemeenteOplossingen)
- Social media (YouTube, X/Twitter, Facebook, Instagram)
- Custom municipal websites

---

## Prerequisites

Before adding a new platform, gather:

1. **Platform Information**
   - Platform name and vendor
   - URL pattern(s)
   - Authentication requirements
   - Rate limits
   - Terms of Service

2. **Technical Analysis**
   - Is content server-side rendered or JavaScript-based?
   - What selectors are used?
   - How is data structured?
   - Are there any APIs available?

3. **Sample Data**
   - 3-5 example URLs
   - Expected output format
   - Edge cases

---

## Step 1: Platform Analysis

### Inspect HTML Structure

Visit 3-5 sample pages and analyze:

```bash
# Example: New platform "OpenGov"
curl https://example-municipality.opengov.nl > sample1.html
curl https://another-municipality.opengov.nl > sample2.html
```

**Key Questions:**
- [ ] What's the calendar/list URL pattern?
- [ ] How are meetings identified? (UUID, numeric ID, slug?)
- [ ] What selectors are used for:
  - Meeting links
  - Meeting title
  - Date/time
  - Status
  - Metadata
  - Agenda items
  - Attachments
- [ ] Is JavaScript required?
- [ ] Are there nested structures (agenda sub-items)?

### Create Analysis Document

```markdown
# Platform Analysis: OpenGov

## URLs
- Base: https://{municipality}.opengov.nl
- Calendar: https://{municipality}.opengov.nl/calendar
- Meeting: https://{municipality}.opengov.nl/meeting/{id}

## Meeting Identification
- ID Type: Numeric (6 digits)
- Example: https://example.opengov.nl/meeting/123456

## Selectors
- Meeting Links: `a.meeting-link[href*="/meeting/"]`
- Title: `h1.meeting-title`
- Date: `.meeting-date` (format: DD-MM-YYYY)
- Time: `.meeting-time` (format: HH:mm)
- Metadata: `.info-panel > .info-item`
- Agenda: `#agenda .agenda-item`
- Attachments: `.documents a.doc-link`

## JavaScript Required
No - content is server-side rendered

## Edge Cases
- Cancelled meetings have class `cancelled`
- Some meetings have no agenda (preliminary)
```

---

## Step 2: Create Configuration File

### Configuration Template

```yaml
# config/platforms/opengov/v1.0.0.yaml
platform:
  type: OPENGOV
  version: "1.0.0"
  vendor: OpenGov Solutions
  description: OpenGov municipal meeting system

# Base URL pattern
baseUrl: "https://{municipality}.opengov.nl"

# Supported features
features:
  - meetings-list
  - meeting-details
  - attachments
  - agenda-items

# CSS selectors
selectors:
  # Calendar/List page
  calendar:
    container: ".meetings-calendar"
    meetingLinks: 'a.meeting-link[href*="/meeting/"]'

  # Meeting list items
  meetingList:
    container: ".meetings-list"
    item: ".meeting-item"
    title: ".meeting-title"
    date: ".meeting-date"
    time: ".meeting-time"
    status: ".meeting-status"

  # Meeting details page
  meetingDetails:
    mainContent: "main.meeting-content"
    header: ".meeting-header"
    title: "h1.meeting-title"

    # Metadata section
    metadata: ".info-panel"
    metadataItem: ".info-item"
    metadataLabel: ".label"
    metadataValue: ".value"

    # Agenda
    agendaContainer: "#agenda"
    agendaItem: ".agenda-item"
    agendaNumber: ".item-number"
    agendaTitle: ".item-title"
    agendaDescription: ".item-description"

    # Attachments
    attachmentsContainer: ".documents"
    attachment: "a.doc-link"
    attachmentName: ".doc-name"
    attachmentSize: ".doc-size"

# Extraction rules
extraction:
  # Regex for extracting meeting ID from URL
  meetingIdPattern: "/meeting/(\\d+)"

  # Date/time formats
  dateFormat: "DD-MM-YYYY"
  timeFormat: "HH:mm"

  # Status mapping
  statusMapping:
    "Gepland": "scheduled"
    "Geannuleerd": "cancelled"
    "Afgerond": "completed"

# Browser requirements
browser:
  javascriptRequired: false
  timeout: 30000  # milliseconds
  waitForSelector: ".meeting-content"

# Rate limiting (be respectful!)
rateLimit:
  requestsPerMinute: 10
  requestsPerHour: 100
```

---

## Step 3: Implement Extraction Logic

### Create Platform Adapter

```typescript
// src/platforms/opengov/adapter.ts
import { Page } from 'playwright';
import { PlatformAdapter, Meeting, MeetingDetails } from '../types';

export class OpenGovAdapter implements PlatformAdapter {
  platformType = 'OPENGOV';

  async extractMeetingsList(
    page: Page,
    config: PlatformConfig
  ): Promise<Meeting[]> {
    return await page.evaluate((cfg) => {
      const links = document.querySelectorAll(cfg.selectors.calendar.meetingLinks);
      const meetings: Meeting[] = [];

      links.forEach(link => {
        const href = link.getAttribute('href') || '';
        const idMatch = href.match(new RegExp(cfg.extraction.meetingIdPattern));
        const id = idMatch?.[1] || '';

        meetings.push({
          id,
          source: cfg.municipality.id,
          title: link.querySelector(cfg.selectors.meetingList.title)?.textContent?.trim() || '',
          date: link.querySelector(cfg.selectors.meetingList.date)?.textContent?.trim() || '',
          time: link.querySelector(cfg.selectors.meetingList.time)?.textContent?.trim() || '',
          status: this.mapStatus(
            link.querySelector(cfg.selectors.meetingList.status)?.textContent?.trim() || '',
            cfg.extraction.statusMapping
          ),
          url: window.location.origin + href
        });
      });

      return meetings;
    }, config);
  }

  async extractMeetingDetails(
    page: Page,
    config: PlatformConfig,
    meetingId: string
  ): Promise<MeetingDetails> {
    // Navigate to meeting page
    await page.goto(`${config.baseUrl}/meeting/${meetingId}`);
    await page.waitForSelector(config.selectors.meetingDetails.mainContent);

    // Extract metadata
    const metadata = await this.extractMetadata(page, config);

    // Extract agenda items
    const agendaItems = await this.extractAgendaItems(page, config);

    // Extract attachments
    const attachments = await this.extractAttachments(page, config);

    return {
      meetingId,
      metadata,
      agendaItems,
      attachments
    };
  }

  private async extractMetadata(
    page: Page,
    config: PlatformConfig
  ): Promise<Record<string, string>> {
    return await page.evaluate((cfg) => {
      const items = document.querySelectorAll(cfg.selectors.meetingDetails.metadataItem);
      const metadata: Record<string, string> = {};

      items.forEach(item => {
        const label = item.querySelector(cfg.selectors.meetingDetails.metadataLabel)?.textContent?.trim() || '';
        const value = item.querySelector(cfg.selectors.meetingDetails.metadataValue)?.textContent?.trim() || '';
        metadata[label] = value;
      });

      return metadata;
    }, config);
  }

  private async extractAgendaItems(
    page: Page,
    config: PlatformConfig
  ): Promise<AgendaItem[]> {
    return await page.evaluate((cfg) => {
      const items = document.querySelectorAll(cfg.selectors.meetingDetails.agendaItem);
      const agendaItems: AgendaItem[] = [];

      items.forEach((item, index) => {
        agendaItems.push({
          index,
          number: item.querySelector(cfg.selectors.meetingDetails.agendaNumber)?.textContent?.trim() || '',
          title: item.querySelector(cfg.selectors.meetingDetails.agendaTitle)?.textContent?.trim() || '',
          description: item.querySelector(cfg.selectors.meetingDetails.agendaDescription)?.textContent?.trim()
        });
      });

      return agendaItems;
    }, config);
  }

  private async extractAttachments(
    page: Page,
    config: PlatformConfig
  ): Promise<Attachment[]> {
    return await page.evaluate((cfg) => {
      const links = document.querySelectorAll(cfg.selectors.meetingDetails.attachment);
      const attachments: Attachment[] = [];

      links.forEach(link => {
        const href = link.getAttribute('href') || '';
        const name = link.querySelector(cfg.selectors.meetingDetails.attachmentName)?.textContent?.trim() || '';
        const sizeText = link.querySelector(cfg.selectors.meetingDetails.attachmentSize)?.textContent?.trim();

        attachments.push({
          id: href.split('/').pop() || '',
          name,
          url: window.location.origin + href,
          type: this.detectAttachmentType(name),
          size: this.parseSize(sizeText)
        });
      });

      return attachments;
    }, config);
  }

  private mapStatus(status: string, mapping: Record<string, string>): string {
    return mapping[status] || 'unknown';
  }

  private detectAttachmentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'word';
    if (['xls', 'xlsx'].includes(ext)) return 'excel';
    return 'document';
  }

  private parseSize(sizeText?: string): number | undefined {
    if (!sizeText) return undefined;
    const match = sizeText.match(/(\d+)\s*(KB|MB)/);
    if (!match) return undefined;
    const value = parseInt(match[1]);
    const unit = match[2];
    return value * (unit === 'MB' ? 1024 : 1) * 1024;
  }
}
```

### Register Adapter

```typescript
// src/platforms/registry.ts
import { NotubizAdapter } from './notubiz/adapter';
import { IbisAdapter } from './ibis/adapter';
import { OpenGovAdapter } from './opengov/adapter';  // New

export const platformRegistry = {
  'NOTUBIZ': NotubizAdapter,
  'IBIS': IbisAdapter,
  'OPENGOV': OpenGovAdapter  // Register new platform
};

export function getPlatformAdapter(platformType: string): PlatformAdapter {
  const AdapterClass = platformRegistry[platformType];
  if (!AdapterClass) {
    throw new Error(`Unsupported platform: ${platformType}`);
  }
  return new AdapterClass();
}
```

---

## Step 4: Create Tests

### Test Suite Template

```typescript
// src/platforms/opengov/__tests__/opengov.test.ts
import { OpenGovAdapter } from '../adapter';
import { V3 as Stagehand } from '@browserbasehq/stagehand';

describe('OpenGov Platform', () => {
  let stagehand: Stagehand;
  let adapter: OpenGovAdapter;

  beforeAll(async () => {
    stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID
    });
    await stagehand.init();
    adapter = new OpenGovAdapter();
  });

  afterAll(async () => {
    await stagehand.close();
  });

  describe('Meeting List Extraction', () => {
    it('should extract meetings from calendar page', async () => {
      const page = stagehand.context.pages()[0];
      await page.goto('https://test-municipality.opengov.nl/calendar');

      const meetings = await adapter.extractMeetingsList(page, mockConfig);

      expect(meetings.length).toBeGreaterThan(0);
      expect(meetings[0]).toHaveProperty('id');
      expect(meetings[0]).toHaveProperty('title');
      expect(meetings[0]).toHaveProperty('url');
    });

    it('should parse meeting ID correctly', async () => {
      const page = stagehand.context.pages()[0];
      await page.goto('https://test-municipality.opengov.nl/calendar');

      const meetings = await adapter.extractMeetingsList(page, mockConfig);

      expect(meetings[0].id).toMatch(/^\d{6}$/);  // 6-digit numeric ID
    });
  });

  describe('Meeting Details Extraction', () => {
    it('should extract meeting metadata', async () => {
      const page = stagehand.context.pages()[0];

      const details = await adapter.extractMeetingDetails(page, mockConfig, '123456');

      expect(details.metadata).toBeDefined();
      expect(Object.keys(details.metadata).length).toBeGreaterThan(0);
    });

    it('should extract agenda items', async () => {
      const page = stagehand.context.pages()[0];

      const details = await adapter.extractMeetingDetails(page, mockConfig, '123456');

      expect(details.agendaItems).toBeDefined();
      expect(details.agendaItems.length).toBeGreaterThan(0);
      expect(details.agendaItems[0]).toHaveProperty('number');
      expect(details.agendaItems[0]).toHaveProperty('title');
    });

    it('should extract attachments', async () => {
      const page = stagehand.context.pages()[0];

      const details = await adapter.extractMeetingDetails(page, mockConfig, '123456');

      expect(details.attachments).toBeDefined();
      if (details.attachments.length > 0) {
        expect(details.attachments[0]).toHaveProperty('name');
        expect(details.attachments[0]).toHaveProperty('url');
        expect(details.attachments[0]).toHaveProperty('type');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle cancelled meetings', async () => {
      const page = stagehand.context.pages()[0];
      await page.goto('https://test-municipality.opengov.nl/calendar');

      const meetings = await adapter.extractMeetingsList(page, mockConfig);
      const cancelled = meetings.find(m => m.status === 'cancelled');

      if (cancelled) {
        expect(cancelled.status).toBe('cancelled');
      }
    });

    it('should handle meetings with no agenda', async () => {
      const page = stagehand.context.pages()[0];

      const details = await adapter.extractMeetingDetails(page, mockConfig, '789012');

      expect(details.agendaItems).toBeDefined();
      // Should not throw error even if agenda is empty
    });
  });
});
```

---

## Step 5: Validate with Real Data

### Manual Validation

```typescript
// validation/opengov-validation.ts
import { OpenGovAdapter } from '../src/platforms/opengov/adapter';

async function validateOpenGov() {
  const testMunicipalities = [
    { id: 'test1', baseUrl: 'https://municipality1.opengov.nl' },
    { id: 'test2', baseUrl: 'https://municipality2.opengov.nl' },
    { id: 'test3', baseUrl: 'https://municipality3.opengov.nl' }
  ];

  for (const municipality of testMunicipalities) {
    console.log(`\nValidating ${municipality.id}...`);

    try {
      // Test meeting list
      const meetings = await scrapeMeetingsList(municipality);
      console.log(`  ✓ Found ${meetings.length} meetings`);

      // Test meeting details
      if (meetings.length > 0) {
        const details = await scrapeMeetingDetails(municipality, meetings[0].id);
        console.log(`  ✓ Extracted details:`);
        console.log(`    - Metadata fields: ${Object.keys(details.metadata).length}`);
        console.log(`    - Agenda items: ${details.agendaItems.length}`);
        console.log(`    - Attachments: ${details.attachments.length}`);
      }

    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
    }
  }
}

validateOpenGov();
```

**Expected Output:**
```
Validating test1...
  ✓ Found 5 meetings
  ✓ Extracted details:
    - Metadata fields: 4
    - Agenda items: 12
    - Attachments: 8

Validating test2...
  ✓ Found 3 meetings
  ✓ Extracted details:
    - Metadata fields: 5
    - Agenda items: 7
    - Attachments: 3

Validating test3...
  ✓ Found 6 meetings
  ✓ Extracted details:
    - Metadata fields: 4
    - Agenda items: 15
    - Attachments: 12
```

---

## Step 6: Update Documentation

### Platform Documentation

Create `/docs/politeia/04-platforms/opengov.md` with:
- Configuration details
- Selector documentation
- Extraction examples
- Edge cases
- Performance notes

### Update Main Docs

**Update `/docs/politeia/README.md`:**
```markdown
## Supported Platforms

- [NOTUBIZ](./04-platforms/notubiz.md) - 100+ municipalities
- [IBIS](./04-platforms/ibis.md) - Major cities
- [OpenGov](./04-platforms/opengov.md) - NEW!
```

**Update API docs** with new platform type:
```typescript
type PlatformType = 'NOTUBIZ' | 'IBIS' | 'OPENGOV';
```

---

## Step 7: Deploy

### 1. Code Review

Submit pull request with:
- Configuration file
- Adapter implementation
- Tests
- Documentation
- Validation results

### 2. Testing Environment

Deploy to test environment:
```bash
# Build with new platform
docker build -t politeia:test .

# Deploy to test
docker-compose -f docker-compose.test.yml up -d

# Validate
curl http://test.politeia.local/api/platforms
# Should show OPENGOV in list
```

### 3. Production Deployment

After successful testing:
```bash
# Tag release
git tag v1.1.0-opengov
git push --tags

# Deploy to production
docker build -t politeia:1.1.0 .
docker push politeia:1.1.0

# Update production
kubectl set image deployment/politeia politeia=politeia:1.1.0
```

---

## Social Media Platforms

### Special Considerations

Social media platforms have unique challenges:

#### YouTube
- **Authentication:** YouTube API requires OAuth 2.0
- **Rate Limits:** 10,000 quota units/day
- **Structure:** Videos, comments, playlists
- **Example:** See [YouTube Extension](../08-extensions/youtube.md)

#### X (Twitter)
- **Authentication:** API v2 requires Bearer token
- **Rate Limits:** Very strict (450 requests/15min)
- **Structure:** Tweets, threads, profiles
- **Challenges:** Rate limiting, authentication

#### Facebook/Instagram
- **Authentication:** OAuth 2.0 required
- **Rate Limits:** Varies by app tier
- **Structure:** Posts, comments, pages
- **Challenges:** Meta Graph API complexity

---

## Checklist

Before submitting a new platform:

- [ ] Platform analysis document created
- [ ] Configuration YAML file created
- [ ] Adapter implementation complete
- [ ] Tests written and passing
- [ ] Validated with 3+ real municipalities
- [ ] Documentation created
- [ ] API docs updated
- [ ] README updated
- [ ] Code review completed
- [ ] Tested in staging environment
- [ ] Deployed to production

---

## Getting Help

**Questions?**
- Open GitHub issue: `[New Platform] OpenGov Support`
- Email: support@politeia.example.com
- Slack: #platform-development

---

## Related Documentation

- [NOTUBIZ Platform](./notubiz.md)
- [IBIS Platform](./ibis.md)
- [Version Management](./version-management.md)
- [Extensions Guide](../08-extensions/)

---

[← Back to Documentation Index](../README.md)
