/**
 * MVP: Oirschot Monitor - Traditional Scraping (No AI)
 *
 * This version uses traditional HTML parsing without AI
 * - No OpenAI API key needed
 * - No LLM costs
 * - Uses CSS selectors and DOM parsing
 * - Faster but less flexible
 */

import 'dotenv/config';
import { V3 as Stagehand } from '@browserbasehq/stagehand';

interface TraditionalAnalysisResult {
  timestamp: string;
  method: 'traditional';
  availableSections: {
    sections: Array<{ name: string; description: string }>;
  };
  recentItems: {
    items: Array<{ title: string; category: string; date: string }>;
  };
  upcomingMeetings: {
    meetings: Array<{ title: string; date: string; time?: string }>;
  };
  extractionTime: number;
  errors: string[];
}

async function analyzeOirschotTraditional(): Promise<TraditionalAnalysisResult> {
  const TARGET_URL = 'https://oirschot.bestuurlijkeinformatie.nl/';
  const startTime = Date.now();
  const errors: string[] = [];

  console.log('🔧 Starting Traditional Analysis (No AI)...\n');

  // Initialize Stagehand WITHOUT AI features
  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    verbose: 1,
    enableCache: false,
  });

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];

    console.log(`📡 Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    console.log('✅ Page loaded\n');

    // Extract sections using traditional DOM parsing
    console.log('📋 Step 1: Extracting navigation sections...');
    const sections = await page.evaluate(() => {
      const navLinks = Array.from(document.querySelectorAll('nav a, .menu a, .navigation a, header a'));
      return navLinks
        .filter(link => link.textContent && link.textContent.trim().length > 0)
        .map(link => ({
          name: link.textContent?.trim() || '',
          description: link.getAttribute('title') || link.getAttribute('aria-label') || 'Menu item'
        }))
        .filter(section => section.name.length > 0)
        .slice(0, 10); // Limit to first 10
    });
    console.log(`Found ${sections.length} sections\n`);

    // Extract recent items using table parsing
    console.log('📄 Step 2: Extracting recent items...');
    const recentItems = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr, .items-list .item, .recent-items li'));
      return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('td, .item-cell'));
        if (cells.length >= 2) {
          return {
            title: cells[0]?.textContent?.trim() || '',
            category: cells[1]?.textContent?.trim() || 'Unknown',
            date: cells[cells.length - 1]?.textContent?.trim() || ''
          };
        }
        // Fallback: try to find any text
        return {
          title: row.textContent?.trim().substring(0, 100) || '',
          category: 'General',
          date: 'Unknown'
        };
      }).filter(item => item.title.length > 0);
    });
    console.log(`Found ${recentItems.length} recent items\n`);

    // Extract meetings using calendar/list parsing
    console.log('📅 Step 3: Extracting meetings...');
    const meetings = await page.evaluate(() => {
      const meetingElements = Array.from(document.querySelectorAll(
        '.meeting, .event, .calendar-item, [class*="vergadering"]'
      ));

      return meetingElements.map(el => {
        const title = el.querySelector('h3, h4, .title, .meeting-title')?.textContent?.trim() ||
                     el.textContent?.trim().substring(0, 50) || 'Meeting';
        const dateEl = el.querySelector('.date, .meeting-date, time');
        const timeEl = el.querySelector('.time, .meeting-time');

        return {
          title,
          date: dateEl?.textContent?.trim() || 'TBD',
          time: timeEl?.textContent?.trim()
        };
      }).filter(m => m.title.length > 0);
    });
    console.log(`Found ${meetings.length} meetings\n`);

    await stagehand.close();

    const extractionTime = Date.now() - startTime;

    return {
      timestamp: new Date().toISOString(),
      method: 'traditional',
      availableSections: { sections },
      recentItems: { items: recentItems },
      upcomingMeetings: { meetings },
      extractionTime,
      errors
    };

  } catch (error) {
    console.error('❌ Error during traditional analysis:', error);
    errors.push(error instanceof Error ? error.message : String(error));
    await stagehand.close();

    const extractionTime = Date.now() - startTime;

    return {
      timestamp: new Date().toISOString(),
      method: 'traditional',
      availableSections: { sections: [] },
      recentItems: { items: [] },
      upcomingMeetings: { meetings: [] },
      extractionTime,
      errors
    };
  }
}

export { analyzeOirschotTraditional, TraditionalAnalysisResult };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeOirschotTraditional()
    .then(result => {
      console.log('✅ Traditional Analysis Complete!');
      console.log('\n📊 Summary:');
      console.log(`  - Method: ${result.method.toUpperCase()}`);
      console.log(`  - Sections found: ${result.availableSections.sections.length}`);
      console.log(`  - Recent items: ${result.recentItems.items.length}`);
      console.log(`  - Meetings: ${result.upcomingMeetings.meetings.length}`);
      console.log(`  - Extraction time: ${result.extractionTime}ms`);
      console.log(`  - Errors: ${result.errors.length}`);
    })
    .catch(error => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
}
