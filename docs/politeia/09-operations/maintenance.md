# Maintenance Guide

Regular maintenance procedures to keep Politeia running smoothly.

---

## Overview

This guide covers:
- Daily operations
- Weekly maintenance tasks
- Monthly reviews
- Backup & recovery
- Updates & upgrades

---

## Daily Operations

### 1. Health Checks

**Automated Monitoring:**

```bash
#!/bin/bash
# scripts/daily-health-check.sh

echo "=== Politeia Daily Health Check ==="
echo "Date: $(date)"

# Service status
echo -e "\n1. Service Status"
docker-compose ps

# Health endpoint
echo -e "\n2. Health Endpoint"
curl -s http://localhost:3000/health | jq '.'

# Database connection
echo -e "\n3. Database Connection"
docker exec postgres pg_isready

# Browserbase API
echo -e "\n4. Browserbase API"
curl -s -H "Authorization: Bearer $BROWSERBASE_API_KEY" \
  https://www.browserbase.com/v1/projects/$BROWSERBASE_PROJECT_ID \
  | jq '.status'

# Recent errors
echo -e "\n5. Recent Errors (last hour)"
docker logs politeia-service --since 1h 2>&1 | grep -i "error" | wc -l

# Disk space
echo -e "\n6. Disk Space"
df -h | grep -E '/$|/var/lib/docker'

# Memory usage
echo -e "\n7. Memory Usage"
free -h

echo -e "\n=== Health Check Complete ==="
```

**Schedule with Cron:**

```bash
# Run daily at 8:00 AM
0 8 * * * /path/to/scripts/daily-health-check.sh >> /var/log/politeia/health.log 2>&1
```

### 2. Log Review

```bash
# Check for errors
docker logs politeia-service --since 24h 2>&1 | grep -i "error"

# Check for warnings
docker logs politeia-service --since 24h 2>&1 | grep -i "warn"

# Monitor scraping success rate
docker logs politeia-service --since 24h 2>&1 | \
  grep "status" | \
  awk '{print $NF}' | \
  sort | uniq -c
```

### 3. Performance Metrics

```bash
# Average response time
docker logs politeia-service --since 24h 2>&1 | \
  grep "executionTime" | \
  awk '{sum+=$NF; count++} END {print "Avg:", sum/count, "ms"}'

# Browserbase session usage
curl -s -H "Authorization: Bearer $BROWSERBASE_API_KEY" \
  https://www.browserbase.com/v1/usage | jq '.sessions'
```

---

## Weekly Maintenance

### 1. Database Maintenance

**Vacuum & Analyze:**

```sql
-- Run weekly to reclaim space and update statistics
VACUUM ANALYZE meetings;
VACUUM ANALYZE meeting_details;
VACUUM ANALYZE agenda_items;
VACUUM ANALYZE attachments;
VACUUM ANALYZE scrape_logs;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Automated Script:**

```bash
#!/bin/bash
# scripts/weekly-database-maintenance.sh

echo "=== Weekly Database Maintenance ==="

# Vacuum
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "VACUUM ANALYZE;"

# Reindex
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "REINDEX DATABASE $DB_NAME;"

# Check bloat
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f scripts/check-bloat.sql

