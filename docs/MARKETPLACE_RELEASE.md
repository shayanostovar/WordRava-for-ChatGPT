# WordRava 1.1.1: public plugin submission guide

Reviewed against official OpenAI documentation on 2026-11-26. [راهنمای فارسی](MARKETPLACE_RELEASE_FA.md).

**Personal import compatibility:** use the corrected 1.1.1 package from the
[download page](https://wordrava.shayanostovar.com/download) or
[schema compatibility release](https://github.com/shayanostovar/WordRava-for-ChatGPT/releases/tag/mcp-v1.1.1-schema-1.0.0).
Both portable manifests declare Agent Plugins schema `1.0.0`, which is separate
from product version `1.1.1`. The original `mcp-v1.1.1` archive declared an
unsupported `1.0.2` plugin schema and is superseded by this corrected package.

## What this release provides

The public package is a portable **Agent Plugin** with `plugin.json`, `mcp.json` and the original WordRava PNG assets. It connects to one hosted MCP service. OpenAI’s current public directory is shared by ChatGPT and Codex; local or repository marketplaces are separate development/distribution mechanisms. The portable format is documented in [Package your plugin](https://developers.openai.com/plugins/build/plugins).

The software release and its review ZIP do not establish OpenAI approval. The owner must still complete the portal actions and supply the real review materials below. The filename contains `review-draft` to keep that distinction visible.

### Actual capabilities

| Workflow | Version 1.1.1 behavior |
| --- | --- |
| Site connection | OAuth linking followed by WordPress administrator approval entirely in the browser. No pairing secret is requested by a model-callable tool. |
| Content | Read posts/pages, create or edit drafts, explicitly publish, update published content, and recoverably trash/restore with matching local permissions and revision checks. |
| SEO | Read/update supported per-post fields through active Yoast SEO or All in One SEO adapters. Both the content revision and `seo_revision` must match. Always inspect `supported_fields`; no global SEO settings or ranking promise. |
| Attached package | Accept the native ChatGPT file object, stage a ZIP up to 50 MiB temporarily for one site, then inspect its actual identity, version and SHA-256. The download expires after 30 minutes. |
| Package installation | Explicit approval plus local package-install/site-admin opt-ins and native WordPress permissions. Re-download and verify the inspected bytes, refuse existing slugs, and leave plugins/themes inactive. |
| Installed administration | Separate approved tools activate installed themes/plugins or deactivate eligible plugins. Installation does not imply activation. |
| Visibility | Read current per-site capacity, reservations, results and connection status. |

There are 35 individually named public tools. Generic operation executors, arbitrary REST/ability dispatch, PHP/shell/SQL execution, permanent deletion and native page-builder document editing are absent. Queueing a WordPress read changes Center state and reserves quota, so these tools correctly advertise `readOnlyHint:false`. A structural ZIP check is not a malware or licensing assessment.

## Package and local evidence

From this repository:

```sh
npm ci --no-audit --no-fund
npm run build
npm test
python3 tests/check_protocol.py
python3 tests/check_marketplace.py
python3 scripts/build_review_fixtures.py
python3 scripts/build_plugin.py
```

Output: `dist/wordrava-chatgpt-plugin-1.1.1-review-draft.zip`. Both manifests must remain at the ZIP root; do not wrap them in an extra directory. The bundle contains no server secrets, test credentials, account tokens, `.app.json` references or lifecycle hooks.

`npm test` uses the real MCP SDK transport and a disposable HTTPS Center mock. It verifies tool discovery, schemas, OAuth scope denial, file input declarations, SEO payloads/revision conflicts, ZIP identity/checksum binding, idempotency forwarding and safe errors. It is a contract test; it does not substitute for actual WordPress installation, provider saves, production OAuth or the OpenAI scan. WordPress/Center acceptance evidence belongs to their corresponding release reports.

After the coordinated deployment, run `python3 scripts/pre_submit_check.py`. It checks versioned public endpoints, OAuth discovery and legal/support availability. A passing health URL does not prove a complete authenticated WordPress workflow.

## Authentication configuration already included

| Setting | WordRava value |
| --- | --- |
| Universal MCP endpoint | `https://wordrava.shayanostovar.com/mcp` |
| Issuer | `https://wordrava.shayanostovar.com` |
| Authorization endpoint | `https://wordrava.shayanostovar.com/oauth/authorize` |
| Token endpoint | `https://wordrava.shayanostovar.com/oauth/token` |
| Client registration | `provided` |
| Client ID | `wordrava-chatgpt` |
| Token authentication | `none` — public client; no client secret |
| Authorization protection | PKCE S256, exact redirect allowlist and resource-bound tokens |
| Registered stable ChatGPT callback | `https://chatgpt.com/connector_platform_oauth_redirect` — verify the portal shows this exact value |
| Initial scopes | `sites:read content:read` |
| Additional write scope | `content:write`, requested when needed |
| Protected resource | `https://wordrava.shayanostovar.com/mcp` |

These values are publisher configuration, not setup fields for ordinary installed users. A Directory installation loads the connection declaration from the package; the user selects **Connect** and consents in the browser.

The provided-client flow is supported; DCR or CIMD is not required for this configured integration. Register the **exact callback URI displayed for this connection**. Current hosts can use a callback-specific URI; a stable callback is available under the issuer-identification rules. Do not guess an ID, add a wildcard or advertise issuer-identification support unless every authorization redirect implements it. See [Authentication](https://developers.openai.com/plugins/build/auth) and [registered client configuration](https://developers.openai.com/plugins/build/plugins#configure-mcp-authentication).

## Owner actions in the OpenAI portal

1. Open [Plugins](https://platform.openai.com/plugins). Select the owning organization/project and verified publishing identity; upload the review ZIP.
2. Inspect **Metadata & Skills** findings. Fix the package and re-upload when required.
3. Under **MCPs**, connect the declared server. Register its displayed callback exactly. Resolve the domain challenge shown by the portal and complete OAuth.
4. Rescan the deployed tools; resolve blocking findings. Check the saved authentication settings, not an assumed default.
5. Complete **Review information → Review details**, including real reviewer access and an accessible demonstration video. Confirm the five positive and three negative cases from the package.
6. Submit the selected draft. After approval, select **Publish**; approval alone does not make the listing available.

The current procedure is documented in [Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission). Host the portal’s exact domain token as plain text at its displayed `/.well-known/openai-apps-challenge` URL. Do not fabricate a token or overwrite another integration’s challenge.

Organization owners have submission access; delegated users need Apps Management Write. The publisher identity must be verified. MCP submissions currently require a global-data-residency project, rather than an EU-data-residency project. See [Remote MCP review requirements](https://developers.openai.com/plugins/deploy/app-review). These are owner/account prerequisites, not changes the ZIP can complete.

## Prepare a usable reviewer site

An operator can create a dedicated **non-administrator** WordRava review account with the Center’s interactive command, from its approved runtime directory:

```sh
dotnet WordRavaCenter.dll create-review-user
```

Run it in an interactive terminal and enter the real review email/password at its prompts; do not put the password in command arguments or Git. During OAuth, choose **Use an existing WordRava account** and sign into that account. Pair the dedicated sample WordPress site in that same browser. Reviewers then choose the same existing-account login, so a fresh browser sees the prepared sample site instead of creating an empty passwordless identity.

Use a dedicated HTTPS WordPress installation containing sample content only. Install Connector 1.1.1 and complete the browser pairing with the review account. Provide the login URL, account credentials and concise access instructions only in the secure review form. Access must work without a private network, one-time email/SMS code, MFA approval or magic link; see [review requirements](https://developers.openai.com/plugins/deploy/app-review).

Our five positive cases cover site ownership/quota, draft creation, SEO, plugin ZIPs and theme ZIPs. Prepare a named review draft and an active supported SEO provider. Run each provider’s SEO acceptance independently; if both plugins are active, choose the provider explicitly. Enable only the local WordPress permissions required by a case. Keep the ordinary published site unchanged for draft/install-only cases.

The reproducible fixtures in `review/fixtures/` are deliberately minimal. The plugin performs no hooks, network calls or data writes. The theme is complete enough for WordPress to recognize but should remain inactive. Their public attachment URLs in the manifest resolve after this repository version is published. For repeated successful installs, remove only the inactive review fixture through WordPress administration first; overwrite refusal is intentional.

Record staging, inspection, explicit approval, installation, polling and unchanged activation state. Record failures for missing consent, disabled opt-ins, stale SEO revisions, changed ZIP bytes and cross-account access. Test on the actual ChatGPT/Codex surfaces to be listed. Keep OAuth tokens and browser pairing fragments out of recordings.

## Public facts and outstanding owner materials

Before submitting, confirm the named publisher and these live pages are accurate:

- [Website](https://wordrava.shayanostovar.com/)
- [Privacy](https://wordrava.shayanostovar.com/privacy)
- [Terms](https://wordrava.shayanostovar.com/terms)
- [Support](https://wordrava.shayanostovar.com/support)

The privacy policy must describe actual data categories, purposes, recipients, retention and available controls. The operational deletion process must be real. The official rules do not prescribe a model-callable account-deletion tool; a documented support process is an implementation option, not an exemption from honoring requests. Do not solicit account secrets or private data through public GitHub issues. See [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines) and [Security & Privacy](https://developers.openai.com/plugins/guides/security-privacy).

The repository cannot verify the owner’s OpenAI identity, choose a legal operator, invent a private support contact, manufacture reviewer credentials/video, solve an unseen domain challenge, or claim review approval. Supply those real materials before final submission. `demo_recording_url` is intentionally absent until an accessible recording exists.

Persian listing text is included under `publication.translations.fa-IR`. Official import currently retains these translations without promising that Directory listing text switches language; see [translation behavior](https://developers.openai.com/plugins/deploy/submission#translate-listing-text). The product’s own English/Persian pages and WordPress package variants are independent of that Directory limitation.

After publication, eligible hosted tool changes are rescanned; package metadata changes require a new ZIP. Keep the deployed tool contract compatible with the reviewed version and rerun the real workflows after each release.
