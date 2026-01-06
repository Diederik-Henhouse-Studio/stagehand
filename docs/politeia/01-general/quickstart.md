# Quick Start Guide

Get Politeia up and running in 5 minutes.

---

## Prerequisites

- Node.js 18+ installed
- Browserbase account ([sign up](https://browserbase.com))
- Basic knowledge of REST APIs

---

## Step 1: Clone & Install

```bash
# Clone repository
git clone https://github.com/your-org/politeia.git
cd politeia

# Install dependencies
npm install

# Or with Docker
docker pull politeia/service:latest
```

---

## Step 2: Configuration

### Environment Variables

Create `.env` file:

```bash
# Browserbase credentials
BROWSERBASE_API_KEY=your_api_key_here
BROWSERBASE_PROJECT_ID=your_project_id

# Service configuration
PORT=3000
NODE_ENV=production

# Optional: Authentication
API_KEY=your_secret_api_key
```

### Get Browserbase Credentials

1. Visit [browserbase.com](https://browserbase.com)
2. Create account
3. Go to Settings → API Keys
4. Copy API Key and Project ID

---

## Step 3: Start the Service

### Option A: Local Development

```bash
npm run dev
```

### Option B: Production

```bash
npm start
```

### Option C: Docker

```bash
docker run -p 3000:3000 \
  -e BROWSERBASE_API_KEY=your_key \
  -e BROWSERBASE_PROJECT_ID=your_project \
  politeia/service:latest
```

---

## Step 4: Test the API

### Health Check

```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-01-06T15:00:00Z"
}
```

### List Supported Platforms

```bash
curl http://localhost:3000/api/platforms
```

**Response:**
```json
{
  "platforms": [
    {
      "type": "NOTUBIZ",
      "name": "NOTUBIZ",
      "vendor": "Decos"
    },
    {
      "type": "IBIS",
      "name": "IBIS",
      "vendor": "IBIS"
    }
  ]
}
```

---

## Step 5: Make Your First Request

### Scrape Meeting List

```bash
curl -X POST http://localhost:3000/api/scrape/meetings-list \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "meetings-list",
    "requestId": "test-001",
    "municipality": {
      "id": "oirschot",
      "name": "Oirschot",
      "platformType": "NOTUBIZ",
      "baseUrl": "https://oirschot.bestuurlijkeinformatie.nl"
    },
    "parameters": {
      "month": 10,
      "year": 2025
    }
  }'
```

**Response:**
```json
{
  "requestId": "test-001",
  "status": "success",
  "timestamp": "2026-01-06T15:05:00Z",
  "executionTime": 4523,
  "browserbaseSessionUrl": "https://browserbase.com/sessions/...",
  "data": {
    "meetingsCount": 4,
    "meetings": [
      {
        "id": "b465214f-a570-45ba-85b9-c4d02bc5b107",
        "title": "Auditcommissie",
        "meetingType": "Commissievergadering",
        "date": "2025-10-07",
        "startTime": "19:30",
        "endTime": "21:00",
        "status": "scheduled",
        "url": "https://oirschot.bestuurlijkeinformatie.nl/Agenda/Index/..."
      }
    ]
  }
}
```

### Scrape Meeting Details

```bash
curl -X POST http://localhost:3000/api/scrape/meeting-details \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "meeting-details",
    "requestId": "test-002",
    "municipality": {
      "id": "oirschot",
      "platformType": "NOTUBIZ"
    },
    "meetingId": "b465214f-a570-45ba-85b9-c4d02bc5b107",
    "meetingUrl": "https://oirschot.bestuurlijkeinformatie.nl/Agenda/Index/b465214f-a570-45ba-85b9-c4d02bc5b107",
    "extractionOptions": {
      "includeAgenda": true,
      "includeAttachments": true,
      "includeMetadata": true
    }
  }'
```

---

## Step 6: Integrate with Your System

### Node.js Example

```typescript
import fetch from 'node-fetch';

const politeia = {
  baseUrl: 'http://localhost:3000',

  async scrapeMeetings(municipality: Municipality) {
    const response = await fetch(`${this.baseUrl}/api/scrape/meetings-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'meetings-list',
        requestId: crypto.randomUUID(),
        municipality
      })
    });

    return await response.json();
  }
};

