#!/usr/bin/env python3
"""Regress package/import failures through the actual builder and final ZIP."""
import copy
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(repo / "scripts"))
from validate_package import validate_archive

missing = object()
negative_cases = [
    ("plugin", ["$schema"], "https://agent-plugins.org/schemas/1.0.2/plugin.schema.json", "Unsupported plugin manifest schema"),
    ("plugin", ["$schema"], missing, "Unsupported plugin manifest schema"),
    ("mcp", ["$schema"], "https://agent-plugins.org/schemas/1.0.2/mcp.schema.json", "Unsupported mcp manifest schema"),
    ("mcp", ["$schema"], missing, "Unsupported mcp manifest schema"),
    ("plugin", ["extensions", "com.openai", "unknown"], {}, "extensions.com.openai: unsupported fields"),
    ("plugin", ["extensions", "com.openai", "interface", "unknown"], "value", "interface: unsupported fields"),
    ("plugin", ["extensions", "com.openai", "interface", "capabilities"], "Read", "interface.capabilities: expected an array"),
    ("plugin", ["extensions", "com.openai", "interface", "defaultPrompt"], 42, "interface.defaultPrompt: expected an array"),
    ("plugin", ["extensions", "com.openai", "interface", "logo"], "./../logo.png", "interface.logo: unsupported or uncontained asset path"),
    ("plugin", ["extensions", "com.openai", "review", "release_notes"], "Previously misplaced release notes", "review: unsupported fields ['release_notes']"),
    ("plugin", ["extensions", "com.openai", "review", "test_credentials"], "do-not-package", "review: unsupported fields"),
    ("plugin", ["extensions", "com.openai", "review", "commerce"], "false", "review.commerce: expected a boolean"),
    ("plugin", ["extensions", "com.openai", "review", "test_cases", "positive"], {}, "review.test_cases.positive: expected 5 cases"),
    ("plugin", ["extensions", "com.openai", "review", "test_cases", "positive", 0, "unknown"], "value", "positive[0]: unsupported fields"),
    ("plugin", ["extensions", "com.openai", "review", "test_cases", "positive", 0, "tools_triggered"], ["wordrava_list_sites"], "positive[0].tools_triggered: expected nonblank text"),
    ("plugin", ["extensions", "com.openai", "review", "test_cases", "negative", 0, "prompt"], missing, "negative[0]: missing fields ['prompt']"),
    ("plugin", ["extensions", "com.openai", "review", "test_cases", "negative", 0, "unknown"], "value", "negative[0]: unsupported fields"),
    ("plugin", ["extensions", "com.openai", "publication", "release_notes"], missing, "publication: missing fields ['release_notes']"),
    ("plugin", ["extensions", "com.openai", "publication", "unknown"], "value", "publication: unsupported fields"),
    ("plugin", ["extensions", "com.openai", "publication", "translations", "fa-IR", "unknown"], "value", "publication.translations.fa-IR: unsupported fields"),
    ("plugin", ["extensions", "com.openai", "publication", "translations", "fa-IR", "description"], [], "publication.translations.fa-IR.description: expected nonblank text"),
    ("mcp", ["mcpServers", "wordrava", "auth"], {}, "mcpServers.wordrava: unsupported fields"),
    ("mcp", ["mcpServers", "wordrava", "extensions", "com.openai", "unknown"], {}, "mcpServers.wordrava.extensions.com.openai: unsupported fields"),
    ("mcp", ["mcpServers", "wordrava", "extensions", "com.openai", "auth", "clientSecret"], "do-not-package", "MCP auth: unsupported fields"),
    ("mcp", ["mcpServers", "wordrava", "extensions", "com.openai", "auth", "client", "unknown"], "value", "MCP auth.client: unsupported fields"),
    ("mcp", ["mcpServers", "wordrava", "extensions", "com.openai", "auth", "client", "clientId"], 12, "MCP auth.client: must preserve"),
    ("mcp", ["mcpServers", "wordrava", "extensions", "com.openai", "auth", "baseScopes"], "sites:read content:read", "MCP auth.baseScopes: expected an array"),
]

