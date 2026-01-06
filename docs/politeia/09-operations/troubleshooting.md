# Troubleshooting Guide

Common issues and solutions for Politeia deployment and operation.

---

## Overview

This guide covers:
- Common errors and fixes
- Debugging techniques
- Performance issues
- Configuration problems
- Network troubleshooting

---

## Service Won't Start

### Symptom: Service fails to start

```bash
Error: Cannot start service
```

### Diagnosis

```bash
# Check logs
docker logs politeia-service

# Check environment variables
docker exec politeia-service env | grep BROWSERBASE

# Check port availability
netstat -tlnp | grep 3000

# Check disk space
df -h
```

### Solutions

**1. Missing Environment Variables**

```bash
# Verify required variables
echo $BROWSERBASE_API_KEY
echo $BROWSERBASE_PROJECT_ID

# Set if missing
export BROWSERBASE_API_KEY=bb_your_key
export BROWSERBASE_PROJECT_ID=prj_your_project
```

**2. Port Already in Use**

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
docker run -p 3001:3000 politeia:latest
```

**3. Insufficient Permissions**

```bash
# Run with proper permissions
sudo docker run politeia:latest

# Or fix ownership
sudo chown -R $USER:$USER /app
```

---

## Browserbase Connection Errors

### Symptom: "Failed to create Browserbase session"

```
Error: Failed to create session
BrowserbaseError: Invalid API key
```

### Diagnosis

```bash
# Test API key
curl -H "Authorization: Bearer $BROWSERBASE_API_KEY" \
  https://www.browserbase.com/v1/sessions

# Check project ID
curl -H "Authorization: Bearer $BROWSERBASE_API_KEY" \
  https://www.browserbase.com/v1/projects/$BROWSERBASE_PROJECT_ID
```

### Solutions

**1. Invalid API Key**

```bash
# Generate new API key from Browserbase dashboard
# https://www.browserbase.com/settings/api-keys

# Update environment
export BROWSERBASE_API_KEY=bb_new_key
docker-compose restart
```

**2. Quota Exceeded**

```bash
# Check usage
curl -H "Authorization: Bearer $BROWSERBASE_API_KEY" \
  https://www.browserbase.com/v1/usage

# Upgrade plan or wait for quota reset
```

**3. Network Connectivity**

```bash
# Test connectivity
ping browserbase.com

# Check firewall
sudo ufw status

# Allow HTTPS
sudo ufw allow 443/tcp
```

---

## Scraping Returns 0 Meetings

### Symptom: No meetings extracted

```json
{
  "meetingsCount": 0,
  "meetings": []
}
```

### Diagnosis

```bash
# Enable verbose logging
export LOG_LEVEL=debug
docker-compose restart

# Check Browserbase session recording
# URL is in response or logs
```

### Solutions

**1. Wrong Month/Year Parameters**

```json
// Correct (0-indexed months)
{
  "month": 9,  // October
  "year": 2025
}

// Wrong
{
  "month": 10,  // November (not October!)
  "year": 2025
}
```

**2. Selector Changed**

```typescript
// Test selectors manually
const stagehand = new Stagehand({/* config */});
await stagehand.init();
const page = stagehand.context.pages()[0];

await page.goto('https://oirschot.bestuurlijkeinformatie.nl');

// Try selector
const elements = await page.$$('a[href*="/Agenda/Index/"]');
console.log(`Found ${elements.length} meeting links`);

if (elements.length === 0) {
  // Selector changed! Inspect page
  const html = await page.content();
  console.log(html);
}
```

**Solution:** Update platform configuration with new selectors.

**3. Platform Website Down**

```bash
# Test website availability
curl -I https://oirschot.bestuurlijkeinformatie.nl

# Check status
curl -s https://oirschot.bestuurlijkeinformatie.nl | grep -i "maintenance"
```

---

## Timeout Errors

### Symptom: "TimeoutError: Navigation timeout"

```
TimeoutError: Navigation timeout of 30000 ms exceeded
```

### Diagnosis

```typescript
// Add detailed logging
const startTime = Date.now();

try {
  await page.goto(url, { timeout: 30000 });
} catch (error) {
  const elapsed = Date.now() - startTime;
  console.error(`Navigation failed after ${elapsed}ms`);
  throw error;
}
```

### Solutions

**1. Increase Timeout**

```typescript
// Longer timeout
await page.goto(url, { timeout: 60000 });  // 60 seconds

