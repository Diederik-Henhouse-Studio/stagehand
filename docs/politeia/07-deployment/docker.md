# Docker Deployment

Complete guide for deploying Politeia using Docker containers.

---

## Overview

Docker provides the simplest deployment option for Politeia with:
- ✅ Consistent environment
- ✅ Easy scaling
- ✅ Quick deployment
- ✅ Isolated dependencies

---

## Prerequisites

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

---

## Single Container Deployment

### Dockerfile

```dockerfile
# /Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src ./src
COPY config ./config
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# ========================================
# Production Image
FROM node:18-alpine

WORKDIR /app

# Copy dependencies and build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start service
CMD ["node", "dist/server.js"]
```

### Build & Run

```bash
# Build image
docker build -t politeia:latest .

# Run container
docker run -d \
  --name politeia \
  -p 3000:3000 \
  -e BROWSERBASE_API_KEY=your_key \
  -e BROWSERBASE_PROJECT_ID=your_project \
  politeia:latest

# View logs
docker logs -f politeia

# Check health
curl http://localhost:3000/health
```

---

## Docker Compose Deployment

### docker-compose.yml

```yaml
version: '3.8'

services:
  politeia:
    build:
      context: .
      dockerfile: Dockerfile
    image: politeia:latest
    container_name: politeia-service
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      BROWSERBASE_API_KEY: ${BROWSERBASE_API_KEY}
      BROWSERBASE_PROJECT_ID: ${BROWSERBASE_PROJECT_ID}
      LOG_LEVEL: info
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
    networks:
      - politeia-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  politeia-network:
    driver: bridge
```

### Environment File

```bash
# .env
BROWSERBASE_API_KEY=bb_abc123...
BROWSERBASE_PROJECT_ID=prj_xyz789...
LOG_LEVEL=info
NODE_ENV=production
```

### Deploy

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Stop services
docker-compose down

# Restart service
docker-compose restart politeia
```

---

## Multi-Container Setup

For production with external system:

```yaml
version: '3.8'

services:
  # Politeia scraping service
  politeia-service:
    build: .
    image: politeia:latest
    container_name: politeia-service
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      BROWSERBASE_API_KEY: ${BROWSERBASE_API_KEY}
      BROWSERBASE_PROJECT_ID: ${BROWSERBASE_PROJECT_ID}
    networks:
      - politeia-network
    depends_on:
      - redis

  # External orchestration system
  external-system:
    build: ./external-system
    image: external-system:latest
    container_name: external-system
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      POLITEIA_API_URL: http://politeia-service:3000
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_KEY: ${SUPABASE_KEY}
    networks:
      - politeia-network
    depends_on:
      - redis

  # Redis for caching
  redis:
    image: redis:7-alpine
    container_name: politeia-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - politeia-network
    command: redis-server --appendonly yes

  # Nginx reverse proxy
  nginx:
    image: nginx:alpine
    container_name: politeia-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - politeia-network
    depends_on:
      - politeia-service
      - external-system

volumes:
  redis-data:

networks:
  politeia-network:
    driver: bridge
