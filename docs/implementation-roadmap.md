# Implementatie Roadmap: Oirschot Gemeente Monitoring

## Fase 1: Direct HTTP Scraping (Week 1-2)

### 1.1 Setup & Dependencies
```bash
npm install cheerio node-fetch
npm install @types/node --save-dev
```

### 1.2 Core Scraper Implementation

```typescript
// src/scraper/direct-scraper.ts
import * as cheerio from 'cheerio';

export class DirectScraper {
  private baseUrl = 'https://oirschot.bestuurlijkeinformatie.nl';

  /**
   * Fetch calendar and extract meeting list
   */
  async fetchMeetingList(month?: number, year?: number): Promise<MeetingBasic[]> {
    const url = month && year
      ? `${this.baseUrl}/Calendar?month=${month - 1}&year=${year}`
      : `${this.baseUrl}/Calendar`;

    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    const meetings: MeetingBasic[] = [];

    $('a[href*="/Agenda/Index/"]').each((i, element) => {
      const href = $(element).attr('href') || '';
      const id = this.extractMeetingId(href);

      if (!id) return;

      const container = $(element).closest('tr, li, div, article');
      const fullText = container.text().trim();

      // Extract date
      const dateMatch = fullText.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i);

      // Extract time
      const timeMatch = fullText.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);

      // Detect status
      const status = fullText.includes('VERVALLEN')
        ? MeetingStatus.CANCELLED
        : MeetingStatus.SCHEDULED;

      meetings.push({
        id,
        source: 'oirschot',
        title: $(element).text().trim(),
        meetingType: this.detectMeetingType($(element).text()),
        date: dateMatch ? dateMatch[0] : '',
        startTime: timeMatch ? timeMatch[1] : '',
        endTime: timeMatch ? timeMatch[2] : '',
        status,
        location: null, // Extracted from details
        url: `${this.baseUrl}${href}`,
        lastChecked: new Date(),
        lastModified: new Date(),
        hash: '' // Calculated after
      });
    });

    return meetings;
  }

  /**
   * Fetch detailed information for a meeting
   */
  async fetchMeetingDetails(meetingId: string): Promise<MeetingDetails> {
    const url = `${this.baseUrl}/Agenda/Index/${meetingId}`;

    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract metadata
    const metadata: Record<string, string> = {};
    $('dl dt').each((i, dt) => {
      const key = $(dt).text().trim().replace(':', '');
      const value = $(dt).next('dd').text().trim();
      if (key && value) {
        metadata[key] = value;
      }
    });

    // Extract agenda items
    const agendaItems = this.extractAgendaItems($);

    // Extract attachments
    const attachments = this.extractAttachments($, meetingId);

    // HTML structure check
    const htmlStructure = {
      hasMainContent: $('#maincontent').length > 0,
      hasBreadcrumb: $('.breadcrumb, ol.breadcrumb').length > 0,
      hasAgendaList: this.findAgendaList($) !== null,
      hasAttachmentsList: $('a[href*="/Document/"]').length > 0
    };

    return {
      // ... combine meeting basics + details
      metadata,
      agendaItems,
      agendaItemsCount: agendaItems.length,
      attachmentsCount: attachments.length,
      attachmentTypes: this.getUniqueAttachmentTypes(attachments),
      htmlStructure,
      scrapedAt: new Date(),
      scrapeMethod: 'dom'
    };
  }

  /**
   * Extract agenda items with nested structure support
   */
  private extractAgendaItems($: cheerio.CheerioAPI): AgendaItem[] {
    const agendaList = this.findAgendaList($);
    if (!agendaList) return [];

    const items: AgendaItem[] = [];
    let globalIndex = 0;

    const processItem = (
      li: cheerio.Element,
      isSubItem: boolean = false,
      parentIndex?: number
    ) => {
      const $li = $(li);

      // Skip breadcrumb items
      const text = $li.text().trim();
      if (text === 'Home' || text === 'Vergaderingen' || $li.find('a[href="/"]').length > 0) {
        return;
      }

      // Extract agenda number
      const numberMatch = text.match(/^(\d+[A-Z]?)\s+/);
      const number = numberMatch ? numberMatch[1] : undefined;

      // Get direct text (not from nested lists)
      const directText = $li.clone().children('ol, ul').remove().end().text().trim();

      // Check for attachments
      const attachments = this.extractAttachmentsFromElement($li, '');

      // Check for nested items
      const hasSubItems = $li.find('> ol, > ul').length > 0;

      const item: AgendaItem = {
        index: ++globalIndex,
        number,
        title: directText,
        description: undefined, // Could be extracted from description elements
        hasSubItems,
        isSubItem,
        parentIndex,
        attachments
      };

      items.push(item);

      // Process nested items recursively
      if (hasSubItems) {
        const currentIndex = globalIndex;
        $li.find('> ol > li, > ul > li').each((i, subLi) => {
          processItem(subLi, true, currentIndex);
        });
      }
    };

    agendaList.find('> li').each((i, li) => {
      processItem(li);
    });

    return items;
  }

  /**
   * Find agenda list using multiple strategies
   */
  private findAgendaList($: cheerio.CheerioAPI): cheerio.Cheerio | null {
    const selectors = [
      'ol.agenda-items',
      'ul.agenda-items',
      '#maincontent ol:not(.breadcrumb)',
      '#maincontent ul:not(.breadcrumb)',
      'section.agenda ol',
      'div[class*="agenda"] ol:not(.breadcrumb)',
    ];

    for (const selector of selectors) {
      const list = $(selector).first();
      if (list.length > 0) {
        return list;
      }
    }

    return null;
  }

  /**
   * Extract attachments from the page
   */
  private extractAttachments($: cheerio.CheerioAPI, meetingId: string): Attachment[] {
    const attachments: Attachment[] = [];

    $('a[href*="/Document/"]').each((i, element) => {
      const $el = $(element);
      const href = $el.attr('href') || '';
      const text = $el.text().trim();

      const attachment = this.parseAttachment(href, text, meetingId);
      if (attachment) {
        attachments.push(attachment);
      }
    });

    return attachments;
  }

  /**
   * Parse attachment from link
   */
  private parseAttachment(href: string, text: string, meetingId: string): Attachment | null {
    // Extract document ID from URL
    const docIdMatch = href.match(/documentId=([a-f0-9-]+)/i);
    if (!docIdMatch) return null;

    const docId = docIdMatch[1];

    // Detect type
    let type: AttachmentType = AttachmentType.DOCUMENT;
    let extension: string | undefined;

    if (text.toLowerCase().includes('.pdf') || href.includes('.pdf')) {
      type = AttachmentType.PDF;
      extension = '.pdf';
    } else if (text.toLowerCase().includes('.docx') || text.toLowerCase().includes('.doc')) {
      type = AttachmentType.WORD;
      extension = '.docx';
    } else if (text.toLowerCase().includes('.xlsx') || text.toLowerCase().includes('.xls')) {
      type = AttachmentType.EXCEL;
      extension = '.xlsx';
    }

    // Extract size if present
    const sizeMatch = text.match(/(\d+)\s*(KB|MB)/i);
    const size = sizeMatch ? this.parseSize(sizeMatch[1], sizeMatch[2]) : undefined;

    return {
      id: docId,
      name: text,
      type,
      url: this.normalizeUrl(href),
      viewUrl: undefined,
      extension,
      size,
      downloaded: false
    };
  }

  /**
   * Detect meeting type from title
   */
  private detectMeetingType(title: string): MeetingType {
    const lower = title.toLowerCase();

    if (lower.includes('presidium')) return MeetingType.PRESIDIUM;
    if (lower.includes('besluitvormende')) return MeetingType.BESLUITVORMEND;
    if (lower.includes('raadsbijeenkomst')) return MeetingType.RAADSBIJEENKOMST;
    if (lower.includes('commissie')) return MeetingType.COMMISSIE;
    if (lower.includes('raadsvergadering')) return MeetingType.BESLUITVORMEND;

    return MeetingType.OTHER;
  }

  /**
   * Extract meeting ID from URL
   */
  private extractMeetingId(href: string): string | null {
    const match = href.match(/\/Agenda\/Index\/([a-f0-9-]+)/i);
    return match ? match[1] : null;
  }

  /**
   * Normalize URL (add base if relative)
   */
  private normalizeUrl(url: string): string {
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return `${this.baseUrl}${url}`;
    return `${this.baseUrl}/${url}`;
  }

  /**
   * Parse file size to bytes
   */
  private parseSize(value: string, unit: string): number {
    const val = parseInt(value, 10);
    const unitLower = unit.toLowerCase();

    if (unitLower === 'kb') return val * 1024;
    if (unitLower === 'mb') return val * 1024 * 1024;

    return val;
  }

  /**
   * Get unique attachment types
   */
  private getUniqueAttachmentTypes(attachments: Attachment[]): AttachmentType[] {
    return [...new Set(attachments.map(a => a.type))];
  }
}
```

