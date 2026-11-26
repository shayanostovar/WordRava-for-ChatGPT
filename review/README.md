# Reproducible reviewer fixtures

These two ZIPs contain intentionally minimal WordPress code for testing the
WordRava package workflow on a **disposable review site**. They are not the
WordRava Connector and have no production functionality.

Generate them with `python3 scripts/build_review_fixtures.py`. Both carry the
coordinated version from `package.json`; archive timestamps are fixed so the
SHA-256 digest is reproducible. The plugin has no hooks, network calls or data
writes. The theme is a minimal complete theme and must remain inactive during
the install-only review case.

The public review cases in `marketplace/plugin.json` attach these files from the
published repository. The reviewer must inspect the returned slug, version and
SHA-256, then explicitly approve installation. The package opt-in and local
WordPress administrator capability remain required. A second install refuses
overwrite. To repeat the success test, the reviewer-site administrator can
delete the inactive fixture through WordPress administration first.

Do not package reviewer credentials, access tokens, browser pairing codes or
private site data with these files. The public plugin submission ZIP contains
only the two manifests and the brand assets; fixtures are separate attachments.
