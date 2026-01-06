# External API Reference

Complete API documentation for integrating with Politeia.

---

## Base URL

```
Production: https://politeia.your-domain.com
Development: http://localhost:3000
```

---

## Authentication

### API Key (Recommended)

```http
POST /api/scrape/meetings-list
Authorization: Bearer your-api-key-here
Content-Type: application/json
```

### Optional: No Auth (Development)

```bash
# Set in .env
REQUIRE_AUTH=false
```

---

## Endpoints

### 1. Health Check

**GET** `/health`

Check service health status.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-01-06T15:00:00Z",
  "uptime": 86400,
  "browserbase": {
    "connected": true,
    "availableSessions": 50
  }
}
```

---

### 2. List Platforms

**GET** `/api/platforms`

Get all supported platforms.

**Response:**
```json
{
  "platforms": [
    {
      "type": "NOTUBIZ",
      "name": "NOTUBIZ",
      "vendor": "Decos",
      "supportedFeatures": [
        "meetings-list",
        "meeting-details",
        "attachments"
      ],
      "version": "1.0.0"
    },
    {
      "type": "IBIS",
      "name": "IBIS",
      "vendor": "IBIS",
      "supportedFeatures": [
        "meetings-list",
        "meeting-details"
      ],
      "version": "0.9.0"
    }
  ]
}
```

---

### 3. List Municipalities

**GET** `/api/municipalities`

Get configured municipalities.

**Query Parameters:**
- `platformType` (optional) - Filter by platform
- `province` (optional) - Filter by province

**Response:**
```json
{
  "municipalities": [
    {
      "id": "oirschot",
      "name": "Oirschot",
      "province": "Noord-Brabant",
      "platformType": "NOTUBIZ",
      "baseUrl": "https://oirschot.bestuurlijkeinformatie.nl",
      "status": "active"
    }
  ],
  "total": 1,
  "filtered": 1
}
```

---

### 4. Scrape Meetings List

**POST** `/api/scrape/meetings-list`

Extract meeting list from calendar.

**Request Body:**
```json
{
  "requestType": "meetings-list",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "municipality": {
    "id": "oirschot",
    "name": "Oirschot",
    "platformType": "NOTUBIZ",
    "baseUrl": "https://oirschot.bestuurlijkeinformatie.nl"
  },
  "parameters": {
    "month": 10,
    "year": 2025,
    "maxMeetings": 100
  },
  "callbackUrl": "https://your-system.com/api/webhook/scrape-results",
  "metadata": {
    "scheduledBy": "daily-cron",
    "priority": "normal",
    "customField": "any-value"
  }
}
```

**Response (Success):**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "timestamp": "2026-01-06T15:05:23Z",
  "executionTime": 4523,
  "browserbaseSessionUrl": "https://browserbase.com/sessions/abc123",
  "data": {
    "meetingsCount": 4,
    "meetings": [
      {
        "id": "b465214f-a570-45ba-85b9-c4d02bc5b107",
        "source": "oirschot",
        "title": "Auditcommissie",
        "meetingType": "Commissievergadering",
        "date": "2025-10-07",
        "startTime": "19:30",
        "endTime": "21:00",
        "location": null,
        "status": "scheduled",
        "url": "https://oirschot.bestuurlijkeinformatie.nl/Agenda/Index/b465214f-a570-45ba-85b9-c4d02bc5b107",
        "hash": "sha256-hash-of-meeting-data"
      }
    ]
  },
  "metadata": {
    "scheduledBy": "daily-cron",
    "priority": "normal"
  }
}
```