### 1.3 Change Detection System

```typescript
// src/monitoring/change-detector.ts
import { createHash } from 'crypto';

export class ChangeDetector {
  /**
   * Create hash of meeting basic info
   */
  hashMeetingBasics(meeting: MeetingBasic): string {
    const data = JSON.stringify({
      title: meeting.title,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      status: meeting.status,
      location: meeting.location
    });

    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Detect changes between stored and current meeting
   */
  detectChanges(stored: MeetingBasic, current: MeetingBasic): Change[] {
    const changes: Change[] = [];

    if (stored.title !== current.title) {
      changes.push({
        field: 'title',
        oldValue: stored.title,
        newValue: current.title,
        type: 'modified'
      });
    }

    if (stored.date !== current.date) {
      changes.push({
        field: 'date',
        oldValue: stored.date,
        newValue: current.date,
        type: 'modified'
      });
    }

    if (stored.status !== current.status) {
      changes.push({
        field: 'status',
        oldValue: stored.status,
        newValue: current.status,
        type: stored.status === MeetingStatus.SCHEDULED && current.status === MeetingStatus.CANCELLED
          ? 'cancelled'
          : 'modified'
      });
    }

    // ... check other fields

    return changes;
  }

  /**
   * Check if meeting is new
   */
  isNewMeeting(meetingId: string, database: Database): boolean {
    return !database.hasMeeting(meetingId);
  }
}

interface Change {
  field: string;
  oldValue: any;
  newValue: any;
  type: 'added' | 'removed' | 'modified' | 'cancelled';
}
```

