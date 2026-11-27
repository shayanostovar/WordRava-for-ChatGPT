#!/usr/bin/env python3
"""1.2.3 compatibility release gate. Evidence is not fabricated by CI.

This validates the review manifest and blocks packaging an incomplete release.
A real integration reviewer must verify the referenced runs and licensed
plugin versions; a static manifest by itself cannot establish compatibility.
"""
import argparse
import json
import re
from pathlib import Path

def validate(root, version=None, require_ready=False):
    matrix = json.loads((root / "contracts/plugin-compatibility-targets.json").read_text(encoding="utf-8"))
    contract = json.loads((root / "contracts/wordrava-protocol-v1.json").read_text(encoding="utf-8"))
    targets = matrix["plugin_targets"]
    extra = matrix["appearance_targets"]
    assert matrix["target_release"] == "1.2.3"
    assert matrix["requested_entries"] == 101 and matrix["unique_plugin_targets"] == 98
    assert len(targets) == 98
    requested = [t["requested_index"] for t in targets] + [a["requested_index"] for t in targets for a in t["aliases"]]
    assert sorted(requested) == list(range(1, 102))
    assert len({t["id"] for t in targets + extra}) == len(targets) + len(extra)
    failures = []
    for target in targets + extra:
        required = target["required_features"]
        assert required and len(required) == len(set(required))
        assert target["status"] in {"not_implemented","partial_unverified","identity_unresolved","verified"}
        missing = []
        if target["status"] != "verified":
            missing.append(target["status"])
        versions = target.get("tested_versions", [])
        if not versions or any(not isinstance(v, dict) or not v.get("wordpress") or not v.get("php") or
            not v.get("plugin_or_theme_version") or not v.get("edition") for v in versions):
            missing.append("real edition/version matrix")
        if "supported_plugin_files" in target and not target["supported_plugin_files"]:
            missing.append("exact plugin identity")
        evidence = target.get("evidence", {})
        for feature in required:
            item = evidence.get(feature, {})
            if not (item.get("adapter_operations") and
                    all(op in contract["operation"]["types"]["read"] + contract["operation"]["types"]["write"]
                        for op in item["adapter_operations"]) and
                    item.get("real_wordpress_test") and
                    re.fullmatch(r"https://github\.com/[^/]+/[^/]+/actions/runs/[0-9]+", str(item.get("ci_run",""))) and
                    item.get("permission_denial_test") and item.get("verification") and item.get("recovery_policy")):
                missing.append(feature)
        if missing:
            failures.append((target["name"], missing))
    print(f"Compatibility scope: {len(targets)} unique plugin targets, {len(extra)} cross-cutting targets; {len(failures)} incomplete.")
    actual = version or contract["centerVersion"]
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", actual):
        raise SystemExit("Invalid release version: " + actual)
    if require_ready and actual != matrix["target_release"] and not failures:
        raise SystemExit("Release version must match the verified compatibility target.")
    if require_ready or tuple(map(int, actual.split("."))) >= (1, 2, 3):
        if failures:
            for name, missing in failures:
                print(f"BLOCKED {name}: {', '.join(missing)}")
            raise SystemExit("WordRava 1.2.3 release blocked: real compatibility acceptance is incomplete.")
    return not failures

if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--version")
    parser.add_argument("--require-ready",action="store_true")
    args=parser.parse_args()
    validate(Path(__file__).resolve().parents[1],args.version,args.require_ready)
