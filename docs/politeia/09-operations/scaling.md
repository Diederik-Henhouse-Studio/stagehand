# Scaling Guide

Complete guide for scaling Politeia from single municipality to nationwide deployments.

---

## Overview

Scaling strategies for different deployment sizes:
- **Small** (1-10 municipalities): Single server
- **Medium** (10-50 municipalities): Load balanced cluster
- **Large** (50-200 municipalities): Kubernetes with auto-scaling
- **Nationwide** (200+ municipalities): Multi-region distributed system

---

## Scaling Metrics

### Key Performance Indicators

| Metric | Small | Medium | Large | Nationwide |
|--------|-------|--------|-------|------------|
| **Municipalities** | 1-10 | 10-50 | 50-200 | 200+ |
| **Requests/Day** | 10-100 | 100-500 | 500-2000 | 2000+ |
| **Concurrent Sessions** | 1-3 | 3-10 | 10-30 | 30+ |
| **CPU Cores** | 1-2 | 2-4 | 4-16 | 16+ |
| **Memory** | 1-2GB | 2-8GB | 8-32GB | 32GB+ |
| **Instances** | 1 | 2-3 | 3-10 | 10+ |

---

## Horizontal Scaling

### Load Balancer Setup

**Nginx Configuration:**

```nginx
# /etc/nginx/nginx.conf
http {
    upstream politeia_cluster {
        least_conn;  # Load balancing algorithm

        server politeia-1:3000 max_fails=3 fail_timeout=30s;
        server politeia-2:3000 max_fails=3 fail_timeout=30s;
        server politeia-3:3000 max_fails=3 fail_timeout=30s;

        # Health check
        keepalive 32;
    }

    server {
        listen 80;
        server_name politeia.example.com;

        location / {
            proxy_pass http://politeia_cluster;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;

            # Retry on failure
            proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        }

        location /health {
            proxy_pass http://politeia_cluster;
            access_log off;
        }
    }
}
```

### Docker Swarm

```yaml
# docker-compose.swarm.yml
version: '3.8'

services:
  politeia:
    image: politeia:latest
    deploy:
      replicas: 5
      update_config:
        parallelism: 2
        delay: 10s
        order: start-first
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      NODE_ENV: production
      BROWSERBASE_API_KEY: ${BROWSERBASE_API_KEY}
      BROWSERBASE_PROJECT_ID: ${BROWSERBASE_PROJECT_ID}
    networks:
      - politeia-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    deploy:
      placement:
        constraints:
          - node.role == manager
    networks:
      - politeia-network

networks:
  politeia-network:
    driver: overlay
```

**Deploy:**
```bash
docker stack deploy -c docker-compose.swarm.yml politeia
```

---

## Vertical Scaling

### Resource Optimization

**CPU Optimization:**

```javascript
// Use worker threads for parallel processing
const { Worker } = require('worker_threads');

async function scrapeInParallel(municipalities) {
  const workers = [];
  const chunkSize = Math.ceil(municipalities.length / os.cpus().length);

  for (let i = 0; i < municipalities.length; i += chunkSize) {
    const chunk = municipalities.slice(i, i + chunkSize);

    const worker = new Worker('./scrape-worker.js', {
      workerData: { municipalities: chunk }
    });

    workers.push(new Promise((resolve) => {
      worker.on('message', resolve);
    }));
  }

  return await Promise.all(workers);
}
```

**Memory Optimization:**

```javascript
// Streaming for large datasets
async function* streamMeetings(municipalityId) {
  const batchSize = 100;
  let offset = 0;

  while (true) {
    const meetings = await database.query(`
      SELECT * FROM meetings
      WHERE municipality_id = $1
      ORDER BY meeting_date DESC
      LIMIT $2 OFFSET $3
    `, [municipalityId, batchSize, offset]);

    if (meetings.length === 0) break;

    yield meetings;
    offset += batchSize;
  }
}

// Usage
for await (const batch of streamMeetings('oirschot')) {
  await processMeetings(batch);
}
```

---

## Database Scaling

### Connection Pooling

```typescript
// database/pool.ts
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Pool configuration
  min: 10,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  console.log('Executed query', { text, duration, rows: result.rowCount });
  return result;
}
```

### Read Replicas