// Usage
const meetings = await politeia.scrapeMeetings({
  id: 'oirschot',
  name: 'Oirschot',
  platformType: 'NOTUBIZ',
  baseUrl: 'https://oirschot.bestuurlijkeinformatie.nl'
});

console.log(`Found ${meetings.data.meetingsCount} meetings`);
```

### Python Example

```python
import requests
import uuid

class PoliteiaClient:
    def __init__(self, base_url='http://localhost:3000'):
        self.base_url = base_url

    def scrape_meetings(self, municipality):
        response = requests.post(
            f'{self.base_url}/api/scrape/meetings-list',
            json={
                'requestType': 'meetings-list',
                'requestId': str(uuid.uuid4()),
                'municipality': municipality
            }
        )
        return response.json()

# Usage
client = PoliteiaClient()
meetings = client.scrape_meetings({
    'id': 'oirschot',
    'name': 'Oirschot',
    'platformType': 'NOTUBIZ',
    'baseUrl': 'https://oirschot.bestuurlijkeinformatie.nl'
})

print(f"Found {meetings['data']['meetingsCount']} meetings")
```

---

## Common Use Cases

### Daily Monitoring

```typescript
// Schedule daily scraping
import { CronJob } from 'cron';

const job = new CronJob('0 6 * * *', async () => {
  const municipalities = await db.getMunicipalities();

  for (const muni of municipalities) {
    const meetings = await politeia.scrapeMeetings(muni);
    const changes = await detectChanges(meetings);

    if (changes.length > 0) {
      await notify(changes);
    }
  }
});

job.start();
```

### Change Detection

```typescript
// Compare with stored data
const storedMeetings = await db.getMeetings(municipalityId);
const currentMeetings = await politeia.scrapeMeetings(municipality);

const changes = {
  new: currentMeetings.filter(m => !storedMeetings.find(s => s.id === m.id)),
  modified: currentMeetings.filter(m => {
    const stored = storedMeetings.find(s => s.id === m.id);
    return stored && stored.hash !== m.hash;
  }),
  removed: storedMeetings.filter(s => !currentMeetings.find(m => m.id === s.id))
};

console.log(`Changes: ${changes.new.length} new, ${changes.modified.length} modified, ${changes.removed.length} removed`);
```

---

## Next Steps

### Essential Reading
- 📖 [API Reference](../03-api/external-api.md) - Complete API documentation
- 🏗️ [Architecture Overview](../02-architecture/system-overview.md) - Understand the system
- 🔧 [Platform Configuration](../04-platforms/notubiz.md) - Configure platforms

### Deployment
- 🐳 [Docker Deployment](../07-deployment/docker.md) - Production deployment
- ☸️ [Kubernetes](../07-deployment/kubernetes.md) - Orchestrated scaling
- 🚀 [Serverless](../07-deployment/serverless.md) - AWS Lambda/Google Cloud Functions

### Extensions
- 📱 [Social Media](../08-extensions/social-media.md) - Scrape social platforms
- 🌐 [Generic Scraping](../08-extensions/generic-scraping.md) - Custom websites

---

## Troubleshooting

### Service Won't Start

**Error:** `BROWSERBASE_API_KEY not found`

**Solution:** Set environment variables:
```bash
export BROWSERBASE_API_KEY=your_key
export BROWSERBASE_PROJECT_ID=your_project
```

### Request Times Out

**Error:** Request timeout after 60s

**Solutions:**
1. Increase timeout in configuration
2. Check Browserbase session status
3. Verify target website is accessible

### No Meetings Found

**Error:** `meetingsCount: 0`

**Possible Causes:**
1. Wrong month/year parameters
2. Platform configuration mismatch
3. Website structure changed

**Solution:** Check [Troubleshooting Guide](../09-operations/troubleshooting.md)

---

## Getting Help

- 📚 [FAQ](./faq.md) - Common questions
- 🐛 [Troubleshooting](../09-operations/troubleshooting.md) - Problem solving
- 💬 [GitHub Issues](https://github.com/your-org/politeia/issues) - Report bugs

---

**🎉 Congratulations!** You're now ready to use Politeia.

[← Back to Documentation Index](../README.md)
