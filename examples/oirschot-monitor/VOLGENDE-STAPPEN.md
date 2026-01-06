# Roadmap: Van MVP naar Productie

## 🎯 Huidige Status (MVP)

✅ **Wat werkt:**
- Website analyse en content discovery
- Extractie van recente items, vergaderingen en secties
- Structured output met Zod schemas
- Monitoring aanbevelingen

❌ **Wat nog niet werkt:**
- Geen change detection
- Geen persistente opslag
- Geen automatische scheduling
- Geen notificaties bij wijzigingen
- Geen integratie met extern systeem

## 📈 Fasering

### **Fase 1: Change Detection** (1-2 weken)

#### Doelstellingen
- Detecteer nieuwe en gewijzigde items
- Sla baseline data op
- Genereer diff reports

#### Taken
1. **Database Setup**
   ```typescript
   // PostgreSQL schema
   CREATE TABLE snapshots (
     id SERIAL PRIMARY KEY,
     created_at TIMESTAMP,
     url VARCHAR(500),
     data JSONB
   );

   CREATE TABLE changes (
     id SERIAL PRIMARY KEY,
     detected_at TIMESTAMP,
     change_type VARCHAR(50), -- 'new', 'modified', 'deleted'
     item_type VARCHAR(50),   -- 'meeting', 'motion', 'document'
     data JSONB
   );
   ```

2. **Diff Algorithm**
   ```typescript
   interface ChangeDetector {
     compareSnapshots(
       baseline: AnalysisResult,
       current: AnalysisResult
     ): Change[];

     detectNew(current: Item[], baseline: Item[]): Item[];
     detectModified(current: Item[], baseline: Item[]): Item[];
     detectDeleted(current: Item[], baseline: Item[]): Item[];
   }
   ```

3. **Storage Layer**
   ```typescript
   class SnapshotStore {
     async saveSnapshot(result: AnalysisResult): Promise<void>;
     async getLatestSnapshot(): Promise<AnalysisResult>;
     async getSnapshotByDate(date: Date): Promise<AnalysisResult>;
   }
   ```

4. **Change Report**
   ```typescript
   interface ChangeReport {
     timestamp: Date;
     totalChanges: number;
     newItems: Item[];
     modifiedItems: { before: Item; after: Item }[];
     deletedItems: Item[];
     summary: string;
   }
   ```

#### Deliverables
- `src/change-detector.ts` - Change detection logic
- `src/storage.ts` - Database persistence
- `src/diff.ts` - Diff algorithm
- Tests voor alle componenten

---

### **Fase 2: Automatisering** (1 week)

#### Doelstellingen
- Periodieke uitvoering zonder handmatige interventie
- Configureerbare scheduling
- Error handling en recovery

#### Taken
1. **Cron Job Setup**
   ```typescript
   // cron-config.ts
   export const SCHEDULE = {
     daily: '0 8 * * *',      // 08:00 dagelijks
     weekly: '0 8 * * 1',     // Maandag 08:00
     hourly: '0 * * * *',     // Elk uur
   };
   ```

2. **Scheduler Implementation**
   ```typescript
   class MonitorScheduler {
     async schedule(frequency: 'hourly' | 'daily' | 'weekly'): Promise<void>;
     async runJob(): Promise<void>;
     async handleError(error: Error): Promise<void>;
   }
   ```

3. **Health Checks**
   ```typescript
   interface HealthCheck {
     lastRun: Date;
     status: 'success' | 'failure';
     errors: string[];
     nextRun: Date;
   }
   ```

