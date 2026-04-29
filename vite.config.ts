// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// When DEPLOY_TARGET=node (used in the Docker image for VPS deploys) we
// disable the Cloudflare Workers plugin so the build emits a standard
// Node.js server bundle that can run with `node .output/server/index.mjs`.
// Default behavior (Lovable preview / publish) keeps Cloudflare enabled.
const isNodeTarget = process.env.DEPLOY_TARGET === "node";

export default defineConfig({
  cloudflare: isNodeTarget ? false : undefined,
});
