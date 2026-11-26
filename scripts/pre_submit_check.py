#!/usr/bin/env python3
"""Read-only production readiness probe. Never submits or mutates WordPress data."""
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ORIGIN = "https://wordrava.shayanostovar.com"
checks = []


def fetch(path, *, method="GET", data=None):
    headers = {"Accept": "application/json, text/html;q=0.9"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = Request(ORIGIN + path, headers=headers, data=data, method=method)
    try:
        result = urlopen(request, timeout=12)
    except HTTPError as exc:
        result = exc
    with result:
        body = result.read(100000).decode("utf-8", errors="replace")
        return result.status, dict(result.headers), body


def check(label, fn):
    try:
        fn()
        checks.append((label, True, "OK"))
    except (AssertionError, KeyError, ValueError, TimeoutError, URLError, OSError) as exc:
        checks.append((label, False, str(exc)[:250] or type(exc).__name__))


def assert_json(path, validator):
    status, _, body = fetch(path)
    assert status == 200, f"HTTP {status}"
    obj = json.loads(body)
    validator(obj)


def check_center():
    assert_json("/health", lambda x: (
        (_ for _ in ()).throw(AssertionError("Center not 1.1.1"))
        if x.get("component") != "center" or x.get("version") != "1.1.1"
        else None))


def check_mcp():
    assert_json("/mcp/health", lambda x: (
        (_ for _ in ()).throw(AssertionError("MCP not 1.1.1"))
        if x.get("component") != "mcp" or x.get("version") != "1.1.1"
        else None))


def check_auth_metadata():
    def validate(x):
        assert x["issuer"] == ORIGIN
        assert x["authorization_endpoint"] == ORIGIN + "/oauth/authorize"
        assert x["token_endpoint"] == ORIGIN + "/oauth/token"
        assert "S256" in x["code_challenge_methods_supported"]
        assert "content:write" in x["scopes_supported"]
    assert_json("/.well-known/oauth-authorization-server", validate)


def check_resource_metadata():
    def validate(x):
        assert x["resource"] == ORIGIN + "/mcp"
        assert ORIGIN in x["authorization_servers"]
    assert_json("/.well-known/oauth-protected-resource", validate)


def check_unauthenticated_mcp():
    status, headers, body = fetch("/mcp", method="POST", data=b'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}')
    assert status == 401, f"Expected 401, got HTTP {status}"
    assert "resource_metadata=" in headers.get("WWW-Authenticate", ""), "Missing RFC 9728 challenge"
    assert "Bearer" in headers.get("WWW-Authenticate", ""), "Missing Bearer challenge"


def check_legal(path, keywords):
    status, _, body = fetch(path)
    assert status == 200, f"HTTP {status}"
    lowered = body.lower()
    assert "<div id=\"root\">" not in lowered, "Admin SPA fallback is not a legal document"
    assert len(body) > 800, "Legal/support document appears empty or placeholder"
    assert any(k in lowered for k in keywords), "Expected document content missing"


check("Center 1.1.1", check_center)
check("MCP 1.1.1", check_mcp)
check("Authorization server OAuth/PKCE", check_auth_metadata)
check("MCP protected resource discovery", check_resource_metadata)
check("Unauthenticated MCP login challenge", check_unauthenticated_mcp)
check("Public privacy policy", lambda: check_legal("/privacy", ["privacy", "datenschutz"]))
check("Public terms", lambda: check_legal("/terms", ["terms", "nutzungsbedingungen"]))
check("Public support", lambda: check_legal("/support", ["support", "hilfe", "contact"]))

for name, ok, detail in checks:
    print(("PASS" if ok else "FAIL") + ": " + name + ("" if ok else " — " + detail))
failed = sum(not ok for _, ok, _ in checks)
print(f"\nPassed {len(checks) - failed}/{len(checks)} public readiness checks.")
if failed:
    print("Not ready for public submission. Re-run after deployment and legal publishing.")
    sys.exit(1)
print("Public endpoint checks passed; authenticated WordPress staging tests are STILL required.")