### 1.4 Rule-Based Attachment Processor

```typescript
// src/processing/attachment-processor.ts

export class AttachmentProcessor {
  private rules: ProcessingRule[];

  constructor(rules: ProcessingRule[]) {
    this.rules = rules;
  }

  /**
   * Determine if attachment should be downloaded
   */
  shouldDownload(
    attachment: Attachment,
    meeting: MeetingBasic,
    agendaItem?: AgendaItem
  ): boolean {
    // Find matching rules (sorted by priority)
    const matchingRules = this.rules
      .filter(rule => this.matchesRule(rule, attachment, meeting, agendaItem))
      .sort((a, b) => this.priorityToNumber(b.priority) - this.priorityToNumber(a.priority));

    if (matchingRules.length === 0) return false;

    const highestRule = matchingRules[0];
    return highestRule.action === 'download';
  }

  /**
   * Check if attachment matches rule
   */
  private matchesRule(
    rule: ProcessingRule,
    attachment: Attachment,
    meeting: MeetingBasic,
    agendaItem?: AgendaItem
  ): boolean {
    // Check meeting type
    if (rule.meetingType && !rule.meetingType.includes(meeting.meetingType)) {
      return false;
    }

    // Check attachment name pattern
    if (rule.attachmentNamePattern && !rule.attachmentNamePattern.test(attachment.name)) {
      return false;
    }

    // Check attachment type
    if (rule.attachmentType && !rule.attachmentType.includes(attachment.type)) {
      return false;
    }

    // Check agenda item pattern
    if (rule.agendaItemPattern && agendaItem && !rule.agendaItemPattern.test(agendaItem.title)) {
      return false;
    }

    return true;
  }

  private priorityToNumber(priority?: 'low' | 'medium' | 'high'): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }
}

// Example rules configuration
export const defaultRules: ProcessingRule[] = [
  {
    // Always download besluitenlijsten
    attachmentNamePattern: /besluitenlijst|besluitvormend/i,
    action: 'download',
    priority: 'high'
  },
  {
    // Download all from besluitvormende meetings
    meetingType: [MeetingType.BESLUITVORMEND],
    action: 'download',
    priority: 'high'
  },
  {
    // Only index agendas from commissie meetings
    meetingType: [MeetingType.COMMISSIE],
    attachmentNamePattern: /agenda/i,
    action: 'index_only',
    priority: 'medium'
  },
  {
    // Download raadsbijeenkomst presentation materials
    meetingType: [MeetingType.RAADSBIJEENKOMST],
    attachmentNamePattern: /presentatie|toelichting/i,
    action: 'download',
    priority: 'medium'
  }
];
```

---

## Fase 2: Daily Monitoring (Week 3)

### 2.1 Cron Job Setup

