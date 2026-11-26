# WordRava 1.1.1 pre-submission audit

Date: 2026-11-26. This is a repository/package audit, not an OpenAI approval or a
claim that owner-specific submission materials have been supplied.

## Implemented corrections

- 35 individually exposed tools replace generic operation executors. Arbitrary
  REST/Ability dispatch and chat-based pairing-secret input are removed from the
  public catalog. Browser-only connection help is provided.
- New named tools implement supported Yoast/AIOSEO post metadata, native ChatGPT
  ZIP staging, plugin/theme inspection and approved inactive installation.
- All tools declare explicit read-only, destructive, idempotency and open-world
  hints. Enqueueing a read is stateful; code installation is destructive even
  without automatic activation.
- Success outputs have declared schemas; errors are sanitized JSON text marked
  `isError:true`, with OAuth challenge metadata where needed. This avoids current
  SDK clients rejecting an error object against a successful-result schema.
- Public account/site outputs omit unnecessary internal owner/plan IDs and
  creation timestamps. The profile keeps its required stable identity.
- Public-client OAuth remains provided/none + PKCE S256; initial scopes are
  read-only and additional write permission is requested separately.
- Review metadata contains five positive and three negative cases, original
  square PNG assets, bounded public listing text and Persian translation.
  Deterministic inert WordPress fixtures back the package scenarios.
- Current versions are coordinated at 1.1.1; wire protocol1.0/schema1.3 is copied
  unchanged from Center. English/Persian submission guides describe actual
  functionality and manual publisher steps.

## Local verification

### Personal import compatibility correction

The original 1.1.1 package declared an unsupported `1.0.2` plugin schema and
was rejected by the Personal importer. Both portable manifests now explicitly
declare the supported Agent Plugins `1.0.0` schema. The product version remains
`1.1.1`; OAuth and the tool contract are unchanged. Metadata checks and the ZIP
builder enforce exact supported schema IDs, including inside the built archive.
`tests/check_package_schema.py` reproduces rejection of unsupported and missing
schema declarations with Python assertions disabled, then verifies a valid ZIP
and preserved authentication metadata. Actual Personal account installation is
separate from these package compatibility checks.

`npm run build` type-checks the server and operation schemas. `npm test` runs
eight integration scenarios plus their parent suite (Node reports 9 tests),
using the real MCP SDK and a disposable HTTPS mock Center with a trusted local
test CA. Production TLS verification is not disabled. These scenarios cover
OAuth discovery, tool/output metadata, native file schemas, response data
minimization, scope checks, SEO validation/revision conflict, staging and exact
package identity/idempotency. Public metadata and shared protocol guards run
separately. The package builder verifies the ZIP root and CRC integrity.

These tests establish the MCP contract. Actual WordPress/provider saves and
installations, deployed Center integration and production OAuth are verified in
the coordinated release workflow and must not be inferred from this mock.

## Complete overlay and real ingestion correction

The first schema repair did not validate the OpenAI overlay and still included
the unsupported `review.release_notes` property. Release notes now live only in
`publication.release_notes`; the release workflow reads the same supported field.
All supplied metadata is checked recursively, including review cases, publication
translations, interface fields, and MCP OAuth. Unknown fields and wrong types
are rejected by the actual package builder and targeted regression cases.

On 2026-11-26, the complete corrected 1.1.1 archive was accepted by the actual
Plugin Creator ingestion backend as a private workspace plugin. Readback of its
portable and generated compatibility manifests confirmed preserved identity,
version, review cases, release notes, Persian metadata, MCP endpoint and OAuth
configuration. The backend normalized publisher identity to the authenticated
account. This is package acceptance, not an OAuth authorization or a public
marketplace approval. No private account details are included in this report.

## Owner-dependent review gates

The following cannot be fabricated by a code release: verified publishing
identity, project permissions/residency, the portal's exact callback and domain
challenge, usable reviewer account/site, real demonstration recording, accurate
legal/operator/support details, a working private process for sensitive support
and deletion requests, and successful OpenAI scans/review. The review ZIP omits
credentials and an invented video URL. Its draft label does not limit software
features; it records the separate marketplace approval status.

Official references used:

- [Packaging](https://developers.openai.com/plugins/build/plugins)
- [Submission](https://developers.openai.com/plugins/deploy/submission)
- [Review requirements](https://developers.openai.com/plugins/deploy/app-review)
- [Guidelines](https://developers.openai.com/plugins/plugin-guidelines)
- [Authentication](https://developers.openai.com/plugins/build/auth)
- [Tool/file reference](https://developers.openai.com/plugins/reference)
- [Security and privacy](https://developers.openai.com/plugins/guides/security-privacy)
- [Submission field limits](https://developers.openai.com/plugins/deploy/submission-errors)
