#!/usr/bin/env python3
"""Regress the Personal import failure using the actual ZIP builder."""
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="wordrava-package-schema-") as directory:
    fixture = Path(directory)
    (fixture / "scripts").mkdir()
    shutil.copy2(repo / "scripts/build_plugin.py", fixture / "scripts/build_plugin.py")
    shutil.copy2(repo / "package.json", fixture / "package.json")
    shutil.copytree(repo / "marketplace", fixture / "marketplace")
    originals = {kind: json.loads((fixture / "marketplace" / f"{kind}.json").read_text())
                 for kind in ("plugin", "mcp")}
    # -O ensures unsupported formats cannot bypass the production builder by
    # disabling Python assert statements.
    command = [sys.executable, "-O", str(fixture / "scripts/build_plugin.py")]
    for kind in ("plugin", "mcp"):
        path = fixture / "marketplace" / f"{kind}.json"
        for schema in (f"https://agent-plugins.org/schemas/1.0.2/{kind}.schema.json", None):
            changed = dict(originals[kind])
            if schema is None:
                changed.pop("$schema", None)
            else:
                changed["$schema"] = schema
            path.write_text(json.dumps(changed))
            result = subprocess.run(command, capture_output=True, text=True)
            assert result.returncode != 0 and f"Unsupported {kind} manifest schema" in result.stderr
            assert not list((fixture / "dist").glob("*.zip")), "Rejected manifest produced an archive"
        path.write_text(json.dumps(originals[kind]))
    result = subprocess.run(command, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    archives = list((fixture / "dist").glob("*.zip"))
    assert len(archives) == 1
    with zipfile.ZipFile(archives[0]) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == {"plugin.json", "mcp.json", "assets/logo.png", "assets/icon.png"}
        for kind in ("plugin", "mcp"):
            packaged = json.loads(archive.read(f"{kind}.json"))
            assert packaged["$schema"] == f"https://agent-plugins.org/schemas/1.0.0/{kind}.schema.json"
            assert packaged == originals[kind]
print("Package schema regression passed: unsupported/missing declarations rejected; 1.0.0 ZIP and OAuth metadata preserved.")
