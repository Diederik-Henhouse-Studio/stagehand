# Scraping-as-a-Service Architecture
## Configuration-Driven System voor NOTUBIZ & IBIS Gemeenten

---

## 🏗️ Architectuur Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SYSTEM                           │
│  (PostgreSQL, Redis, Node.js/Python Service)                │
│                                                              │
│  ┌────────────────┐    ┌──────────────┐   ┌──────────────┐│
│  │   Scheduler    │───▶│  Orchestrator│──▶│   Database   ││
│  │  (Daily Cron)  │    │  (API calls) │   │  (Meetings)  ││
│  └────────────────┘    └──────────────┘   └──────────────┘│
│           │                    │                            │
│           │                    │                            │
└───────────┼────────────────────┼────────────────────────────┘
            │                    │
            ▼                    ▼
   ╔════════════════════════════════════════════════════════╗
   ║        STAGEHAND SCRAPING SERVICE                      ║
   ║        (Stagehand + Browserbase)                       ║
   ║                                                         ║
   ║  ┌──────────────────────────────────────────────────┐ ║
   ║  │         REST/GraphQL API                         │ ║
   ║  │  POST /api/scrape/meetings-list                  │ ║
   ║  │  POST /api/scrape/meeting-details                │ ║
   ║  └──────────────────────────────────────────────────┘ ║
   ║                        │                               ║
   ║  ┌──────────────────────────────────────────────────┐ ║
   ║  │      Platform Config Manager                     │ ║
   ║  │  • NOTUBIZ Templates                             │ ║
   ║  │  • IBIS Templates                                │ ║
   ║  └──────────────────────────────────────────────────┘ ║
   ║                        │                               ║
   ║  ┌──────────────────────────────────────────────────┐ ║
   ║  │      Stagehand Execution Engine                  │ ║
   ║  │  • Browser Automation                            │ ║
   ║  │  • DOM Extraction                                │ ║
   ║  │  • Error Handling                                │ ║
   ║  └──────────────────────────────────────────────────┘ ║
   ╚════════════════════════════════════════════════════════╝
```

---

## 📋 Request Types

### 1. Meeting List Request (Inventariseren)

**Request:**
```json
{
  "requestType": "meetings-list",
  "requestId": "uuid-v4",
  "municipality": {
    "id": "oirschot",
    "name": "Oirschot",
    "platformType": "NOTUBIZ",
    "baseUrl": "https://oirschot.bestuurlijkeinformatie.nl"
  },
  "parameters": {
    "month": 10,
    "year": 2025,
    "maxMeetings": 100
  },
  "callbackUrl": "https://your-system.com/api/webhook/scrape-results",
  "metadata": {
    "scheduledBy": "daily-cron",
    "priority": "normal"
  }
}
```

**Response:**
```json
{
  "requestId": "uuid-v4",
  "status": "success",
  "timestamp": "2026-01-06T14:00:00Z",
  "executionTime": 4523,
  "browserbaseSessionUrl": "https://browserbase.com/sessions/...",
  "data": {
    "meetingsCount": 4,
    "meetings": [
      {
        "id": "b465214f-a570-45ba-85b9-c4d02bc5b107",
        "title": "Auditcommissie",
        "meetingType": "Commissievergadering",
        "date": "2025-10-07",
        "startTime": "19:30",
        "endTime": "21:00",
        "location": "Commissiekamer beneden",
        "status": "scheduled",
        "url": "https://oirschot.bestuurlijkeinformatie.nl/Agenda/Index/b465214f-a570-45ba-85b9-c4d02bc5b107",
        "hash": "sha256-of-basic-info"
      }
      // ... more meetings
    ]
  }
}
```

### 2. Meeting Details Request (Per vergadering)

**Request:**
```json
{
  "requestType": "meeting-details",
  "requestId": "uuid-v4",
  "municipality": {
    "id": "oirschot",
    "platformType": "NOTUBIZ"
  },
  "meetingId": "b465214f-a570-45ba-85b9-c4d02bc5b107",
  "meetingUrl": "https://oirschot.bestuurlijkeinformatie.nl/Agenda/Index/...",
  "extractionOptions": {
    "includeAgenda": true,
    "includeAttachments": true,
    "includeMetadata": true,
    "maxAgendaDepth": 3
  },
  "callbackUrl": "https://your-system.com/api/webhook/scrape-results"
}
```

**Response:**
```json
{
  "requestId": "uuid-v4",
  "status": "success",
  "timestamp": "2026-01-06T14:05:00Z",
  "executionTime": 3245,
  "data": {
    "meetingId": "b465214f-a570-45ba-85b9-c4d02bc5b107",
    "metadata": {
      "Locatie": "Commissiekamer beneden",
      "Voorzitter": "M. van Leeuwen",
      "Agenda documenten": "251007 Agenda Auditcommissie"
    },
    "agendaItems": [
      {
        "index": 1,
        "number": "1",
        "title": "Opening",
        "description": null,
        "hasSubItems": false,
        "isSubItem": false,
        "attachments": []
      },
      {
        "index": 2,
        "number": "2",
        "title": "Vaststellen agenda",
        "description": null,
        "hasSubItems": true,
        "isSubItem": false,
        "attachments": [
          {
            "id": "doc-uuid",
            "name": "Agenda Auditcommissie 7 oktober.pdf",
            "type": "pdf",
            "url": "https://oirschot.bestuurlijkeinformatie.nl/Document/...",
            "size": 110592,
            "extension": ".pdf"
          }
        ]
      }
      // ... more agenda items
    ],
    "attachmentsSummary": {
      "total": 6,
      "byType": {
        "pdf": 4,
        "document": 2
      }
    },
    "htmlStructure": {
      "hasMainContent": true,
      "hasBreadcrumb": true,
      "hasAgendaList": true,
      "hasAttachmentsList": true
    }
  }
}
```

---

## 🔧 Platform Configuration System

### Platform Types

```typescript
export enum PlatformType {
  NOTUBIZ = 'NOTUBIZ',  // Oirschot, Best, Eindhoven, etc.
  IBIS = 'IBIS',        // Amsterdam, Rotterdam, etc.
  CUSTOM = 'CUSTOM'     // Voor edge cases
}
```

### NOTUBIZ Configuration

```typescript
// config/platforms/notubiz.config.ts

