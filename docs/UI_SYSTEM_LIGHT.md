# WordRava UI contract — RasafamCRM Light Mode

The ChatGPT MCP server has no rendered dashboard; its user-facing surfaces are
tool descriptions, consent, tool responses, and the Marketplace manifest.
WordPress Connector and Center render the UI. Both use the following reviewed
RasafamCRM `wwwroot/css/site.css` light tokens:

| Token | Light value |
| --- | --- |
| `--bg` | `#f8fafc` |
| `--surface` | `#ffffff` |
| `--surface-2` | `#f1f5f9` |
| `--text` | `#0f172a` |
| `--muted` | `#64748b` |
| `--border` | `#e2e8f0` |
| `--primary` | `#111827` |
| `--primary-soft` | `#eef2ff` |
| `--shadow` | `0 18px 45px rgba(15,23,42,.08)` |
| `--radius` | `18px` |

Use Vazirmatn/Tahoma fallback with at least 15px base body text; 44px minimum
interactive touch height; responsive cards and bilingual RTL/LTR layouts.
Successful pairing uses semantic pale green `#f0fdf4` surface, `#bbf7d0`
border and `#166534` text, not a green application-wide primary.

WordPress UI CSS must be scoped to `.wr-admin` to avoid altering WordPress.
ChatGPT MCP tools do not inject CSS into the ChatGPT interface or expose
the one-time code in logs. Never claim this visual contract changes the
platform-managed ChatGPT UI, which remains controlled by OpenAI.
