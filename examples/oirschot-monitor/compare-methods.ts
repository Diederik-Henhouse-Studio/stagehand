/**
 * Comparison Script: AI vs Traditional Scraping
 *
 * Runs both the AI-powered and traditional scraping methods
 * and generates a detailed comparison report
 */

import 'dotenv/config';
import { analyzeOirschotPortal } from './mvp-analyzer-cloud';
import { analyzeOirschotTraditional } from './mvp-analyzer-traditional';

interface ComparisonReport {
  timestamp: string;
  aiResults: any;
  traditionalResults: any;
  comparison: {
    sections: { ai: number; traditional: number; winner: string };
    recentItems: { ai: number; traditional: number; winner: string };
    meetings: { ai: number; traditional: number; winner: string };
    speed: { ai: number; traditional: number; winner: string };
    accuracy: string;
    cost: { ai: string; traditional: string };
  };
  recommendation: string;
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function determineWinner(aiCount: number, traditionalCount: number): string {
  if (aiCount > traditionalCount) return 'AI';
  if (traditionalCount > aiCount) return 'Traditional';
  return 'Tie';
}

async function compareScrapingMethods(): Promise<ComparisonReport> {
  console.log('🔬 Starting Scraping Method Comparison\n');
  console.log('━'.repeat(60));
  console.log('🤖 AI-POWERED SCRAPING (with OpenAI GPT)');
  console.log('━'.repeat(60));

  const aiResults = await analyzeOirschotPortal();

  console.log('\n' + '━'.repeat(60));
  console.log('🔧 TRADITIONAL SCRAPING (CSS Selectors)');
  console.log('━'.repeat(60));

  const traditionalResults = await analyzeOirschotTraditional();

  console.log('\n' + '═'.repeat(60));
  console.log('📊 COMPARISON REPORT');
  console.log('═'.repeat(60) + '\n');

  // Calculate comparison metrics
  const aiSectionsCount = aiResults.availableSections.sections.length;
  const tradSectionsCount = traditionalResults.availableSections.sections.length;

  const aiItemsCount = aiResults.recentItems.items.length;
  const tradItemsCount = traditionalResults.recentItems.items.length;

  const aiMeetingsCount = aiResults.upcomingMeetings.meetings.length;
  const tradMeetingsCount = traditionalResults.upcomingMeetings.meetings.length;

  const aiTime = aiResults.extractionTime || 0;
  const tradTime = traditionalResults.extractionTime || 0;

  const comparison = {
    sections: {
      ai: aiSectionsCount,
      traditional: tradSectionsCount,
      winner: determineWinner(aiSectionsCount, tradSectionsCount)
    },
    recentItems: {
      ai: aiItemsCount,
      traditional: tradItemsCount,
      winner: determineWinner(aiItemsCount, tradItemsCount)
    },
    meetings: {
      ai: aiMeetingsCount,
      traditional: tradMeetingsCount,
      winner: determineWinner(aiMeetingsCount, tradMeetingsCount)
    },
    speed: {
      ai: aiTime,
      traditional: tradTime,
      winner: tradTime < aiTime ? 'Traditional' : 'AI'
    },
    accuracy: 'AI typically has better accuracy with semantic understanding',
    cost: {
      ai: '$0.01-0.05 per run (OpenAI API)',
      traditional: 'Free (no API costs)'
    }
  };

  // Print detailed comparison
  console.log('📋 DATA EXTRACTION RESULTS:\n');

  console.log('  Sections Found:');
  console.log(`    🤖 AI:          ${comparison.sections.ai}`);
  console.log(`    🔧 Traditional: ${comparison.sections.traditional}`);
  console.log(`    🏆 Winner:      ${comparison.sections.winner}\n`);

  console.log('  Recent Items:');
  console.log(`    🤖 AI:          ${comparison.recentItems.ai}`);
  console.log(`    🔧 Traditional: ${comparison.recentItems.traditional}`);
  console.log(`    🏆 Winner:      ${comparison.recentItems.winner}\n`);

  console.log('  Meetings:');
  console.log(`    🤖 AI:          ${comparison.meetings.ai}`);
  console.log(`    🔧 Traditional: ${comparison.meetings.traditional}`);
  console.log(`    🏆 Winner:      ${comparison.meetings.winner}\n`);

  console.log('⚡ PERFORMANCE:\n');
  console.log(`  🤖 AI Time:          ${formatTime(comparison.speed.ai)}`);
  console.log(`  🔧 Traditional Time: ${formatTime(comparison.speed.traditional)}`);
  console.log(`  🏆 Faster:           ${comparison.speed.winner}\n`);

  console.log('💰 COST:\n');
  console.log(`  🤖 AI:          ${comparison.cost.ai}`);
  console.log(`  🔧 Traditional: ${comparison.cost.traditional}\n`);

  console.log('🎯 ACCURACY & FLEXIBILITY:\n');
  console.log(`  ${comparison.accuracy}`);
  console.log(`  AI adapts to layout changes automatically`);
  console.log(`  Traditional requires manual selector updates\n`);

  // Generate recommendation
  let recommendation = '';
  const totalAIWins = [comparison.sections, comparison.recentItems, comparison.meetings]
    .filter(c => c.winner === 'AI').length;

  if (totalAIWins >= 2) {
    recommendation = '🤖 RECOMMENDED: AI-Powered Scraping\n' +
      '   Better data extraction and adaptability.\n' +
      '   Worth the small API cost for production use.';
  } else {
    recommendation = '🔧 RECOMMENDED: Traditional Scraping\n' +
      '   Good enough results, zero cost.\n' +
      '   Consider AI for complex/changing layouts.';
  }

  console.log('💡 RECOMMENDATION:\n');
  console.log(`  ${recommendation}\n`);

  console.log('═'.repeat(60) + '\n');

  // Detailed data preview
  console.log('📄 SAMPLE DATA PREVIEW:\n');

  console.log('🤖 AI Extracted Sample:');
  if (aiResults.recentItems.items.length > 0) {
    const sample = aiResults.recentItems.items[0];
    console.log(`  Title: ${sample.title}`);
    console.log(`  Category: ${sample.category}`);
    console.log(`  Date: ${sample.date}\n`);
  }

  console.log('🔧 Traditional Extracted Sample:');
  if (traditionalResults.recentItems.items.length > 0) {
    const sample = traditionalResults.recentItems.items[0];
    console.log(`  Title: ${sample.title}`);
    console.log(`  Category: ${sample.category}`);
    console.log(`  Date: ${sample.date}\n`);
  }

  return {
    timestamp: new Date().toISOString(),
    aiResults,
    traditionalResults,
    comparison,
    recommendation
  };
}

// Export for use in other modules
export { compareScrapingMethods, ComparisonReport };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  compareScrapingMethods()
    .then(() => {
      console.log('✅ Comparison complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Comparison failed:', error.message);
      process.exit(1);
    });
}
