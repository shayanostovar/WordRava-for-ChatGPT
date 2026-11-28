#!/usr/bin/env python3
"""Limited cloud runtime scope guard. NOT full plugin or directory acceptance.

Actual CI builds, security tests and Center's isolated database/OAuth acceptance
must still succeed before deployment. Never mark incomplete adapters verified.
"""
import json
from pathlib import Path
from check_compatibility_gate import validate

root = Path(__file__).resolve().parents[1]
# Never publish a partial universal runtime as the legacy 1.3.1 release.
if (root / "contracts/universal-capabilities-v1.json").exists():
    raise SystemExit("Universal 1.4.0 development is not approved for production publishing.")
c = json.loads((root / "contracts/wordrava-protocol-v1.json").read_text())
s = c["cloudRelease"]
def require(value, message):
    if not value:
        raise SystemExit(message)
require(s["scope"] == "limited-cloud-runtime" and s["version"] == "1.3.1", "Unexpected cloud release scope")
require(s["fullPluginCoverage"] is False and s["marketplaceApproval"] is False and s["wordpressDirectoryApproval"] is False, "Unverified release claims")
require(c["centerVersion"] == s["version"] == c["releaseComponents"]["chatgptMcp"], "Cloud version mismatch")
require(c["usage"]["freeDailyLimitDefault"] == 120, "Incorrect Free allowance")
require(c["operation"]["humanApproval"]["minimumConnectorVersion"] == "1.3.0", "Human approval boundary missing")
require(c["packageStaging"]["status"] == "retired", "Executable package staging must remain retired")
forbidden = {"rest_read","run_read_ability","install_plugin_zip","install_theme_zip","inspect_plugin_zip","inspect_theme_zip"}
require(not forbidden.intersection(c["operation"]["types"]["read"] + c["operation"]["types"]["write"]), "Forbidden execution operation")
require(c["capabilities"]["mcpToolCount"] == 46, "Unexpected tool scope; review new operations explicitly")
validate(root, inventory_only=True)
print("Limited cloud 1.3.1 scope validated; no full-compatibility or marketplace approval claimed.")
