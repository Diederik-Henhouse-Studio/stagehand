# Kubernetes Deployment

Complete guide for deploying Politeia on Kubernetes for production-grade orchestration.

---

## Overview

Kubernetes provides enterprise-grade orchestration with:
- ✅ Auto-scaling (horizontal and vertical)
- ✅ Self-healing
- ✅ Rolling updates with zero downtime
- ✅ Service discovery
- ✅ Load balancing
- ✅ Secret management

---

## Prerequisites

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Verify installation
kubectl version --client

# For local testing: Install minikube
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
```

---

## Namespace Setup

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: politeia
  labels:
    name: politeia
    environment: production
```

```bash
kubectl apply -f namespace.yaml
```

---

## ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: politeia-config
  namespace: politeia
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "3000"

  # Platform configurations
  PLATFORM_CONFIG_PATH: "/app/config/platforms"

  # Feature flags
  ENABLE_CACHE: "true"
  ENABLE_METRICS: "true"
```

---

## Secrets

```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: politeia-secrets
  namespace: politeia
type: Opaque
stringData:
  browserbase-api-key: "bb_your_api_key_here"
  browserbase-project-id: "prj_your_project_id_here"
  # Add other secrets as needed
```

**Important:** Use proper secret management (Sealed Secrets, Vault, etc.):

```bash
# Example with kubeseal
kubectl create secret generic politeia-secrets \
  --from-literal=browserbase-api-key=bb_abc123 \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > sealed-secret.yaml

kubectl apply -f sealed-secret.yaml
```

---

## Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: politeia-service
  namespace: politeia
  labels:
    app: politeia
    component: service
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: politeia
      component: service
  template:
    metadata:
      labels:
        app: politeia
        component: service
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: politeia
        image: politeia:1.0.0
        imagePullPolicy: IfNotPresent
        ports:
        - name: http
          containerPort: 3000
          protocol: TCP

        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: politeia-config
              key: NODE_ENV
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: politeia-config
              key: LOG_LEVEL
        - name: PORT
          valueFrom:
            configMapKeyRef:
              name: politeia-config
              key: PORT
        - name: BROWSERBASE_API_KEY
          valueFrom:
            secretKeyRef:
              name: politeia-secrets
              key: browserbase-api-key
        - name: BROWSERBASE_PROJECT_ID
          valueFrom:
            secretKeyRef:
              name: politeia-secrets
              key: browserbase-project-id

        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi

        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2

        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
        - name: logs
          mountPath: /app/logs

      volumes:
      - name: config
        configMap:
          name: platform-configs
      - name: logs
        emptyDir: {}

      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
```

---

## Service

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: politeia-service
  namespace: politeia
  labels:
    app: politeia
    component: service
spec:
  type: ClusterIP
  selector:
    app: politeia
    component: service
  ports:
  - name: http
    port: 80
    targetPort: 3000
    protocol: TCP
  sessionAffinity: None
```

---

## Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: politeia-ingress
  namespace: politeia
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "60"
    nginx.ingress.kubernetes.io/limit-rps: "10"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
spec:
  tls:
  - hosts:
    - politeia.example.com
    secretName: politeia-tls
  rules:
  - host: politeia.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: politeia-service
            port:
              number: 80
```

---

## Horizontal Pod Autoscaler

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: politeia-hpa
  namespace: politeia
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: politeia-service
  minReplicas: 3
  maxReplicas: 10
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
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 2
        periodSeconds: 30
      selectPolicy: Max
```

---

## Redis Cache

```yaml
# redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: politeia
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        volumeMounts:
        - name: redis-data
          mountPath: /data
      volumes:
      - name: redis-data
        persistentVolumeClaim:
          claimName: redis-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: politeia
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
  namespace: politeia
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: standard
```

---

## Monitoring with Prometheus

```yaml
# servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: politeia-metrics
  namespace: politeia
  labels:
    app: politeia
spec:
  selector:
    matchLabels:
      app: politeia
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

---

## Deployment Commands

### Deploy All Resources

```bash
# Apply all configurations
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml
kubectl apply -f redis-deployment.yaml

# Or use kustomize
kubectl apply -k ./k8s/
```

### Verify Deployment

```bash
# Check namespace
kubectl get all -n politeia

# Check pods
kubectl get pods -n politeia
kubectl describe pod politeia-service-xxx -n politeia

# Check logs
kubectl logs -f deployment/politeia-service -n politeia

# Check service
kubectl get svc -n politeia
kubectl describe svc politeia-service -n politeia

# Check ingress
kubectl get ingress -n politeia
```

---

## Rolling Updates

### Update Deployment

```bash
# Update image
kubectl set image deployment/politeia-service \
  politeia=politeia:1.1.0 \
  -n politeia

# Monitor rollout
kubectl rollout status deployment/politeia-service -n politeia

# Check rollout history
kubectl rollout history deployment/politeia-service -n politeia
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/politeia-service -n politeia

# Rollback to specific revision
kubectl rollout undo deployment/politeia-service \
  --to-revision=2 \
  -n politeia
```