```typescript
// src/jobs/daily-scraper.ts
import { CronJob } from 'cron';

export class DailyScraper {
  private scraper: DirectScraper;
  private detector: ChangeDetector;
  private database: Database;
  private notifier: Notifier;

  /**
   * Run daily at 6:00 AM
   */
  setupCronJob() {
    const job = new CronJob('0 6 * * *', async () => {
      console.log('Starting daily scrape...');
      await this.runDailyScrape();
    });

    job.start();
  }

  /**
   * Daily scrape workflow
   */
  async runDailyScrape() {
    try {
      // 1. Fetch current calendar
      const currentMeetings = await this.scraper.fetchMeetingList();

      // 2. Check each meeting for changes
      for (const meeting of currentMeetings) {
        // Calculate hash
        meeting.hash = this.detector.hashMeetingBasics(meeting);

        // Check if new
        if (this.detector.isNewMeeting(meeting.id, this.database)) {
          await this.handleNewMeeting(meeting);
          continue;
        }

        // Check for changes
        const stored = await this.database.getMeeting(meeting.id);
        if (stored.hash !== meeting.hash) {
          await this.handleChangedMeeting(stored, meeting);
        }
      }

      // 3. Check for removed meetings
      const storedMeetings = await this.database.getAllActiveMeetings();
      const currentIds = new Set(currentMeetings.map(m => m.id));

      for (const stored of storedMeetings) {
        if (!currentIds.has(stored.id)) {
          await this.handleRemovedMeeting(stored);
        }
      }

      console.log('Daily scrape completed');

    } catch (error) {
      console.error('Daily scrape failed:', error);
      await this.notifier.sendError(error);
    }
  }

  private async handleNewMeeting(meeting: MeetingBasic) {
    // Save to database
    await this.database.saveMeeting(meeting);

    // Fetch details
    const details = await this.scraper.fetchMeetingDetails(meeting.id);
    await this.database.saveMeetingDetails(details);

    // Notify
    await this.notifier.sendNewMeeting(meeting);
  }

  private async handleChangedMeeting(stored: MeetingBasic, current: MeetingBasic) {
    const changes = this.detector.detectChanges(stored, current);

    // Update database
    await this.database.updateMeeting(current);

    // Re-fetch details if major change
    if (this.isMajorChange(changes)) {
      const details = await this.scraper.fetchMeetingDetails(current.id);
      await this.database.saveMeetingDetails(details);
    }

    // Notify
    await this.notifier.sendMeetingChanged(current, changes);
  }

  private async handleRemovedMeeting(meeting: MeetingBasic) {
    // Mark as removed
    await this.database.markMeetingRemoved(meeting.id);

    // Notify
    await this.notifier.sendMeetingRemoved(meeting);
  }

  private isMajorChange(changes: Change[]): boolean {
    return changes.some(c =>
      c.field === 'date' ||
      c.field === 'status' ||
      c.type === 'cancelled'
    );
  }
}
```

---

## Fase 3: Multi-Gemeente Scaling (Week 4+)

### 3.1 Config-Driven Architecture

```typescript
// config/municipalities.ts

export interface MunicipalityConfig {
  id: string;
  name: string;
  baseUrl: string;
  selectors: {
    meetingLinks: string;
    metadata: {
      container: string;
      key: string;
      value: string;
    };
    agendaList: string[];
    attachments: string;
  };
  meetingTypePatterns: Record<string, RegExp>;
}

export const municipalities: MunicipalityConfig[] = [
  {
    id: 'oirschot',
    name: 'Oirschot',
    baseUrl: 'https://oirschot.bestuurlijkeinformatie.nl',
    selectors: {
      meetingLinks: 'a[href*="/Agenda/Index/"]',
      metadata: {
        container: 'dl',
        key: 'dt',
        value: 'dd'
      },
      agendaList: [
        'ol.agenda-items',
        '#maincontent ol:not(.breadcrumb)',
      ],
      attachments: 'a[href*="/Document/"]'
    },
    meetingTypePatterns: {
      presidium: /presidium/i,
      besluitvormend: /besluitvormende/i,
      raadsbijeenkomst: /raadsbijeenkomst/i,
      commissie: /commissie/i
    }
  },
  // Add more municipalities here
];
```

---

## Performance Comparison

| Aspect | Stagehand/Browserbase | Direct HTTP/Cheerio |
|--------|----------------------|---------------------|
| **Cost per scrape** | ~$0.10 | ~$0.001 |
| **Speed** | 30-60s | 3-5s |
| **Reliability** | 95% (browser deps) | 99% (simple HTTP) |
| **Scalability** | Limited | High |
| **Maintenance** | Medium | Low |

---

## Timeline

- **Week 1:** Core scraper + data models
- **Week 2:** Change detection + testing
- **Week 3:** Daily monitoring + notifications
- **Week 4:** Multi-gemeente support
- **Week 5+:** ML features + public API

