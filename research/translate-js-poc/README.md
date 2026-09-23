# translate.js privacy research fixture

This is a **synthetic, non-production proof of concept**. Serve this directory on a local HTTP origin to inspect the behavior. Gapwise's application, production build, routes, CSP, and deployment do not load it.

## Source and license

`translate.min.js` is copied without modification from [`xnx3/translate` commit `0f0f7bcab1ba8038b049f12f5c5d72bbbb67738b`](https://github.com/xnx3/translate/commit/0f0f7bcab1ba8038b049f12f5c5d72bbbb67738b), SHA-256 `03b1196e18e4161c30ee79c198c03355a2454d461b5908efc7422954e492ad67`. The upstream MIT copyright and permission notice is preserved in [LICENSE](LICENSE). The upstream npm manifest points to a missing root `index.js` at this commit, so this fixture pins the actual browser asset rather than treating that manifest as a working browser package.

## Scope and behavior

The fixture sets English as the source language, hides the upstream selector, and supplies a native labeled selector for English, French, and Spanish. It stores the choice locally, enables one upstream DOM observer, and scans only `#public-copy`. A `notranslate` class and `code` tag exclusion protect sample identifiers. The content outside that root is invented private-style text used to verify isolation. Language switching, persistence, dynamic nodes, and service failure must be checked in a browser; the fixture is not a supported Gapwise translation feature.

The `client.edge` service posts scanned text to `https://edge.microsoft.com/translate/translatetext`. The library's other modes/configuration can contact `api.translate.zvo.cn`, `america.api.translate.zvo.cn`, other ZVO service hosts, and `res.zvo.cn`; this fixture disables its init, host-probe, and IP calls. The upstream script also has optional code paths for other hosts. Do not enter personal data into this fixture.

## Production gate

The main React app renders timetable entries, course enrollment details, account information, personalized recommendations, route state, and other private text in its DOM. Translating the whole document, or observing shared application roots, would send that content to a third party. CSS exclusions alone cannot prove that future React components, dialogs, and portal content remain outside the scanner. The application CSP permits neither the Edge translation endpoint nor ZVO API hosts. Adding them to `connect-src` would expand network access for the whole application.

The production path needs a reviewed translation provider/data-processing arrangement and a strict public-string allowlist (or curated local catalogs), with per-route and portal audits, React-safe rendering, failure handling, accessibility review, and evidence that no private text reaches any endpoint. SEO language variants would also need authored localized pages and `hreflang`; client-side DOM mutation does not provide that. Until those conditions are met, this fixture must remain disconnected from production.