```typescript
// database/replicas.ts
import { Pool } from 'pg';

const primaryPool = new Pool({
  host: 'primary.db.example.com',
  // ... config
});

const replicaPools = [
  new Pool({ host: 'replica1.db.example.com' }),
  new Pool({ host: 'replica2.db.example.com' }),
  new Pool({ host: 'replica3.db.example.com' })
];

let replicaIndex = 0;

export async function write(query: string, params?: any[]) {
  return primaryPool.query(query, params);
}

export async function read(query: string, params?: any[]) {
  // Round-robin load balancing
  const pool = replicaPools[replicaIndex];
  replicaIndex = (replicaIndex + 1) % replicaPools.length;

  return pool.query(query, params);
}
```

### Caching Strategy

```typescript
// cache/redis.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true
});

export async function cacheQuery<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  // Check cache
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  // Execute and cache
  const result = await fn();
  await redis.setex(key, ttl, JSON.stringify(result));

  return result;
}

// Usage
const meetings = await cacheQuery(
  `meetings:${municipalityId}:${year}-${month}`,
  () => scrapeMeetingsList(municipality, month, year),
  3600  // 1 hour TTL
);
```

---

## Browserbase Optimization

### Session Pooling

```typescript
// browserbase/pool.ts
class BrowserbasePool {
  private pool: Stagehand[] = [];
  private maxSize = 10;
  private minSize = 3;

  async initialize() {
    // Pre-warm pool
    for (let i = 0; i < this.minSize; i++) {
      const stagehand = await this.createSession();
      this.pool.push(stagehand);
    }
  }

  async acquire(): Promise<Stagehand> {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }

    // Create new session if pool empty
    return await this.createSession();
  }

  async release(stagehand: Stagehand) {
    if (this.pool.length < this.maxSize) {
      this.pool.push(stagehand);
    } else {
      // Pool full, close session
      await stagehand.close();
    }
  }

  private async createSession(): Promise<Stagehand> {
    const stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID
    });
    await stagehand.init();
    return stagehand;
  }

  async drain() {
    for (const stagehand of this.pool) {
      await stagehand.close();
    }
    this.pool = [];
  }
}

// Usage
const pool = new BrowserbasePool();
await pool.initialize();

const stagehand = await pool.acquire();
try {
  await scrape(stagehand);
} finally {
  await pool.release(stagehand);
}
```

### Concurrent Scraping

```typescript
// Limit concurrent Browserbase sessions
import pLimit from 'p-limit';

const limit = pLimit(10);  // Max 10 concurrent sessions

async function scrapeAllMunicipalities(municipalities: Municipality[]) {
  const results = await Promise.all(
    municipalities.map(municipality =>
      limit(() => scrapeMunicipality(municipality))
    )
  );

  return results;
}
```

---

## Rate Limiting

### Per-Municipality Rate Limits

```typescript
// rate-limiter.ts
import Bottleneck from 'bottleneck';

// Create limiter per municipality
const limiters = new Map<string, Bottleneck>();

function getLimiter(municipalityId: string): Bottleneck {
  if (!limiters.has(municipalityId)) {
    limiters.set(municipalityId, new Bottleneck({
      minTime: 5000,  // 5 seconds between requests
      maxConcurrent: 1  // One request at a time per municipality
    }));
  }
  return limiters.get(municipalityId)!;
}

// Usage
const limiter = getLimiter('oirschot');
const result = await limiter.schedule(() =>
  scrapeMeetingsList(municipality, month, year)
);
```

### Global Rate Limiting

```nginx
# nginx rate limiting
http {
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=60r/m;
    limit_req_zone $server_name zone=global_limit:10m rate=1000r/m;

    server {
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            limit_req zone=global_limit burst=100 nodelay;

            proxy_pass http://politeia_cluster;
        }
    }
}
```

---

## Queue-Based Architecture

### Message Queue Setup

```typescript
// queue/rabbitmq.ts
import amqp from 'amqplib';

class ScrapeQueue {
  private connection?: amqp.Connection;
  private channel?: amqp.Channel;

  async connect() {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL!);
    this.channel = await this.connection.createChannel();

    await this.channel.assertQueue('scrape-requests', {
      durable: true,
      arguments: {
        'x-max-priority': 10
      }
    });
  }

  async enqueue(request: ScrapeRequest, priority: number = 5) {
    if (!this.channel) throw new Error('Not connected');

    await this.channel.sendToQueue(
      'scrape-requests',
      Buffer.from(JSON.stringify(request)),
      {
        persistent: true,
        priority
      }
    );
  }

  async consume(handler: (request: ScrapeRequest) => Promise<void>) {
    if (!this.channel) throw new Error('Not connected');

    await this.channel.prefetch(1);  // Process one at a time

    this.channel.consume('scrape-requests', async (msg) => {
      if (!msg) return;

      try {
        const request = JSON.parse(msg.content.toString());
        await handler(request);
        this.channel!.ack(msg);
      } catch (error) {
        console.error('Failed to process request:', error);
        this.channel!.nack(msg, false, true);  // Requeue
      }
    });
  }
}

// Worker process
const queue = new ScrapeQueue();
await queue.connect();

await queue.consume(async (request) => {
  console.log('Processing request:', request.requestId);
  const result = await scrape(request);
  await saveResult(result);
});
```

