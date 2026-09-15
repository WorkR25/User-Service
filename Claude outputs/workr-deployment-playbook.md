# Workr Deployment Playbook: From Manual EC2 to a Cheaper, Repeatable Pipeline

*Revised for 5,000–8,000 daily active users.*

## Executive summary

Your instinct is correct on both counts: the current process is risky *and* overpriced for what User-Service and Job-Service need. But with 5,000–8,000 DAU already in the picture, the sizing calculus is different from a pre-launch project — real users are depending on this staying up, and today's setup has **zero redundancy per service** (one EC2 instance each), so a single crash or a routine restart takes a live product down. The good news, worked out below, is that raw compute demand at this DAU is still modest — the thing that needs fixing is redundancy and connection headroom, not horsepower or a full production-grade rebuild. My recommendation is **Path D** in Section 5: two right-sized instances, each running both services under pm2, with Caddy/Nginx for local routing and Route 53 health checks for automatic DNS failover instead of an ALB. It lands at roughly **$66–68/month** — real protection against a whole instance or AZ dying, at well under half the cost of ECS Fargate (~$110–125/month), using tools you already know. If you want to shave another ~$20/month and accept the risk of a single box, Path C covers the more common failure (a crashed process) but not a dead instance.

## What I looked at

To ground this in your actual codebases rather than generic advice, I read through both repos directly. Both services are the same shape: Express 5 + TypeScript, Sequelize against MySQL, JWT auth, file uploads to S3, structured logging via Winston. Neither repo has a Dockerfile, a CI workflow, or a pm2 ecosystem file checked in yet. Both already expose a `/health` endpoint, which is exactly what a load balancer or orchestrator needs for health checks. Job-Service calls User-Service over plain HTTP via a `USER_SERVICE_URL` env var, which matters for whatever routing/service-discovery approach you pick next.

## 1. Your current process, mapped out

What you described is "pet server" deployment: two long-lived EC2 instances, each configured by hand once, where every release means repeating a multi-step manual sequence — clone or pull, `npm install`, run migrations, compile, restart under pm2 — on both boxes, separately, from memory. I also noticed `User-Service/.env` has leftover commented-out and duplicate `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` lines sitting alongside a separate set of `PROD_DB_*` keys — a visible symptom of config getting hand-edited directly on the box over time.

## 2. What's actually wrong with it