**Response (Error):**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "error",
  "timestamp": "2026-01-06T15:05:23Z",
  "error": {
    "code": "SCRAPING_FAILED",
    "message": "Failed to navigate to calendar page",
    "details": "Timeout after 60000ms",
    "retryable": true,
    "browserbaseSessionUrl": "https://browserbase.com/sessions/abc123"
  }
}
```

---

### 5. Scrape Meeting Details

**POST** `/api/scrape/meeting-details`

Extract detailed information for a specific meeting.

**Request Body:**
```json
{
  "requestType": "meeting-details",
  "requestId": "660f9500-f39c-52e5-b827-557766550001",
  "municipality": {
    "id": "oirschot",
    "platformType": "NOTUBIZ"
  },
  "meetingId": "b465214f-a570-45ba-85b9-c4d02bc5b107",
  "meetingUrl": "https://oirschot.bestuurlijkeinformatie.nl/Agenda/Index/b465214f-a570-45ba-85b9-c4d02bc5b107",
  "extractionOptions": {
    "includeAgenda": true,
    "includeAttachments": true,
    "includeMetadata": true,
    "maxAgendaDepth": 5
  },
  "callbackUrl": "https://your-system.com/api/webhook/scrape-results"
}
```

**Response:**
```json
{
  "requestId": "660f9500-f39c-52e5-b827-557766550001",
  "status": "success",
  "timestamp": "2026-01-06T15:10:45Z",
  "executionTime": 3245,
  "data": {
    "meetingId": "b465214f-a570-45ba-85b9-c4d02bc5b107",
    "metadata": {
      "Locatie": "Commissiekamer beneden",
      "Voorzitter": "M. van Leeuwen",
      "Agenda documenten": "251007 Agenda Auditcommissie"
    },
    "agendaItems": [
      {
        "index": 1,
        "number": "1",
        "title": "Opening",
        "description": null,
        "hasSubItems": false,
        "isSubItem": false,
        "parentIndex": null,
        "attachments": []
      },
      {
        "index": 2,
        "number": "2",
        "title": "Vaststellen agenda",
        "description": null,
        "hasSubItems": true,
        "isSubItem": false,
        "parentIndex": null,
        "attachments": [
          {
            "id": "doc-uuid-123",
            "name": "Agenda Auditcommissie 7 oktober.pdf",
            "type": "pdf",
            "url": "https://oirschot.bestuurlijkeinformatie.nl/Document/...",
            "viewUrl": null,
            "extension": ".pdf",
            "size": 110592
          }
        ]
      }
    ],
    "attachmentsSummary": {
      "total": 6,
      "byType": {
        "pdf": 4,
        "document": 2
      }
    },
    "htmlStructure": {
      "hasMainContent": true,
      "hasBreadcrumb": true,
      "hasAgendaList": true,
      "hasAttachmentsList": true
    }
  }
}
```

---

## Request Schemas

### MeetingsListRequest

```typescript
interface MeetingsListRequest {
  requestType: 'meetings-list';
  requestId: string;  // UUID v4
  municipality: {
    id: string;
    name: string;
    platformType: 'NOTUBIZ' | 'IBIS' | 'CUSTOM';
    baseUrl: string;
  };
  parameters?: {
    month?: number;      // 1-12
    year?: number;       // e.g., 2025
    maxMeetings?: number; // default: 100
  };
  callbackUrl?: string;  // Webhook URL
  metadata?: Record<string, any>;
}
```

### MeetingDetailsRequest

```typescript
interface MeetingDetailsRequest {
  requestType: 'meeting-details';
  requestId: string;
  municipality: {
    id: string;
    platformType: 'NOTUBIZ' | 'IBIS' | 'CUSTOM';
  };
  meetingId: string;
  meetingUrl: string;
  extractionOptions: {
    includeAgenda: boolean;
    includeAttachments: boolean;
    includeMetadata: boolean;
    maxAgendaDepth?: number;  // default: 5
  };
  callbackUrl?: string;
  metadata?: Record<string, any>;
}
```

---

## Response Schemas

### Success Response

```typescript
interface SuccessResponse {
  requestId: string;
  status: 'success';
  timestamp: string;  // ISO 8601
  executionTime: number;  // milliseconds
  browserbaseSessionUrl?: string;
  data: MeetingsList | MeetingDetails;
  metadata?: Record<string, any>;
}
```

### Error Response

```typescript
interface ErrorResponse {
  requestId: string;
  status: 'error';
  timestamp: string;
  error: {
    code: ErrorCode;
    message: string;
    details?: string;
    retryable: boolean;
    browserbaseSessionUrl?: string;
  };
}

type ErrorCode =
  | 'INVALID_REQUEST'
  | 'PLATFORM_NOT_SUPPORTED'
  | 'SCRAPING_FAILED'
  | 'TIMEOUT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'BROWSERBASE_ERROR'
  | 'CONFIGURATION_ERROR';
```

---

## Error Codes

| Code | Description | Retryable | Action |
|------|-------------|-----------|--------|
| `INVALID_REQUEST` | Malformed request body | ❌ | Fix request format |
| `PLATFORM_NOT_SUPPORTED` | Unknown platform type | ❌ | Check platform list |
| `SCRAPING_FAILED` | Failed to extract data | ✅ | Retry or check logs |
| `TIMEOUT` | Request exceeded timeout | ✅ | Retry with longer timeout |
| `RATE_LIMIT_EXCEEDED` | Too many requests | ✅ | Wait and retry |
| `BROWSERBASE_ERROR` | Browser session error | ✅ | Retry |
| `CONFIGURATION_ERROR` | Invalid config | ❌ | Fix configuration |

---

## Rate Limits

### Default Limits

```typescript
{
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  concurrentSessions: 10
}
```

### Custom Limits

Contact support for higher limits.

**Headers:**
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1609459200
```