---

## Multi-Region Deployment

### Geographic Distribution

```
Region: EU-WEST (Netherlands, Belgium)
├── Load Balancer: lb-eu-west.politeia.io
├── Instances: politeia-eu-west-1, politeia-eu-west-2
└── Database: db-eu-west (primary)

Region: EU-CENTRAL (Germany)
├── Load Balancer: lb-eu-central.politeia.io
├── Instances: politeia-eu-central-1
└── Database: db-eu-central (replica)

Region: US-EAST (Backup)
├── Load Balancer: lb-us-east.politeia.io
├── Instances: politeia-us-east-1
└── Database: db-us-east (replica)
```

### Route53 Geolocation Routing

```hcl
# terraform/route53.tf
resource "aws_route53_zone" "politeia" {
  name = "politeia.io"
}

resource "aws_route53_record" "eu_west" {
  zone_id = aws_route53_zone.politeia.zone_id
  name    = "api.politeia.io"
  type    = "A"

  geolocation_routing_policy {
    continent = "EU"
  }

  alias {
    name                   = aws_lb.eu_west.dns_name
    zone_id               = aws_lb.eu_west.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "us_east" {
  zone_id = aws_route53_zone.politeia.zone_id
  name    = "api.politeia.io"
  type    = "A"

  geolocation_routing_policy {
    continent = "NA"
  }

  alias {
    name                   = aws_lb.us_east.dns_name
    zone_id               = aws_lb.us_east.zone_id
    evaluate_target_health = true
  }
}
```

---

## Monitoring & Alerts

### Auto-Scaling Triggers

```yaml
# Kubernetes HPA with custom metrics
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: politeia-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: politeia-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
```

### Performance Monitoring

```typescript
// metrics/prometheus.ts
import promClient from 'prom-client';

const register = new promClient.Registry();

// Metrics
const requestDuration = new promClient.Histogram({
  name: 'scrape_duration_seconds',
  help: 'Duration of scraping requests',
  labelNames: ['municipality', 'platform', 'request_type'],
  buckets: [1, 5, 10, 30, 60]
});

const requestTotal = new promClient.Counter({
  name: 'scrape_requests_total',
  help: 'Total scraping requests',
  labelNames: ['municipality', 'platform', 'status']
});

register.registerMetric(requestDuration);
register.registerMetric(requestTotal);

// Instrument code
export async function instrumentedScrape(request: ScrapeRequest) {
  const end = requestDuration.startTimer({
    municipality: request.municipality.id,
    platform: request.municipality.platformType,
    request_type: request.requestType
  });

  try {
    const result = await scrape(request);

    requestTotal.inc({
      municipality: request.municipality.id,
      platform: request.municipality.platformType,
      status: 'success'
    });

    return result;
  } catch (error) {
    requestTotal.inc({
      municipality: request.municipality.id,
      platform: request.municipality.platformType,
      status: 'error'
    });
    throw error;
  } finally {
    end();
  }
}

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## Cost Optimization

### Scaling ROI

| Scale | Infrastructure Cost | Browserbase Cost | Total/Month |
|-------|-------------------|------------------|-------------|
| **Small (10)** | $20 (1 server) | $8 | $28 |
| **Medium (50)** | $100 (cluster) | $40 | $140 |
| **Large (200)** | $500 (K8s) | $160 | $660 |
| **Nationwide (350)** | $1000 (multi-region) | $280 | $1,280 |

**Cost per municipality:**
- Small: $2.80/month
- Medium: $2.80/month
- Large: $3.30/month
- Nationwide: $3.66/month

**Savings vs Traditional:**
- Traditional (24/7 browser per municipality): $252,000/month (350 × $720)
- Politeia: $1,280/month
- **Savings: 99.5% ($250,720/month)**

---

## Related Documentation

- [Docker Deployment](../07-deployment/docker.md)
- [Kubernetes Deployment](../07-deployment/kubernetes.md)
- [Monitoring Guide](./monitoring.md)
- [Troubleshooting](./troubleshooting.md)

---

[← Back to Documentation Index](../README.md)
