# WordRava 1.3.0 — WordPress.org readiness (unreleased)

Status: BLOCKED. Current published product release remains 1.2.0. No directory submission, approval, production deployment or release ZIP is claimed.

## Source changes
- Credential-free Quick Connect setup prompt, explicit OAuth setup, no secret sharing, same-admin pairing and consent-dependent polling.
- Named operations only. Generic REST/Abilities dispatch removed; metadata discovery is not operation authority.
- Sensitive changes require a site-local, expiring, one-time administrator decision bound to exact request and site identity. Source implementation must pass real runtime/security tests.
- Executable ZIP staging, inspection and installation removed from Connector, Center endpoint registration and MCP tool registry; previous releases remain in Git history. Do not ship arbitrary code or SQL interfaces. Native WordPress installer is the alternative.
- Initial GPL header and disclosure changes. No claim that all assets/dependencies or generated source have been audited.

## Review evidence
The 18-rule audit and additional release acceptance checks are in contracts/wordpress-org-review.json. The 101 original requests (98 unique targets) plus nine supplemental plugin targets are in contracts/plugin-compatibility-targets.json; partial code is not full verified support. Six additional appearance/inventory/permission targets remain. The gate must fail until all actual-version evidence and review checks are verified. No premium license or unverified plugin identity may be guessed or bypassed.

## Required before release
Test exact WordPress/PHP/plugin versions, local profiles, expired/replayed/denied approvals, job isolation, network failures, update/recovery, page builders and theme-specific APIs in disposable staging. Run official Plugin Check against the final archive, PHPCS with WordPress Coding Standards, reproducible package and size checks, Center/MCP builds and end-to-end production-candidate tests. Verify all corresponding source is accessible, asset licenses, legal pages, retention/deletion and a monitored support/privacy contact. Check directory slug and publisher identity. Never submit to WordPress.org or SVN without explicit authorization.

## Reviewer clarification draft (not sent)
To: plugins@wordpress.org
Subject: WordRava — directory eligibility of external management service boundaries

Hello Plugin Review Team,
WordRava connects administrator-consented WordPress sites to an independently hosted OAuth and job service. The proposed directory edition does not expose arbitrary PHP/JS/SQL, REST or ability execution, nor download or install executable ZIP archives. Site administrators approve sensitive typed requests locally; native WordPress capabilities are still enforced. We plan to support bounded content/SEO, site identity, Additional CSS, existing block-theme template parts, and activation/deactivation of already-installed plugins/themes. Would these bounded lifecycle/appearance operations be acceptable for this architecture? Specifically, if a future management-only edition were ever to install an administrator-provided archive, what exact requirements would apply under Guideline 8? We are excluding that capability pending clarification and will not use a hidden route or a feature flag to bypass review. Please advise on the required external-service disclosure and any additional conditions for a cloud quota on genuinely hosted operations. Thank you.

References: https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/
https://developer.wordpress.org/plugins/wordpress-org/plugin-developer-faq/
https://developer.wordpress.org/plugins/wordpress-org/common-issues/
https://wordpress.org/plugins/plugin-check/
https://wordpress.org/plugins/developers/readme-validator/
https://developer.wordpress.org/plugins/wordpress-org/how-to-use-subversion/
