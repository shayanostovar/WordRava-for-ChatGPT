# Universal 1.4.0 — development milestone 1

Development-only generic MCP interface. Set WORDRAVA_UNIVERSAL_DISCOVERY_ENABLED=true only in isolated test infrastructure on both MCP and Center. Production defaults to false and the publishing gate rejects the incomplete universal branch.

The four stable tools queue category inventory, search the persistent site catalog, inspect an exact capability and list public post metadata through a locally opted-in native adapter. Use wordrava_job_status for the asynchronous result. Continue inventory pagination with the exact returned inventory_revision; a changed inventory must restart. An old connector cannot run these operations. The existing named tools remain backward compatible.

Discovery does not authorize arbitrary REST or Ability invocation, source-code execution, option access or writes. The initial adapter is intentionally read-only. Source and manifest release metadata remain at the last runtime version until a verified coordinated release; no package is approved or built for distribution by this commit.