4. **Docker Container** (optioneel)
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY . .
   RUN npm install
   CMD ["npm", "run", "monitor"]
   ```

#### Deliverables
- `src/scheduler.ts` - Scheduling logic
- `docker-compose.yml` - Container setup
- `systemd/oirschot-monitor.service` - Linux service
- Documentation voor deployment

---

### **Fase 3: Notificaties** (1 week)

#### Doelstellingen
- Real-time alerts bij wijzigingen
- Configureerbare notificatie kanalen
- Rich formatting

#### Taken
1. **Email Notificaties**
   ```typescript
   interface EmailNotifier {
     sendChangeAlert(changes: ChangeReport): Promise<void>;
     formatHtml(changes: ChangeReport): string;
   }
   ```

2. **Slack Integration**
   ```typescript
   interface SlackNotifier {
     postToChannel(changes: ChangeReport): Promise<void>;
     formatMessage(changes: ChangeReport): SlackMessage;
   }
   ```

3. **Webhook Support**
   ```typescript
   interface WebhookNotifier {
     sendToEndpoint(url: string, payload: any): Promise<void>;
   }
   ```

4. **Notification Templates**
   ```html
   <!-- email-template.html -->
   <h2>Nieuwe Wijzigingen Gedetecteerd</h2>
   <p>Er zijn {{totalChanges}} wijzigingen gevonden:</p>
   <ul>
     {{#each newItems}}
       <li><strong>{{title}}</strong> - {{category}} ({{date}})</li>
     {{/each}}
   </ul>
   ```

#### Deliverables
- `src/notifiers/email.ts`
- `src/notifiers/slack.ts`
- `src/notifiers/webhook.ts`
- `templates/` folder met templates

---

### **Fase 4: Deep Analysis** (2-3 weken)

#### Doelstellingen
- Extractie van document content (PDFs)
- Analyse van detail pagina's
- Sentiment en keyword analysis

#### Taken
1. **PDF Extraction**
   ```typescript
   class DocumentAnalyzer {
     async downloadPdf(url: string): Promise<Buffer>;
     async extractText(pdf: Buffer): Promise<string>;
     async analyzeSentiment(text: string): Promise<Sentiment>;
     async extractKeywords(text: string): Promise<string[]>;
   }
   ```

2. **Detail Page Scraping**
   ```typescript
   class DetailPageScraper {
     async navigateToItem(item: Item): Promise<void>;
     async extractFullDetails(itemUrl: string): Promise<DetailedItem>;
   }

   interface DetailedItem extends Item {
     fullText: string;
     attachments: string[];
     relatedItems: Item[];
     authors: string[];
   }
   ```

3. **Categorization**
   ```typescript
   class ItemCategorizer {
     async categorize(item: Item): Promise<Category>;
     async tagWithKeywords(item: Item): Promise<string[]>;
   }

   enum Category {
     Environment = 'environment',
     Finance = 'finance',
     Infrastructure = 'infrastructure',
     Social = 'social',
     // ...
   }
   ```

4. **Search Index**
   ```typescript
   // Elasticsearch/Meilisearch integration
   class SearchIndexer {
     async indexDocument(doc: DetailedItem): Promise<void>;
     async search(query: string): Promise<DetailedItem[]>;
   }
   ```

#### Deliverables
- `src/analyzers/pdf-analyzer.ts`
- `src/analyzers/detail-scraper.ts`
- `src/analyzers/categorizer.ts`
- Search index setup

---

### **Fase 5: API & Integration** (2 weken)

#### Doelstellingen
- REST API voor externe toegang
- Integratie met extern systeem
- Authentication & Authorization

#### Taken
1. **REST API**
   ```typescript
   // Express.js API
   app.get('/api/changes', async (req, res) => {
     const changes = await getRecentChanges(req.query.since);
     res.json(changes);
   });

   app.get('/api/items/:id', async (req, res) => {
     const item = await getItemById(req.params.id);
     res.json(item);
   });

   app.get('/api/meetings', async (req, res) => {
     const meetings = await getUpcomingMeetings();
     res.json(meetings);
   });
   ```

2. **Authentication**
   ```typescript
   interface AuthMiddleware {
     verifyToken(token: string): Promise<User>;
     requireAuth(req, res, next): void;
   }
   ```

3. **Rate Limiting**
   ```typescript
   import rateLimit from 'express-rate-limit';

   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 min
     max: 100 // max requests
   });
   ```

4. **OpenAPI Documentation**
   ```yaml
   openapi: 3.0.0
   info:
     title: Oirschot Monitor API
     version: 1.0.0
   paths:
     /api/changes:
       get:
         summary: Get recent changes
         parameters:
           - name: since
             in: query
             schema:
               type: string
               format: date-time
   ```

5. **External System Integration**
   ```typescript
   class ExternalSystemClient {
     async pushChanges(changes: ChangeReport): Promise<void>;
     async syncMeetings(meetings: Meeting[]): Promise<void>;
   }
   ```

#### Deliverables
- `src/api/` - API implementation
- `openapi.yaml` - API documentation
- `src/integrations/` - External system connectors
- Postman collection voor testing

---

### **Fase 6: Dashboard** (2-3 weken)

#### Doelstellingen
- Web UI voor monitoring
- Visualisaties van trends
- Manual trigger controls

#### Taken
1. **Frontend Setup**
   ```bash
   # React + TypeScript
   npx create-react-app dashboard --template typescript
   ```

2. **Dashboard Components**
   ```typescript
   // Components
   - RecentChangesWidget
   - UpcomingMeetingsWidget
   - TrendChart
   - ItemsTable
   - DetailModal
   ```

3. **Real-time Updates**
   ```typescript
   // WebSocket voor live updates
   const ws = new WebSocket('ws://localhost:3000/ws');
   ws.onmessage = (event) => {
     const change = JSON.parse(event.data);
     updateDashboard(change);
   };
   ```

4. **Charts & Visualizations**
   ```typescript
   import { Line, Bar, Pie } from 'react-chartjs-2';

   <Line data={changesOverTime} />
   <Bar data={itemsByCategory} />
   <Pie data={meetingsByType} />
   ```

#### Deliverables
- `dashboard/` - React application
- Deployment setup (Vercel/Netlify)
- User documentation

---

## 🎬 Quick Start Roadmap

### **Week 1-2: Foundation**
- [ ] Database setup (PostgreSQL)
- [ ] Change detection algorithm
- [ ] Storage layer
- [ ] Basic tests

### **Week 3: Automation**
- [ ] Cron job implementation
- [ ] Error handling
- [ ] Health checks
- [ ] Deployment setup

### **Week 4: Notifications**
- [ ] Email notifier
- [ ] Slack integration
- [ ] Templates
- [ ] Testing

### **Week 5-7: Deep Analysis**
- [ ] PDF extraction
- [ ] Detail page scraping
- [ ] Categorization
- [ ] Search index

### **Week 8-9: API**
- [ ] REST API development
- [ ] Authentication
- [ ] Documentation
- [ ] External integration

### **Week 10-12: Dashboard**
- [ ] Frontend development
- [ ] Real-time updates
- [ ] Visualizations
- [ ] Deployment

---

## 💡 Prioriteiten

### **Must Have (MVP+)**
1. Change detection
2. Database storage
3. Scheduled runs
4. Email notifications

### **Should Have**
1. Slack integration
2. PDF extraction
3. REST API
4. Search functionality

### **Nice to Have**
1. Dashboard
2. Real-time updates
3. Advanced analytics
4. Mobile app

---

## 🔧 Tech Stack Aanbevelingen

### **Backend**
- **Runtime**: Node.js 18+
- **Framework**: Express.js of Fastify
- **Database**: PostgreSQL (Supabase voor managed)
- **ORM**: Prisma of TypeORM
- **Scheduling**: node-cron of BullMQ
- **Testing**: Jest + Supertest

### **Frontend**
- **Framework**: React + TypeScript
- **UI Library**: Material-UI of Chakra UI
- **State**: Zustand of Redux Toolkit
- **Charts**: Chart.js of Recharts
- **Deploy**: Vercel of Netlify

### **Infrastructure**
- **Hosting**: Railway, Render, or DigitalOcean
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry + Uptime Robot
- **Logging**: Winston + Papertrail

---

## 📊 Geschatte Effort

| Fase | Effort | Dependencies |
|------|--------|-------------|
| Change Detection | 1-2 weken | MVP complete |
| Automation | 1 week | Phase 1 |
| Notifications | 1 week | Phase 2 |
| Deep Analysis | 2-3 weken | Phase 3 |
| API & Integration | 2 weken | Phase 4 |
| Dashboard | 2-3 weken | Phase 5 |
| **Totaal** | **9-12 weken** | |

---

## 🚀 Ga aan de slag!

Begin met **Fase 1** en bouw stap voor stap verder. Elk fase levert werkende functionaliteit op die onafhankelijk van latere fases gebruikt kan worden.

Succes! 🎉
