/**
 * MVP: Oirschot Bestuurlijke Informatie Monitor
 *
 * This script analyzes the Oirschot municipal government portal
 * to understand what information is available and how to monitor changes.
 */

import { V3 as Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod';

// Define schemas for structured data extraction
const RecentItemSchema = z.object({
  items: z.array(
    z.object({
      title: z.string().describe('Title of the item'),
      category: z.string().describe('Category type (e.g., Ingekomen stukken, Moties)'),
      date: z.string().describe('Modification or submission date'),
      url: z.string().optional().describe('Link to the full item if available'),
    })
  ),
});

const MeetingSchema = z.object({
  meetings: z.array(
    z.object({
      title: z.string().describe('Meeting title'),
      date: z.string().describe('Meeting date'),
      time: z.string().optional().describe('Meeting time'),
      location: z.string().optional().describe('Meeting location'),
    })
  ),
});

const AvailableSectionsSchema = z.object({
  sections: z.array(
    z.object({
      name: z.string().describe('Section name'),
      description: z.string().describe('What this section contains'),
    })
  ),
});

interface AnalysisResult {
  timestamp: string;
  availableSections: z.infer<typeof AvailableSectionsSchema>;
  recentItems: z.infer<typeof RecentItemSchema>;
  upcomingMeetings: z.infer<typeof MeetingSchema>;
  monitoringRecommendations: string[];
}

async function analyzeOirschotPortal(): Promise<AnalysisResult> {
  const TARGET_URL = 'https://oirschot.bestuurlijkeinformatie.nl/';

  console.log('🚀 Starting Oirschot Portal Analysis...\n');

  // Initialize Stagehand with local browser
  const stagehand = new Stagehand({
    env: 'LOCAL',
    verbose: 1,
    enableCache: false,
  });

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];

    console.log(`📡 Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    console.log('✅ Page loaded successfully\n');

    // Step 1: Identify available sections
    console.log('📋 Step 1: Analyzing available sections...');
    const sections = await stagehand.extract({
      instruction: 'Extract all main navigation sections and their purposes from the menu',
      schema: AvailableSectionsSchema,
    });
    console.log(`Found ${sections.sections.length} main sections:\n`);
    sections.sections.forEach(section => {
      console.log(`  - ${section.name}: ${section.description}`);
    });
    console.log();

    // Step 2: Extract recent items
    console.log('📄 Step 2: Extracting recent items from the dashboard...');
    const recentItems = await stagehand.extract({
      instruction: 'Extract all items from the recent items table, including title, category, and date',
      schema: RecentItemSchema,
    });
    console.log(`Found ${recentItems.items.length} recent items:\n`);
    recentItems.items.slice(0, 5).forEach(item => {
      console.log(`  - [${item.category}] ${item.title} (${item.date})`);
    });
    if (recentItems.items.length > 5) {
      console.log(`  ... and ${recentItems.items.length - 5} more`);
    }
    console.log();

    // Step 3: Check for upcoming meetings
    console.log('📅 Step 3: Looking for upcoming meetings...');
    const meetings = await stagehand.extract({
      instruction: 'Extract upcoming meetings from the page, including title, date, time, and location',
      schema: MeetingSchema,
    });
    console.log(`Found ${meetings.meetings.length} upcoming meetings:\n`);
    meetings.meetings.slice(0, 5).forEach(meeting => {
      console.log(`  - ${meeting.title} on ${meeting.date}${meeting.time ? ` at ${meeting.time}` : ''}`);
    });
    if (meetings.meetings.length > 5) {
      console.log(`  ... and ${meetings.meetings.length - 5} more`);
    }
    console.log();

    // Generate monitoring recommendations
    const recommendations = generateMonitoringRecommendations(
      sections,
      recentItems,
      meetings
    );

    console.log('💡 Monitoring Recommendations:');
    recommendations.forEach((rec, idx) => {
      console.log(`  ${idx + 1}. ${rec}`);
    });
    console.log();

    await stagehand.close();

    return {
      timestamp: new Date().toISOString(),
      availableSections: sections,
      recentItems,
      upcomingMeetings: meetings,
      monitoringRecommendations: recommendations,
    };

  } catch (error) {
    console.error('❌ Error during analysis:', error);
    await stagehand.close();
    throw error;
  }
}

function generateMonitoringRecommendations(
  sections: z.infer<typeof AvailableSectionsSchema>,
  recentItems: z.infer<typeof RecentItemSchema>,
  meetings: z.infer<typeof MeetingSchema>
): string[] {
  const recommendations: string[] = [];

  // Recommendation 1: Monitor recent items
  if (recentItems.items.length > 0) {
    const categories = [...new Set(recentItems.items.map(i => i.category))];
    recommendations.push(
      `Monitor recent items table for new submissions. Currently tracking: ${categories.join(', ')}`
    );
  }

  // Recommendation 2: Track meetings
  if (meetings.meetings.length > 0) {
    recommendations.push(
      `Track upcoming meetings calendar. Found ${meetings.meetings.length} scheduled meetings`
    );
  }

  // Recommendation 3: Section-based monitoring
  const relevantSections = sections.sections.filter(s =>
    s.name.toLowerCase().includes('vergadering') ||
    s.name.toLowerCase().includes('overzicht') ||
    s.name.toLowerCase().includes('besluit')
  );

  if (relevantSections.length > 0) {
    recommendations.push(
      `Monitor specific sections: ${relevantSections.map(s => s.name).join(', ')}`
    );
  }

  // Recommendation 4: Change detection strategy
  recommendations.push(
    'Implement change detection by comparing document dates and new entries'
  );

  // Recommendation 5: Data structure
  recommendations.push(
    'Store baseline snapshot and compare against it periodically (daily/weekly)'
  );

  return recommendations;
}

// Export for use in other modules
export { analyzeOirschotPortal, AnalysisResult };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeOirschotPortal()
    .then(result => {
      console.log('✅ Analysis complete!');
      console.log('\n📊 Summary:');
      console.log(`  - Sections analyzed: ${result.availableSections.sections.length}`);
      console.log(`  - Recent items found: ${result.recentItems.items.length}`);
      console.log(`  - Upcoming meetings: ${result.upcomingMeetings.meetings.length}`);
      console.log(`  - Recommendations: ${result.monitoringRecommendations.length}`);
    })
    .catch(error => {
      console.error('Failed to complete analysis:', error.message);
      process.exit(1);
    });
}
