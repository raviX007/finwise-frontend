# FinWise Frontend — Deployment Guide

This document covers the full deployment pipeline for the FinWise frontend: building a Docker image (Vite + Nginx), pushing to AWS ECR, and deploying to an EC2 instance.

---

## Architecture Overview

```mermaid
graph LR
    subgraph GitHub
        PR[Push to main] --> GA[GitHub Actions]
    end

    subgraph AWS
        GA -->|OIDC Auth| ECR[ECR Registry]
        GA -->|SSH| EC2[EC2 Instance]
        SM[Secrets Manager] -->|BACKEND_URL| EC2
        ECR -->|docker pull| EC2
    end

    subgraph EC2 Instance
        NGINX_HOST[Host Nginx :80/:443<br/>Reverse Proxy]
        FE[finwise-frontend :4100<br/>Nginx + React SPA]
        BE[finwise-backend :4000<br/>Express API]
    end

    NGINX_HOST -->|proxy_pass| FE
    FE -->|/api/ proxy| BE
    FE -.->|Docker network:<br/>finwise-net| BE
```

## Deployment Pipeline

```mermaid
sequenceDiagram
    participant DEV as Developer
    participant GH as GitHub Actions
    participant ECR as AWS ECR
    participant SM as Secrets Manager
    participant EC2 as EC2 Instance

    DEV->>GH: Push to main branch
    GH->>GH: OIDC → Assume IAM role
    GH->>ECR: docker login
    GH->>GH: docker build (Vite → Nginx)
    GH->>ECR: docker push :SHA + :latest

    GH->>EC2: SSH connection
    EC2->>ECR: docker pull :latest
    EC2->>SM: Fetch finwise/frontend secret
    EC2->>EC2: Extract BACKEND_URL (if set)
    EC2->>EC2: docker rm old container
    EC2->>EC2: docker run with BACKEND_URL env
    EC2->>EC2: docker image prune
```

---

## Prerequisites

### AWS Resources

| Resource | Details |
|----------|---------|
| **ECR Repository** | `finwise-frontend` in `ap-south-1` |
| **EC2 Instance** | Amazon Linux 2023, t3.medium, Docker installed |
| **IAM Role (GitHub)** | `github-actions-deploy` with OIDC trust policy |
| **IAM Role (EC2)** | Instance profile with ECR pull + Secrets Manager read |
| **Secrets Manager** | Secret named `finwise/frontend` |
| **Docker Network** | `finwise-net` (shared with backend container) |

### GitHub Secrets

Set these in the repository Settings → Secrets and variables → Actions:

| Secret | Description | Example |
|--------|-------------|---------|
| `AWS_ACCOUNT_ID` | 12-digit AWS account ID | `123456789012` |
| `EC2_HOST` | EC2 Elastic IP address | `13.233.x.x` |
| `EC2_SSH_KEY` | ed25519 private key for EC2 access | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

---

## AWS Setup (One-Time)

### 1. Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name finwise-frontend \
  --region ap-south-1 \
  --image-scanning-configuration scanOnPush=true
```

### 2. Create Secrets Manager Secret

The frontend secret is minimal — only needed if you want to override the default backend URL:

```bash
aws secretsmanager create-secret \
  --name finwise/frontend \
  --region ap-south-1 \
  --secret-string '{
    "BACKEND_URL": "http://finwise-backend:4000"
  }'
```

The `BACKEND_URL` defaults to `http://finwise-backend:4000` (Docker DNS). You only need to override this if:
- The backend container has a different name
- You're using host networking instead of a Docker network
- The backend is on a different host

### 3. OIDC & IAM

Same as backend — see [backend deployment guide](../../finwise-backend/docs/deployment.md). Ensure the trust policy includes `repo:YOUR_GITHUB_USERNAME/finwise-frontend:*`.

### 4. EC2 Instance Permissions

Same IAM policy as backend — ECR pull + Secrets Manager read for `finwise/*`.

---

## How the Workflow Works

The workflow file is at `.github/workflows/build-deploy.yml`.

### Step 1: Build & Push to ECR

The Docker image is a multi-stage build:

```
Stage 1 (builder):  node:22-alpine → npm ci → vite build → static files in /app/dist
Stage 2 (runtime):  nginx:alpine → copy dist + nginx.conf + entrypoint script
```

```yaml
- name: Build and push Docker image
  run: |
    IMAGE="${{ steps.ecr.outputs.registry }}/finwise-frontend"
    docker build -t $IMAGE:${{ github.sha }} -t $IMAGE:latest .
    docker push $IMAGE:${{ github.sha }}
    docker push $IMAGE:latest
```

### Step 2: Deploy on EC2

