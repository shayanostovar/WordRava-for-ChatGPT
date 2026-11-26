#!/usr/bin/env python3
"""Build inert, reproducible ZIPs used only on a disposable reviewer site."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
version = json.loads((root / "package.json").read_text())["version"]
destination = root / "review" / "fixtures"
destination.mkdir(parents=True, exist_ok=True)
packages = {
    "plugin": {
        "wordrava-review-plugin.php": f"""<?php
/**
 * Plugin Name: WordRava Review Plugin
 * Description: Inert fixture for testing WordRava ZIP inspection and inactive installation on a disposable review site.
 * Version: {version}
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Author: ShayanOstovar
 * License: GPL-2.0-or-later
 */
if (!defined('ABSPATH')) {{ exit; }}
// Intentionally no hooks, network calls, data writes or activation behavior.
""",
    },
    "theme": {
        "style.css": f"""/*
Theme Name: WordRava Review Theme
Description: Inactive installation fixture for a disposable WordRava review site.
Version: {version}
Requires at least: 6.5
Requires PHP: 8.1
Author: ShayanOstovar
License: GPL-2.0-or-later
Text Domain: wordrava-review-theme
*/
body {{ font-family: system-ui, sans-serif; margin: 3rem; }}
""",
        "index.php": """<?php if (!defined('ABSPATH')) { exit; } ?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head><meta charset="<?php bloginfo('charset'); ?>"><?php wp_head(); ?></head>
<body <?php body_class(); ?>><?php wp_body_open(); ?>
<h1><?php echo esc_html(get_bloginfo('name')); ?></h1>
<p>WordRava review fixture. Use only on a disposable review site.</p>
<?php wp_footer(); ?></body></html>
""",
    },
}
for package_type, files in packages.items():
    slug = f"wordrava-review-{package_type}"
    path = destination / f"{slug}-{version}.zip"
    with ZipFile(path, "w", ZIP_DEFLATED) as archive:
        for name, content in sorted(files.items()):
            entry = ZipInfo(f"{slug}/{name}", date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, content.encode())
    with ZipFile(path) as archive:
        assert archive.testzip() is None
    print(f"{path.relative_to(root)}  SHA-256 {hashlib.sha256(path.read_bytes()).hexdigest()}")
