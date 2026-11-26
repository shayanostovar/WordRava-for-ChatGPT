"""Strict local validation of WordRava's portable package profile.

Field mappings: OpenAI Plugin Creator component/review requirements and
https://developers.openai.com/plugins/deploy/submission#configure-onboarding-review-and-publication
This checks the supported fields used by this package, including OpenAI's MCP
authentication extension. It is not an OpenAI importer or review approval.
Unknown fields fail closed; extend this profile deliberately for new components.
"""
import json
import re
import struct
import zipfile
from urllib.parse import urlsplit

PACKAGE_PATHS = ("plugin.json", "mcp.json", "assets/logo.png", "assets/icon.png")
PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json"
CATEGORIES = {
    "Business & Operations", "Communication", "Creativity", "Data & Analytics",
    "Developer Tools", "Education & Research", "Entertainment", "Finance",
    "Healthcare", "Other", "Productivity", "Scientific Research", "Security", "Travel",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def object_fields(value, allowed, required, path):
    require(isinstance(value, dict), f"{path}: expected an object")
    unknown = set(value) - set(allowed)
    require(not unknown, f"{path}: unsupported fields {sorted(unknown)}")
    missing = set(required) - set(value)
    require(not missing, f"{path}: missing fields {sorted(missing)}")


def text(value, path, maximum=None, multiline=True):
    require(isinstance(value, str) and bool(value.strip()), f"{path}: expected nonblank text")
    require(maximum is None or len(value) <= maximum, f"{path}: text exceeds {maximum} characters")
    require(all((ord(c) >= 32 or c == "\n" and multiline) and not 127 <= ord(c) <= 159
                and c not in "\u2028\u2029" for c in value), f"{path}: unsupported control characters")
    require(multiline or "\n" not in value, f"{path}: expected one line")


def https_url(value, path, maximum=2048):
    text(value, path, maximum, multiline=False)
    parsed = urlsplit(value)
    require(parsed.scheme == "https" and bool(parsed.hostname) and parsed.username is None
            and parsed.password is None and not any(c.isspace() for c in value),
            f"{path}: expected an absolute HTTPS URL without credentials")


def string_array(value, path, maximum=None, item_maximum=None):
    require(isinstance(value, list), f"{path}: expected an array")
    require(maximum is None or len(value) <= maximum, f"{path}: too many entries")
    for index, item in enumerate(value):
        text(item, f"{path}[{index}]", item_maximum, multiline=False)


def validate_package(files, expected_version=None):
    require(set(files) == set(PACKAGE_PATHS), "Package must contain exactly its two manifests and two PNG assets")
    plugin = json.loads(files["plugin.json"])
    mcp = json.loads(files["mcp.json"])
    require(isinstance(plugin, dict) and plugin.get("$schema") == PLUGIN_SCHEMA,
            f"Unsupported plugin manifest schema; expected {PLUGIN_SCHEMA}")
    require(isinstance(mcp, dict) and mcp.get("$schema") == MCP_SCHEMA,
            f"Unsupported mcp manifest schema; expected {MCP_SCHEMA}")
    object_fields(plugin,
                  {"$schema", "name", "version", "description", "author", "homepage", "repository", "license", "keywords", "extensions"},
                  {"$schema", "name", "version", "description", "author", "extensions"}, "plugin.json")
    require(plugin["name"] == "wordrava", "plugin.json.name: expected wordrava")
    text(plugin["version"], "plugin.json.version", 128, False)
    require(re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?", plugin["version"]) is not None,
            "plugin.json.version: expected a semantic version")
    require(expected_version is None or plugin["version"] == expected_version,
            "plugin.json.version: does not match package version")
    text(plugin["description"], "plugin.json.description", 4000)
    author = plugin["author"]
    object_fields(author, {"name", "email", "url"}, {"name"}, "plugin.json.author")
    text(author["name"], "plugin.json.author.name", 120, False)
    if "email" in author:
        text(author["email"], "plugin.json.author.email", 320, False)
        require(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", author["email"]) is not None, "plugin.json.author.email: invalid email")
    if "url" in author:
        https_url(author["url"], "plugin.json.author.url")
    for key in ("homepage", "repository"):
        if key in plugin:
            https_url(plugin[key], f"plugin.json.{key}")
    if "license" in plugin:
        text(plugin["license"], "plugin.json.license", multiline=False)
    if "keywords" in plugin:
        string_array(plugin["keywords"], "plugin.json.keywords", 25)
    object_fields(plugin["extensions"], {"com.openai"}, {"com.openai"}, "plugin.json.extensions")
    overlay = plugin["extensions"]["com.openai"]
    object_fields(overlay, {"interface", "review", "publication"}, {"interface", "review", "publication"}, "extensions.com.openai")
    ui = overlay["interface"]
    fields = {"displayName", "shortDescription", "longDescription", "developerName", "category", "capabilities",
              "websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL", "defaultPrompt",
              "brandColor", "brandColorDark", "composerIcon", "composerIconDark", "logo", "logoDark"}
    object_fields(ui, fields, fields - {"brandColor", "brandColorDark", "logoDark", "composerIconDark"}, "interface")
    for key, maximum in {"displayName": 30, "shortDescription": 30, "longDescription": 4000, "developerName": 80}.items():
        text(ui[key], f"interface.{key}", maximum, multiline=key == "longDescription")
    require(isinstance(ui["category"], str) and ui["category"] in CATEGORIES, "interface.category: unsupported category")
    string_array(ui["capabilities"], "interface.capabilities", 20, 120)
    for key in ("websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"):
        https_url(ui[key], f"interface.{key}", 1024)
    prompts = [ui["defaultPrompt"]] if isinstance(ui["defaultPrompt"], str) else ui["defaultPrompt"]
    string_array(prompts, "interface.defaultPrompt", 3, 128)
    normalized = [" ".join(item.split()) for item in prompts]
    require(len(set(normalized)) == len(normalized), "interface.defaultPrompt: duplicate prompts")
    require(all("@" not in item for item in prompts), "interface.defaultPrompt: app mentions are not supported")
    for key in ("brandColor", "brandColorDark"):
        if key in ui:
            require(isinstance(ui[key], str) and re.fullmatch(r"#[0-9a-fA-F]{6}", ui[key]) is not None,
                    f"interface.{key}: expected #RRGGBB")
    for key in ("logo", "composerIcon", "logoDark", "composerIconDark"):
        if key in ui:
            value = ui[key]
            require(isinstance(value, str) and value in ("./assets/logo.png", "./assets/icon.png"), f"interface.{key}: unsupported or uncontained asset path")
            raw = files[value[2:]]
            require(len(raw) >= 24 and raw[:8] == b"\x89PNG\r\n\x1a\n" and len(raw) <= 5 * 1024 * 1024,
                    f"interface.{key}: expected a PNG of at most 5 MiB")
            width, height = struct.unpack(">II", raw[16:24])
            require(width == height and (256 if key.startswith("logo") else 48) <= width <= 4096,
                    f"interface.{key}: invalid square image dimensions")

    review = overlay["review"]
    object_fields(review, {"test_cases", "prompts", "demo_recording_url", "commerce", "commerce_description"},
                  {"test_cases"}, "review")
    if "prompts" in review:
        require(isinstance(review["prompts"], list) and len(review["prompts"]) <= 20, "review.prompts: expected at most 20 prompts")
        for index, prompt in enumerate(review["prompts"]):
            text(prompt, f"review.prompts[{index}]", 4000)
    if "demo_recording_url" in review:
        https_url(review["demo_recording_url"], "review.demo_recording_url")
    if "commerce" in review:
        require(type(review["commerce"]) is bool, "review.commerce: expected a boolean")
    if "commerce_description" in review:
        text(review["commerce_description"], "review.commerce_description")
    cases = review["test_cases"]
    object_fields(cases, {"positive", "negative"}, {"positive", "negative"}, "review.test_cases")
    for kind, count in (("positive", 5), ("negative", 3)):
        group = cases[kind]
        require(isinstance(group, list) and len(group) == count, f"review.test_cases.{kind}: expected {count} cases")
        for index, case in enumerate(group):
            path = f"review.test_cases.{kind}[{index}]"
            required = {"description", "prompt"} | ({"tools_triggered", "expected_behavior"} if kind == "positive" else set())
            object_fields(case, {"description", "prompt", "tools_triggered", "expected_behavior", "file_attachment_urls", "expected_output_url"}, required, path)
            for key in ("description", "prompt", "tools_triggered", "expected_behavior"):
                if key in case:
                    text(case[key], f"{path}.{key}", 4000)
            if "file_attachment_urls" in case:
                require(isinstance(case["file_attachment_urls"], list), f"{path}.file_attachment_urls: expected an array")
                for url in case["file_attachment_urls"]:
                    https_url(url, f"{path}.file_attachment_urls")
            if "expected_output_url" in case:
                https_url(case["expected_output_url"], f"{path}.expected_output_url")

    publication = overlay["publication"]
    object_fields(publication, {"release_notes", "countries", "translations"}, {"release_notes"}, "publication")
    text(publication["release_notes"], "publication.release_notes")
    if "countries" in publication:
        string_array(publication["countries"], "publication.countries")
        require(all(re.fullmatch(r"[A-Z]{2}", item) for item in publication["countries"]), "publication.countries: expected uppercase two-letter country codes")
    if "translations" in publication and publication["translations"] is not None:
        require(isinstance(publication["translations"], dict), "publication.translations: expected an object")
        for locale, translation in publication["translations"].items():
            text(locale, "publication.translations locale", multiline=False)
            path = f"publication.translations.{locale}"
            object_fields(translation, {"subtitle", "description"}, set(), path)
            for key, maximum in (("subtitle", 30), ("description", 4000)):
                if key in translation and translation[key] is not None:
                    text(translation[key], f"{path}.{key}", maximum, multiline=key == "description")

    object_fields(mcp, {"$schema", "mcpServers"}, {"$schema", "mcpServers"}, "mcp.json")
    object_fields(mcp["mcpServers"], {"wordrava"}, {"wordrava"}, "mcpServers")
    server = mcp["mcpServers"]["wordrava"]
    object_fields(server, {"type", "url", "extensions"}, {"type", "url", "extensions"}, "mcpServers.wordrava")
    require(server["type"] == "streamable-http", "mcpServers.wordrava.type: expected streamable-http")
    require(server["url"] == "https://wordrava.shayanostovar.com/mcp", "mcpServers.wordrava.url: unexpected endpoint")
    object_fields(server["extensions"], {"com.openai"}, {"com.openai"}, "mcpServers.wordrava.extensions")
    settings = server["extensions"]["com.openai"]
    object_fields(settings, {"auth"}, {"auth"}, "mcpServers.wordrava.extensions.com.openai")
    auth = settings["auth"]
    object_fields(auth, {"type", "client", "authorizationServerBase", "resource", "baseScopes"},
                  {"type", "client", "authorizationServerBase", "resource", "baseScopes"}, "MCP auth")
    require(auth["type"] == "oauth", "MCP auth.type: expected oauth")
    client = auth["client"]
    object_fields(client, {"mode", "clientId", "tokenEndpointAuthMethod"},
                  {"mode", "clientId", "tokenEndpointAuthMethod"}, "MCP auth.client")
    require(client == {"mode": "provided", "clientId": "wordrava-chatgpt", "tokenEndpointAuthMethod": "none"},
            "MCP auth.client: must preserve the registered public WordRava client")
    for key in ("authorizationServerBase", "resource"):
        https_url(auth[key], f"MCP auth.{key}")
    require(auth["authorizationServerBase"] == "https://wordrava.shayanostovar.com" and auth["resource"] == server["url"],
            "MCP auth: issuer or protected resource changed")
    string_array(auth["baseScopes"], "MCP auth.baseScopes")
    require(auth["baseScopes"] == ["sites:read", "content:read"], "MCP auth.baseScopes: expected initial read-only scopes")
    return plugin, mcp


def validate_archive(path, expected_version=None):
    with zipfile.ZipFile(path) as archive:
        require(len(archive.namelist()) == len(PACKAGE_PATHS) and set(archive.namelist()) == set(PACKAGE_PATHS),
                "ZIP must contain exactly one portable WordRava package without duplicate or extra paths")
        require(archive.testzip() is None, "ZIP integrity check failed")
        return validate_package({name: archive.read(name) for name in PACKAGE_PATHS}, expected_version)
