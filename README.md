# Serper Web Search provider (`@xiaolizi0v0/dsh-web-search-serper`)

A Cordis bundle that registers a Serper backend into the Harness web capability
seam (`ctx.web`), following the shape of the official
`@deepseek-ai/dsh-web-search-deepseek` provider: `name` / `inject` / `Config` /
`apply`, a provider object with `id`, a cheap `available()`, and
`search(request, signal)`. It owns only transport and mapping — the model-facing
`web_search` schema stays with `@deepseek-ai/dsh-tool-web` — and it also registers
its own `serper_search` tool (see below). The browser half is the settings form the
Plugins page renders for this bundle's row.

## Provider id and selection

- Registers under provider id **`serper`**.
- The patch does **not** pin `searchProvider`. With the profile's existing
  DeepSeek provider also registered and usable, an un-pinned search reports
  `WEB_PROVIDER_AMBIGUOUS`; to route searches to Serper, add to the profile patch:

  ```yaml
  - id: include:web
    config:
      searchProvider: serper
  ```

## Request

`POST https://google.serper.dev/search` with header `X-API-KEY` and body:

```json
{ "q": "<query>", "gl": "us", "hl": "en", "num": 10, "page": 1 }
```

`num` follows the caller's `maxResults` when that is smaller than the configured
page size. The seam enforces the final cap, so `truncated` is never set here.

## Mapping to the seam result

- `organic[]` → `sources[]` (`link` → `url`, `title`, `snippet`, `date` → `publishedAt`),
  deduped by URL.
- `answerBox.answer` / `answerBox.snippet` → the optional provider `content`.
- Redirects are refused (`redirect: "error"`), as in the official provider.

## Config (`web-search-serper`)

| Field | Default | Meaning |
|---|---|---|
| `apiKey` | — | literal key, `role: secret` (prefer the credentials service) |
| `apiKeyEnv` | `SERPER_API_KEY` | credential reference resolved per search |
| `endpoint` | `https://google.serper.dev/search` | Serper Search API endpoint (`SERPER_SEARCH_ENDPOINT` env fallback) |
| `gl` / `hl` | `us` / `en` | Serper locale parameters |
| `num` | `10` (1–100) | results per page |
| `page` | `1` | result page |
| `includeAnswerBox` | `true` | surface Serper's answer box as the provider answer |
| `tool` | `true` | register this plugin's own `serper_search` tool |
| `toolMaxResults` | `8` (1–100) | source cap the tool enforces on its own result |
| `toolTimeoutMs` | `30000` | the tool's cooperative timeout budget (`ToolDefinition.timeoutMs`) |

Settings namespace: `web-search-serper` (the row id), which is what the Plugin
Manager resolves as `props.form` for the row. The `plugins.row.config` slot key is
`@xiaolizi0v0/dsh-web-search-serper#web-search-serper` (`<package name>#<row id>`), and
`client.js` registers the form there. The official Settings → Web search page is
bound to the `web-search-deepseek` namespace, so it never shows Serper.

## The plugin's own tool (`serper_search`)

`dsh-tool-web` owns the model-facing `web_search`, and that tool goes through the
seam, so it depends on provider selection. `serper_search` calls this plugin's
provider object directly, so it works without `searchProvider` being configured:

```json
{ "query": "deepseek harness", "type": "news", "page": 2, "maxResults": 5 }
```

- `query` is required; `type` (`organic` | `news`), `page` (1–10), `maxResults`,
  `gl`, and `hl` are optional and fall back to the plugin settings.
- The tool enforces its own `toolMaxResults` cap and reports `truncated`.
- Presentation returns the `card: "web"` / `kind: "search"` view, so the Chat tool
  card matches the official web tools.
- Both paths share one `search()` implementation; the tool owns schema,
  validation, formatting, and presentation only.

## Error codes

| Situation | `WebError` code |
|---|---|
| No key resolves | `WEB_PROVIDER_CREDENTIAL_MISSING` |
| Serper rejects the key (HTTP 401/403) | `WEB_PROVIDER_CREDENTIAL_MISSING` |
| Caller cancellation | `WEB_ABORTED` |
| Transport / provider / unmappable body | `WEB_PROVIDER_ERROR` (names the endpoint) |

## Install

From the DSH 1024Store catalog (the package is published to npm as
`@xiaolizi0v0/dsh-web-search-serper`):

```powershell
dsh1024 plugin --profile web add @xiaolizi0v0/dsh-web-search-serper
# or the official command
dsh plugin --profile web add @xiaolizi0v0/dsh-web-search-serper
```

Or from this directory as a local bundle:

```powershell
# plugin_manager: action install_bundle, target <absolute path to this directory>
```

Then restart the profile if the plugin module is already loaded (replacing an
installed package needs a fresh JavaScript module generation). The browser half
needs only a renderer reload.

- [index.js](index.js) — provider, Config, `apply`, and the `serper_search` tool
- [client.js](client.js) — the settings form the Plugins page renders for this row
- [cordis.patch.yml](cordis.patch.yml) — the inserted Host row
- [package.json](package.json) — bundle manifest with display metadata, icon, and `dsh.client`
- `locale/en.json`, `locale/zh.json`, `icon.svg`

The seam request shape carries only `query` and `maxResults`; the extra fields the
tool passes (`block`, `page`, `gl`, `hl`) are provider-private extensions used on
the tool path only.
