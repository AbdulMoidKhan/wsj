# Workspace Junction — Rollback Runbook

**Trigger**: Any health check failure, unrecoverable upload error, or customer-facing regression during/after R2 deployment.

---

## 1. Quick Rollback Steps

1. **Revert Git Commit**:
   ```bash
   cd /root/wsj-next
   git checkout 396ad2a # Previous verified commit
   ```

2. **Revert Environment Configuration**:
   Restore backup environment files:
   ```bash
   cp /root/wsj-next/backend/.env.backup /root/wsj-next/backend/.env
   ```

3. **Rebuild & Restart**:
   ```bash
   cd /root/wsj-next/backend && node ./node_modules/typescript/bin/tsc --project tsconfig.json && cd ..
   npm run build
   pm2 restart wsj-backend --update-env
   pm2 restart wsj-web --update-env
   ```

4. **Verify Health**:
   ```bash
   curl -fsS http://127.0.0.1:4000/api/health
   curl -fsS -I https://wp.workspacejunction.com
   ```

---

## 2. Database Restoration (If required)

If database tables were corrupted (note: no destructive schema migrations were performed in this release):
```bash
bash scripts/devops/restore-postgres.sh <backup-timestamp-file.sql.gz>
```

---

## 3. Local Media Safety

- All local media files under `public/media/` were preserved intact during migration.
- Reverting the environment variable or git commit instantly falls back to local disk delivery without data loss.
