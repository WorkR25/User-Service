# User-Service deployment (pm2)

User-Service runs under pm2 from the repo checkout (e.g. `/opt/workr/User-Service`), behind nginx.
It shares the server with notification-service and Redis. Run **one** instance only (the nurture scheduler runs inside the process).

## Every deploy

```bash
ssh ubuntu@<server>
cd /opt/workr/User-Service
./deploy/deploy.sh
```

What it does, in order - and stops safely at the first problem:

1. Checks `.env` (required keys, Redis reachable, and for the scheduler: the VSL URL/key) - **fails before touching anything**.
2. `git pull --ff-only origin main`.
3. `npm ci` only when `package-lock.json` changed.
4. Builds (`tsc`). A build error leaves the running app untouched.
5. Runs Sequelize migrations. A migration error leaves the running app untouched.
6. `pm2 restart <name> --update-env` - the pm2 process is found by script path, so your existing `workr-user` is reused, never duplicated.
7. Waits for `http://127.0.0.1:$PORT/health`. If it never answers, it **rolls back automatically** to the previous build (`dist.prev`).
8. `pm2 save`.

Other commands: `./deploy/deploy.sh status | logs | rollback`, options `--no-pull`, `--skip-migrate`, `--force-install`,
`DEPLOY_BRANCH=develop ./deploy/deploy.sh`. Rollback restores the previous *build*; migrations are not reverted, so keep them backward-compatible.
The very first run after adopting this script runs `npm ci` once (it has no saved lock hash yet).

## `.env` - the values that bite

| Key | Must be |
|---|---|
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_TLS` | the Redis notification-service reads from: `127.0.0.1` / `6379` / `false` |
| `LEAD_NURTURE_QUEUE_NAME`, `LEAD_NURTURE_JOB_NAME` | identical to notification-service's constants (the defaults match - leave unset) |
| `NOTIFICATION_SERVICE_BASE_URL` | `http://127.0.0.1:3005/api/v1` (admin delivery lookup) |
| `NOTIFICATION_LOOKUP_API_KEY` | equal to `WORKR_LOOKUP_API_KEY` in notification-service's `.env` |
| `LEAD_NURTURE_SCHEDULER_ENABLED` | `true` or Day 2-15 follow-ups never run (Day 0 still works) |
| `LEAD_NURTURE_DRY_RUN` | `false` to actually send; anything else only logs "would send" |
| `VSL_API_BASE_URL` | `https://form.interviewcall.club/api/v1` - **must end in `/api/v1`**, otherwise the lookup answers 404 and every tick sends nothing |
| `VSL_WORKR_API_KEY` | equal to `WORKR_INTEGRATION_API_KEY` on the candidate-form service (in its `/opt/ic-booking/settings.env`); wrong key = 401 |
| `JWT_SECRET` | never change it casually (logs everyone out); Job-Service must use the same value |

`deploy.sh` checks the VSL values and Redis for you, and warns about `.env` lines that are not `KEY=VALUE`
(dotenv ignores those silently, e.g. a value split over two lines).

## Checking Day 2+ follow-ups

Application logs are files (`logs/DD-MM-YYYY-app.log`, written with the server clock - UTC on these servers, so 11:45 IST is 06:15 in the log).

```bash
./deploy/deploy.sh logs
grep -hE 'Lead nurture scheduler started|tick finished|lookup failed|tick crashed' logs/*app.log | tail -n 20
```

- `"dryRun":false` in "scheduler started" = live. A tick runs at :00/:15/:30/:45 between 10:00 and 19:00 IST; a restart does not trigger one.
- `queued > 0` and `lookupFailed: 0` = working. `lookupFailed: 100` + "HTTP 404" = wrong `VSL_API_BASE_URL`; "HTTP 401" = key mismatch.

## First time on a NEW server

```bash
# Node 22, pm2, nginx, certbot, git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx git
sudo npm i -g pm2

sudo mkdir -p /opt/workr && sudo chown $USER /opt/workr && cd /opt/workr
git clone <User-Service repo url> User-Service && cd User-Service
nano .env                      # fill it in (see the table above); chmod 600 .env
./deploy/deploy.sh             # builds, migrates and starts pm2 process "workr-user" from deploy/ecosystem.config.js

pm2 startup                    # prints one sudo command - run it, so pm2 starts on reboot
pm2 save
```

nginx: proxy `user.workr.club` to `http://127.0.0.1:<PORT from .env>` (`client_max_body_size 10m;`), then `sudo certbot --nginx -d user.workr.club`.
Security group: open 22 (your IP only), 80, 443. **Never** open the app port or Redis (6379).
Set up notification-service and Redis on this server first (see its `deploy/workr-server/README.md`).
