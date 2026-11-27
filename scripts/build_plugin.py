#!/usr/bin/env python3
"""Build a review ZIP with plugin.json and mcp.json at the archive ROOT."""
import json
import pathlib
import zipfile
from validate_package import PACKAGE_PATHS, validate_archive, validate_package

root = pathlib.Path(__file__).resolve().parents[1]
source = root / "marketplace"
version = json.loads((root / "package.json").read_text())["version"]
import subprocess, sys
subprocess.run([sys.executable, str(root / "tests/check_compatibility_gate.py"), "--version", version], check=True)
files = {name: (source / name).read_bytes() for name in PACKAGE_PATHS}
validate_package(files, version)
dest = root / "dist" / f"wordrava-chatgpt-plugin-{version}-review-draft.zip"
dest.parent.mkdir(exist_ok=True)
temporary = dest.with_suffix(".zip.tmp")
with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED) as z:
    for name, raw in files.items():
        entry = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        z.writestr(entry, raw)
validate_archive(temporary, version)
temporary.replace(dest)
print(f"Review draft ZIP: {dest}")

