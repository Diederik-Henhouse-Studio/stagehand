/**
 * Calendar Function Explorer
 * Detecteert alle beschikbare functies op de Calendar pagina
 */

import 'dotenv/config';
import { V3 as Stagehand } from '@browserbasehq/stagehand';
import { writeFileSync } from 'fs';
import { SessionTracker } from './session-tracker';

interface DetectedFunction {
  name: string;
  type: 'button' | 'link' | 'dropdown' | 'input' | 'form';
  selector: string;
  element: string;
  attributes: Record<string, string>;
  interactionMethod: string;
}

interface CalendarState {
  currentMonth: string;
  currentYear: string;
  availableMonths: string[];
  availableYears: string[];
  navigationElements: DetectedFunction[];
}

interface MeetingBasic {
  id: string;
  title: string;
  date: string;
  url: string;
}

export class CalendarExplorer {
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
   * PHASE 1: Explore Calendar page and detect all functions
   */
  async exploreCalendarFunctions(): Promise<CalendarState> {
    console.log('\n🔍 PHASE 1: Exploring Calendar Functions...\n');

    await this.stagehand.init();

    // Track session
    const context = (this.stagehand as any).context;
    if (context && context._sessionId) {
      this.sessionId = context._sessionId;
      const sessionUrl = `https://www.browserbase.com/sessions/${context._sessionId}`;
      this.sessionTracker.startSession(
        context._sessionId,
        sessionUrl,
        context._debugUrl || sessionUrl,
        'Calendar Function Exploration'
      );
    }

    const page = this.stagehand.context.pages()[0];

    // Navigate to calendar
    console.log('📅 Navigating to Calendar page...');
    await page.goto('https://oirschot.bestuurlijkeinformatie.nl/Calendar', {
      waitUntil: 'networkidle'
    });

    console.log('✅ Page loaded\n');

    // Detect all interactive elements
    const state = await page.evaluate(() => {
      const state: any = {
        currentMonth: '',
        currentYear: '',
        availableMonths: [],
        availableYears: [],
        navigationElements: []
      };

      // Find current month/year display
      const monthYearHeaders = Array.from(document.querySelectorAll('h1, h2, h3, .month, .year, [class*="calendar"]'))
        .map(el => el.textContent?.trim())
        .filter(Boolean);

      console.log('Month/Year headers:', monthYearHeaders);

      // Try to extract current month and year from text
      const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
        'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

      for (const text of monthYearHeaders) {
        const lowerText = text?.toLowerCase() || '';

        // Check for month
        for (const month of monthNames) {
          if (lowerText.includes(month)) {
            state.currentMonth = month;
          }
        }

        // Check for year (4 digits)
        const yearMatch = text?.match(/20\d{2}/);
        if (yearMatch) {
          state.currentYear = yearMatch[0];
        }
      }

      // Find all links (potential navigation)
      const links = Array.from(document.querySelectorAll('a'));
      links.forEach((link, index) => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.trim() || '';
        const classes = link.className || '';

        // Detect navigation links
        if (
          href.includes('month=') ||
          href.includes('year=') ||
          text.toLowerCase().includes('vorige') ||
          text.toLowerCase().includes('volgende') ||
          text.toLowerCase().includes('previous') ||
          text.toLowerCase().includes('next') ||
          classes.includes('prev') ||
          classes.includes('next')
        ) {
          state.navigationElements.push({
            name: text || `Link ${index}`,
            type: 'link',
            selector: `a[href="${href}"]`,
            element: `<a href="${href}" class="${classes}">${text}</a>`,
            attributes: {
              href,
              class: classes,
              text
            },
            interactionMethod: 'click'
          });

          // Extract month/year from URL
          const monthMatch = href.match(/month=(\d+)/);
          const yearMatch = href.match(/year=(\d+)/);
          if (monthMatch) state.availableMonths.push(monthMatch[1]);
          if (yearMatch) state.availableYears.push(yearMatch[1]);
        }
      });

      // Find all buttons
      const buttons = Array.from(document.querySelectorAll('button'));
      buttons.forEach((button, index) => {
        const text = button.textContent?.trim() || '';
        const classes = button.className || '';
        const dataAttrs = Array.from(button.attributes)
          .filter(attr => attr.name.startsWith('data-'))
          .reduce((acc, attr) => ({ ...acc, [attr.name]: attr.value }), {});

        if (Object.keys(dataAttrs).length > 0 || text) {
          state.navigationElements.push({
            name: text || `Button ${index}`,
            type: 'button',
            selector: button.id ? `#${button.id}` : `button.${classes.split(' ')[0]}`,
            element: `<button class="${classes}">${text}</button>`,
            attributes: {
              class: classes,
              text,
              ...dataAttrs
            },
            interactionMethod: 'click'
          });
        }
      });

      // Find dropdowns/selects
      const selects = Array.from(document.querySelectorAll('select'));
      selects.forEach((select, index) => {
        const name = select.getAttribute('name') || '';
        const id = select.getAttribute('id') || '';
        const options = Array.from(select.querySelectorAll('option'))
          .map(opt => ({
            value: opt.value,
            text: opt.textContent?.trim()
          }));

        state.navigationElements.push({
          name: name || id || `Select ${index}`,
          type: 'dropdown',
          selector: id ? `#${id}` : `select[name="${name}"]`,
          element: `<select name="${name}" id="${id}">...</select>`,
          attributes: {
            name,
            id,
            options: JSON.stringify(options)
          },
          interactionMethod: 'select'
        });

        // Extract years/months from options
        options.forEach(opt => {
          if (opt.value && opt.value.match(/^\d{4}$/)) {
            state.availableYears.push(opt.value);
          }
          if (opt.value && opt.value.match(/^\d{1,2}$/)) {
            state.availableMonths.push(opt.value);
          }
        });
      });

      // Deduplicate arrays
      state.availableMonths = [...new Set(state.availableMonths)];
      state.availableYears = [...new Set(state.availableYears)];

      return state;
    });

