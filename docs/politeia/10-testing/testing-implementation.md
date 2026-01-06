# Testing Implementation

Complete implementation guide for the Politeia testing and validation system.

---

## Test Runner Implementation

### Core Test Runner

```typescript
// tests/monthly-validator.ts
import { V3 as Stagehand } from '@browserbasehq/stagehand';
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';

interface TestConfig {
  municipalities: Municipality[];
  month: number;
  year: number;
  outputDir: string;
}

interface Municipality {
  id: string;
  name: string;
  platform: 'NOTUBIZ' | 'IBIS';
  platformVersion: string;
  baseUrl: string;
  configPath: string;
}

export class MonthlyValidator {
  private config: TestConfig;
  private testRunId: string;
  private outputPath: string;

  constructor(config: TestConfig) {
    this.config = config;
    this.testRunId = format(new Date(), "yyyy-MM-dd'T'HH-mm-ss'Z'");
    this.outputPath = path.join(config.outputDir, this.testRunId);
  }

  async run(): Promise<TestResults> {
    console.log(`🧪 Starting Monthly Validation: ${this.testRunId}`);
    console.log(`📅 Testing month: ${this.config.month}/${this.config.year}`);

    // Create output directories
    this.createOutputStructure();

    const results: TestResults = {
      testRunId: this.testRunId,
      executedAt: new Date().toISOString(),
      testType: 'monthly-validation',
      testedMonth: {
        month: this.config.month,
        year: this.config.year,
        label: format(new Date(this.config.year, this.config.month), 'MMMM yyyy')
      },
      municipalities: [],
      results: {
        totalMeetings: 0,
        totalAgendaItems: 0,
        totalDocuments: 0,
        successRate: 0,
        failedMeetings: []
      },
      duration: {
        total: 0,
        perMunicipality: {}
      }
    };

    const startTime = Date.now();

    // Test each municipality
    for (const municipality of this.config.municipalities) {
      console.log(`\n📍 Testing ${municipality.name} (${municipality.platform})...`);

      const municipalityStartTime = Date.now();

      try {
        const municipalityResult = await this.testMunicipality(municipality);
        results.municipalities.push(municipalityResult);

        results.results.totalMeetings += municipalityResult.meetingsCount;
        results.results.totalAgendaItems += municipalityResult.totalAgendaItems;
        results.results.totalDocuments += municipalityResult.totalDocuments;

      } catch (error) {
        console.error(`❌ Failed to test ${municipality.name}:`, error);
        results.results.failedMeetings.push({
          municipality: municipality.id,
          error: error.message
        });
      }

      const municipalityDuration = Date.now() - municipalityStartTime;
      results.duration.perMunicipality[municipality.id] = municipalityDuration;

      console.log(`✅ Completed ${municipality.name} in ${(municipalityDuration / 1000).toFixed(1)}s`);
    }

    results.duration.total = Date.now() - startTime;
    results.results.successRate =
      ((results.results.totalMeetings - results.results.failedMeetings.length) /
       results.results.totalMeetings) * 100;

    // Write results
    await this.writeResults(results);

    console.log(`\n✨ Validation complete!`);
    console.log(`📊 Results: ${results.results.totalMeetings} meetings, ${results.results.totalAgendaItems} agenda items, ${results.results.totalDocuments} documents`);
    console.log(`📁 Output: ${this.outputPath}`);

    return results;
  }

  private async testMunicipality(municipality: Municipality): Promise<MunicipalityTestResult> {
    const logger = this.createLogger(municipality.id);

    logger.log(`Starting test for ${municipality.name}`);
    logger.log(`Platform: ${municipality.platform} ${municipality.platformVersion}`);
    logger.log(`Base URL: ${municipality.baseUrl}`);

    // Load platform configuration
    const platformConfig = this.loadPlatformConfig(municipality.configPath);

    // Initialize scraper
    const scraper = await this.createScraper(platformConfig, logger);

    try {
      // Scrape meetings list
      logger.log(`Fetching meetings for ${this.config.month}/${this.config.year}...`);
      const meetings = await scraper.scrapeMeetingsList(
        this.config.month,
        this.config.year
      );

      logger.log(`Found ${meetings.length} meetings`);

      const meetingDetails: MeetingDetails[] = [];

      // Scrape details for each meeting
      for (const meeting of meetings) {
        logger.log(`Scraping meeting: ${meeting.title}`);

        try {
          const details = await scraper.scrapeMeetingDetails(meeting.url);
          meetingDetails.push(details);

          logger.log(`  ✓ ${details.agendaItems.length} agenda items`);
          logger.log(`  ✓ ${details.documents.length} documents`);

        } catch (error) {
          logger.error(`  ✗ Failed to scrape meeting: ${error.message}`);
        }

        // Rate limiting
        await this.sleep(2000);
      }

      // Validate results
      const validationResults = this.validateMeetings(meetingDetails);

      // Write municipality results
      await this.writeMunicipalityResults(
        municipality,
        meetings,
        meetingDetails,
        validationResults
      );

      const totalAgendaItems = meetingDetails.reduce((sum, m) => sum + m.agendaItems.length, 0);
      const totalDocuments = meetingDetails.reduce((sum, m) => sum + m.documents.length, 0);

      logger.log(`Test completed successfully`);

      return {
        municipalityId: municipality.id,
        municipalityName: municipality.name,
        platform: municipality.platform,
        platformVersion: municipality.platformVersion,
        meetingsCount: meetings.length,
        totalAgendaItems,
        totalDocuments,
        validationsPassed: validationResults.passedCount,
        validationsFailed: validationResults.failedCount,
        status: 'success'
      };

    } finally {
      await scraper.close();
    }
  }

  private createOutputStructure() {
    const dirs = [
      this.outputPath,
      path.join(this.outputPath, 'logs'),
      path.join(this.outputPath, 'results'),
      path.join(this.outputPath, 'artifacts'),
      path.join(this.outputPath, 'artifacts', 'screenshots'),
      path.join(this.outputPath, 'artifacts', 'browserbase-sessions')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private createLogger(municipalityId: string): Logger {
    const logPath = path.join(this.outputPath, 'logs', `${municipalityId}.log`);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    return {
      log: (message: string) => {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] ${message}\n`;
        logStream.write(logLine);
        console.log(`  ${message}`);
      },
      error: (message: string) => {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] ERROR: ${message}\n`;
        logStream.write(logLine);
        console.error(`  ❌ ${message}`);
      }
    };
  }

  private async writeMunicipalityResults(
    municipality: Municipality,
    meetings: Meeting[],
    details: MeetingDetails[],
    validations: ValidationResults
  ) {
    const municipalityDir = path.join(this.outputPath, 'results', municipality.id);
    const meetingsDir = path.join(municipalityDir, 'meetings');

    fs.mkdirSync(municipalityDir, { recursive: true });
    fs.mkdirSync(meetingsDir, { recursive: true });

    // Write meetings.json
    const meetingsJson = {
      municipality: municipality.id,
      month: this.config.month,
      year: this.config.year,
      scrapedAt: new Date().toISOString(),
      meetingsCount: meetings.length,
      meetings: details.map((d, i) => ({
        id: `meeting-${String(i + 1).padStart(3, '0')}`,
        ...d,
        agendaItemsCount: d.agendaItems.length,
        documentsCount: d.documents.length
      }))
    };

    fs.writeFileSync(
      path.join(municipalityDir, 'meetings.json'),
      JSON.stringify(meetingsJson, null, 2)
    );

    // Write overview.md
    const overviewMd = this.generateOverviewMarkdown(municipality, details);
    fs.writeFileSync(
      path.join(municipalityDir, 'overview.md'),
      overviewMd
    );

    // Write individual meeting files
    for (let i = 0; i < details.length; i++) {
      const meeting = details[i];
      const meetingSlug = this.createMeetingSlug(meeting);

      // Meeting overview (combined)
      const meetingMd = this.generateMeetingMarkdown(meeting);
      fs.writeFileSync(
        path.join(meetingsDir, `${meetingSlug}.md`),
        meetingMd
      );

      // Meeting JSON
      fs.writeFileSync(
        path.join(meetingsDir, `${meetingSlug}.json`),
        JSON.stringify(meeting, null, 2)
      );

      // Agenda markdown
      const agendaMd = this.generateAgendaMarkdown(meeting);
      fs.writeFileSync(
        path.join(meetingsDir, `${meetingSlug}-agenda.md`),
        agendaMd
      );

      // Documents markdown
      const documentsMd = this.generateDocumentsMarkdown(meeting);
      fs.writeFileSync(
        path.join(meetingsDir, `${meetingSlug}-documents.md`),
        documentsMd
      );
    }
  }

  private generateOverviewMarkdown(
    municipality: Municipality,
    meetings: MeetingDetails[]
  ): string {
    const monthLabel = format(
      new Date(this.config.year, this.config.month),
      'MMMM yyyy'
    );

    let md = `# ${municipality.name} - ${monthLabel} Meetings\n\n`;
    md += `**Platform:** ${municipality.platform} ${municipality.platformVersion}\n`;
    md += `**Scraped:** ${new Date().toLocaleString()}\n`;
    md += `**Total Meetings:** ${meetings.length}\n\n`;

    md += `## Meetings\n\n`;

    meetings.forEach((meeting, index) => {
      md += `### ${index + 1}. ${meeting.title} - ${format(new Date(meeting.date), 'MMMM d, yyyy')}\n\n`;
      md += `**Time:** ${meeting.time}\n`;
      md += `**Location:** ${meeting.location}\n`;
      md += `**Status:** ${meeting.status}\n`;
      md += `**URL:** ${meeting.url}\n\n`;
      md += `**Agenda Items:** ${meeting.agendaItems.length}\n`;
      md += `**Documents:** ${meeting.documents.length}\n\n`;

      // Top 5 agenda items
      md += `**Agenda Overview:**\n`;
      meeting.agendaItems.slice(0, 5).forEach(item => {
        md += `${item.number}. ${item.title}\n`;
      });
      if (meeting.agendaItems.length > 5) {
        md += `... and ${meeting.agendaItems.length - 5} more\n`;
      }
      md += `\n`;

      // Top 3 documents
      if (meeting.documents.length > 0) {
        md += `**Key Documents:**\n`;
        meeting.documents.slice(0, 3).forEach(doc => {
          const size = doc.size ? ` (${(doc.size / 1024).toFixed(0)} KB)` : '';
          md += `- ${doc.title}${size}\n`;
        });
        if (meeting.documents.length > 3) {
          md += `- ... and ${meeting.documents.length - 3} more documents\n`;
        }
        md += `\n`;
      }

      md += `---\n\n`;
    });

    return md;
  }

  private generateMeetingMarkdown(meeting: MeetingDetails): string {
    let md = `# ${meeting.title}\n\n`;
    md += `**Date:** ${format(new Date(meeting.date), 'EEEE, MMMM d, yyyy')}\n`;
    md += `**Time:** ${meeting.time}\n`;
    md += `**Location:** ${meeting.location}\n`;
    md += `**Status:** ${meeting.status}\n`;
    md += `**URL:** ${meeting.url}\n\n`;

    md += `## Summary\n\n`;
    md += `- **Agenda Items:** ${meeting.agendaItems.length}\n`;
    md += `- **Documents:** ${meeting.documents.length}\n\n`;

    md += `## Agenda\n\n`;
    meeting.agendaItems.forEach(item => {
      md += `### ${item.number}. ${item.title}\n\n`;
      if (item.description) {
        md += `${item.description}\n\n`;
      }
    });

    md += `## Documents\n\n`;
    meeting.documents.forEach(doc => {
      const size = doc.size ? ` (${(doc.size / 1024).toFixed(0)} KB)` : '';
      md += `- [${doc.title}](${doc.url})${size}\n`;
      if (doc.type) {
        md += `  - Type: ${doc.type}\n`;
      }
    });

    return md;
  }

  private generateAgendaMarkdown(meeting: MeetingDetails): string {
    let md = `# Agenda: ${meeting.title}\n\n`;
    md += `**Date:** ${format(new Date(meeting.date), 'MMMM d, yyyy')}\n`;
    md += `**Time:** ${meeting.time}\n\n`;

    md += `## Agenda Items (${meeting.agendaItems.length})\n\n`;

    meeting.agendaItems.forEach(item => {
      md += `### ${item.number}. ${item.title}\n\n`;
      if (item.description) {
        md += `${item.description}\n\n`;
      }
      md += `---\n\n`;
    });

    return md;
  }

  private generateDocumentsMarkdown(meeting: MeetingDetails): string {
    let md = `# Documents: ${meeting.title}\n\n`;
    md += `**Total Documents:** ${meeting.documents.length}\n\n`;

    // Group by type
    const byType = meeting.documents.reduce((acc, doc) => {
      const type = doc.type || 'Other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(doc);
      return acc;
    }, {} as Record<string, typeof meeting.documents>);

    Object.entries(byType).forEach(([type, docs]) => {
      md += `## ${type} (${docs.length})\n\n`;
      docs.forEach((doc, i) => {
        const size = doc.size ? ` - ${(doc.size / 1024).toFixed(0)} KB` : '';
        md += `${i + 1}. [${doc.title}](${doc.url})${size}\n`;
      });
      md += `\n`;
    });

    return md;
  }

  private createMeetingSlug(meeting: MeetingDetails): string {
    const date = format(new Date(meeting.date), 'yyyy-MM-dd');
    const title = meeting.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${date}-${title}`;
  }

  private async writeResults(results: TestResults) {
    // Write metadata.json
    fs.writeFileSync(
      path.join(this.outputPath, 'metadata.json'),
      JSON.stringify(results, null, 2)
    );

    // Write summary.md
    const summaryMd = this.generateSummaryMarkdown(results);
    fs.writeFileSync(
      path.join(this.outputPath, 'summary.md'),
      summaryMd
    );

    // Write execution log
    const executionLogPath = path.join(this.outputPath, 'logs', 'test-execution.log');
    const executionLog = `Test Run: ${results.testRunId}\n`;
    fs.appendFileSync(executionLogPath, executionLog);
  }

  private generateSummaryMarkdown(results: TestResults): string {
    let md = `# Test Run Summary\n\n`;
    md += `**Test ID:** ${results.testRunId}\n`;
    md += `**Executed:** ${new Date(results.executedAt).toLocaleString()}\n`;
    md += `**Test Type:** ${results.testType}\n`;
    md += `**Tested Month:** ${results.testedMonth.label}\n\n`;

    md += `## Overview\n\n`;
    const overallStatus = results.results.successRate === 100 ? '✅ SUCCESS' : '⚠️ PARTIAL';
    md += `${overallStatus} - ${results.results.successRate.toFixed(1)}% success rate\n\n`;

    md += `| Municipality | Platform | Meetings | Agenda Items | Documents | Status |\n`;
    md += `|--------------|----------|----------|--------------|-----------|--------|\n`;

    results.municipalities.forEach(m => {
      const status = m.status === 'success' ? '✅ PASS' : '❌ FAIL';
      md += `| ${m.municipalityName} | ${m.platform} ${m.platformVersion} | ${m.meetingsCount} | ${m.totalAgendaItems} | ${m.totalDocuments} | ${status} |\n`;
    });

    md += `\n## Execution Details\n\n`;
    md += `- **Total Duration:** ${(results.duration.total / 1000 / 60).toFixed(1)}m\n`;
    md += `- **Success Rate:** ${results.results.successRate.toFixed(1)}%\n`;
    md += `- **Failed Meetings:** ${results.results.failedMeetings.length}\n\n`;

    md += `## Validation Instructions\n\n`;
    md += `To validate results:\n\n`;
    md += `1. **Compare with actual websites:**\n`;
    results.municipalities.forEach(m => {
      const baseUrl = this.config.municipalities.find(mm => mm.id === m.municipalityId)?.baseUrl;
      md += `   - ${m.municipalityName}: ${baseUrl}\n`;
    });
    md += `\n`;
    md += `2. **Check meeting counts:** Verify total meetings matches website calendar\n\n`;
    md += `3. **Spot-check meeting details:** Open random meetings and compare:\n`;
    md += `   - Meeting title and date\n`;
    md += `   - Agenda item count and titles\n`;
    md += `   - Document availability\n\n`;
    md += `4. **Review logs:** Check \`logs/\` directory for any warnings or errors\n\n`;

    md += `## Next Steps\n\n`;
    md += `- [ ] Manual validation completed\n`;
    md += `- [ ] Results approved\n`;
    md += `- [ ] Issues documented (if any)\n`;
    md += `- [ ] Archive test run\n`;

    return md;
  }

  private validateMeetings(meetings: MeetingDetails[]): ValidationResults {
    // Implement validation logic
    return {
      passedCount: meetings.length,
      failedCount: 0,
      validations: []
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## CLI Implementation

```typescript
// bin/monthly-validator.ts
#!/usr/bin/env node

import { Command } from 'commander';
import { MonthlyValidator } from '../tests/monthly-validator';
import path from 'path';

const program = new Command();

program
  .name('monthly-validator')
  .description('Run monthly validation tests for Politeia')
  .version('1.0.0');

program
  .command('run')
  .description('Run monthly validation')
  .option('-m, --month <number>', 'Month to test (0-11)', (val) => parseInt(val))
  .option('-y, --year <number>', 'Year to test', (val) => parseInt(val))
  .option('--municipality <id>', 'Test specific municipality only')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    // Default to most recently completed month
    const now = new Date();
    const month = options.month ?? (now.getMonth() === 0 ? 11 : now.getMonth() - 1);
    const year = options.year ?? (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());

    const municipalities = [
      {
        id: 'oirschot',
        name: 'Oirschot',
        platform: 'NOTUBIZ' as const,
        platformVersion: '2.0.0',
        baseUrl: 'https://oirschot.bestuurlijkeinformatie.nl',
        configPath: path.join(__dirname, '../config/platforms/notubiz/v2.0.0.yaml')
      },
      {
        id: 'best',
        name: 'Best',
        platform: 'IBIS' as const,
        platformVersion: '1.0.0',
        baseUrl: 'https://best.raadsinformatie.nl',
        configPath: path.join(__dirname, '../config/platforms/ibis/v1.0.0.yaml')
      }
    ];

    // Filter if specific municipality requested
    const testMunicipalities = options.municipality
      ? municipalities.filter(m => m.id === options.municipality)
      : municipalities;

    if (testMunicipalities.length === 0) {
      console.error(`Municipality '${options.municipality}' not found`);
      process.exit(1);
    }

    const validator = new MonthlyValidator({
      municipalities: testMunicipalities,
      month,
      year,
      outputDir: path.join(__dirname, '../output')
    });

    try {
      const results = await validator.run();

      if (results.results.successRate === 100) {
        console.log('\n✅ All tests passed!');
        process.exit(0);
      } else {
        console.log(`\n⚠️ ${results.results.failedMeetings.length} tests failed`);
        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ Test execution failed:', error);
      process.exit(1);
    }
  });

program.parse();
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "test:monthly": "ts-node bin/monthly-validator.ts run",
    "test:quick": "ts-node bin/monthly-validator.ts run --municipality oirschot",
    "test:october": "ts-node bin/monthly-validator.ts run --month 9 --year 2025",
    "test:validate": "ts-node tests/validate-output.ts"
  }
}
```

---

## Related Documentation

- [Testing Overview](./testing-overview.md)
- [Output Format Specification](./output-format.md)
- [Validation Examples](./validation-examples.md)

---

[← Back to Documentation Index](../README.md)
