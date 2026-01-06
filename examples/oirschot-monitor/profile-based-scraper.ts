/**
 * Profile-Based Scraper
 * NO AI - Uses extraction profiles per page type
 */

import 'dotenv/config';
import { V3 as Stagehand } from '@browserbasehq/stagehand';
import { PageProfiles, getProfileForUrl } from './page-profiles';
import { SessionTracker } from './session-tracker';
import { writeFileSync } from 'fs';

interface CalendarNavigationOptions {
  year: number;
  month: number; // 1-12
}

interface ExtractedMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  chairman: string;
  broadcast?: string;
  agendaItems: Array<{
    number: string;
    title: string;
    description: string;
    category: 'regular' | 'hamerstuk' | 'bespreekstuk';
    attachments: Array<{
      name: string;
      url: string;
      size?: string;
      type: string;
    }>;
  }>;
  metadata: Record<string, string>;
}

export class ProfileBasedScraper {
  private stagehand: Stagehand;
  private sessionTracker: SessionTracker;
  private sessionId?: string;

  constructor() {
    this.sessionTracker = new SessionTracker('./data');
    this.stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      verbose: 1,
      enableCache: false,
    });
  }

  /**
   * Scrape calendar and all meetings for a given month
   */
  async scrapeMonth(year: number, month: number): Promise<ExtractedMeeting[]> {
    console.log(`\n🗓️  Scraping ${this.getMonthName(month)} ${year}...\n`);

    try {
      await this.stagehand.init();

      // Track session
      const context = (this.stagehand as any).context;
      if (context && context._sessionId) {
        this.sessionId = context._sessionId;
        const sessionUrl = `https://www.browserbase.com/sessions/${context._sessionId}`;
        const debugUrl = context._debugUrl || sessionUrl;
        this.sessionTracker.startSession(
          context._sessionId,
          sessionUrl,
          debugUrl,
          `Scrape ${this.getMonthName(month)} ${year}`
        );
      }

      const page = this.stagehand.context.pages()[0];

      // Step 1: Navigate to calendar with month/year
      const calendarUrl = this.buildCalendarUrl(year, month);
      console.log(`📅 Navigating to: ${calendarUrl}`);
      await page.goto(calendarUrl, { waitUntil: 'networkidle' });

      // Step 2: Extract meeting list using Calendar profile
      console.log('📋 Extracting meeting list...');
      const meetingIds = await this.extractCalendarMeetings(page);
      console.log(`   Found ${meetingIds.length} meetings\n`);

      this.sessionTracker.updateSession(this.sessionId!, { meetings: meetingIds.length });

      // Step 3: Scrape each meeting detail
      const meetings: ExtractedMeeting[] = [];

      for (let i = 0; i < meetingIds.length; i++) {
        const meetingId = meetingIds[i];
        console.log(`   ${i + 1}/${meetingIds.length} Scraping meeting ${meetingId.id.substring(0, 8)}...`);

        try {
          const meeting = await this.scrapeMeetingDetail(page, meetingId.url);
          meetings.push(meeting);
          console.log(`      ✅ ${meeting.agendaItems.length} agenda items, ${this.countAttachments(meeting)} attachments`);
        } catch (error) {
          console.error(`      ❌ Error: ${error instanceof Error ? error.message : error}`);
        }

        // Delay between requests
        if (i < meetingIds.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      // Save results
      this.saveResults(meetings, year, month);

      this.sessionTracker.updateSession(this.sessionId!, { meetingDetails: meetings.length });
      this.sessionTracker.completeSession(this.sessionId!);

      await this.stagehand.close();

      return meetings;

    } catch (error) {
      console.error('Scraping failed:', error);
      if (this.sessionId) {
        this.sessionTracker.completeSession(
          this.sessionId,
          error instanceof Error ? error.message : String(error)
        );
      }
      await this.stagehand.close();
      throw error;
    }
  }

  /**
   * Extract meeting list from calendar page
   */
  private async extractCalendarMeetings(page: any): Promise<Array<{ id: string; url: string }>> {
    return await page.evaluate(() => {
      const profile = {
        meetings: 'a[href*="/Agenda/Index/"]'
      };

      const links = Array.from(document.querySelectorAll(profile.meetings)) as HTMLAnchorElement[];

      return links.map(link => {
        const idMatch = link.href.match(/\/Agenda\/Index\/([a-f0-9-]+)/i);
        return {
          id: idMatch?.[1] || '',
          url: link.href
        };
      }).filter(m => m.id);
    });
  }

  /**
   * Scrape meeting detail page using profile
   */
  private async scrapeMeetingDetail(page: any, url: string): Promise<ExtractedMeeting> {
    await page.goto(url, { waitUntil: 'networkidle' });

    const data = await page.evaluate(() => {
      // Extract metadata from <dl>
      const metadata: Record<string, string> = {};
      const dl = document.querySelector('dl');
      if (dl) {
        const keys = dl.querySelectorAll('dt');
        const values = dl.querySelectorAll('dd');

        keys.forEach((key, index) => {
          const keyText = key.textContent?.trim().replace(':', '') || '';
          const valueText = values[index]?.textContent?.trim() || '';
          if (keyText && valueText) {
            metadata[keyText.toLowerCase()] = valueText;
          }
        });
      }

      // Extract basic info
      const title = document.querySelector('h1')?.textContent?.trim() || '';
      const dateEl = document.querySelector('h2');
      const dateText = dateEl?.textContent?.trim() || '';

      // Time is usually after the date in text nodes
      let timeText = '';
      const timeMatch = document.body.textContent?.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (timeMatch) {
        timeText = timeMatch[0];
      }

      // Extract agenda items
      const agendaItems: any[] = [];
      const agendaList = document.querySelector('ol');

      if (agendaList) {
        const items = agendaList.querySelectorAll(':scope > li');

        items.forEach(li => {
          // Extract number
          const numberEl = li.querySelector('strong:first-child');
          const number = numberEl?.textContent?.trim() || '';

          // Extract title
          const fullText = li.textContent || '';
          const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
          const title = lines[0] || '';

          // Extract description (paragraphs)
          const descriptionEls = li.querySelectorAll('p');
          const description = Array.from(descriptionEls)
            .map(p => p.textContent?.trim())
            .filter(Boolean)
            .join('\n\n');

          // Determine category
          const lowerText = fullText.toLowerCase();
          let category = 'regular';
          if (lowerText.includes('hamerstuk')) category = 'hamerstuk';
          if (lowerText.includes('bespreekstuk')) category = 'bespreekstuk';

          // Extract attachments
          const attachmentLinks = li.querySelectorAll('a[href*="/Agenda/Document/"]');
          const attachments = Array.from(attachmentLinks).map(link => {
            const text = link.textContent?.trim() || '';
            return {
              name: text,
              url: (link as HTMLAnchorElement).href,
              type: text.toLowerCase().includes('.pdf') ? 'PDF' : 'Unknown'
            };
          });

          agendaItems.push({
            number,
            title: title.substring(0, 200),
            description,
            category,
            attachments
          });
        });
      }

      return {
        title,
        date: dateText,
        time: timeText,
        location: metadata['locatie'] || metadata['plaats'] || '',
        chairman: metadata['voorzitter'] || '',
        broadcast: metadata['uitzending'] || '',
        metadata,
        agendaItems
      };
    });

    // Extract meeting ID from URL
    const idMatch = url.match(/\/Agenda\/Index\/([a-f0-9-]+)/i);

    return {
      id: idMatch?.[1] || '',
      ...data
    };
  }

  /**
   * Build calendar URL for specific month/year
   */
  private buildCalendarUrl(year: number, month: number): string {
    // iBabs might use query params or path segments
    // Try common patterns:
    return `https://oirschot.bestuurlijkeinformatie.nl/Calendar?year=${year}&month=${month}`;
  }

  /**
   * Get month name in Dutch
   */
  private getMonthName(month: number): string {
    const months = [
      'januari', 'februari', 'maart', 'april', 'mei', 'juni',
      'juli', 'augustus', 'september', 'oktober', 'november', 'december'
    ];
    return months[month - 1] || `maand-${month}`;
  }

  /**
   * Count total attachments
   */
  private countAttachments(meeting: ExtractedMeeting): number {
    return meeting.agendaItems.reduce(
      (sum, item) => sum + item.attachments.length,
      0
    );
  }

  /**
   * Save results to JSON
   */
  private saveResults(meetings: ExtractedMeeting[], year: number, month: number) {
    const filename = `./data/meetings-${year}-${String(month).padStart(2, '0')}.json`;
    writeFileSync(filename, JSON.stringify(meetings, null, 2));
    console.log(`\n💾 Results saved to: ${filename}`);
  }

  /**
   * Generate summary report
   */
  generateSummary(meetings: ExtractedMeeting[]): string {
    const totalAgenda = meetings.reduce((sum, m) => sum + m.agendaItems.length, 0);
    const totalAttachments = meetings.reduce((sum, m) => sum + this.countAttachments(m), 0);

    const hamerstukken = meetings.reduce((sum, m) =>
      sum + m.agendaItems.filter(i => i.category === 'hamerstuk').length, 0
    );

    const bespreekstukken = meetings.reduce((sum, m) =>
      sum + m.agendaItems.filter(i => i.category === 'bespreekstuk').length, 0
    );

    return `
📊 PROFILE-BASED SCRAPING SUMMARY
════════════════════════════════════════

✅ NO AI USED - 100% HTML/DOM Extraction

📋 Results:
  Meetings:        ${meetings.length}
  Agenda Items:    ${totalAgenda}
  Attachments:     ${totalAttachments}

📑 Categories:
  Hamerstukken:    ${hamerstukken}
  Bespreekstukken: ${bespreekstukken}
  Regular:         ${totalAgenda - hamerstukken - bespreekstukken}

════════════════════════════════════════
    `.trim();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new ProfileBasedScraper();

  // Scrape January 2026
  scraper.scrapeMonth(2026, 1)
    .then(meetings => {
      console.log('\n' + scraper.generateSummary(meetings));

      // Show session report
      const tracker = new SessionTracker('./data');
      console.log('\n' + tracker.generateReport());

      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
}

export { ProfileBasedScraper, ExtractedMeeting };
