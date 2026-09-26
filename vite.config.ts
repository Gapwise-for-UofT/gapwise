import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { lovableAssetsProxyPlugin } from "@lovable.dev/vite-tanstack-config";

/**
 * Client-only build: routing, ICS parsing, route calculation, and Supabase calls run in the
 * browser. `bun run build` emits the static `dist/` deployed by Vercel.
 */
export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json}"],
        navigateFallback: "/index.html",
        // Never let the app-shell service worker intercept crawler-facing static endpoints.
        // This also keeps direct browser navigation to these files truthful after a deployment.
        navigateFallbackDenylist: [/^\/robots\.txt$/, /^\/sitemap\.xml$/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*$/,
            handler: "NetworkOnly",
            options: {
              cacheName: "openfreemap-tiles",
            },
          },
        ],
      },
    }),
    lovableAssetsProxyPlugin(),
    {
      name: "gapwise-preview-routing",
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (!req.url) return next();
          const parsed = new URL(req.url, "http://localhost");
          const host = (req.headers.host || "").toLowerCase();
          const KNOWN_UNIVERSITIES = new Set(["uoft", "carleton", "tmu", "queens", "laurier"]);
          let uniId = "uoft";
          if (host.includes("carleton")) uniId = "carleton";
          else if (host.includes("tmu")) uniId = "tmu";
          else if (host.includes("queens")) uniId = "queens";
          else if (host.includes("laurier")) uniId = "laurier";
          else {
            const queryUni = parsed.searchParams.get("university");
            if (queryUni && KNOWN_UNIVERSITIES.has(queryUni)) {
              uniId = queryUni;
            }
          }

          if (
            parsed.pathname === "/" ||
            parsed.pathname === "" ||
            parsed.pathname === "/index.html"
          ) {
            req.url = `/_universities/${uniId}/index.html`;
          } else if (parsed.pathname === "/og-card.png" || parsed.pathname === "/og-gapwise.png") {
            req.url = `/universities/${uniId}/og-card.png`;
          } else if (
            !parsed.pathname.includes(".") &&
            !parsed.pathname.startsWith("/api") &&
            !parsed.pathname.startsWith("/v1")
          ) {
            req.url = `/_universities/${uniId}/index.html`;
          }
          next();
        });
      },
    },
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    outDir: "dist",
    manifest: true,
  },
});
