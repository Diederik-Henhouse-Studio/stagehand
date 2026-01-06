/**
 * Browserbase Session Tracker
 * Tracks and stores session metadata for later analysis
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface SessionMetadata {
  sessionId: string;
  sessionUrl: string;
  debugUrl?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  purpose: string;
  extractedData: {
    sections?: number;
    items?: number;
    meetings?: number;
    meetingDetails?: number;
  };
  status: 'active' | 'completed' | 'failed';
  error?: string;
}

export class SessionTracker {
  private sessionsDir: string;
  private sessionsFile: string;

  constructor(dataDir: string = './data') {
    this.sessionsDir = dataDir;
    this.sessionsFile = join(dataDir, 'sessions.json');

    // Ensure data directory exists
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Start tracking a new session
   */
  startSession(sessionId: string, sessionUrl: string, debugUrl: string, purpose: string): SessionMetadata {
    const session: SessionMetadata = {
      sessionId,
      sessionUrl,
      debugUrl,
      startTime: new Date().toISOString(),
      purpose,
      extractedData: {},
      status: 'active'
    };

    this.saveSession(session);
    console.log(`\n📝 Session tracked: ${sessionId}`);
    console.log(`   URL: ${sessionUrl}`);
    console.log(`   Debug: ${debugUrl}\n`);

    return session;
  }

  /**
   * Update session with extraction data
   */
  updateSession(sessionId: string, data: Partial<SessionMetadata['extractedData']>) {
    const sessions = this.loadSessions();
    const session = sessions.find(s => s.sessionId === sessionId);

    if (session) {
      session.extractedData = { ...session.extractedData, ...data };
      this.saveSessions(sessions);
    }
  }

  /**
   * Complete a session
   */
  completeSession(sessionId: string, error?: string) {
    const sessions = this.loadSessions();
    const session = sessions.find(s => s.sessionId === sessionId);

    if (session) {
      session.endTime = new Date().toISOString();
      session.duration = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
      session.status = error ? 'failed' : 'completed';
      if (error) session.error = error;

      this.saveSessions(sessions);

      console.log(`\n✅ Session completed: ${sessionId}`);
      console.log(`   Duration: ${(session.duration / 1000).toFixed(2)}s`);
      console.log(`   Status: ${session.status}\n`);
    }
  }

  /**
   * Get all sessions
   */
  getSessions(): SessionMetadata[] {
    return this.loadSessions();
  }

  /**
   * Get recent sessions
   */
  getRecentSessions(limit: number = 10): SessionMetadata[] {
    const sessions = this.loadSessions();
    return sessions
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionMetadata | undefined {
    const sessions = this.loadSessions();
    return sessions.find(s => s.sessionId === sessionId);
  }

  /**
   * Generate session report
   */
  generateReport(): string {
    const sessions = this.loadSessions();
    const total = sessions.length;
    const completed = sessions.filter(s => s.status === 'completed').length;
    const failed = sessions.filter(s => s.status === 'failed').length;
    const active = sessions.filter(s => s.status === 'active').length;

    const totalMeetings = sessions.reduce((sum, s) => sum + (s.extractedData.meetings || 0), 0);
    const totalItems = sessions.reduce((sum, s) => sum + (s.extractedData.items || 0), 0);

    return `
📊 BROWSERBASE SESSION REPORT
════════════════════════════════════════

📈 Summary:
  Total Sessions:     ${total}
  ✅ Completed:       ${completed}
  ❌ Failed:          ${failed}
  🔄 Active:          ${active}

📋 Data Extracted:
  Total Meetings:     ${totalMeetings}
  Total Items:        ${totalItems}

🕐 Recent Sessions:
${this.getRecentSessions(5).map(s => `
  • ${s.sessionId.substring(0, 8)}... (${s.purpose})
    Status: ${s.status}
    Duration: ${s.duration ? (s.duration / 1000).toFixed(2) + 's' : 'N/A'}
    Extracted: ${s.extractedData.meetings || 0} meetings, ${s.extractedData.items || 0} items
`).join('\n')}

════════════════════════════════════════
    `.trim();
  }

  private saveSession(session: SessionMetadata) {
    const sessions = this.loadSessions();
    sessions.push(session);
    this.saveSessions(sessions);
  }

  private loadSessions(): SessionMetadata[] {
    if (!existsSync(this.sessionsFile)) {
      return [];
    }

    try {
      const data = readFileSync(this.sessionsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading sessions:', error);
      return [];
    }
  }

  private saveSessions(sessions: SessionMetadata[]) {
    try {
      writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2));
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
  }
}