```bash
# 1. Pull image from ECR
docker pull ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/finwise-frontend:latest

# 2. Fetch BACKEND_URL from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id finwise/frontend \
  --query SecretString --output text | \
  python3 -c "import json,sys; [print(f'{k}={v}') for k,v in json.load(sys.stdin).items()]" \
  > /home/ec2-user/apps/finwise-frontend.env

# 3. Extract BACKEND_URL
BACKEND_URL=$(grep '^BACKEND_URL=' /home/ec2-user/apps/finwise-frontend.env | cut -d= -f2-)

# 4. Run container on shared Docker network
docker rm -f finwise-frontend 2>/dev/null || true
docker run -d \
  --name finwise-frontend \
  --network finwise-net \
  -p 4100:4100 \
  ${BACKEND_URL:+-e BACKEND_URL=$BACKEND_URL} \
  --restart unless-stopped \
  ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/finwise-frontend:latest
```

---

## Docker Image Details

| Detail | Value |
|--------|-------|
| Base image | `nginx:alpine` |
| Image size | ~92 MB |
| Exposed port | `4100` |
| Container name | `finwise-frontend` |
| Docker network | `finwise-net` |
| Restart policy | `unless-stopped` |

### Runtime Backend URL Injection

The container uses an entrypoint script (`docker-entrypoint.sh`) that replaces the backend URL in the Nginx config at startup:

```bash
# Default: proxy_pass http://finwise-backend:4000
# Override: docker run -e BACKEND_URL=http://custom-backend:4000 ...
```

This means you can change the backend target without rebuilding the image.

---

## Nginx Configuration (Inside Container)

The container's Nginx serves two purposes:

1. **SPA routing** — All non-API routes serve `index.html` (React Router)
2. **API proxy** — `/api/*` requests are proxied to the backend container

```nginx
server {
    listen 4100;

    # SPA — all routes → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy — forwards to backend via Docker network
    location /api/ {
        proxy_pass http://finwise-backend:4000;

        # SSE streaming support
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        chunked_transfer_encoding off;
        add_header X-Accel-Buffering no;
        proxy_read_timeout 300s;
    }
}
```

### SSE Streaming — Why These Headers Matter

| Header/Directive | Purpose |
|-----------------|---------|
| `proxy_buffering off` | Nginx sends chunks immediately instead of buffering the full response |
| `proxy_cache off` | Prevents caching of streamed responses |
| `Connection ''` | Prevents Nginx from adding `Connection: close` which kills the stream |
| `chunked_transfer_encoding off` | Ensures raw SSE format, not chunked encoding |
| `X-Accel-Buffering no` | Tells upstream proxies (ALB, CloudFront) not to buffer |
| `proxy_read_timeout 300s` | Keeps long-running SSE connections alive for up to 5 minutes |

---

## Networking on EC2

```
                    Internet
                       │
                       ▼
              ┌─────────────────┐
              │  Host Nginx     │
              │  :80 / :443     │
              │  (reverse proxy)│
              └────────┬────────┘
                       │ proxy_pass localhost:4100
                       ▼
              ┌─────────────────┐
              │ finwise-frontend│
              │ (Nginx container│
              │  :4100)         │
              └────────┬────────┘
                       │ proxy_pass finwise-backend:4000
                       │ (Docker DNS on finwise-net)
                       ▼
              ┌─────────────────┐
              │ finwise-backend │
              │ (Node.js :4000) │
              └─────────────────┘
```

Both containers are on the `finwise-net` Docker network. The frontend Nginx resolves `finwise-backend` by container name — no hardcoded IPs.

### Host Nginx Config (on EC2)

```nginx
server {
    listen 80;
    server_name finwise.yourdomain.com;

    location / {
        proxy_pass http://localhost:4100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE pass-through
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

Add HTTPS with Certbot:

```bash
sudo certbot --nginx -d finwise.yourdomain.com
```

---

## Rollback

```bash
# SSH into EC2
ECR=ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com

# Pull specific commit SHA
docker pull $ECR/finwise-frontend:COMMIT_SHA

# Replace container
docker rm -f finwise-frontend
docker run -d \
  --name finwise-frontend \
  --network finwise-net \
  -p 4100:4100 \
  --restart unless-stopped \
  $ECR/finwise-frontend:COMMIT_SHA
```

---

## Troubleshooting

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| SSE not streaming (arrives all at once) | Nginx buffering enabled somewhere | Check all 3 Nginx layers (container, host, ALB) have `proxy_buffering off` |
| `502 Bad Gateway` on `/api/*` | Backend container not running or wrong network | `docker ps`, verify both on `finwise-net` |
| Frontend loads but API calls fail | CORS or proxy misconfiguration | Check backend `ALLOWED_ORIGINS` includes the frontend domain |
| `host not found in upstream "finwise-backend"` | Containers on different Docker networks | Ensure both use `--network finwise-net` |
| Chat responses cut off after 60s | Nginx default timeout | Verify `proxy_read_timeout 300s` in all Nginx layers |
