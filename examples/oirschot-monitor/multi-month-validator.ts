/**
 * Multi-Month Validator
 * Scrapes 3 maanden (okt, nov, dec 2025) en valideert universele page-type profiles
 */

import 'dotenv/config';
import { V3 as Stagehand } from '@browserbasehq/stagehand';
import { writeFileSync, mkdirSync } from 'fs';

interface MeetingDetail {
  id: string;
  title: string;
  date: string;
  url: string;
  month: string;

  // Detailed analysis
  meetingType: string;
  location: string;
  metadata: Record<string, string>;
  agendaItemsCount: number;
  agendaItemsStructure: string[];
  attachmentsCount: number;
  attachmentTypes: string[];
  sectionsCount: number;
  htmlStructure: {
    hasMainContent: boolean;
    hasBreadcrumb: boolean;
    hasAgendaList: boolean;
    hasAttachmentsList: boolean;
  };
}

interface MonthReport {
  month: string;
  year: number;
  meetingsCount: number;
  meetings: MeetingDetail[];

  // Aggregates
  uniqueMeetingTypes: string[];
  totalAgendaItems: number;
  totalAttachments: number;
  avgAgendaItems: number;
  avgAttachments: number;
}

interface ValidationReport {
  months: MonthReport[];

  // Cross-month analysis
  allMeetingTypes: string[];
  structureVariations: string[];
  dataConsistency: {
    allHaveMetadata: boolean;
    allHaveAgendaItems: boolean;
    allHaveAttachments: boolean;
    inconsistencies: string[];
  };

  // Universal page-type profile
  universalProfile: {
    supportedMeetingTypes: string[];
    requiredSelectors: string[];
    optionalSelectors: string[];
    extractionStrategies: string[];
  };
}

export class MultiMonthValidator {
  private stagehand: Stagehand;