No reproducibility, no CI gate before production, and real downtime on every release, since restarting the one process on the one box means a gap with nothing to take traffic during that window. Running two ALBs for two services pays for load-balancing capacity twice. On security: long-lived `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, the JWT secret, the salt, and the raw DB password are all sitting as plaintext on both public-facing boxes instead of behind an IAM role or a secrets manager. And at your current traffic, the most important gap is the one that's easy to miss because it's invisible until it happens: **one instance per service means one thing standing between "up" and "down" for thousands of daily users**, with no automatic failover and no way to patch the OS or roll out a release without a visible gap.

## 3. Sizing this for 5,000–8,000 daily active users

DAU alone doesn't tell you request volume, so here's the estimate, with the assumption stated plainly: a job-platform user browsing listings, searching, filtering, and managing applications generates on the order of ~25 API requests per active day (this is a working assumption, not something I measured — if you have real numbers from CloudWatch or your logs, they'd sharpen this considerably). At that rate:

- 5,000 DAU → ~125,000 requests/day → **~1.5 req/s average**, roughly **7–15 req/s at peak** (5–10x average, a typical peak-to-mean ratio for consumer traffic with daytime/evening concentration)
- 8,000 DAU → ~200,000 requests/day → **~2.3 req/s average**, roughly **12–23 req/s at peak**

That's genuinely light load — a single small Node instance can typically handle several hundred simple JSON requests per second, so raw throughput was never the binding constraint, and it isn't what changes here. What *does* change at this scale:

**Redundancy stops being optional.** At near-zero users, one box going down is an inconvenience. At 5,000–8,000 DAU it's an outage affecting a real, currently-active user base — including whatever marketing pushes you're running that drive people to the platform at specific times. The right baseline now is **at least two compute units per service**, behind one shared load balancer, so a crash, a deploy, or an OS patch on one instance doesn't take the service down.

**Database connection headroom matters more.** With two instances per service instead of one, you have more Sequelize connection pools opening against RDS simultaneously. A `db.t4g.micro` has a fairly tight `max_connections` ceiling for its memory class; worth either sizing pool `max` conservatively per instance (e.g., 8–10 rather than a default that assumes it owns the whole connection budget) or stepping up to a `db.t4g.small` for headroom. Neither is expensive relative to the rest of the bill.

**A few cheap wins become worth doing now that weren't worth the setup cost before.** Fronting your S3 bucket with a CloudFront distribution cuts both latency and S3 egress cost for anything served repeatedly (profile images, resumes, static job assets) — inexpensive to add and pays for itself at this traffic level. Basic rate limiting on public search/listing endpoints is also worth having once a platform has enough real traffic to attract scrapers and bots, though I'd treat this as optional-but-cheap rather than urgent.

**What you do *not* need yet:** a read replica, Redis caching, or Multi-AZ RDS. At 12–23 req/s peak, a single well-indexed MySQL instance handles this comfortably. Don't let "we have thousands of users now" push you into infrastructure sized for a much bigger problem than the one you actually have.

## 4. Roughly what today's setup costs

None of these numbers are exact — I don't have your actual instance sizes or RDS class, and AWS's published rates are for US East, with Mumbai (ap-south-1) typically running 10–20% higher — but they show where the money goes. Figures assume the common startup default of `t3.micro`-class EC2 instances and a small single-AZ `db.t4g.micro`-class MySQL instance.

| Line item | Approx. monthly cost (USD) |
|---|---|
| 2× EC2 (t3.micro-class, one per service, **no redundancy**) | ~$18–20 |
| 2× ALB (base charge only, before LCU/traffic) | ~$36–40 |
| 1× RDS MySQL, single-AZ, small class | ~$24–26 |
| EBS storage, snapshots, data transfer | ~$5–10 |
| **Estimated baseline total** | **~$85–95/month**, and still only one instance deep per service |

## 5. Four ways forward, sized for this traffic level

### Path C: bare minimum — one right-sized box, pm2 cluster mode

Run each service under pm2 in **cluster mode** (`pm2 start dist/server.js -i 2`) on a single instance (a `t4g.small` easily covers both services at 10–25 req/s peak). If a worker crashes on an unhandled exception, pm2 restarts it automatically and the other worker keeps serving traffic; `pm2 reload` does a rolling, zero-downtime restart on deploy. Nginx in front handles routing and TLS. **What it doesn't cover:** if the underlying VM or its AZ goes down, you're down until you replace it — no second instance to fail over to.

### Path D: two boxes, Caddy/Nginx + Elastic IPs + Route 53 health-check failover (recommended)

This is your proposal, and it's the right shape for where you are — it closes Path C's whole-instance/AZ gap without ECS's cost or learning curve. The piece to get right: **a single Elastic IP alone doesn't give you failover** — it's bound to one instance at a time, so if that instance dies the IP doesn't relocate itself. Give each instance its own EIP, then put Route 53 in front with health checks against `/health` on both, using multivalue-answer (or failover) routing — Route 53 stops handing out a dead instance's address automatically. Failover this way takes roughly 1–3 minutes (health-check interval plus DNS TTL), not an ALB's near-instant deregistration, which is a fair trade at this traffic level. Run **both services on both instances** (Caddy or Nginx doing local path/subdomain routing to each service's port) so either box alone can serve full traffic — don't dedicate one instance per service, or you've just relocated the single-point-of-failure problem instead of fixing it. Keep both instances in a public subnet with a locked-down security group (80/443 open, 22 restricted to your own IP) rather than a private-subnet-plus-NAT-Gateway setup — that pattern is right at bigger scale, but a NAT Gateway alone runs ~$32+/month for a benefit you don't need yet. RDS stays private, reachable only from the two instances' security group. Deploy with a rolling GitHub Actions script — update instance B, health-check it, then instance A — so a bad release can't take both boxes down at once.

One cost worth flagging explicitly since you asked about Elastic IPs: AWS has charged for every public IPv4 address (EIPs included, attached or not) since February 2024 — $0.005/hour, about $3.65/month each. Two EIPs is roughly $7.30/month; small, but it's a real line item that a lot of cost estimates miss.

### Path A: ECS Fargate (true managed redundancy, highest cost)

Containerize each service, push to ECR via GitHub Actions, run each on Fargate with 2+ tasks behind one ALB. This buys managed restarts and zero OS patching on top of the redundancy Path D already gives you — worth it once you need autoscaling for genuinely spiky traffic, or want to stop owning server patching entirely, neither of which is true yet at steady 10–25 req/s peak.

### Path B2: Railway or a similar small PaaS

Push-to-deploy from GitHub, TLS and routing bundled, redundancy by default on the standard tier. Bills on actual CPU/RAM/egress rather than a flat price, so treat the estimate below as a starting point to validate against a real month of usage.

## 6. Cost comparison

| Setup | Compute | Routing | Database | Approx. total/month |
|---|---|---|---|---|
| **Current** (no redundancy) | 2× EC2 (t3.micro-class) | 2× ALB | 1× RDS, single-AZ | **~$85–95** |
| **Path C** — 1 box, pm2 cluster | 1× `t4g.small`, 2 workers/service | Nginx, no ALB | 1× RDS, `t4g.micro` (pool-tuned) | **~$44–46** |
| **Path D** — 2 boxes, Route 53 failover (recommended) | 2× `t4g.small`, each runs both services | Caddy/Nginx + 2 EIPs + Route 53 | 1× RDS, `t4g.micro` (pool-tuned) | **~$66–68** |
| **Path A** — Fargate, 2 tasks/service | 4× small Fargate tasks (~$9–10 each) | 1× ALB | 1× RDS, `t4g.small`-class | **~$110–125** |
| **Path B2** — Railway, usage-based | scales with actual CPU/RAM | included | Railway-managed MySQL or RDS | **~$80–150, validate after a real month** |

## 7. My recommendation

Go with **Path D**, not ECS. At 5,000–8,000 DAU with steady (not spiky) load, ECS's real advantages — autoscaling and zero server ownership — aren't pulling their weight yet, and you'd be paying roughly 65% more for them. Path D gives you the thing Path C was missing (survives a whole instance or AZ dying) for about $20/month more than the bare-minimum option, at well under half of ECS's cost, using tools (EC2, Nginx/Caddy, SSH) your team already knows. Treat the GitHub Actions rolling-deploy script and clean env-var setup you build for Path D as the foundation you'd carry forward if you ever do move to Path A — none of it is wasted work. Revisit ECS specifically when traffic gets spiky enough that autoscaling saves real money, or when patching servers by hand becomes a bigger time cost than the price difference. Railway (B2) stays an option if you'd rather buy redundancy from a PaaS than build it, but confirm the real usage-based bill before betting on that number.

## 8. Concrete next steps

1. Rotate the AWS access keys in both `.env` files and replace them with an IAM instance role scoped to only the S3 bucket each service needs.
2. Clean up `User-Service/.env`: remove the duplicate/commented `DB_*` lines and consolidate `PROD_DB_*` into a single source of truth per environment.
3. Move the DB password, `JWT_SECRET`, and `SALT` into SSM Parameter Store and load them at boot instead of a file on disk.
4. Confirm production actually runs compiled output (`node dist/server.js`), not `ts-node`.
5. Stand up two `t4g.small` instances in a public subnet (no NAT Gateway needed), each running both services under pm2 (`-i 2` cluster mode) behind Caddy or Nginx doing local path/subdomain routing.
6. Allocate one Elastic IP per instance, then set up Route 53 with health checks against `/health` on both, using multivalue-answer or failover routing so a dead instance drops out of DNS automatically.
7. Cap the Sequelize pool (`max: 5`) per worker so both instances' connections stay comfortably under `db.t4g.micro`'s connection limit — no RDS size bump needed.
8. Add a CloudFront distribution in front of the S3 bucket for anything served repeatedly (images, resumes, static assets).
9. Add a GitHub Actions workflow per repo that deploys to one instance, health-checks it, then the other — `git pull && npm ci && npm run migrate && npx tsc && pm2 reload <app>` per box — so a bad release can't take both down at once.
10. Once this is stable, revisit Path A once traffic gets spiky enough for autoscaling to pay for itself, or trial Railway (Path B2) on one service for a real month to get an actual usage-based number.

## 9. Caveats

The request-volume estimate in Section 3 rests on an assumed 25 requests/user/day — a reasonable planning number for a browsing-and-application-heavy job platform, but not a measured one. If you can pull real numbers (total daily requests, or peak requests/minute) from CloudWatch, application logs, or your ALB access logs, I can tighten this considerably, including a more precise RDS instance-class and task-count recommendation. Cost figures are built from AWS's and Railway's currently published on-demand rates, mostly quoted at US East pricing, with Mumbai generally running somewhat higher; the `db.t4g.small` figure is a heuristic (roughly double the micro price, consistent with how AWS typically prices size steps within a family) rather than a fetched rate — confirm both through the AWS Pricing Calculator before committing budget.

### Pricing sources
- [Elastic Load Balancing pricing](https://aws.amazon.com/elasticloadbalancing/pricing/) / [AWS ALB Pricing Explained](https://www.cloudzero.com/blog/aws-alb-pricing/)
- [AWS Fargate Pricing](https://aws.amazon.com/fargate/pricing/) / [AWS Fargate Pricing Explained (Vantage)](https://www.vantage.sh/blog/fargate-pricing)
- [Amazon RDS for MySQL pricing](https://aws.amazon.com/rds/mysql/pricing/) / [db.t4g.micro pricing (economize.cloud)](https://www.economize.cloud/resources/aws/pricing/rds/db.t4g.micro/)
- [Amazon EC2 On-Demand Pricing](https://aws.amazon.com/ec2/pricing/on-demand/) / [t3.micro pricing (economize.cloud)](https://www.economize.cloud/resources/aws/pricing/ec2/t3.micro/) / [t4g.small pricing (economize.cloud)](https://www.economize.cloud/resources/aws/pricing/ec2/t4g.small/)
- [Amazon Lightsail pricing](https://aws.amazon.com/lightsail/pricing)
- [Railway pricing plans](https://docs.railway.com/pricing/plans)
