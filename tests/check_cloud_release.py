#!/usr/bin/env python3
"""Limited cloud runtime scope guard. NOT full plugin or directory acceptance.

Actual CI builds, security tests and Center's isolated database/OAuth acceptance
must still succeed before deployment. Never mark incomplete adapters verified.
"""
import json
from pathlib import Path
from check_compatibility_gate import validate

root = Path(__file__).resolve().parents[1]
# Full universal and directory distribution remain separately blocked.
c = json.loads((root / "contracts/wordrava-protocol-v1.json").read_text())
s = c["cloudRelease"]
def require(value, message):
    if not value:
        raise SystemExit(message)
require(s["scope"] == "limited-cloud-runtime" and s["version"] == "1.4.4", "Unexpected cloud release scope")
require(s.get("universalProductionEnabled") is False and s.get("universalSchemaDeferred") is True, "Experimental universal must stay disabled")
u = json.loads((root / "contracts/universal-capabilities-v1.json").read_text())
require(u["status"] == "development_not_production_approved" and u["execution"]["write_enabled"] is False, "Unverified universal release")
require("NODE_ENV=production PORT=3100 WORDRAVA_UNIVERSAL_DISCOVERY_ENABLED=false" in (root / "Dockerfile").read_text(), "Missing production feature lock")
require("process.env.WORDRAVA_UNIVERSAL_DISCOVERY_ENABLED === 'true' && process.env.NODE_ENV !== 'production'" in (root / "src/server.ts").read_text(), "Missing runtime feature lock")
require(s["connectorArchive"] == c["releaseComponents"]["wordpressConnector"] == "1.3.1", "Unverified Connector package")
require(json.loads((root / "marketplace/plugin.json").read_text())["version"] == s["marketplaceDraftVersion"] == "1.3.1", "Unverified Marketplace draft version")
require(s["fullPluginCoverage"] is False and s["marketplaceApproval"] is False and s["wordpressDirectoryApproval"] is False, "Unverified release claims")
require(c["centerVersion"] == s["version"] == c["releaseComponents"]["chatgptMcp"], "Cloud version mismatch")
require(c["usage"]["freeDailyLimitDefault"] == 120, "Incorrect Free allowance")
require(c["operation"]["humanApproval"]["minimumConnectorVersion"] == "1.3.0", "Human approval boundary missing")
require(c["packageStaging"]["status"] == "retired", "Executable package staging must remain retired")
forbidden = {"rest_read","run_read_ability","install_plugin_zip","install_theme_zip","inspect_plugin_zip","inspect_theme_zip"}
require(not forbidden.intersection(c["operation"]["types"]["read"] + c["operation"]["types"]["write"]), "Forbidden execution operation")
require(c["capabilities"]["mcpToolCount"] == 46, "Unexpected tool scope; review new operations explicitly")
adapter_contract = json.loads((root / "contracts/plugin-adapters-development-v1.json").read_text())
require(adapter_contract["production_enabled"] is False, "Unreviewed plugin adapter release")
require("process.env.WORDRAVA_PLUGIN_ADAPTERS_DEV === 'true' && process.env.NODE_ENV === 'development'" in (root / "src/server.ts").read_text(), "Missing staging adapter gate")
validate(root, inventory_only=True)
print("Limited cloud 1.4.4 scope validated; Universal disabled; no full-compatibility or marketplace approval claimed.")
