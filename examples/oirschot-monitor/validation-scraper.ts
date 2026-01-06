/**
 * Multi-Method Validation Scraper
 * Tests 3 different approaches to extract meetings and compares results
 */

import 'dotenv/config';
import { V3 as Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod';
import { writeFileSync } from 'fs';

// Ground truth from manual inspection
const GROUND_TRUTH = [
  {
    id: '6adc011f-aa01-4e7d-a03d-3082aa922279',
    title: 'Presidium',
    date: '06-01-2026',
    time: '19:00 - 20:30',
    location: 'Commissiekamer beneden'
  },
  {
    id: 'd4725440-637b-48c7-9c10-bd5812e488ef',
    title: 'Raadsbijeenkomst Openbaar',
    subtitle: 'Actualiteitensessie en Leefdael II',
    date: '06-01-2026',
    time: '20:30 - 22:00',
    location: 'Raadszaal'
  },
  {
    id: 'c8c8ca9a-4db1-4feb-a816-51e3bbb9260e',
    title: 'Raadsbijeenkomst Openbaar',
    date: '13-01-2026',
    time: '19:30 - 22:30',
    location: 'Raadszaal'
  },
  {
    id: 'aad6707b-bb7c-4178-9706-c2121ca13f82',
    title: 'Raadsbijeenkomst Openbaar',
    date: '20-01-2026',
    time: '19:30 - 22:30',
    location: 'Raadszaal'
  },
  {
    id: '1436adfe-7c32-4fb8-b877-a51657d63bfa',
    title: 'Besluitvormende raadsvergadering',
    date: '27-01-2026',
    time: '19:30 - 23:00',
    location: 'Raadszaal'
  }
];

const MeetingSchema = z.object({
  meetings: z.array(
    z.object({
      title: z.string(),
      date: z.string(),
      time: z.string().optional(),
      location: z.string().optional(),
      id: z.string().optional()
    })
  )
});

interface ValidationResult {
  method: string;
  meetingsFound: number;
  correctIds: string[];
  missedIds: string[];
  falsePositives: number;
  accuracy: number;
  precision: number;
  recall: number;
  executionTime: number;
  error?: string;
}

class ValidationScraper {
  private stagehand: Stagehand;

  constructor() {
    this.stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      verbose: 1,
      enableCache: false,
      modelApiKey: process.env.OPENAI_API_KEY,
    });
  }

  async runValidation(): Promise<ValidationResult[]> {
    console.log('🔬 MULTI-METHOD VALIDATION SCRAPER\n');
    console.log('═'.repeat(60));
    console.log(`📊 Ground Truth: ${GROUND_TRUTH.length} meetings in January 2026`);
    console.log('═'.repeat(60) + '\n');

    await this.stagehand.init();
    const page = this.stagehand.context.pages()[0];

    await page.goto('https://oirschot.bestuurlijkeinformatie.nl/Calendar', {
      waitUntil: 'networkidle'
    });

    const results: ValidationResult[] = [];

    // Method 1: Pure HTML/DOM Scraping
    console.log('📋 METHOD 1: Pure HTML/DOM Scraping...');
    results.push(await this.method1_HTML(page));

    // Method 2: AI-Powered Semantic Extraction
    console.log('\n🤖 METHOD 2: AI-Powered Semantic Extraction...');
    results.push(await this.method2_AI());

    // Method 3: Hybrid Approach (DOM + Pattern Matching)
    console.log('\n🔄 METHOD 3: Hybrid (DOM + Pattern Matching)...');
    results.push(await this.method3_Hybrid(page));

    await this.stagehand.close();

    return results;
  }

  /**
   * Method 1: Pure HTML/DOM Scraping
   * Uses multiple CSS selectors and DOM parsing
   */
  private async method1_HTML(page: any): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const meetings = await page.evaluate(() => {
        const results: any[] = [];

        // Strategy 1: Look for links with /Agenda/Index/ pattern
        const agendaLinks = Array.from(
          document.querySelectorAll('a[href*="/Agenda/Index/"]')
        ) as HTMLAnchorElement[];

        agendaLinks.forEach(link => {
          const idMatch = link.href.match(/\/Agenda\/Index\/([a-f0-9-]+)/i);
          if (!idMatch) return;

          const id = idMatch[1];

          // Find parent container
          const container = link.closest('tr, .meeting-row, .calendar-item, li, div[class*="meeting"]');
          if (!container) return;

          // Extract text content
          const fullText = container.textContent || '';

          // Try to extract title (usually the link text or nearby heading)
          const title = link.textContent?.trim() ||
                       container.querySelector('h3, h4, strong, .title')?.textContent?.trim() ||
                       'Unknown';

          // Try to find date
          const dateText = fullText.match(/\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}\s+\w+\s+\d{4}/)?.[0] || '';

          // Try to find time
          const timeMatch = fullText.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
          const time = timeMatch ? timeMatch[0] : '';

          results.push({
            id,
            title: title.substring(0, 100),
            date: dateText,
            time,
            fullText: fullText.substring(0, 200)
          });
        });

        return results;
      });

      const executionTime = Date.now() - startTime;
      return this.calculateMetrics('HTML/DOM', meetings, executionTime);

    } catch (error) {
      return {
        method: 'HTML/DOM',
        meetingsFound: 0,
        correctIds: [],
        missedIds: GROUND_TRUTH.map(m => m.id),
        falsePositives: 0,
        accuracy: 0,
        precision: 0,
        recall: 0,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Method 2: AI-Powered Semantic Extraction
   * Uses Stagehand's extract() with LLM
   */
  private async method2_AI(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const result = await this.stagehand.extract({
        instruction: `Extract all upcoming meetings from this calendar page. For each meeting include:
- Title (meeting name)
- Date in format DD-MM-YYYY
- Time range (e.g., "19:00 - 20:30")
- Location
- Meeting ID (extract from the URL /Agenda/Index/[ID])

Focus especially on meetings in January 2026.`,
        schema: MeetingSchema,
        timeout: 90000
      });

      const meetings = result?.meetings || [];
      const executionTime = Date.now() - startTime;

      return this.calculateMetrics('AI Semantic', meetings, executionTime);

    } catch (error) {
      return {
        method: 'AI Semantic',
        meetingsFound: 0,
        correctIds: [],
        missedIds: GROUND_TRUTH.map(m => m.id),
        falsePositives: 0,
        accuracy: 0,
        precision: 0,
        recall: 0,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Method 3: Hybrid Approach
   * Combines DOM parsing with smart pattern matching
   */
  private async method3_Hybrid(page: any): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const meetings = await page.evaluate(() => {
        const results: any[] = [];

        // Find all table rows or list items that might contain meetings
        const containers = Array.from(
          document.querySelectorAll('tr, li, .meeting, .event, [class*="agenda"]')
        );

        containers.forEach(container => {
          const html = container.innerHTML;
          const text = container.textContent || '';

          // Look for meeting ID in any link
          const idMatch = html.match(/\/Agenda\/Index\/([a-f0-9-]{36})/i);
          if (!idMatch) return;

          const id = idMatch[1];

          // Extract title - look for common patterns
          let title = '';
          const titleEl = container.querySelector('a[href*="/Agenda/Index/"], strong, b, h3, h4');
          if (titleEl) {
            title = titleEl.textContent?.trim() || '';
          }

          // Date patterns
          const datePatterns = [
            /(\d{1,2})\s+(januari|februari|maart)\s+(\d{4})/i,
            /(\d{1,2})-(\d{1,2})-(\d{4})/,
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/
          ];

          let date = '';
          for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
              date = match[0];
              break;
            }
          }

          // Time pattern
          const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
          const time = timeMatch ? timeMatch[0] : '';

          // Location patterns
          const locationPatterns = ['Raadszaal', 'Commissiekamer', 'Trouwzaal'];
          let location = '';
          for (const loc of locationPatterns) {
            if (text.includes(loc)) {
              location = loc;
              break;
            }
          }

          results.push({
            id,
            title: title.substring(0, 150).trim(),
            date,
            time,
            location
          });
        });

        // Deduplicate by ID
        const unique = Array.from(
          new Map(results.map(m => [m.id, m])).values()
        );

        return unique;
      });

      const executionTime = Date.now() - startTime;
      return this.calculateMetrics('Hybrid', meetings, executionTime);

    } catch (error) {
      return {
        method: 'Hybrid',
        meetingsFound: 0,
        correctIds: [],
        missedIds: GROUND_TRUTH.map(m => m.id),
        falsePositives: 0,
        accuracy: 0,
        precision: 0,
        recall: 0,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Calculate accuracy metrics
   */
  private calculateMetrics(
    method: string,
    found: any[],
    executionTime: number
  ): ValidationResult {
    const foundIds = found.map(m => m.id).filter(Boolean);
    const groundTruthIds = GROUND_TRUTH.map(m => m.id);

    const correctIds = foundIds.filter(id => groundTruthIds.includes(id));
    const missedIds = groundTruthIds.filter(id => !foundIds.includes(id));
    const falsePositives = foundIds.filter(id => !groundTruthIds.includes(id));

    const truePositives = correctIds.length;
    const falseNegatives = missedIds.length;
    const falsePositiveCount = falsePositives.length;

    // Precision: Of what we found, how many were correct?
    const precision = foundIds.length > 0
      ? truePositives / foundIds.length
      : 0;

    // Recall: Of what should be found, how many did we find?
    const recall = groundTruthIds.length > 0
      ? truePositives / groundTruthIds.length
      : 0;

    // Accuracy: Overall correctness
    const accuracy = groundTruthIds.length > 0
      ? truePositives / groundTruthIds.length
      : 0;

    console.log(`   Found: ${foundIds.length} meetings`);
    console.log(`   Correct: ${correctIds.length}/${groundTruthIds.length}`);
    console.log(`   Missed: ${missedIds.length}`);
    console.log(`   Accuracy: ${(accuracy * 100).toFixed(1)}%`);
    console.log(`   Time: ${(executionTime / 1000).toFixed(2)}s`);

    return {
      method,
      meetingsFound: foundIds.length,
      correctIds,
      missedIds,
      falsePositives: falsePositiveCount,
      accuracy,
      precision,
      recall,
      executionTime
    };
  }

  /**
   * Generate comparison report
   */
  generateReport(results: ValidationResult[]): string {
    let report = `
🔬 VALIDATION REPORT: Meeting Extraction Methods
════════════════════════════════════════════════════════════════

📊 GROUND TRUTH BASELINE:
  Total Meetings: ${GROUND_TRUTH.length}
  Date Range: January 2026

  ✓ 06-01-2026: 2 meetings (Presidium + Raadsbijeenkomst)
  ✓ 13-01-2026: 1 meeting (Raadsbijeenkomst)
  ✓ 20-01-2026: 1 meeting (Raadsbijeenkomst)
  ✓ 27-01-2026: 1 meeting (Besluitvormende raadsvergadering)

════════════════════════════════════════════════════════════════

`;

    // Sort by accuracy
    const sorted = [...results].sort((a, b) => b.accuracy - a.accuracy);

    sorted.forEach((result, idx) => {
      const rank = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';

      report += `
${rank} METHOD ${idx + 1}: ${result.method.toUpperCase()}
────────────────────────────────────────────────────────────────
  Meetings Found:    ${result.meetingsFound}/${GROUND_TRUTH.length}
  Accuracy:          ${(result.accuracy * 100).toFixed(1)}% ${result.accuracy >= 0.8 ? '✅' : '❌'}
  Precision:         ${(result.precision * 100).toFixed(1)}%
  Recall:            ${(result.recall * 100).toFixed(1)}%
  Execution Time:    ${(result.executionTime / 1000).toFixed(2)}s

  ✅ Correct IDs: ${result.correctIds.length}
  ${result.correctIds.map(id => `     - ${id.substring(0, 8)}...`).join('\n')}

  ❌ Missed IDs: ${result.missedIds.length}
  ${result.missedIds.map(id => `     - ${id.substring(0, 8)}... (${GROUND_TRUTH.find(m => m.id === id)?.title})`).join('\n')}

  ${result.falsePositives > 0 ? `⚠️  False Positives: ${result.falsePositives}` : ''}
  ${result.error ? `🚨 Error: ${result.error}` : ''}

`;
    });

    // Final recommendation
    const best = sorted[0];
    report += `
════════════════════════════════════════════════════════════════
🎯 FINAL ASSESSMENT
════════════════════════════════════════════════════════════════

🏆 WINNER: ${best.method.toUpperCase()}

Performance:
  ✓ Found ${best.correctIds.length}/${GROUND_TRUTH.length} meetings correctly
  ✓ ${(best.accuracy * 100).toFixed(1)}% accuracy
  ✓ ${(best.executionTime / 1000).toFixed(2)}s execution time

Recommendation:
  ${best.accuracy >= 0.8
    ? `✅ ${best.method} is PRODUCTION READY\n     Use this method for automated monitoring.`
    : `⚠️  ${best.method} needs improvement\n     Current accuracy (${(best.accuracy * 100).toFixed(1)}%) is below 80% threshold.`
  }

${best.missedIds.length > 0
  ? `⚠️  Missing Meetings:\n${best.missedIds.map(id => {
      const meeting = GROUND_TRUTH.find(m => m.id === id);
      return `     • ${meeting?.title} (${meeting?.date})`;
    }).join('\n')}`
  : '✅ ALL MEETINGS DETECTED!'
}

════════════════════════════════════════════════════════════════
`;

    return report;
  }
}

// Run validation
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ValidationScraper();

  validator.runValidation()
    .then(results => {
      const report = validator.generateReport(results);
      console.log('\n' + report);

      // Save results
      writeFileSync(
        './data/validation-results.json',
        JSON.stringify(results, null, 2)
      );

      writeFileSync(
        './data/validation-report.txt',
        report
      );

      console.log('\n💾 Results saved to:');
      console.log('   - ./data/validation-results.json');
      console.log('   - ./data/validation-report.txt\n');

      process.exit(0);
    })
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

export type { ValidationResult };
export { ValidationScraper, GROUND_TRUTH };