echo "=== Maintenance Complete ==="
```

### 2. Log Rotation

```bash
# /etc/logrotate.d/politeia
/var/log/politeia/*.log {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 0644 politeia politeia
    postrotate
        docker-compose restart politeia-service > /dev/null 2>&1
    endscript
}
```

### 3. Cache Cleanup

```typescript
// scripts/cache-cleanup.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function cleanupCache() {
  console.log('Starting cache cleanup...');

  // Remove expired keys
  const keys = await redis.keys('*');
  let removed = 0;

  for (const key of keys) {
    const ttl = await redis.ttl(key);
    if (ttl === -1) {
      // No expiration set, check age
      const value = await redis.get(key);
      const age = Date.now() - JSON.parse(value).timestamp;

      if (age > 7 * 24 * 60 * 60 * 1000) {
        // Older than 7 days
        await redis.del(key);
        removed++;
      }
    }
  }

  console.log(`Removed ${removed} stale cache entries`);

  // Report cache stats
  const info = await redis.info('stats');
  console.log('Cache stats:', info);

  await redis.quit();
}

cleanupCache();
```

### 4. Platform Configuration Validation

```typescript
// scripts/validate-platforms.ts
import { validateConfiguration } from '../src/platforms/validator';

async function weeklyValidation() {
  const platforms = ['NOTUBIZ', 'IBIS'];
  const results = [];

  for (const platform of platforms) {
    console.log(`\nValidating ${platform}...`);

    const result = await validateConfiguration(
      platform,
      getCurrentVersion(platform)
    );

    results.push(result);

    console.log(`  Pass rate: ${result.passRate * 100}%`);
    console.log(`  Tested: ${result.testedMunicipalities.length} municipalities`);

    if (result.errors.length > 0) {
      console.error('  Errors:', result.errors);
    }
  }

  // Send report
  await sendValidationReport(results);
}

weeklyValidation();
```

---

## Monthly Reviews

### 1. Usage Analysis

```sql
-- Monthly scraping statistics
SELECT
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_requests,
  COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as failed,
  AVG(execution_time_ms) as avg_time,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as success_rate
FROM scrape_logs
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
```

### 2. Cost Analysis

```typescript
// scripts/monthly-cost-analysis.ts
async function analyzeCosts() {
  // Browserbase costs
  const browserbaseUsage = await getBrowserbaseUsage();
  const browserbaseCost = browserbaseUsage.sessions * 0.001;

  // Infrastructure costs
  const infrastructureCost = calculateInfrastructureCost();

  // Total
  const totalCost = browserbaseCost + infrastructureCost;

  // Per municipality
  const municipalities = await getMunicipalityCount();
  const costPerMunicipality = totalCost / municipalities;

  const report = {
    month: new Date().toISOString().substring(0, 7),
    costs: {
      browserbase: browserbaseCost,
      infrastructure: infrastructureCost,
      total: totalCost
    },
    metrics: {
      municipalities,
      costPerMunicipality,
      sessions: browserbaseUsage.sessions,
      avgSessionDuration: browserbaseUsage.avgDuration
    }
  };

  await sendCostReport(report);
  return report;
}
```

### 3. Performance Review

```sql
-- Slowest municipalities
SELECT
  m.name,
  m.platform_type,
  AVG(sl.execution_time_ms) as avg_time,
  COUNT(*) as scrape_count
FROM scrape_logs sl
JOIN municipalities m ON sl.municipality_id = m.id
WHERE sl.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY m.id, m.name, m.platform_type
ORDER BY avg_time DESC
LIMIT 10;

-- Most common errors
SELECT
  error_details->>'code' as error_code,
  COUNT(*) as occurrences,
  ARRAY_AGG(DISTINCT m.name) as affected_municipalities
FROM scrape_logs sl
JOIN municipalities m ON sl.municipality_id = m.id
WHERE sl.status = 'error'
  AND sl.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY error_details->>'code'
ORDER BY occurrences DESC;
```

### 4. Security Audit

```bash
#!/bin/bash
# scripts/monthly-security-audit.sh

echo "=== Monthly Security Audit ==="

# 1. Check for vulnerable dependencies
echo -e "\n1. Dependency Vulnerabilities"
npm audit

# 2. Check Docker image vulnerabilities
echo -e "\n2. Docker Image Scan"
docker scan politeia:latest

# 3. Check SSL certificates
echo -e "\n3. SSL Certificate Expiry"
echo | openssl s_client -servername politeia.example.com \
  -connect politeia.example.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# 4. Check exposed ports
echo -e "\n4. Exposed Ports"
sudo netstat -tlnp | grep -E ':(80|443|3000|5432|6379)'

# 5. Check file permissions
echo -e "\n5. File Permissions"
find /app -type f -perm /o+w -ls

# 6. Review access logs
echo -e "\n6. Suspicious Access Attempts"
grep -i "401\|403\|429" /var/log/nginx/access.log | tail -20

echo -e "\n=== Security Audit Complete ==="
```

---

## Backup & Recovery

### Backup Strategy

**Daily Incremental Backups:**

```bash
#!/bin/bash
# scripts/backup-daily.sh

BACKUP_DIR="/backups/daily"
DATE=$(date +%Y%m%d)

# 1. Database backup
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | \
  gzip > $BACKUP_DIR/db-$DATE.sql.gz

# 2. Configuration backup
tar czf $BACKUP_DIR/config-$DATE.tar.gz \
  /app/config \
  /app/.env \
  /etc/nginx/nginx.conf

# 3. Logs backup
tar czf $BACKUP_DIR/logs-$DATE.tar.gz \
  /var/log/politeia

# 4. Upload to S3
aws s3 sync $BACKUP_DIR s3://politeia-backups/daily/

# 5. Cleanup old backups (keep 7 days)
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

**Weekly Full Backups:**

```bash
#!/bin/bash
# scripts/backup-weekly.sh

BACKUP_DIR="/backups/weekly"
DATE=$(date +%Y%m%d)

# Full system backup
docker run --rm \
  -v /var/lib/docker:/source:ro \
  -v $BACKUP_DIR:/backup \
  alpine \
  tar czf /backup/docker-$DATE.tar.gz -C /source .

# Upload to S3
aws s3 sync $BACKUP_DIR s3://politeia-backups/weekly/

# Cleanup (keep 4 weeks)
find $BACKUP_DIR -name "*.gz" -mtime +28 -delete
```

### Recovery Procedures

**Database Restore:**

```bash
#!/bin/bash
# scripts/restore-database.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore-database.sh <backup-file>"
  exit 1
fi

# Stop service
docker-compose stop politeia-service

# Restore database
gunzip < $BACKUP_FILE | \
  psql -h $DB_HOST -U $DB_USER $DB_NAME

# Restart service
docker-compose start politeia-service

echo "Database restored from $BACKUP_FILE"
```

**Full System Restore:**

```bash
#!/bin/bash
# scripts/restore-system.sh

BACKUP_DATE=$1

# 1. Restore Docker volumes
docker run --rm \
  -v /var/lib/docker:/target \
  -v /backups/weekly:/backup \
  alpine \
  tar xzf /backup/docker-$BACKUP_DATE.tar.gz -C /target

# 2. Restore configuration
tar xzf /backups/daily/config-$BACKUP_DATE.tar.gz -C /

# 3. Restore database
./restore-database.sh /backups/daily/db-$BACKUP_DATE.sql.gz

# 4. Restart all services
docker-compose restart

echo "System restored from $BACKUP_DATE"
```

---

## Updates & Upgrades

### Application Updates

```bash
#!/bin/bash
# scripts/update-application.sh

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./update-application.sh <version>"
  exit 1
fi

echo "Updating Politeia to version $VERSION"

# 1. Backup current state
./scripts/backup-daily.sh

# 2. Pull new image
docker pull politeia:$VERSION

# 3. Update docker-compose.yml
sed -i "s/politeia:.*/politeia:$VERSION/" docker-compose.yml