---

## Multi-Environment Setup

### Kustomize Structure

```
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
├── overlays/
│   ├── development/
│   │   ├── kustomization.yaml
│   │   └── replicas.yaml
│   ├── staging/
│   │   ├── kustomization.yaml
│   │   └── replicas.yaml
│   └── production/
│       ├── kustomization.yaml
│       ├── replicas.yaml
│       └── hpa.yaml
```

### Base Configuration

```yaml
# k8s/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: politeia

resources:
- deployment.yaml
- service.yaml
- configmap.yaml

commonLabels:
  app: politeia
  managed-by: kustomize
```

### Production Overlay

```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: politeia-prod

bases:
- ../../base

patchesStrategicMerge:
- replicas.yaml

resources:
- hpa.yaml
- ingress.yaml

images:
- name: politeia
  newTag: 1.0.0

configMapGenerator:
- name: politeia-config
  behavior: merge
  literals:
  - NODE_ENV=production
  - LOG_LEVEL=info
```

### Deploy per Environment

```bash
# Development
kubectl apply -k k8s/overlays/development

# Staging
kubectl apply -k k8s/overlays/staging

# Production
kubectl apply -k k8s/overlays/production
```

---

## StatefulSet for External System

```yaml
# external-system-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: external-system
  namespace: politeia
spec:
  serviceName: external-system
  replicas: 2
  selector:
    matchLabels:
      app: external-system
  template:
    metadata:
      labels:
        app: external-system
    spec:
      containers:
      - name: external-system
        image: external-system:1.0.0
        ports:
        - containerPort: 4000
        env:
        - name: POLITEIA_API_URL
          value: "http://politeia-service"
        - name: SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: external-system-secrets
              key: supabase-url
        - name: SUPABASE_KEY
          valueFrom:
            secretKeyRef:
              name: external-system-secrets
              key: supabase-key
        volumeMounts:
        - name: data
          mountPath: /app/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
```

---

## Network Policies

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: politeia-network-policy
  namespace: politeia
spec:
  podSelector:
    matchLabels:
      app: politeia
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    - podSelector:
        matchLabels:
          app: external-system
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443  # HTTPS for Browserbase
    - protocol: TCP
      port: 53   # DNS
    - protocol: UDP
      port: 53
```

---

## Resource Quotas

```yaml
# resource-quota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: politeia-quota
  namespace: politeia
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    persistentvolumeclaims: "5"
    services.loadbalancers: "2"
```

---

## Backup & Disaster Recovery

### Velero Backup

```bash
# Install Velero
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.8.0 \
  --bucket politeia-backups \
  --backup-location-config region=us-east-1 \
  --snapshot-location-config region=us-east-1

# Create backup schedule
velero schedule create politeia-daily \
  --schedule="0 2 * * *" \
  --include-namespaces politeia

# Manual backup
velero backup create politeia-manual --include-namespaces politeia

# List backups
velero backup get

# Restore
velero restore create --from-backup politeia-daily-20260106
```

---

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl get pods -n politeia

# Describe pod
kubectl describe pod politeia-service-xxx -n politeia

# Check events
kubectl get events -n politeia --sort-by='.lastTimestamp'

# Check logs
kubectl logs politeia-service-xxx -n politeia
kubectl logs politeia-service-xxx -n politeia --previous
```

### Image Pull Issues

```bash
# Check image pull secrets
kubectl get secrets -n politeia

# Create image pull secret
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=user \
  --docker-password=pass \
  -n politeia

# Add to deployment
spec:
  template:
    spec:
      imagePullSecrets:
      - name: regcred
```

### Networking Issues

```bash
# Test service connectivity
kubectl run -it --rm debug \
  --image=nicolaka/netshoot \
  -n politeia \
  -- /bin/bash

# Inside debug pod
curl http://politeia-service/health
nslookup politeia-service
ping redis
```

---

## Production Checklist

- [ ] Namespace created with labels
- [ ] ConfigMaps defined
- [ ] Secrets encrypted (Sealed Secrets/Vault)
- [ ] Deployment with resource limits
- [ ] Liveness and readiness probes configured
- [ ] HPA enabled
- [ ] Service created
- [ ] Ingress with TLS configured
- [ ] Network policies defined
- [ ] Resource quotas set
- [ ] Monitoring (ServiceMonitor) configured
- [ ] Logging configured (Fluentd/ELK)
- [ ] Backup strategy (Velero) implemented
- [ ] CI/CD pipeline configured
- [ ] Multi-environment setup (dev/staging/prod)
- [ ] Disaster recovery tested

---

## Related Documentation

- [Docker Deployment](./docker.md)
- [Serverless Deployment](./serverless.md)
- [Monitoring Guide](./monitoring.md)
- [Scaling Guide](../09-operations/scaling.md)

---

[← Back to Documentation Index](../README.md)