// Or wait for specific event
await page.goto(url, {
  waitUntil: 'domcontentloaded',  // Don't wait for all resources
  timeout: 30000
});
```

**2. Slow Network**

```typescript
// Check network speed
const response = await page.goto(url);
console.log('Response time:', response.timing().responseEnd);

// Use CDN if available
const cdnUrl = 'https://cdn.example.com/...';
```

**3. Heavy Page**

```typescript
// Block unnecessary resources
await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2}', route => {
  route.abort();
});

await page.route('**/google-analytics.com/**', route => route.abort());
```

---

## Memory Issues

### Symptom: "JavaScript heap out of memory"

```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

### Diagnosis

```bash
# Check memory usage
docker stats politeia-service

# Check system memory
free -h

# Check swap
swapon --show
```

### Solutions

**1. Increase Node.js Memory**

```bash
# Set max memory
export NODE_OPTIONS="--max-old-space-size=2048"

# In Dockerfile
ENV NODE_OPTIONS="--max-old-space-size=2048"
```

**2. Memory Leaks**

```typescript
// Fix: Close Browserbase sessions
try {
  await stagehand.init();
  // ... scraping ...
} finally {
  await stagehand.close();  // Always close!
}

// Fix: Stream large datasets
async function* streamMeetings() {
  const batchSize = 100;
  let offset = 0;

  while (true) {
    const batch = await database.query(
      'SELECT * FROM meetings LIMIT $1 OFFSET $2',
      [batchSize, offset]
    );

    if (batch.length === 0) break;

    yield batch;
    offset += batchSize;
  }
}
```

**3. Too Many Concurrent Operations**

```typescript
// Limit concurrency
import pLimit from 'p-limit';

const limit = pLimit(5);  // Max 5 concurrent

const results = await Promise.all(
  municipalities.map(m =>
    limit(() => scrapeMunicipality(m))
  )
);
```

---

## Database Connection Errors

### Symptom: "Connection refused" or "Too many connections"

```
Error: connect ECONNREFUSED 127.0.0.1:5432
Error: too many connections for role "postgres"
```

### Diagnosis

```bash
# Test connection
psql -h localhost -U postgres -d politeia

# Check active connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check max connections
psql -c "SHOW max_connections;"
```

### Solutions

**1. Database Not Running**

```bash
# Start Supabase/PostgreSQL
docker-compose up -d postgres

# Or for cloud Supabase
# Check https://app.supabase.com/
```

**2. Connection Pool Exhausted**

```typescript
// Increase pool size
const pool = new Pool({
  max: 50,  // Increase from default 10
  min: 10,
  idleTimeoutMillis: 30000
});

// Or use connection pooling service
// PgBouncer, Supabase connection pooler
```

**3. Connection Leaks**

```typescript
// Fix: Always release connections
const client = await pool.connect();
try {
  await client.query('SELECT * FROM meetings');
} finally {
  client.release();  // Always release!
}

// Better: Use pool.query directly
await pool.query('SELECT * FROM meetings');
```

---

## API Rate Limiting

### Symptom: "429 Too Many Requests"

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests"
  }
}
```

### Diagnosis

```bash
# Check rate limit headers
curl -I https://politeia.example.com/api/scrape/meetings-list

# Headers:
# X-RateLimit-Limit: 60
# X-RateLimit-Remaining: 0
# X-RateLimit-Reset: 1609459200
```

### Solutions

**1. Implement Retry Logic**

```typescript
async function scrapeWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.statusCode === 429) {
        const resetTime = error.headers['x-ratelimit-reset'];
        const waitTime = resetTime - Date.now();

        console.log(`Rate limited. Waiting ${waitTime}ms...`);
        await sleep(waitTime);
      } else if (i === maxRetries - 1) {
        throw error;
      }
    }
  }
}
```

**2. Throttle Requests**

```typescript
import Bottleneck from 'bottleneck';

const limiter = new Bottleneck({
  minTime: 1000,  // 1 second between requests
  maxConcurrent: 5
});

const result = await limiter.schedule(() =>
  scrapeMeetingsList(municipality)
);
```

**3. Distribute Load**

```typescript
// Multiple API keys (if allowed)
const apiKeys = [
  process.env.API_KEY_1,
  process.env.API_KEY_2,
  process.env.API_KEY_3
];

let keyIndex = 0;