  constructor() {
    this.stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      verbose: 1,
      enableCache: false,
    });
  }

  /**
   * Main validation workflow
   */
  async runValidation(): Promise<ValidationReport> {
    console.log('\n🔬 MULTI-MONTH VALIDATION');
    console.log('════════════════════════════════════════════════════════════════\n');

    await this.stagehand.init();
    const page = this.stagehand.context.pages()[0];

    // Navigate to calendar
    console.log('📅 Navigating to Calendar page...\n');
    await page.goto('https://oirschot.bestuurlijkeinformatie.nl/Calendar', {
      waitUntil: 'networkidle'
    });

    const months = [
      { name: 'oktober', value: 10, year: 2025 },
      { name: 'november', value: 11, year: 2025 },
      { name: 'december', value: 12, year: 2025 },
    ];

    const monthReports: MonthReport[] = [];

    for (const monthInfo of months) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📆 SCRAPING: ${monthInfo.name.toUpperCase()} ${monthInfo.year}`);
      console.log(`${'='.repeat(70)}\n`);

      const report = await this.scrapeMonth(page, monthInfo.year, monthInfo.value, monthInfo.name);
      monthReports.push(report);

      // Save individual month report
      this.saveReport(`data/validation-${monthInfo.name}-2025.json`, report);
    }

    // Generate cross-month analysis
    const validationReport = this.analyzeAcrossMonths(monthReports);

    // Save final report
    this.saveReport('data/validation-report.json', validationReport);
    this.generateTextReport(validationReport);

    await this.stagehand.close();

    return validationReport;
  }

  /**
   * Scrape a single month
   */
  private async scrapeMonth(
    page: any,
    year: number,
    month: number,
    monthName: string
  ): Promise<MonthReport> {
    // Navigate to month
    console.log(`🗓️  Selecting ${monthName} ${year}...`);

    const monthIndex = month - 1; // 0-indexed

    await page.locator('#CurrentYear').selectOption(year.toString());
    await page.waitForTimeout(500);

    await page.locator('#CurrentMonth').selectOption(monthIndex.toString());
    await page.waitForTimeout(3000);

    console.log(`✅ Navigation complete\n`);

    // Extract meetings list
    const meetings = await this.extractMeetings(page);
    console.log(`📋 Found ${meetings.length} meetings\n`);

    // Deep dive into EACH meeting
    const detailedMeetings: MeetingDetail[] = [];

    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i];
      console.log(`\n📄 Meeting ${i + 1}/${meetings.length}: ${meeting.title.substring(0, 50)}...`);

      const details = await this.scrapeMeetingDetails(page, meeting, monthName);
      detailedMeetings.push(details);

      // Delay between requests
      if (i < meetings.length - 1) {
        await page.waitForTimeout(2000);
      }
    }

    // Generate month report
    const report: MonthReport = {
      month: monthName,
      year,
      meetingsCount: detailedMeetings.length,
      meetings: detailedMeetings,
      uniqueMeetingTypes: [...new Set(detailedMeetings.map(m => m.meetingType))],
      totalAgendaItems: detailedMeetings.reduce((sum, m) => sum + m.agendaItemsCount, 0),
      totalAttachments: detailedMeetings.reduce((sum, m) => sum + m.attachmentsCount, 0),
      avgAgendaItems: detailedMeetings.length > 0
        ? detailedMeetings.reduce((sum, m) => sum + m.agendaItemsCount, 0) / detailedMeetings.length
        : 0,
      avgAttachments: detailedMeetings.length > 0
        ? detailedMeetings.reduce((sum, m) => sum + m.attachmentsCount, 0) / detailedMeetings.length
        : 0,
    };

    console.log(`\n✅ ${monthName} complete:`);
    console.log(`   - ${report.meetingsCount} meetings`);
    console.log(`   - ${report.uniqueMeetingTypes.length} unique types`);
    console.log(`   - ${report.totalAgendaItems} total agenda items`);
    console.log(`   - ${report.totalAttachments} total attachments\n`);

    return report;
  }

  /**
   * Extract meetings from current calendar view
   */
  private async extractMeetings(page: any): Promise<Array<{id: string, title: string, date: string, url: string}>> {
    return await page.evaluate(() => {
      const mainContent = document.querySelector('section.col#maincontent');
      const searchRoot = mainContent || document;
      const meetingLinks = Array.from(
        searchRoot.querySelectorAll('a[href*="/Agenda/Index/"]')
      ) as HTMLAnchorElement[];

      return meetingLinks.map(link => {
        const idMatch = link.href.match(/\/Agenda\/Index\/([a-f0-9-]+)/i);
        const container = link.closest('tr, li, div, article');
        const fullText = container?.textContent?.trim() || link.textContent?.trim() || '';
        const dateMatch = fullText.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i);

        return {
          id: idMatch?.[1] || '',
          title: link.textContent?.trim() || '',
          date: dateMatch ? dateMatch[0] : fullText.substring(0, 50),
          url: link.href
        };
      }).filter(m => m.id);
    });
  }

  /**
   * Deep scrape of meeting details
   */
  private async scrapeMeetingDetails(
    page: any,
    meeting: {id: string, title: string, date: string, url: string},
    month: string
  ): Promise<MeetingDetail> {
    await page.goto(meeting.url, { waitUntil: 'networkidle' });

    const analysis = await page.evaluate(() => {
      const result: any = {
        metadata: {},
        agendaItems: [],
        attachments: [],
        sections: [],
        htmlStructure: {
          hasMainContent: !!document.querySelector('#maincontent'),
          hasBreadcrumb: !!document.querySelector('.breadcrumb, ol.breadcrumb, ul.breadcrumb'),
          hasAgendaList: false,
          hasAttachmentsList: false,
        }
      };

      // Extract metadata
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

      // Find agenda items (try multiple selectors)
      const agendaSelectors = [
        'ol.agenda-items',
        'ul.agenda-items',
        '#maincontent ol:not(.breadcrumb)',
        '#maincontent ul:not(.breadcrumb)',
        'section.agenda ol',
        'div[class*="agenda"] ol:not(.breadcrumb)',
      ];

      let agendaList = null;
      for (const selector of agendaSelectors) {
        agendaList = document.querySelector(selector);
        if (agendaList) {
          result.htmlStructure.hasAgendaList = true;
          break;
        }
      }

      if (agendaList) {
        const items = agendaList.querySelectorAll(':scope > li');
        items.forEach((li) => {
          const text = li.textContent?.trim() || '';
          // Skip breadcrumbs
          if (text === 'Home' || text === 'Vergaderingen' || li.querySelector('a[href="/"]')) {
            return;
          }

          result.agendaItems.push({
            text: text.substring(0, 100),
            hasAttachments: li.querySelectorAll('a[href*="/Document/"]').length > 0,
            hasSubItems: li.querySelectorAll('ol, ul').length > 0,
          });
        });
      }

      // Find attachments
      const attachmentLinks = document.querySelectorAll('a[href*="/Document/"], a[href*=".pdf"]');
      result.htmlStructure.hasAttachmentsList = attachmentLinks.length > 0;

      attachmentLinks.forEach(link => {
        const href = (link as HTMLAnchorElement).href;
        const text = link.textContent?.trim() || '';

        // Determine type from extension or href
        let type = 'unknown';
        if (href.includes('.pdf')) type = 'pdf';
        else if (href.includes('.docx') || href.includes('.doc')) type = 'word';
        else if (href.includes('.xlsx') || href.includes('.xls')) type = 'excel';
        else if (href.includes('/Document/')) type = 'document';

        result.attachments.push({
          text,
          href,
          type
        });
      });

      // Count sections
      result.sections = Array.from(
        document.querySelectorAll('h1, h2, h3, h4, section')
      ).map(el => ({
        tag: el.tagName,
        class: el.className,
      }));

      return result;
    });

    // Extract meeting type from title
    const titleLower = meeting.title.toLowerCase();
    let meetingType = 'Unknown';

    if (titleLower.includes('presidium')) meetingType = 'Presidium';
    else if (titleLower.includes('besluitvormende')) meetingType = 'Besluitvormende raadsvergadering';
    else if (titleLower.includes('raadsbijeenkomst')) meetingType = 'Raadsbijeenkomst';
    else if (titleLower.includes('commissie')) meetingType = 'Commissievergadering';
    else if (titleLower.includes('raadsvergadering')) meetingType = 'Raadsvergadering';

    const location = analysis.metadata['Locatie'] || analysis.metadata['Location'] || 'Unknown';

    // Count attachment types
    const attachmentTypes = [...new Set(analysis.attachments.map((a: any) => a.type))];

    const detail: MeetingDetail = {
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      url: meeting.url,
      month,
      meetingType,
      location,
      metadata: analysis.metadata,
      agendaItemsCount: analysis.agendaItems.length,
      agendaItemsStructure: analysis.agendaItems.map((item: any) => {
        if (item.hasSubItems) return 'nested';
        if (item.hasAttachments) return 'with-attachments';
        return 'simple';
      }),
      attachmentsCount: analysis.attachments.length,
      attachmentTypes,
      sectionsCount: analysis.sections.length,
      htmlStructure: analysis.htmlStructure,
    };

    console.log(`   ✅ Type: ${meetingType}`);
    console.log(`   ✅ Agenda items: ${detail.agendaItemsCount}`);
    console.log(`   ✅ Attachments: ${detail.attachmentsCount} (${attachmentTypes.join(', ')})`);

    return detail;
  }

  /**
   * Analyze data across months
   */
  private analyzeAcrossMonths(monthReports: MonthReport[]): ValidationReport {
    const allMeetings = monthReports.flatMap(r => r.meetings);
    const allMeetingTypes = [...new Set(allMeetings.map(m => m.meetingType))];

    // Check structure variations
    const structureVariations: string[] = [];

    const allHaveMainContent = allMeetings.every(m => m.htmlStructure.hasMainContent);
    if (!allHaveMainContent) structureVariations.push('Some meetings missing #maincontent');

    const allHaveAgendaList = allMeetings.every(m => m.htmlStructure.hasAgendaList);
    if (!allHaveAgendaList) structureVariations.push('Some meetings missing agenda list');

    // Check data consistency
    const inconsistencies: string[] = [];

    const meetingsWithoutMetadata = allMeetings.filter(m => Object.keys(m.metadata).length === 0);
    if (meetingsWithoutMetadata.length > 0) {
      inconsistencies.push(`${meetingsWithoutMetadata.length} meetings without metadata`);
    }

    const meetingsWithoutAgenda = allMeetings.filter(m => m.agendaItemsCount === 0);
    if (meetingsWithoutAgenda.length > 0) {
      inconsistencies.push(`${meetingsWithoutAgenda.length} meetings without agenda items`);
    }

    const meetingsWithoutAttachments = allMeetings.filter(m => m.attachmentsCount === 0);
    if (meetingsWithoutAttachments.length > 0) {
      inconsistencies.push(`${meetingsWithoutAttachments.length} meetings without attachments`);
    }

    // Create universal profile
    const universalProfile = {
      supportedMeetingTypes: allMeetingTypes,
      requiredSelectors: [
        '#maincontent',
        'a[href*="/Agenda/Index/"]',
        'dl (metadata)',
      ],
      optionalSelectors: [
        'ol.agenda-items',
        'a[href*="/Document/"]',
        '.breadcrumb',
      ],
      extractionStrategies: [
        'Try multiple agenda list selectors',
        'Skip breadcrumb items',
        'Extract metadata from <dl>',
        'Classify meeting types from title',
        'Detect attachment types from URL/extension',
      ],
    };

    return {
      months: monthReports,
      allMeetingTypes,
      structureVariations,
      dataConsistency: {
        allHaveMetadata: meetingsWithoutMetadata.length === 0,
        allHaveAgendaItems: meetingsWithoutAgenda.length === 0,
        allHaveAttachments: meetingsWithoutAttachments.length === 0,
        inconsistencies,
      },
      universalProfile,
    };
  }

  /**
   * Generate text report
   */
  private generateTextReport(report: ValidationReport) {
    const summary = `
════════════════════════════════════════════════════════════════
🔬 MULTI-MONTH VALIDATION REPORT
════════════════════════════════════════════════════════════════

📅 SCOPE: Oktober, November, December 2025

📊 SUMMARY:
${report.months.map(m => `
   ${m.month.toUpperCase()} ${m.year}:
   - Meetings: ${m.meetingsCount}
   - Types: ${m.uniqueMeetingTypes.join(', ')}
   - Avg agenda items: ${m.avgAgendaItems.toFixed(1)}
   - Avg attachments: ${m.avgAttachments.toFixed(1)}
`).join('')}

🏷️  ALL MEETING TYPES (${report.allMeetingTypes.length}):
${report.allMeetingTypes.map(t => `   - ${t}`).join('\n')}

🔍 STRUCTURE VARIATIONS:
${report.structureVariations.length > 0
  ? report.structureVariations.map(v => `   ⚠️  ${v}`).join('\n')
  : '   ✅ No variations detected - all meetings have consistent structure'
}

📋 DATA CONSISTENCY:
   All have metadata: ${report.dataConsistency.allHaveMetadata ? '✅' : '❌'}
   All have agenda items: ${report.dataConsistency.allHaveAgendaItems ? '✅' : '❌'}
   All have attachments: ${report.dataConsistency.allHaveAttachments ? '✅' : '❌'}

${report.dataConsistency.inconsistencies.length > 0
  ? `\n   ⚠️  INCONSISTENCIES:\n${report.dataConsistency.inconsistencies.map(i => `      - ${i}`).join('\n')}`
  : ''
}

🎯 UNIVERSAL PAGE-TYPE PROFILE:

   SUPPORTED MEETING TYPES (${report.universalProfile.supportedMeetingTypes.length}):
${report.universalProfile.supportedMeetingTypes.map(t => `   - ${t}`).join('\n')}

   REQUIRED SELECTORS:
${report.universalProfile.requiredSelectors.map(s => `   - ${s}`).join('\n')}

   OPTIONAL SELECTORS:
${report.universalProfile.optionalSelectors.map(s => `   - ${s}`).join('\n')}

   EXTRACTION STRATEGIES:
${report.universalProfile.extractionStrategies.map(s => `   - ${s}`).join('\n')}

════════════════════════════════════════════════════════════════

✅ VALIDATION COMPLETE

DATA FILES:
   • data/validation-oktober-2025.json
   • data/validation-november-2025.json
   • data/validation-december-2025.json
   • data/validation-report.json
   • data/validation-summary.txt

════════════════════════════════════════════════════════════════
`;

    console.log(summary);
    writeFileSync('./data/validation-summary.txt', summary);
  }

  /**
   * Save report to file
   */
  private saveReport(filename: string, data: any) {
    try {
      mkdirSync('./data', { recursive: true });
    } catch (e) {
      // Directory exists
    }
    writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`💾 Saved: ${filename}`);
  }
}

// Run validation
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new MultiMonthValidator();

  validator.runValidation()
    .then(() => {
      console.log('\n✅ Validation complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Validation failed:', error.message);
      process.exit(1);
    });
}