export const notubizConfig: PlatformConfig = {
  platformType: PlatformType.NOTUBIZ,
  name: 'NOTUBIZ',
  vendor: 'Decos',

  // URL Patterns
  urlPatterns: {
    calendar: '/Calendar',
    meeting: '/Agenda/Index/{meetingId}',
    document: '/Agenda/Document/{meetingId}?documentId={documentId}',
    search: '/Search'
  },

  // Selectors for Meeting List
  meetingListSelectors: {
    container: 'section.col#maincontent',
    meetingLinks: 'a[href*="/Agenda/Index/"]',

    extraction: {
      id: {
        method: 'regex',
        pattern: /\/Agenda\/Index\/([a-f0-9-]+)/i,
        source: 'href'
      },
      title: {
        method: 'text',
        selector: 'self'
      },
      date: {
        method: 'regex',
        pattern: /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i,
        source: 'containerText'
      },
      time: {
        method: 'regex',
        pattern: /(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/,
        source: 'containerText'
      },
      status: {
        method: 'keyword',
        keywords: {
          cancelled: ['VERVALLEN', 'GEANNULEERD'],
          rescheduled: ['VERPLAATST'],
          completed: ['AFGEROND']
        },
        default: 'scheduled'
      }
    }
  },

  // Selectors for Meeting Details
  meetingDetailsSelectors: {
    metadata: {
      container: 'dl',
      key: 'dt',
      value: 'dd',
      transform: {
        key: 'trim-colon',
        value: 'trim'
      }
    },

    agendaItems: {
      // Multiple strategies (try in order)
      strategies: [
        {
          name: 'structured-list',
          container: 'ol.agenda-items',
          item: '> li',
          priority: 1
        },
        {
          name: 'main-content-list',
          container: '#maincontent',
          item: 'ol:not(.breadcrumb) > li',
          exclude: 'li:has(a[href="/"])',
          priority: 2
        },
        {
          name: 'agenda-section',
          container: 'section.agenda, div[class*="agenda"]',
          item: 'ol:not(.breadcrumb) > li',
          priority: 3
        }
      ],

      extraction: {
        number: {
          method: 'regex',
          pattern: /^(\d+[A-Z]?)\s+/,
          source: 'text'
        },
        title: {
          method: 'text',
          selector: 'self',
          transform: 'removeNumber'
        },
        hasSubItems: {
          method: 'exists',
          selector: '> ol, > ul'
        },
        attachments: {
          selector: 'a[href*="/Document/"]',
          multiple: true
        }
      }
    },

    attachments: {
      selector: 'a[href*="/Document/"], a[href*=".pdf"]',
      extraction: {
        id: {
          method: 'regex',
          pattern: /documentId=([a-f0-9-]+)/i,
          source: 'href'
        },
        name: {
          method: 'text',
          selector: 'self',
          transform: 'removeSize'
        },
        url: {
          method: 'attribute',
          attribute: 'href'
        },
        type: {
          method: 'extension',
          mapping: {
            '.pdf': 'pdf',
            '.docx': 'word',
            '.doc': 'word',
            '.xlsx': 'excel',
            '.xls': 'excel'
          },
          default: 'document'
        },
        size: {
          method: 'regex',
          pattern: /(\d+)\s*(KB|MB)/i,
          source: 'text',
          transform: 'toBytes'
        }
      }
    }
  },

  // Meeting Type Detection
  meetingTypeDetection: {
    method: 'title-pattern',
    patterns: {
      'Presidium': /presidium/i,
      'Besluitvormende raadsvergadering': /besluitvormende\s+raadsvergadering/i,
      'Raadsbijeenkomst': /raadsbijeenkomst/i,
      'Commissievergadering': /commissie|auditcommissie/i,
      'Raadsvergadering': /raadsvergadering(?!\s+besluitvormende)/i
    },
    default: 'Other'
  },

  // Calendar Navigation
  calendarNavigation: {
    monthSelector: '#CurrentMonth',
    yearSelector: '#CurrentYear',
    monthIndexing: 'zero-based', // 0 = januari
    submitMethod: 'auto', // Automatically reloads via AJAX
    waitTime: 3000
  }
};
```

### IBIS Configuration

```typescript
// config/platforms/ibis.config.ts

export const ibisConfig: PlatformConfig = {
  platformType: PlatformType.IBIS,
  name: 'IBIS',
  vendor: 'IBIS',

  // URL Patterns (different from NOTUBIZ)
  urlPatterns: {
    calendar: '/Vergaderingen',
    meeting: '/vergadering/{meetingId}',
    document: '/document/{documentId}',
    search: '/zoeken'
  },

  // Different selectors for IBIS
  meetingListSelectors: {
    container: 'div.vergaderlijst',
    meetingLinks: 'a.vergadering-link',

    extraction: {
      id: {
        method: 'attribute',
        attribute: 'data-vergadering-id'
      },
      // ... IBIS-specific selectors
    }
  },

  // ... rest of IBIS config
};
```

### Municipality Configuration

```typescript
// config/municipalities/oirschot.config.ts

export const oirschotConfig: MunicipalityConfig = {
  id: 'oirschot',
  name: 'Oirschot',
  province: 'Noord-Brabant',

  platform: {
    type: PlatformType.NOTUBIZ,
    baseUrl: 'https://oirschot.bestuurlijkeinformatie.nl',
    configOverrides: {
      // Municipality-specific overrides if needed
      calendarNavigation: {
        waitTime: 4000 // Oirschot is slower
      }
    }
  },

  scraping: {
    rateLimit: {
      requestsPerMinute: 10,
      requestsPerHour: 100
    },
    retryPolicy: {
      maxRetries: 3,
      backoffMs: 1000
    }
  },

  meetingTypes: {
    // Municipality-specific meeting types (rare)
    customTypes: []
  }
};
```

---

## 🚀 Stagehand Service Implementation

### Service API (Express + TypeScript)

```typescript
// src/service/api.ts

import express from 'express';
import { V3 as Stagehand } from '@browserbasehq/stagehand';
import { PlatformConfigManager } from './config-manager';
import { ScraperEngine } from './scraper-engine';

const app = express();
app.use(express.json());

const configManager = new PlatformConfigManager();
const scraperEngine = new ScraperEngine(configManager);

/**
 * POST /api/scrape/meetings-list
 * Scrape calendar and return meeting list
 */
app.post('/api/scrape/meetings-list', async (req, res) => {
  try {
    const request: MeetingsListRequest = req.body;

    // Validate request
    if (!request.municipality || !request.municipality.platformType) {
      return res.status(400).json({
        error: 'Missing required fields: municipality.platformType'
      });
    }

    // Get platform config
    const platformConfig = configManager.getPlatformConfig(
      request.municipality.platformType
    );

    // Apply municipality overrides
    const municipalityConfig = configManager.getMunicipalityConfig(
      request.municipality.id
    );

    // Execute scraping
    const result = await scraperEngine.scrapeMeetingsList(
      request,
      platformConfig,
      municipalityConfig
    );

    // Send response
    res.json({
      requestId: request.requestId,
      status: 'success',
      timestamp: new Date().toISOString(),
      executionTime: result.executionTime,
      browserbaseSessionUrl: result.sessionUrl,
      data: result.data
    });

    // Optional: Call webhook if provided
    if (request.callbackUrl) {
      await fetch(request.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      });
    }

  } catch (error) {
    console.error('Scraping failed:', error);
    res.status(500).json({
      requestId: req.body.requestId,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/scrape/meeting-details
 * Scrape specific meeting details
 */
app.post('/api/scrape/meeting-details', async (req, res) => {
  try {
    const request: MeetingDetailsRequest = req.body;

    const platformConfig = configManager.getPlatformConfig(
      request.municipality.platformType
    );

    const result = await scraperEngine.scrapeMeetingDetails(
      request,
      platformConfig
    );

    res.json({
      requestId: request.requestId,
      status: 'success',
      timestamp: new Date().toISOString(),
      executionTime: result.executionTime,
      data: result.data
    });

    if (request.callbackUrl) {
      await fetch(request.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      });
    }

  } catch (error) {
    console.error('Meeting details scraping failed:', error);
    res.status(500).json({
      requestId: req.body.requestId,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/platforms
 * List supported platforms
 */
app.get('/api/platforms', (req, res) => {
  const platforms = configManager.getAllPlatformConfigs();
  res.json({
    platforms: platforms.map(p => ({
      type: p.platformType,
      name: p.name,
      vendor: p.vendor
    }))
  });
});

/**
 * GET /api/municipalities
 * List configured municipalities
 */
app.get('/api/municipalities', (req, res) => {
  const municipalities = configManager.getAllMunicipalityConfigs();
  res.json({
    municipalities: municipalities.map(m => ({
      id: m.id,
      name: m.name,
      platformType: m.platform.type,
      baseUrl: m.platform.baseUrl
    }))
  });
});

app.listen(3000, () => {
  console.log('🚀 Stagehand Scraping Service running on port 3000');
});
```

### Scraper Engine (Template-based execution)

```typescript
// src/service/scraper-engine.ts

export class ScraperEngine {
  private configManager: PlatformConfigManager;

  constructor(configManager: PlatformConfigManager) {
    this.configManager = configManager;
  }

  /**
   * Scrape meetings list using platform-specific config
   */
  async scrapeMeetingsList(
    request: MeetingsListRequest,
    platformConfig: PlatformConfig,
    municipalityConfig: MunicipalityConfig
  ): Promise<ScrapingResult> {
    const startTime = Date.now();

    const stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      verbose: 1,
      enableCache: false
    });

    try {
      await stagehand.init();
      const page = stagehand.context.pages()[0];

      // Build calendar URL
      const calendarUrl = this.buildUrl(
        municipalityConfig.platform.baseUrl,
        platformConfig.urlPatterns.calendar,
        request.parameters
      );

      // Navigate to calendar
      await page.goto(calendarUrl, { waitUntil: 'networkidle' });

      // Navigate to specific month if needed
      if (request.parameters?.month && request.parameters?.year) {
        await this.navigateToMonth(
          page,
          request.parameters.month,
          request.parameters.year,
          platformConfig.calendarNavigation
        );
      }

      // Extract meetings using platform-specific selectors
      const meetings = await this.extractMeetingsList(
        page,
        platformConfig.meetingListSelectors,
        platformConfig.meetingTypeDetection,
        municipalityConfig
      );

      const executionTime = Date.now() - startTime;

      await stagehand.close();

      return {
        success: true,
        executionTime,
        sessionUrl: (stagehand as any).context?._sessionUrl,
        data: {
          meetingsCount: meetings.length,
          meetings
        }
      };

    } catch (error) {
      await stagehand.close();
      throw error;
    }
  }

  /**
   * Extract meetings from page using config-driven selectors
   */
  private async extractMeetingsList(
    page: any,
    selectors: MeetingListSelectors,
    typeDetection: MeetingTypeDetection,
    municipalityConfig: MunicipalityConfig
  ): Promise<MeetingBasic[]> {
    return await page.evaluate((config: any) => {
      const meetings: any[] = [];

      // Get container
      const container = config.selectors.container
        ? document.querySelector(config.selectors.container)
        : document;

      if (!container) return [];

      // Find meeting links
      const links = container.querySelectorAll(config.selectors.meetingLinks);

      links.forEach((link: HTMLAnchorElement) => {
        const meeting: any = {};

        // Extract each field based on config
        for (const [field, extractConfig] of Object.entries(config.selectors.extraction)) {
          const value = this.extractField(link, extractConfig as any);
          meeting[field] = value;
        }

        // Detect meeting type
        meeting.meetingType = this.detectMeetingType(
          meeting.title,
          config.typeDetection
        );

        // Add municipality info
        meeting.source = config.municipalityId;
        meeting.url = link.href;

        meetings.push(meeting);
      });

      return meetings;
    }, {
      selectors,
      typeDetection,
      municipalityId: municipalityConfig.id
    });
  }

  /**
   * Navigate to specific month using platform config
   */
  private async navigateToMonth(
    page: any,
    month: number,
    year: number,
    navConfig: CalendarNavigationConfig
  ) {
    // Adjust month index based on platform
    const monthIndex = navConfig.monthIndexing === 'zero-based'
      ? month - 1
      : month;

    // Select year
    await page.locator(navConfig.yearSelector).selectOption(year.toString());
    await page.waitForTimeout(500);

    // Select month
    await page.locator(navConfig.monthSelector).selectOption(monthIndex.toString());

    // Wait for page update
    await page.waitForTimeout(navConfig.waitTime);
  }

  /**
   * Build URL with parameters
   */
  private buildUrl(
    baseUrl: string,
    pattern: string,
    params?: Record<string, any>
  ): string {
    let url = baseUrl + pattern;

    if (params) {
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      }
      const queryString = queryParams.toString();
      if (queryString) {
        url += '?' + queryString;
      }
    }

    return url;
  }
}
```

---

## 📊 External System Integration

### External Scheduler (Daily Cron)

```typescript
// external-system/scheduler/daily-scraper.ts

import { CronJob } from 'cron';
import { StagehandServiceClient } from './stagehand-client';
import { Database } from './database';

export class DailyMeetingScraper {
  private client: StagehandServiceClient;
  private database: Database;

  constructor() {
    this.client = new StagehandServiceClient('https://stagehand-service.com');
    this.database = new Database();
  }

  /**
   * Setup daily scraping job
   */
  setupCronJob() {
    // Run every day at 6:00 AM
    const job = new CronJob('0 6 * * *', async () => {
      await this.runDailyScrape();
    });

    job.start();
  }

  /**
   * Daily scraping workflow
   */
  async runDailyScrape() {
    console.log('Starting daily scrape...');

    // Get all active municipalities
    const municipalities = await this.database.getActiveMunicipalities();

    // Scrape each municipality
    for (const muni of municipalities) {
      try {
        await this.scrapeMunicipality(muni);
      } catch (error) {
        console.error(`Failed to scrape ${muni.name}:`, error);
      }
    }
  }

  /**
   * Scrape a single municipality
   */
  async scrapeMunicipality(municipality: Municipality) {
    console.log(`Scraping ${municipality.name}...`);

    // 1. Request meeting list from Stagehand Service
    const listResponse = await this.client.scrapeMeetingsList({
      requestType: 'meetings-list',
      requestId: crypto.randomUUID(),
      municipality: {
        id: municipality.id,
        name: municipality.name,
        platformType: municipality.platformType,
        baseUrl: municipality.baseUrl
      },
      parameters: {
        // Scrape next 3 months
        // (Stagehand will handle month navigation internally)
      },
      callbackUrl: null // We'll handle response synchronously
    });

    if (listResponse.status !== 'success') {
      throw new Error(`Scraping failed: ${listResponse.error}`);
    }

    // 2. Compare with database (Change Detection)
    const changes = await this.detectChanges(
      municipality.id,
      listResponse.data.meetings
    );

    console.log(`Found ${changes.new.length} new, ${changes.modified.length} modified, ${changes.removed.length} removed`);

    // 3. For new or modified meetings, request details
    for (const meeting of [...changes.new, ...changes.modified]) {
      await this.scrapeMeetingDetails(municipality, meeting);
    }

    // 4. Update database
    await this.database.updateMeetings(municipality.id, listResponse.data.meetings);
  }

  /**
   * Detect changes by comparing with database
   */
  async detectChanges(
    municipalityId: string,
    currentMeetings: MeetingBasic[]
  ): Promise<ChangeSet> {
    const storedMeetings = await this.database.getMeetings(municipalityId);

    const changes: ChangeSet = {
      new: [],
      modified: [],
      removed: []
    };

    // Create hash maps
    const storedMap = new Map(storedMeetings.map(m => [m.id, m]));
    const currentMap = new Map(currentMeetings.map(m => [m.id, m]));

    // Find new meetings
    for (const meeting of currentMeetings) {
      if (!storedMap.has(meeting.id)) {
        changes.new.push(meeting);
      } else {
        // Check for modifications
        const stored = storedMap.get(meeting.id)!;
        if (stored.hash !== meeting.hash) {
          changes.modified.push(meeting);
        }
      }
    }

    // Find removed meetings
    for (const stored of storedMeetings) {
      if (!currentMap.has(stored.id)) {
        changes.removed.push(stored);
      }
    }

    return changes;
  }

  /**
   * Request meeting details from Stagehand Service
   */
  async scrapeMeetingDetails(
    municipality: Municipality,
    meeting: MeetingBasic
  ) {
    const detailsResponse = await this.client.scrapeMeetingDetails({
      requestType: 'meeting-details',
      requestId: crypto.randomUUID(),
      municipality: {
        id: municipality.id,
        platformType: municipality.platformType
      },
      meetingId: meeting.id,
      meetingUrl: meeting.url,
      extractionOptions: {
        includeAgenda: true,
        includeAttachments: true,
        includeMetadata: true,
        maxAgendaDepth: 5
      },
      callbackUrl: null
    });

    if (detailsResponse.status === 'success') {
      await this.database.saveMeetingDetails(
        meeting.id,
        detailsResponse.data
      );
    }
  }
}

interface ChangeSet {
  new: MeetingBasic[];
  modified: MeetingBasic[];
  removed: MeetingBasic[];
}
```

### Stagehand Service Client

```typescript
// external-system/clients/stagehand-client.ts

export class StagehandServiceClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Request meeting list scraping
   */
  async scrapeMeetingsList(
    request: MeetingsListRequest
  ): Promise<MeetingsListResponse> {
    const response = await fetch(`${this.baseUrl}/api/scrape/meetings-list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Stagehand service error: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Request meeting details scraping
   */
  async scrapeMeetingDetails(
    request: MeetingDetailsRequest
  ): Promise<MeetingDetailsResponse> {
    const response = await fetch(`${this.baseUrl}/api/scrape/meeting-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Stagehand service error: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get supported platforms
   */
  async getPlatforms(): Promise<Platform[]> {
    const response = await fetch(`${this.baseUrl}/api/platforms`);
    const data = await response.json();
    return data.platforms;
  }

  /**
   * Get configured municipalities
   */
  async getMunicipalities(): Promise<Municipality[]> {
    const response = await fetch(`${this.baseUrl}/api/municipalities`);
    const data = await response.json();
    return data.municipalities;
  }
}
```

---

## 🎯 Benefits van deze Architecture

### 1. **Separation of Concerns**
- **Stagehand Service:** Focus op scraping
- **External System:** Focus op business logic

### 2. **Scalability**
- Stagehand service kan horizontaal schalen
- Meerdere instanties voor parallelle scraping
- Load balancing mogelijk

### 3. **Platform Agnostic**
- Eenvoudig nieuwe platforms toevoegen (NOTUBIZ, IBIS, custom)
- Configuration-driven, geen code changes

### 4. **Cost Optimization**
- Browserbase sessions alleen tijdens scraping
- External system gebruikt geen dure browser resources

### 5. **Flexibility**
- External system bepaalt scheduling policy
- Change detection logic in external system
- Attachment processing rules in external system

### 6. **Reusability**
- Stagehand service kan door meerdere externe systemen gebruikt worden
- Shared service voor alle gemeenten

---

## 📈 Next Steps

1. ✅ Implement Stagehand Service API
2. ✅ Create NOTUBIZ config template
3. ✅ Create IBIS config template
4. ✅ Build external scheduler
5. ✅ Test with Oirschot (NOTUBIZ)
6. ⏭️ Add more municipalities
7. ⏭️ Dashboard voor monitoring