    console.log('📊 Detection Results:');
    console.log(`   Current Month: ${state.currentMonth || 'Not detected'}`);
    console.log(`   Current Year: ${state.currentYear || 'Not detected'}`);
    console.log(`   Available Months: ${state.availableMonths.length}`);
    console.log(`   Available Years: ${state.availableYears.length}`);
    console.log(`   Navigation Elements: ${state.navigationElements.length}\n`);

    // Save detailed report
    this.saveReport('calendar-functions.json', state);

    return state;
  }

  /**
   * PHASE 2: Navigate to December 2025 by ACTUALLY using the dropdowns
   */
  async navigateToMonth(year: number, month: number): Promise<void> {
    console.log(`\n🗓️  PHASE 2: Navigating to ${this.getMonthName(month)} ${year}...\n`);

    const page = this.stagehand.context.pages()[0];

    // Strategy 1: Click and select dropdowns like a real user! 🖱️
    console.log('📍 Strategy 1: Click dropdowns and select values (real user interaction)');

    try {
      // Month is 0-indexed: 0=januari, 11=december
      const monthIndex = month - 1;

      console.log(`   Selecting year: ${year}...`);

      // Select year from dropdown - use Playwright's native select
      await page.locator('#CurrentYear').selectOption(year.toString());
      console.log(`   ✅ Year selected: ${year}`);

      // Wait a bit for any JavaScript to process
      await page.waitForTimeout(500);

      console.log(`   Selecting month: ${this.getMonthName(month)} (value: ${monthIndex})...`);

      // Select month from dropdown
      await page.locator('#CurrentMonth').selectOption(monthIndex.toString());
      console.log(`   ✅ Month selected: ${this.getMonthName(month)}`);

      // Wait for AJAX request to complete and page to update
      console.log('   Waiting for calendar to update (3s)...');
      await page.waitForTimeout(3000);

      // Verify the selection
      const verification = await page.evaluate(() => {
        const yearSelect = document.querySelector('#CurrentYear') as HTMLSelectElement;
        const monthSelect = document.querySelector('#CurrentMonth') as HTMLSelectElement;
        return {
          year: yearSelect?.value,
          month: monthSelect?.value,
          monthText: monthSelect?.options[monthSelect.selectedIndex]?.text
        };
      });

      console.log(`   ✅ Verified: ${verification.monthText} ${verification.year}\n`);
      return;

    } catch (error) {
      console.log(`   ❌ API call failed: ${error}`);
      console.log('   Trying page reload fallback...\n');
    }

    // Strategy 2: Fallback - reload page and hope for the best
    console.log('📍 Strategy 2: Page reload (fallback)');

    try {
      await page.reload({ waitUntil: 'networkidle' });
      console.log('   ⚠️  Page reloaded, using current month data\n');
    } catch (error) {
      console.log('   ❌ Fallback also failed\n');
      throw new Error(`Could not navigate to ${this.getMonthName(month)} ${year}`);
    }
  }

  /**
   * PHASE 3: Extract meetings from current view
   */
  async extractMeetings(): Promise<MeetingBasic[]> {
    console.log('📋 PHASE 3: Extracting Meetings...\n');

    const page = this.stagehand.context.pages()[0];

    const meetings = await page.evaluate(() => {
      // Focus on the main content section where meetings are listed
      const mainContent = document.querySelector('section.col#maincontent');

      if (!mainContent) {
        console.log('⚠️  Warning: maincontent section not found, searching whole page');
      }

      const searchRoot = mainContent || document;
      const meetingLinks = Array.from(
        searchRoot.querySelectorAll('a[href*="/Agenda/Index/"]')
      ) as HTMLAnchorElement[];

      console.log(`Found ${meetingLinks.length} meeting links in ${mainContent ? 'maincontent' : 'whole page'}`);

      return meetingLinks.map(link => {
        const idMatch = link.href.match(/\/Agenda\/Index\/([a-f0-9-]+)/i);

        // Get parent row/container for context
        const container = link.closest('tr, li, div, article');
        const fullText = container?.textContent?.trim() || link.textContent?.trim() || '';

        // Try to extract date from context
        const dateMatch = fullText.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i);

        return {
          id: idMatch?.[1] || '',
          title: link.textContent?.trim() || '',
          date: dateMatch ? dateMatch[0] : fullText.substring(0, 50),
          url: link.href
        };
      }).filter(m => m.id);
    });

    console.log(`   Found ${meetings.length} meetings\n`);

    meetings.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.title}`);
      console.log(`      Date: ${m.date}`);
      console.log(`      ID: ${m.id.substring(0, 8)}...\n`);
    });

    return meetings;
  }

  /**
   * PHASE 4: Deep dive into each meeting
   */
  async scrapeMeetingDetails(meetingUrl: string) {
    console.log(`🔍 Opening meeting: ${meetingUrl.substring(0, 60)}...`);

    const page = this.stagehand.context.pages()[0];
    await page.goto(meetingUrl, { waitUntil: 'networkidle' });

    const details = await page.evaluate(() => {
      const result: any = {
        metadata: {},
        agendaItems: [],
        attachments: [],
        availableSections: []
      };

      // Extract ALL text content types
      result.availableSections = Array.from(
        document.querySelectorAll('h1, h2, h3, h4, section, article, .section, [class*="agenda"]')
      ).map(el => ({
        tag: el.tagName,
        class: el.className,
        id: el.id,
        text: el.textContent?.substring(0, 100).trim()
      }));

      // Extract metadata from <dl>
      const dl = document.querySelector('dl');
      if (dl) {
        const keys = dl.querySelectorAll('dt');
        const values = dl.querySelectorAll('dd');
        keys.forEach((key, index) => {
          const k = key.textContent?.trim().replace(':', '') || '';
          const v = values[index]?.textContent?.trim() || '';
          if (k) result.metadata[k] = v;
        });
      }

      // Find agenda items (EXCLUDE breadcrumb navigation!)
      // Try multiple selectors to find the real agenda list
      const agendaSelectors = [
        'ol.agenda-items',                           // Specific agenda class
        'ul.agenda-items',
        '#maincontent ol:not(.breadcrumb)',          // Ordered list NOT breadcrumb
        '#maincontent ul:not(.breadcrumb)',
        'section.agenda ol',                         // Section with agenda
        'div[class*="agenda"] ol:not(.breadcrumb)',  // Div containing "agenda"
      ];

      let agendaList = null;
      for (const selector of agendaSelectors) {
        agendaList = document.querySelector(selector);
        if (agendaList) {
          console.log(`Found agenda items using selector: ${selector}`);
          break;
        }
      }

      if (agendaList) {
        const items = agendaList.querySelectorAll(':scope > li');
        console.log(`Extracting ${items.length} agenda items`);

        items.forEach((li, index) => {
          // Skip if this looks like breadcrumb (contains "Home" or navigation links)
          const text = li.textContent?.trim() || '';
          if (text === 'Home' || text === 'Vergaderingen' || li.querySelector('a[href="/"]')) {
            console.log(`Skipping breadcrumb item: ${text}`);
            return;
          }

          result.agendaItems.push({
            index: index + 1,
            html: li.innerHTML.substring(0, 200),
            text: text.substring(0, 200),
            hasAttachments: li.querySelectorAll('a[href*="/Document/"]').length > 0
          });
        });
      } else {
        console.log('⚠️  No agenda list found, will need to investigate HTML structure');
      }

      // Find ALL attachments
      const attachmentLinks = document.querySelectorAll('a[href*="/Document/"], a[href*=".pdf"]');
      result.attachments = Array.from(attachmentLinks).map(link => ({
        text: link.textContent?.trim(),
        href: (link as HTMLAnchorElement).href
      }));

      return result;
    });

    console.log(`   ✅ Metadata fields: ${Object.keys(details.metadata).length}`);
    console.log(`   ✅ Agenda items: ${details.agendaItems.length}`);
    console.log(`   ✅ Attachments: ${details.attachments.length}`);
    console.log(`   ✅ Sections: ${details.availableSections.length}\n`);

    return details;
  }

  /**
   * Complete exploration workflow
   */
  async runCompleteExploration() {
    try {
      // Phase 1: Detect functions
      const state = await this.exploreCalendarFunctions();

      // Phase 2: Navigate to December 2025
      await this.navigateToMonth(2025, 12);

      // Phase 3: Extract meetings
      const meetings = await this.extractMeetings();

      // Save meeting list
      this.saveReport('december-2025-meetings.json', meetings);

      // Phase 4: Deep dive (first 3 meetings)
      const detailedMeetings = [];
      const maxMeetings = Math.min(3, meetings.length);

      console.log(`\n🔬 PHASE 4: Deep Dive (${maxMeetings} meetings)...\n`);

      for (let i = 0; i < maxMeetings; i++) {
        const meeting = meetings[i];
        console.log(`\n📄 Meeting ${i + 1}/${maxMeetings}: ${meeting.title}\n`);

        const details = await this.scrapeMeetingDetails(meeting.url);
        detailedMeetings.push({
          ...meeting,
          ...details
        });

        // Delay between requests
        if (i < maxMeetings - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      // Save detailed results
      this.saveReport('december-2025-detailed.json', detailedMeetings);

      // Generate summary
      this.generateSummary(state, meetings, detailedMeetings);

      // Update session
      if (this.sessionId) {
        this.sessionTracker.completeSession(this.sessionId);
      }

      await this.stagehand.close();

    } catch (error) {
      console.error('\n❌ Exploration failed:', error);
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
   * Helper: Get Dutch month name
   */
  private getMonthName(month: number): string {
    const months = [
      'januari', 'februari', 'maart', 'april', 'mei', 'juni',
      'juli', 'augustus', 'september', 'oktober', 'november', 'december'
    ];
    return months[month - 1] || `month-${month}`;
  }

  /**
   * Helper: Save report to file
   */
  private saveReport(filename: string, data: any) {
    const path = `./data/${filename}`;
    writeFileSync(path, JSON.stringify(data, null, 2));
    console.log(`💾 Saved: ${path}`);
  }

  /**
   * Generate final summary
   */
  private generateSummary(state: CalendarState, meetings: MeetingBasic[], detailed: any[]) {
    const summary = `
