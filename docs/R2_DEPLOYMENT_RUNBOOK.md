# Workspace Junction — VPS Deployment Runbook

**Target Host**: `72.61.0.11` (Ubuntu 24.04 LTS, KVM 4)
**Application Root**: `/root/wsj-next`
**Processes**: `wsj-backend` (port 4000), `wsj-web` (port 3600)
**Proxy**: Nginx (`/` -> 3600, `/api/` -> 4000)
**Database**: Docker `wsj-app-postgres-1` (port 5437)

---

## 1. Pre-Deployment Safety Checklist

- [x] Cloudflare R2 bucket CORS, lifecycle and object uploads verified.
- [x] Backend NestJS tests pass and build outputs validated.
- [x] Next.js frontend builds without errors.
- [x] Database backup generated before any modifications.
- [x] Local media intact on disk for instant zero-downtime rollback.

---

## 2. Deployment Sequence

1. **Database Backup**:
   Run the proven database backup script:
   ```bash
   bash scripts/devops/backup-postgres.sh
   ```

2. **Pull Changes**:
   Sync approved commits to `/root/wsj-next`:
   ```bash
   cd /root/wsj-next
   git fetch origin
   git merge origin/main --ff-only
   ```

3. **Install Dependencies**:
   Install root and backend dependencies using package locks:
   ```bash
   npm ci --prefer-offline
   cd backend && npm ci --prefer-offline && cd ..
   ```

4. **Update Backend Environment**:
   Add R2 environment variables to `/root/wsj-next/backend/.env` (without exposing in logs):
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME=workspacejunction`
   - `R2_ENDPOINT`
   - `R2_PUBLIC_URL=https://pub-e4b4ffee7e0747098f49cc9765932cee.r2.dev`
   - `R2_REGION=auto`

5. **Build Application**:
   Compile backend and frontend:
   ```bash
   cd /root/wsj-next/backend && node ./node_modules/typescript/bin/tsc --project tsconfig.json && cd ..
   npm run build
   ```

6. **PM2 Atomic Switch**:
   Restart backend and web services using the controlled PM2 script:
   ```bash
   pm2 restart wsj-backend --update-env
   pm2 restart wsj-web --update-env
   ```

7. **Verify Production Health**:
   ```bash
   curl -fsS http://127.0.0.1:4000/api/health
   curl -fsS -I https://wp.workspacejunction.com
   ```