```

---

## Nginx Configuration

```nginx
# nginx.conf
http {
    upstream politeia {
        server politeia-service:3000;
    }

    upstream external_system {
        server external-system:4000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=60r/m;

    server {
        listen 80;
        server_name politeia.example.com;

        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name politeia.example.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # Politeia API
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;

            proxy_pass http://politeia;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # Timeouts for long-running scrapes
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # External system API
        location /external/ {
            proxy_pass http://external_system;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # Health check (no rate limit)
        location /health {
            proxy_pass http://politeia;
        }
    }
}
```

---

## Scaling with Docker

### Horizontal Scaling

```yaml
version: '3.8'

services:
  politeia:
    build: .
    image: politeia:latest
    restart: unless-stopped
    environment:
      NODE_ENV: production
      BROWSERBASE_API_KEY: ${BROWSERBASE_API_KEY}
      BROWSERBASE_PROJECT_ID: ${BROWSERBASE_PROJECT_ID}
    networks:
      - politeia-network
    deploy:
      replicas: 3  # Run 3 instances
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf:ro
    networks:
      - politeia-network
    depends_on:
      - politeia

networks:
  politeia-network:
```

### Load Balancer Config

```nginx
# nginx-lb.conf
http {
    upstream politeia_cluster {
        least_conn;  # Load balancing method
        server politeia:3000 max_fails=3 fail_timeout=30s;
    }

    server {
        listen 80;

        location / {
            proxy_pass http://politeia_cluster;
            proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        }
    }
}
```

---

## Monitoring

### Prometheus Integration

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    networks:
      - politeia-network

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    networks:
      - politeia-network

volumes:
  prometheus-data:
  grafana-data:
```

### Prometheus Config

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'politeia'
    static_configs:
      - targets: ['politeia-service:3000']
```

---

## Logging

### Centralized Logging with ELK

```yaml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.10.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - es-data:/usr/share/elasticsearch/data
    networks:
      - politeia-network

  logstash:
    image: docker.elastic.co/logstash/logstash:8.10.0
    container_name: logstash
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf:ro
    networks:
      - politeia-network
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.10.0
    container_name: kibana
    ports:
      - "5601:5601"
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
    networks:
      - politeia-network
    depends_on:
      - elasticsearch

volumes:
  es-data:
```

---

## Backup & Recovery

### Backup Script

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# Backup config
docker cp politeia-service:/app/config ${BACKUP_DIR}/config_${DATE}

# Backup logs
docker cp politeia-service:/app/logs ${BACKUP_DIR}/logs_${DATE}

# Backup volumes
docker run --rm \
  -v politeia_redis-data:/data \
  -v ${BACKUP_DIR}:/backup \
  alpine tar czf /backup/redis_${DATE}.tar.gz -C /data .

echo "Backup completed: ${DATE}"
```

### Restore Script

```bash
#!/bin/bash
# restore.sh

BACKUP_DATE=$1

if [ -z "$BACKUP_DATE" ]; then
  echo "Usage: ./restore.sh YYYYMMDD_HHMMSS"
  exit 1
fi

# Restore config
docker cp /backups/config_${BACKUP_DATE} politeia-service:/app/config

# Restore volumes
docker run --rm \
  -v politeia_redis-data:/data \
  -v /backups:/backup \
  alpine tar xzf /backup/redis_${BACKUP_DATE}.tar.gz -C /data

echo "Restore completed: ${BACKUP_DATE}"

# Restart services
docker-compose restart
```

---

## Security

### Docker Security Best Practices

```dockerfile
# Secure Dockerfile
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory with proper ownership
WORKDIR /app
RUN chown nodejs:nodejs /app

# Copy files
COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci --only=production

COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

CMD ["node", "server.js"]
```

### Docker Compose Security

```yaml
services:
  politeia:
    build: .
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    environment:
      NODE_ENV: production
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs politeia

# Check container details
docker inspect politeia

# Check if port is in use
netstat -tlnp | grep 3000

# Restart container
docker restart politeia
```

### High Memory Usage

```bash
# Check resource usage
docker stats politeia

# Set memory limits
docker run -d \
  --name politeia \
  --memory="1g" \
  --memory-swap="2g" \
  politeia:latest
```

### Network Issues

```bash
# Check network
docker network inspect politeia-network

# Test connectivity
docker exec politeia ping external-system

# Recreate network
docker-compose down
docker network prune
docker-compose up -d
```

---

## Production Checklist

- [ ] Build optimized image (multi-stage)
- [ ] Set resource limits (CPU, memory)
- [ ] Configure health checks
- [ ] Enable logging (JSON format)
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure backups (automated)
- [ ] Implement rate limiting (Nginx)
- [ ] Enable HTTPS (SSL certificates)
- [ ] Use secrets management (Docker secrets)
- [ ] Test disaster recovery
- [ ] Document deployment process
- [ ] Set up alerts (PagerDuty, Slack)

---

## Related Documentation

- [Kubernetes Deployment](./kubernetes.md)
- [Serverless Deployment](./serverless.md)
- [Monitoring Guide](./monitoring.md)
- [Architecture Overview](../02-architecture/system-overview.md)

---

[← Back to Documentation Index](../README.md)