function getNextApiKey() {
  const key = apiKeys[keyIndex];
  keyIndex = (keyIndex + 1) % apiKeys.length;
  return key;
}
```

---

## Configuration Errors

### Symptom: "Platform not supported" or "Invalid configuration"

```
Error: Platform 'NOTUBIZ' not supported
Error: Invalid selector configuration
```

### Diagnosis

```bash
# Verify configuration file
cat config/platforms/notubiz/current.yaml

# Validate YAML syntax
yamllint config/platforms/notubiz/current.yaml

# Check symlink
ls -la config/platforms/notubiz/current.yaml
```

### Solutions

**1. Missing Configuration**

```bash
# List available platforms
ls config/platforms/

# Create symlink to correct version
cd config/platforms/notubiz
ln -sf v2.0.0.yaml current.yaml
```

**2. Invalid YAML**

```bash
# Fix syntax errors
# Common issues:
# - Tabs instead of spaces
# - Missing quotes
# - Incorrect indentation

# Use YAML validator
npm install -g yaml-validator
yaml-validator config/platforms/notubiz/v2.0.0.yaml
```

**3. Wrong Platform Version**

```typescript
// Override version per municipality
const config = {
  id: 'oirschot',
  platformType: 'NOTUBIZ',
  platformVersion: '1.1.0',  // Use older version
  baseUrl: 'https://oirschot.bestuurlijkeinformatie.nl'
};
```

---

## Kubernetes Issues

### Pods Crashing

```bash
# Check pod status
kubectl get pods -n politeia

# Describe pod
kubectl describe pod politeia-service-xxx -n politeia

# Check events
kubectl get events -n politeia --sort-by='.lastTimestamp'

# View logs
kubectl logs politeia-service-xxx -n politeia
kubectl logs politeia-service-xxx -n politeia --previous
```

### Solutions

**1. CrashLoopBackOff**

```yaml
# Check readiness probe
readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30  # Increase if app takes time to start
  periodSeconds: 10
```

**2. ImagePullBackOff**

```bash
# Check image exists
docker images | grep politeia

# Check image pull secrets
kubectl get secrets -n politeia

# Create secret
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=user \
  --docker-password=pass \
  -n politeia
```

---

## Performance Degradation

### Symptom: Slow response times

```bash
# Before: 3-5 seconds
# After: 20-30 seconds
```

### Diagnosis

```typescript
// Add timing logs
const startTime = Date.now();

await page.goto(url);
console.log(`Navigation: ${Date.now() - startTime}ms`);

const extractStart = Date.now();
const meetings = await extractMeetings(page);
console.log(`Extraction: ${Date.now() - extractStart}ms`);

await stagehand.close();
console.log(`Total: ${Date.now() - startTime}ms`);
```

### Solutions

**1. Database Query Optimization**

```sql
-- Add indexes
CREATE INDEX idx_meetings_municipality_date
ON meetings(municipality_id, meeting_date DESC);

-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM meetings
WHERE municipality_id = 'oirschot'
  AND meeting_date >= '2025-10-01';
```

**2. Enable Caching**

```typescript
// Cache frequent queries
const cachedMeetings = await cacheQuery(
  `meetings:${municipalityId}:${month}-${year}`,
  () => scrapeMeetingsList(municipality, month, year),
  3600  // 1 hour TTL
);
```

**3. Scale Horizontally**

```bash
# Add more instances
kubectl scale deployment politeia-service --replicas=5 -n politeia

# Or enable auto-scaling
kubectl autoscale deployment politeia-service \
  --cpu-percent=70 \
  --min=3 \
  --max=10 \
  -n politeia
```

---

## Getting Help

### Enable Debug Logging

```bash
# Maximum verbosity
export LOG_LEVEL=debug
export VERBOSE=2

docker-compose restart
docker-compose logs -f
```

### Collect Diagnostic Information

```bash
# System info
uname -a
docker --version
node --version

# Service status
docker ps
docker stats

# Logs
docker logs politeia-service > service.log

# Configuration
cat .env > config.txt
cat docker-compose.yml >> config.txt

# Network
curl -v https://oirschot.bestuurlijkeinformatie.nl
```

### Report Issue

Include in GitHub issue or support ticket:
1. Error message (full stack trace)
2. Steps to reproduce
3. Expected vs actual behavior
4. System information
5. Logs (last 100 lines)
6. Browserbase session URL (if available)

---

## Related Documentation

- [Scaling Guide](./scaling.md)
- [Maintenance Guide](./maintenance.md)
- [Docker Deployment](../07-deployment/docker.md)
- [Kubernetes Deployment](../07-deployment/kubernetes.md)

---

[← Back to Documentation Index](../README.md)
