#!/usr/bin/env python3
"""Build a review ZIP with plugin.json and mcp.json at the archive ROOT."""
import json
import pathlib
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
source = root / "marketplace"
manifest = json.loads((source / "plugin.json").read_text())
auth = json.loads((source / "mcp.json").read_text())
assert manifest["name"] == "wordrava" and manifest["version"] == "1.0.2"
assert auth["mcpServers"]["wordrava"]["type"] == "streamable-http"
assert auth["mcpServers"]["wordrava"]["url"] == "https://wordrava.shayanostovar.com/mcp"
review = manifest["extensions"]["com.openai"]["review"]["test_cases"]
assert len(review["positive"]) == 6 and len(review["negative"]) == 3
paths = ["plugin.json", "mcp.json", "assets/logo.svg", "assets/icon.svg"]
dest = root / "dist" / "wordrava-chatgpt-plugin-1.0.2-review-draft.zip"
dest.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
    for file in paths:
        z.write(source / file, file)
with zipfile.ZipFile(dest) as z:
    assert z.testzip() is None
    assert "plugin.json" in z.namelist() and "mcp.json" in z.namelist()
print(f"Review draft ZIP: {dest}")
