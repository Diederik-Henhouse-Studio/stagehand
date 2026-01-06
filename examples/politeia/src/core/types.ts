/**
 * Core type definitions for Politeia
 */

import type { Page } from 'playwright';

// ============================================================================
// Configuration Types
// ============================================================================

export interface MunicipalityConfig {
  id: string;
  name: string;
  platform: 'NOTUBIZ' | 'IBIS';
  platformVersion: string;
  urls: {
    base: string;
    calendar: string;
  };
  scraping: {
    timeout: number;
    retries: number;
    waitForSelector?: 'load' | 'domcontentloaded' | 'networkidle';
    screenshots?: boolean;
  };
  validation?: {
    requiredFields?: string[];
    minAgendaItems?: number;
    minDocuments?: number;
  };
}

export interface PlatformConfig {
  name: string;
  version: string;
  selectors: PlatformSelectors;
  parser: PlatformParser;
}

export interface PlatformSelectors {
  // Calendar page selectors
  meetingList: string;
  meetingItem: string;
  meetingTitle: string;
  meetingDate: string;
  meetingTime?: string;
  meetingUrl: string;
  meetingStatus?: string;

  // Meeting detail selectors
  agendaItems: string;
  agendaNumber: string;
  agendaTitle: string;
  agendaDescription?: string;

  // Document selectors
  documents: string;
  documentTitle: string;
  documentUrl: string;
  documentType?: string;
  documentSize?: string;
}

export interface PlatformParser {
  parseDate: (dateString: string) => Date;
  parseMeetingList: (html: string) => MeetingReference[];
  parseMeetingDetail: (html: string) => MeetingDetail;
  parseAgendaItems: (html: string) => AgendaItem[];
  parseDocuments: (html: string) => Document[];
}

// ============================================================================
// Scraping Result Types
// ============================================================================

export interface MeetingReference {
  title: string;
  date: Date;
  url: string;
  status?: string;
}

export interface MeetingDetail {
  id: string;
  title: string;
  date: Date;
  time?: string;
  location?: string;
  status?: string;
  url: string;
  agendaItems: AgendaItem[];
  documents: Document[];
}

export interface AgendaItem {
  number: string;
  title: string;
  description?: string;
  decision?: string;
}

export interface Document {
  title: string;
  type?: string;
  url: string;
  size?: number;
  date?: Date;
}

// ============================================================================
// Test & Validation Types
// ============================================================================

export interface TestConfig {
  month: number;
  year: number;
  municipalities: MunicipalityConfig[];
  verbose?: boolean;
  outputDir?: string;
}

export interface TestResults {
  testRunId: string;
  executedAt: string;
  testType: 'monthly-validation' | 'quick-test' | 'single-meeting';
  testedMonth?: {
    month: number;
    year: number;
    label: string;
  };
  municipalities: MunicipalityTestResult[];
  results: {
    totalMeetings: number;
    totalAgendaItems: number;
    totalDocuments: number;
    successRate: number;
    failedMeetings: string[];
  };
  duration?: {
    total: number;
    perMunicipality: Record<string, number>;
  };
}

export interface MunicipalityTestResult {
  municipality: string;
  municipalityName: string;
  platform: string;
  platformVersion: string;
  success: boolean;
  meetings: MeetingDetail[];
  validation: ValidationResult;
  session?: {
    id: string;
    recordingUrl?: string;
    duration?: number;
  };
  error?: string;
  timing?: {
    start: Date;
    end: Date;
    duration: number;
  };
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  warnings: string[];
  errors: string[];
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message?: string;
  severity: 'info' | 'warning' | 'error';
}

// ============================================================================
// Output Types
// ============================================================================

export interface OutputConfig {
  outputDir: string;
  format: 'json' | 'markdown' | 'both';
  includeMetadata: boolean;
  generatePerMeeting: boolean;
}

export interface MetadataOutput {
  testRunId: string;
  executedAt: string;
  testType: string;
  testedMonth?: {
    month: number;
    year: number;
    label: string;
  };
  municipalities: {
    id: string;
    name: string;
    platform: string;
    platformVersion: string;
  }[];
  configuration: {
    browserbase: {
      projectId: string;
      sessionTimeout: number;
    };
    politeia: {
      version: string;
      outputDir: string;
    };
  };
  results: {
    totalMeetings: number;
    totalAgendaItems: number;
    totalDocuments: number;
    successRate: number;
    failedMeetings: string[];
  };
  duration: {
    total: number;
    perMunicipality: Record<string, number>;
  };
}

// ============================================================================
// Scraper Engine Types
// ============================================================================

export interface ScraperOptions {
  municipality: MunicipalityConfig;
  month: number;
  year: number;
  logger?: Logger;
  session?: BrowserSession;
}

export interface BrowserSession {
  id: string;
  page: Page;
  recordingUrl?: string;
  startTime: Date;
  keepAlive?: boolean;
}

export interface ScrapingContext {
  municipality: MunicipalityConfig;
  session: BrowserSession;
  logger: Logger;
  retryCount: number;
  maxRetries: number;
}

// ============================================================================
// Logger Types
// ============================================================================

export interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, error?: Error | any): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  context: string;
  outputDir?: string;
  console?: boolean;
}

// ============================================================================
// Platform Adapter Interface
// ============================================================================

export interface PlatformAdapter {
  name: string;
  version: string;

  // Navigation
  getCalendarUrl(baseUrl: string, month: number, year: number): string;
  getMeetingUrl(baseUrl: string, meetingId: string): string;

  // Selectors
  getSelectors(): PlatformSelectors;

  // Parsing
  parseMeetingList(page: Page): Promise<MeetingReference[]>;
  parseMeetingDetail(page: Page): Promise<MeetingDetail>;
  parseAgendaItems(page: Page): Promise<AgendaItem[]>;
  parseDocuments(page: Page): Promise<Document[]>;

  // Validation
  validateMeeting(meeting: MeetingDetail): ValidationResult;
  validateConfiguration(config: MunicipalityConfig): boolean;
}

// ============================================================================
// CLI Types
// ============================================================================

export interface CLIOptions {
  command: 'test' | 'scrape' | 'demo' | 'validate';
  month?: number;
  year?: number;
  municipality?: string;
  url?: string;
  verbose?: boolean;
  output?: string;
}