# 4. Rolling update
docker-compose up -d --no-deps politeia-service

# 5. Health check
sleep 10
curl -f http://localhost:3000/health || {
  echo "Health check failed! Rolling back..."
  docker-compose up -d --no-deps politeia-service:previous
  exit 1
}

# 6. Cleanup old images
docker image prune -f

echo "Update completed successfully"
```

### Platform Configuration Updates

```bash
#!/bin/bash
# scripts/update-platform-config.sh

PLATFORM=$1
VERSION=$2

# 1. Backup current config
cp config/platforms/$PLATFORM/current.yaml \
   config/platforms/$PLATFORM/backup-$(date +%Y%m%d).yaml

# 2. Update symlink
cd config/platforms/$PLATFORM
ln -sf v$VERSION.yaml current.yaml

# 3. Restart service
docker-compose restart politeia-service

# 4. Validate
./scripts/validate-platforms.ts

echo "Platform $PLATFORM updated to version $VERSION"
```

### Security Updates

```bash
#!/bin/bash
# scripts/security-updates.sh

echo "=== Security Updates ==="

# 1. Update base image
docker pull node:18-alpine

# 2. Rebuild application
docker build --no-cache -t politeia:latest .

# 3. Update dependencies
npm audit fix

# 4. Update system packages
docker exec politeia-service apk update
docker exec politeia-service apk upgrade

# 5. Restart services
docker-compose restart

echo "=== Security Updates Complete ==="
```

---

## Monitoring Dashboard

### Grafana Dashboard Setup

```yaml
# monitoring/grafana-dashboard.json
{
  "dashboard": {
    "title": "Politeia Operations",
    "panels": [
      {
        "title": "Scraping Success Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(scrape_requests_total{status=\"success\"}[5m])"
          }
        ]
      },
      {
        "title": "Average Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, scrape_duration_seconds_bucket)"
          }
        ]
      },
      {
        "title": "Active Municipalities",
        "type": "stat",
        "targets": [
          {
            "expr": "count(municipality_status{is_active=\"true\"})"
          }
        ]
      }
    ]
  }
}
```

---

## Maintenance Checklist

### Daily
- [ ] Check service health
- [ ] Review error logs
- [ ] Monitor performance metrics
- [ ] Verify Browserbase quota

### Weekly
- [ ] Database vacuum & analyze
- [ ] Log rotation
- [ ] Cache cleanup
- [ ] Platform configuration validation
- [ ] Review scraping statistics

### Monthly
- [ ] Usage analysis
- [ ] Cost review
- [ ] Performance review
- [ ] Security audit
- [ ] Update dependencies
- [ ] Review backup integrity

### Quarterly
- [ ] Platform configuration updates
- [ ] Infrastructure capacity planning
- [ ] Disaster recovery test
- [ ] Documentation updates
- [ ] Team training/review

---

## Related Documentation

- [Troubleshooting Guide](./troubleshooting.md)
- [Scaling Guide](./scaling.md)
- [Docker Deployment](../07-deployment/docker.md)
- [Kubernetes Deployment](../07-deployment/kubernetes.md)

---

[← Back to Documentation Index](../README.md)