with tempfile.TemporaryDirectory(prefix="wordrava-package-schema-") as directory:
    fixture = Path(directory)
    (fixture / "scripts").mkdir()
    shutil.copy2(repo / "scripts/build_plugin.py", fixture / "scripts/build_plugin.py")
    shutil.copy2(repo / "scripts/validate_package.py", fixture / "scripts/validate_package.py")
    shutil.copy2(repo / "package.json", fixture / "package.json")
    shutil.copytree(repo / "marketplace", fixture / "marketplace")
    # Include the actual release gate and shared manifests; test the complete
    # package builder rather than bypassing the newly required gate.
    (fixture / "tests").mkdir()
    shutil.copy2(repo / "tests/check_compatibility_gate.py", fixture / "tests/check_compatibility_gate.py")
    shutil.copytree(repo / "contracts", fixture / "contracts")
    originals = {kind: json.loads((fixture / "marketplace" / f"{kind}.json").read_text())
                 for kind in ("plugin", "mcp")}
    # -O ensures unsupported formats cannot bypass the production builder by
    # disabling Python assert statements.
    command = [sys.executable, "-O", str(fixture / "scripts/build_plugin.py")]
    for kind, segments, value, expected_error in negative_cases:
        manifests = copy.deepcopy(originals)
        target = manifests[kind]
        for segment in segments[:-1]:
            target = target[segment]
        if value is missing:
            target.pop(segments[-1], None)
        else:
            target[segments[-1]] = value
        for name, manifest in manifests.items():
            (fixture / "marketplace" / f"{name}.json").write_text(json.dumps(manifest))
        result = subprocess.run(command, capture_output=True, text=True)
        assert result.returncode != 0 and expected_error in result.stderr, (segments, result.stderr)
        assert not list((fixture / "dist").glob("*.zip")), "Rejected manifest produced an archive"
    for name, manifest in originals.items():
        (fixture / "marketplace" / f"{name}.json").write_text(json.dumps(manifest))
    result = subprocess.run(command, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    archives = list((fixture / "dist").glob("*.zip"))
    assert len(archives) == 1
    validate_archive(archives[0], originals["plugin"]["version"])
    with zipfile.ZipFile(archives[0]) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == {"plugin.json", "mcp.json", "assets/logo.png", "assets/icon.png"}
        for kind in ("plugin", "mcp"):
            packaged = json.loads(archive.read(f"{kind}.json"))
            assert packaged["$schema"] == f"https://agent-plugins.org/schemas/1.0.0/{kind}.schema.json"
            assert packaged == originals[kind]
        packaged_plugin = json.loads(archive.read("plugin.json"))
        overlay = packaged_plugin["extensions"]["com.openai"]
        assert "release_notes" not in overlay["review"]
        assert overlay["publication"]["release_notes"].strip()
        assert all(case["expected_behavior"] for case in overlay["review"]["test_cases"]["negative"])
        packaged_files = {name: archive.read(name) for name in archive.namelist()}
    # A correct working manifest must not mask a malformed final archive.
    bad = fixture / "invalid-overlay.zip"
    packaged_plugin["extensions"]["com.openai"]["review"]["release_notes"] = "invalid placement"
    packaged_files["plugin.json"] = json.dumps(packaged_plugin).encode()
    with zipfile.ZipFile(bad, "w") as archive:
        for name, raw in packaged_files.items():
            archive.writestr(name, raw)
    try:
        validate_archive(bad)
    except ValueError as error:
        assert "review: unsupported fields ['release_notes']" in str(error)
    else:
        raise AssertionError("Invalid overlay in final ZIP was accepted")
    duplicate = fixture / "duplicate-path.zip"
    shutil.copy2(archives[0], duplicate)
    with zipfile.ZipFile(duplicate, "a") as archive:
        archive.writestr("../plugin.json", b"{}")
    try:
        validate_archive(duplicate)
    except ValueError as error:
        assert "duplicate or extra paths" in str(error)
    else:
        raise AssertionError("Unexpected archive path was accepted")
print(f"Package compatibility regression passed: {len(negative_cases)} invalid manifest cases and 2 invalid ZIP cases rejected; valid schema, publication notes, review cases, assets and OAuth preserved.")
