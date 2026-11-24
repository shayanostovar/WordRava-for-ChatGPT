# WordRava: pre-submission technical audit — 24 November 2026

**Release decision: NO-GO for the public Plugin Directory.** This is a source-based audit with limited independent local PHP testing, not an OpenAI approval or external penetration test.

Scope: [WordRavaCenter](https://github.com/shayanostovar/WordRavaCenter), [WordPress Connector](https://github.com/shayanostovar/WordRava-WordPress-Connector), [ChatGPT MCP](https://github.com/shayanostovar/WordRava-for-ChatGPT). WordRavaCenter and Connector are private repositories. Do not copy private code, secrets or user data into a public issue.

## Evidence and progress

| Area | Status | Evidence |
| --- | --- | --- |
| MCP TypeScript/build | **PASS (static/CI)** | [MCP CI](https://github.com/shayanostovar/WordRava-for-ChatGPT/actions/runs/45397069657); package manifest and declared tool schemas |
| Center .NET build | **PASS (restricted runner, source build)** | [Center compile](https://github.com/shayanostovar/WordRavaCenter/actions/runs/45397283823) |
| WordPress PHP syntax and worker mocks | **PASS (local mocks; no real WP)** | PHP 8.4 lint for four packaged PHP files; committed `tests/test_worker_regression.php` tests permissions, no-write without opt-in, stale-revision, draft-only and at-least-once receipt handling |
| Center/Connector full GitHub-hosted CI | **BLOCKED BEFORE START** | Zero steps and no assigned hosted runner: [Center](https://github.com/shayanostovar/WordRavaCenter/actions/runs/45397535238), [WP](https://github.com/shayanostovar/WordRava-WordPress-Connector/actions/runs/45397472577) |
| Real OAuth/PostgreSQL integration | **NOT YET RUN** | `WordRavaCenter/tests/smoke_oauth.py` and isolated `deploy/acceptance/run.sh` prepared |
| WordPress staging + human approvals | **NOT YET RUN** | Requires staging WordPress; not safe to test on a production customer site |
| Production Center 0.2.0 | **NOT DEPLOYED** | Previous observed live Center 0.1.1; newer code is feature-flagged off |
| Public legal pages/reviewer materials | **UNVERIFIED** | `scripts/pre_submit_check.py` provides read-only probe; live endpoint check unavailable in the audit environment |

## P0: release blockers

1. **CI runner allocation:** For both private repositories, hosted jobs fail before checkout (empty `runner_name`, `steps=[]`). Inspect GitHub Actions run annotations, account Billing and licensing, budgets, Actions policy and GitHub Support. Do not grant the shared production runner blanket Docker privileges or register untrusted PR workflows to circumvent billing. [Tracking issue](https://github.com/shayanostovar/WordRavaCenter/issues/2).
2. **Real Center acceptance:** Run disposable PostgreSQL suite with exact OAuth code exchange, PKCE S256, refresh rotation, stolen/expired token rejection, session revocation, scope checks, idempotency, quota and tenant isolation. Compiler success is insufficient. Run `deploy/acceptance/run.sh` only as `wordrava`, following operator review; project name `wordrava-acceptance` and no host ports.
3. **Real WordPress acceptance:** Upgrade a staging WordPress Connector with fresh pairing code and verify unchanged Site ID; exercise read jobs, permissions, draft create/update, stale revision, rate limits, failed ack, replay, site/account blocks and real cron. Avoid live customer content.
4. **Independent user authorization for changes:** The current MCP argument `user_confirmed: true` is caller-supplied and WordPress `allow_writes` is a standing administrator opt-in. Verify that the ChatGPT host presents meaningful per-write confirmation; require an independently auditable approval tied to the exact write payload to guarantee sensitive-operation consent. Do not claim approval security merely because a model can set a boolean. [Tracking issue](https://github.com/shayanostovar/WordRavaCenter/issues/3).
5. **Publisher materials:** Live privacy policy, terms, support contact, verified publisher identity, working HTTPS OAuth discovery, correct redirect URI, test account without extra verification steps, populated review tests, actual demo video and domain challenge token are required. No public submission until these are verified.

## P1: production hardening

- **OAuth:** Spent refresh-token hashes are now retained to detect replay and revoke the grant. Add bounded retention/purge, verify access-token revocation behavior and exact scope request/denial; finish concurrent rotation tests. Password login currently uses an IP-based limiter; review original-client-IP forwarding behind trusted Nginx and add per-account failure controls to prevent a shared proxy IP throttling all users.
- **WordPress job transport:** Delivery is at least once. A local receipt caches completed write results, but a crash between a WordPress edit and writing the receipt can still duplicate or lose edits. Add a durable reconciliation/approval ledger; audit lease expiry races and lost-completion recovery.
- **Tenant/privacy:** Confirm that site/account block applies to every endpoint and outstanding job. Define a privacy data map for account email, sites, URLs, content, plugin inventory, operation results and personal logs. Implement retention and deletion/export/revocation lifecycle before mass distribution.
- **Database:** Replace ad hoc additive SQL / `EnsureCreated` with rehearsed, managed migrations and recovery procedures. A container image rollback does not roll back DB schema.
- **Content security:** Treat returned WordPress HTML and post text as untrusted content and test prompt injection, sanitization, maximum response sizes, markup transformations and accidental disclosure of unpublished/private content.

## Confirmed intentional product limitations

The 0.2.0 beta supports remote inventory reads plus **draft-only** creation/update when both Center and WordPress opt-in are enabled. No publishing, deletion, Elementor/Divi/WPBakery structured edits, media upload, complete snapshot/rollback or self-service account deletion is implemented. Listing/marketing must reflect this.

## Recheck and release sequence

1. Fix hosted-runner provisioning; rerun both private full CI suites.
2. Run disposable Center/PostgreSQL integration acceptance, then a real staging WordPress + MCP OAuth flow.
3. Audit authenticated tool outputs and hostile/negative tests; verify explicit human approval and audit trails for each draft change.
4. Deploy Center API 0.2.0 **after** DB backup and rollback rehearsal with flags OFF; update only the WordRava Nginx vhost; enable OAuth separately, then MCP. Enable operations after staging acceptance.
5. Publish real privacy/terms/support pages, prepare review account and demo video; run `python3 scripts/pre_submit_check.py` against the live service.
6. Only then use the [Plugin submission portal](https://platform.openai.com/plugins) with **With MCP**, scan tools and submit. OpenAI independently reviews the plugin; build/release success does not guarantee acceptance.

Documentation: [OpenAI remote MCP review](https://developers.openai.com/plugins/deploy/app-review), [Plugin submission](https://developers.openai.com/plugins/deploy/submission), [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage).
