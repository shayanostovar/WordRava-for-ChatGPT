# WordRava 1.2.3 compatibility release gate (development)

**Not released.** Production version identifiers remain 1.2.0. Do not merge this work to main or deploy while the acceptance matrix is incomplete.

The 101 submitted list entries represent 98 unique targets; the repeated Polylang, WPForms and ElementsKit names are aliases. The authoritative exact scope is `contracts/plugin-compatibility-targets.json`. The unqualified name "Image Optimizer" needs the actual plugin file/vendor to distinguish it from similarly named products.

Current development code adds bounded page/media inventory, Polylang content translation reads/assignment/merging, explicit Read Only and Read & Write local grants, core theme identity, native Additional CSS and native block header/footer operations. No other plugin is newly claimed as fully supported. The existing Elementor/Gutenberg preview and Yoast/AIOSEO metadata adapters remain limited. Native theme parts use a restricted block allowlist; classic PHP templates, commercial theme builders, and theme-specific CSS stores need dedicated adapters. Local snapshots restore stored content, not entire sites or original theme files.

Each target must identify the exact plugin file and installed edition, enumerate version-compatible capabilities, implement typed named MCP operations and validations in all three projects, and pass real isolated WordPress positive/negative, privilege, concurrency, read-back and recovery tests. Premium plugin test fixtures must be legally installed and licensed. External provider authentication/authorization, actual billing and irreversible sensitive actions are not bypassed. Fixture mocks and mere installation detection cannot count as full support.

Run `python3 tests/check_compatibility_gate.py --require-ready` to enforce release readiness. The gate rejects incomplete 1.2.3+ builds; it is called by the existing protocol checks. The version fields and package files must not be bumped until the real gate is green. Review integration run links and exact supported operation lists before setting a target to verified. A static evidence manifest is not a substitute for inspecting the real integration results.

Deployment: first obtain passing CI on development branches, then coordinate version and packaged EN/FA connector assets, Center and MCP. Main-branch automation deploys the current main SHA, so do not merge incomplete branches as a shortcut. Confirm exact release SHAs and production health, test on disposable staging, and separately complete ChatGPT marketplace review.