════════════════════════════════════════════════════════════════
🔬 CALENDAR EXPLORATION REPORT
════════════════════════════════════════════════════════════════

📅 CALENDAR STATE:
   Current Month: ${state.currentMonth || 'Unknown'}
   Current Year:  ${state.currentYear || 'Unknown'}

   Available Months: ${state.availableMonths.join(', ') || 'None detected'}
   Available Years:  ${state.availableYears.join(', ') || 'None detected'}

🔧 DETECTED FUNCTIONS:
   Total Navigation Elements: ${state.navigationElements.length}

   By Type:
   - Links:     ${state.navigationElements.filter(e => e.type === 'link').length}
   - Buttons:   ${state.navigationElements.filter(e => e.type === 'button').length}
   - Dropdowns: ${state.navigationElements.filter(e => e.type === 'dropdown').length}

📋 DECEMBER 2025 MEETINGS:
   Total Meetings: ${meetings.length}

📊 DEEP DIVE RESULTS:
   Meetings Analyzed: ${detailed.length}

   Average per Meeting:
   - Metadata fields: ${(detailed.reduce((sum, m) => sum + Object.keys(m.metadata || {}).length, 0) / detailed.length).toFixed(1)}
   - Agenda items:    ${(detailed.reduce((sum, m) => sum + (m.agendaItems?.length || 0), 0) / detailed.length).toFixed(1)}
   - Attachments:     ${(detailed.reduce((sum, m) => sum + (m.attachments?.length || 0), 0) / detailed.length).toFixed(1)}

════════════════════════════════════════════════════════════════

✅ DATA FILES GENERATED:
   • data/calendar-functions.json       - All detected functions
   • data/december-2025-meetings.json   - Meeting list
   • data/december-2025-detailed.json   - Deep dive results

🎯 NEXT STEPS:
   1. Review calendar-functions.json for navigation methods
   2. Validate december-2025-meetings.json data accuracy
   3. Use detailed.json to create page-type profiles

════════════════════════════════════════════════════════════════
`;

    console.log(summary);
    writeFileSync('./data/exploration-summary.txt', summary);
  }
}

// Run exploration
if (import.meta.url === `file://${process.argv[1]}`) {
  const explorer = new CalendarExplorer();

  explorer.runCompleteExploration()
    .then(() => {
      console.log('\n✅ Exploration complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });
}
