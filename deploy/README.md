# User-Service deployment (shared WorkR server)

Runs as one Docker container (`workr-user-service`) on the **same server as notification-service**, which also hosts
Redis (`workr-redis`). The containers talk over the docker network `workr-net`:

- Redis: `REDIS_HOST=workr-redis`
- notification-service lookups: `NOTIFICATION_SERVICE_BASE_URL=http://notification-service:3000/api/v1`

Run **one** instance only - the lead-nurture scheduler runs inside the process (node-cron).

## One-time server setup

Do notification-service first (see its `deploy/workr-server/README.md`): it installs Docker, creates `workr-net` and Redis.

```bash
cd /opt/workr
git clone <User-Service repo url> User-Service
cd User-Service
cp deploy/env.production.example deploy/.env.production
chmod 600 deploy/.env.production
nano deploy/.env.production        # fill every CHANGE_ME
```

`REDIS_PASSWORD` and `NOTIFICATION_LOOKUP_API_KEY` must equal notification-service's `REDIS_PASSWORD` / `WORKR_LOOKUP_API_KEY`.
`DB_HOST` must not be `localhost` (the script refuses); for MySQL on this server use `host.docker.internal`.

### Moving from pm2 to Docker (first deploy only)

The pm2 process is holding the port. Either

1. quick: `pm2 stop <name> && pm2 delete <name> && pm2 save`, then deploy (a few seconds of downtime), or
2. zero-downtime: set `HOST_PORT=3010` in `.env.production`, deploy, `curl localhost:3010/health`, point nginx
   `proxy_pass` at `http://127.0.0.1:3010`, reload nginx, then stop pm2.

The container publishes on `127.0.0.1` by default, so keep nginx (or another proxy) in front. If clients hit the port directly, set `HOST_BIND=0.0.0.0`.

## Deploy (every time)

```bash
cd /opt/workr/User-Service
./deploy/deploy.sh
```

It: checks the env file -> `git pull` main -> builds -> runs Sequelize migrations (aborts without touching the running
service if they fail) -> restarts the container -> waits for `/health` -> **rolls back automatically** to the previous image if unhealthy.

Other commands: `./deploy/deploy.sh rollback | status | logs`, options `--no-pull`, `--skip-migrate`,
`DEPLOY_BRANCH=develop ./deploy/deploy.sh`.
Rollback restores the previous *image*; migrations are not reverted, so keep them backward-compatible.

## Notes

- Production runs compiled JS (`node dist/server.js`), not `ts-node`. pm2 is no longer used (the `pm2` dependency is simply unused).
- The nurture scheduler stays **off / dry-run** until you set `LEAD_NURTURE_SCHEDULER_ENABLED=true` and `LEAD_NURTURE_DRY_RUN=false`.
  `deploy.sh` prints which mode is configured.
- App logs: `docker logs workr-user-service` and files in the `user-service-logs` volume (`/app/logs`).
- Private repo: the server needs git credentials (deploy key or PAT) for `git pull`.
