/**
 * Deep Meeting Crawler for Oirschot
 * Crawls calendar, extracts meeting list, then dives into each meeting
 * for detailed agenda items and attachments
 */

import 'dotenv/config';
import { V3 as Stagehand } from '@browserbasehq/stagehand';
import { SessionTracker } from './session-tracker';
import { writeFileSync } from 'fs';

interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  url: string;
}

interface AgendaItem {
  number: string;
  title: string;
  description?: string;
  attachments: Attachment[];
}

interface Attachment {
  name: string;
  url: string;
  type: string;
}

interface MeetingDetails extends Meeting {
  agendaItems: AgendaItem[];
  totalAttachments: number;
  scrapedAt: string;
}

export class DeepMeetingCrawler {
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
   * Main crawl workflow
   */
  async crawl(maxMeetings: number = 5): Promise<MeetingDetails[]> {
    console.log('🚀 Starting Deep Meeting Crawler...\n');

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
          'Deep Meeting Crawl'
        );
      }

      // Step 1: Get meetings list from calendar
      console.log('📅 Step 1: Fetching meetings from calendar...');
      const meetings = await this.getMeetingsList();
      console.log(`   Found ${meetings.length} meetings\n`);

      this.sessionTracker.updateSession(this.sessionId!, { meetings: meetings.length });

      // Step 2: Crawl each meeting (limit to maxMeetings)
      console.log(`🔍 Step 2: Crawling ${Math.min(maxMeetings, meetings.length)} meeting details...\n`);
      const detailedMeetings: MeetingDetails[] = [];

      for (let i = 0; i < Math.min(maxMeetings, meetings.length); i++) {
        const meeting = meetings[i];
        console.log(`   ${i + 1}/${Math.min(maxMeetings, meetings.length)} Processing: ${meeting.title}`);

        try {
          const details = await this.getMeetingDetails(meeting);
          detailedMeetings.push(details);
          console.log(`      ✅ Found ${details.agendaItems.length} agenda items, ${details.totalAttachments} attachments\n`);
        } catch (error) {
          console.error(`      ❌ Error: ${error instanceof Error ? error.message : error}\n`);
        }

        // Small delay between meetings
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      this.sessionTracker.updateSession(this.sessionId!, { meetingDetails: detailedMeetings.length });

      // Step 3: Save results
      this.saveResults(detailedMeetings);

      // Complete session
      this.sessionTracker.completeSession(this.sessionId!);

      await this.stagehand.close();

      return detailedMeetings;

    } catch (error) {
      console.error('❌ Crawl failed:', error);
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
   * Get list of meetings from calendar page
   */
  private async getMeetingsList(): Promise<Meeting[]> {
    const page = this.stagehand.context.pages()[0];

    // Go to calendar
    await page.goto('https://oirschot.bestuurlijkeinformatie.nl/Calendar', {
      waitUntil: 'networkidle'
    });

    // Extract meetings using DOM parsing
    const meetings = await page.evaluate(() => {
      const meetingElements = Array.from(
        document.querySelectorAll('[data-meeting-id], .meeting-item, .calendar-item, a[href*="/Agenda/Index/"]')
      );

      return meetingElements.map(el => {
        // Try to extract meeting ID from URL
        const link = el as HTMLAnchorElement;
        const href = link.href || el.querySelector('a')?.href || '';
        const idMatch = href.match(/\/Agenda\/Index\/([a-f0-9-]+)/i);
        const id = idMatch ? idMatch[1] : '';

        // Extract title
        const title = (el.textContent || '').trim().substring(0, 200);

        // Try to find date/time
        const dateEl = el.querySelector('.date, .meeting-date, time, [class*="date"]');
        const timeEl = el.querySelector('.time, .meeting-time, [class*="time"]');

        return {
          id,
          title,
          date: dateEl?.textContent?.trim() || 'TBD',
          time: timeEl?.textContent?.trim() || '',
          url: href
        };
      }).filter(m => m.id && m.url); // Only keep meetings with valid IDs
    });

    return meetings;
  }

  /**
   * Get detailed information for a specific meeting
   */
  private async getMeetingDetails(meeting: Meeting): Promise<MeetingDetails> {
    const page = this.stagehand.context.pages()[0];

    // Navigate to meeting page
    await page.goto(meeting.url, { waitUntil: 'networkidle' });

    // Extract agenda items and attachments
    const agendaData = await page.evaluate(() => {
      const agendaItems: any[] = [];

      // Find agenda items (multiple possible selectors)
      const itemElements = Array.from(
        document.querySelectorAll('.agenda-item, [class*="agendapunt"], .meeting-item, tr[data-agenda-id]')
      );

      itemElements.forEach(item => {
        // Extract agenda number
        const numberEl = item.querySelector('.number, .agenda-number, [class*="nummer"]');
        const number = numberEl?.textContent?.trim() || '';

        // Extract title
        const titleEl = item.querySelector('.title, .agenda-title, h3, h4, strong');
        const title = titleEl?.textContent?.trim() || item.textContent?.substring(0, 100).trim() || '';

        // Extract description
        const descEl = item.querySelector('.description, .agenda-description, p');
        const description = descEl?.textContent?.trim();

        // Extract attachments
        const attachmentLinks = Array.from(item.querySelectorAll('a[href*="/download"], a[href*=".pdf"], .attachment a'));
        const attachments = attachmentLinks.map(link => ({
          name: link.textContent?.trim() || 'Document',
          url: (link as HTMLAnchorElement).href,
          type: (link as HTMLAnchorElement).href.includes('.pdf') ? 'PDF' : 'Unknown'
        }));

        if (title) {
          agendaItems.push({
            number,
            title,
            description,
            attachments
          });
        }
      });

      return agendaItems;
    });

    const totalAttachments = agendaData.reduce((sum, item) => sum + item.attachments.length, 0);

    return {
      ...meeting,
      agendaItems: agendaData,
      totalAttachments,
      scrapedAt: new Date().toISOString()
    };
  }

  /**
   * Save crawl results to JSON file
   */
  private saveResults(meetings: MeetingDetails[]) {
    const filename = `./data/meetings-${new Date().toISOString().split('T')[0]}.json`;
    writeFileSync(filename, JSON.stringify(meetings, null, 2));
    console.log(`\n💾 Results saved to: ${filename}`);
  }

  /**
   * Generate summary report
   */
  generateSummary(meetings: MeetingDetails[]): string {
    const totalAgendaItems = meetings.reduce((sum, m) => sum + m.agendaItems.length, 0);
    const totalAttachments = meetings.reduce((sum, m) => sum + m.totalAttachments, 0);

    let report = `
📊 DEEP MEETING CRAWL SUMMARY
════════════════════════════════════════

📋 Overview:
  Meetings Analyzed:   ${meetings.length}
  Total Agenda Items:  ${totalAgendaItems}
  Total Attachments:   ${totalAttachments}

📅 Meetings:
`;

    meetings.forEach((meeting, idx) => {
      report += `
  ${idx + 1}. ${meeting.title}
     Date: ${meeting.date} ${meeting.time}
     URL: ${meeting.url}
     Agenda Items: ${meeting.agendaItems.length}
     Attachments: ${meeting.totalAttachments}
`;
    });

    report += `
════════════════════════════════════════
    `;

    return report.trim();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const crawler = new DeepMeetingCrawler();

  crawler.crawl(3) // Crawl first 3 meetings
    .then(meetings => {
      console.log(crawler.generateSummary(meetings));

      // Print session report
      const tracker = new SessionTracker('./data');
      console.log('\n' + tracker.generateReport());

      process.exit(0);
    })
    .catch(error => {
      console.error('Crawl failed:', error.message);
      process.exit(1);
    });
}

export { Meeting, MeetingDetails, AgendaItem, Attachment };
