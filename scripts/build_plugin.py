#!/usr/bin/env python3
"""Build a review ZIP with plugin.json and mcp.json at the archive ROOT."""
import json
import pathlib
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
source = root / "marketplace"
manifest = json.loads((source / "plugin.json").read_text())
auth = json.loads((source / "mcp.json").read_text())
version = json.loads((root / "package.json").read_text())["version"]
assert manifest["name"] == "wordrava" and manifest["version"] == version
assert auth["mcpServers"]["wordrava"]["type"] == "streamable-http"
assert auth["mcpServers"]["wordrava"]["url"] == "https://wordrava.shayanostovar.com/mcp"
review = manifest["extensions"]["com.openai"]["review"]["test_cases"]
assert len(review["positive"]) == 5 and len(review["negative"]) == 3
paths = ["plugin.json", "mcp.json", "assets/logo.png", "assets/icon.png"]
dest = root / "dist" / f"wordrava-chatgpt-plugin-{version}-review-draft.zip"
dest.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
    for file in paths:
        entry = zipfile.ZipInfo(file, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        z.writestr(entry, (source / file).read_bytes())
with zipfile.ZipFile(dest) as z:
    assert z.testzip() is None
    assert "plugin.json" in z.namelist() and "mcp.json" in z.namelist()
print(f"Review draft ZIP: {dest}")