---

## Webhooks

If `callbackUrl` is provided, Politeia will POST results:

**Webhook Payload:**
```json
{
  "requestId": "uuid",
  "status": "success",
  "timestamp": "2026-01-06T15:00:00Z",
  "data": { /* scraping results */ }
}
```

**Security:**
- Verify webhook signature (optional)
- Use HTTPS endpoints only
- Implement idempotency (same requestId)

---

## Code Examples

### Node.js / TypeScript

```typescript
import fetch from 'node-fetch';

class PoliteiaClient {
  constructor(
    private baseUrl: string,
    private apiKey?: string
  ) {}

  async scrapeMeetingsList(request: MeetingsListRequest) {
    const response = await fetch(`${this.baseUrl}/api/scrape/meetings-list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  }
}

// Usage
const client = new PoliteiaClient('https://politeia.example.com', 'your-api-key');

const result = await client.scrapeMeetingsList({
  requestType: 'meetings-list',
  requestId: crypto.randomUUID(),
  municipality: {
    id: 'oirschot',
    name: 'Oirschot',
    platformType: 'NOTUBIZ',
    baseUrl: 'https://oirschot.bestuurlijkeinformatie.nl'
  },
  parameters: {
    month: 10,
    year: 2025
  }
});

console.log(`Found ${result.data.meetingsCount} meetings`);
```

### Python

```python
import requests
import uuid

class PoliteiaClient:
    def __init__(self, base_url: str, api_key: str = None):
        self.base_url = base_url
        self.api_key = api_key

    def scrape_meetings_list(self, request: dict):
        headers = {'Content-Type': 'application/json'}
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'

        response = requests.post(
            f'{self.base_url}/api/scrape/meetings-list',
            json=request,
            headers=headers
        )
        response.raise_for_status()
        return response.json()

# Usage
client = PoliteiaClient('https://politeia.example.com', 'your-api-key')

result = client.scrape_meetings_list({
    'requestType': 'meetings-list',
    'requestId': str(uuid.uuid4()),
    'municipality': {
        'id': 'oirschot',
        'name': 'Oirschot',
        'platformType': 'NOTUBIZ',
        'baseUrl': 'https://oirschot.bestuurlijkeinformatie.nl'
    },
    'parameters': {
        'month': 10,
        'year': 2025
    }
})

print(f"Found {result['data']['meetingsCount']} meetings")
```

### cURL

```bash
curl -X POST https://politeia.example.com/api/scrape/meetings-list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "requestType": "meetings-list",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
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

---

## Best Practices

### 1. Use Request IDs
Always generate unique `requestId` (UUID v4) for tracking and idempotency.

### 2. Implement Retry Logic
```typescript
async function scrapeWithRetry(request, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await politeia.scrape(request);
    } catch (error) {
      if (!error.retryable || i === maxRetries - 1) {
        throw error;
      }
      await sleep(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}
```

### 3. Handle Webhooks
```typescript
app.post('/webhook/scrape-results', async (req, res) => {
  const { requestId, status, data } = req.body;

  // Idempotency check
  if (await db.hasProcessed(requestId)) {
    return res.status(200).send('OK');
  }

  // Process results
  await processResults(data);

  // Mark as processed
  await db.markProcessed(requestId);

  res.status(200).send('OK');
});
```

### 4. Monitor Rate Limits
```typescript
if (response.headers['x-ratelimit-remaining'] < 10) {
  console.warn('Approaching rate limit');
  await sleep(5000);
}
```

---

## Testing

### Health Check
```bash
curl https://politeia.example.com/health
```

### List Platforms
```bash
curl https://politeia.example.com/api/platforms
```

### Test Scraping (Development)
```bash
curl -X POST http://localhost:3000/api/scrape/meetings-list \
  -H "Content-Type: application/json" \
  -d @test-request.json
```

---

## Related Documentation

- [Request Schemas](./request-schemas.md)
- [Response Schemas](./response-schemas.md)
- [Authentication](./authentication.md)
- [Deployment](../07-deployment/docker.md)

---

[← Back to Documentation Index](../README.md)
