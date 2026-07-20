import { defineConfig, Plugin } from "vite"
import pkg from "./package.json" with { type: "json" }

const banner = `/*!
 * easy-tooltips
 * Version  : ${pkg.version}
 * License  : MIT
 * Copyright: ${new Date().getFullYear()} Ewan Howell
 */`

const cssBannerPlugin = (banner: string): Plugin => ({
  name: "css-banner-plugin",
  enforce: "post",
  generateBundle(_, bundle) {
    for (const fileName in bundle) {
      if (fileName.endsWith(".css")) {
        const file = bundle[fileName]
        if (file.type === "asset") {
          const content = typeof file.source === "string"
            ? file.source
            : new TextDecoder().decode(file.source)
          file.source = `${banner}\n${content.replace("\n/*$vite$:1*/", "")}`
        }
      }
    }
  },
})

const demoDevPlugin = (): Plugin => ({
  name: "demo-dev-plugin",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === "/demo" || req.url?.startsWith("/demo?")) {
        res.statusCode = 302
        res.setHeader("Location", "/demo/")
        res.end()
        return
      }
      next()
    })
  },
  transformIndexHtml(html) {
    return html
      .replace(`<link href="https://cdn.jsdelivr.net/npm/easy-tooltips@latest/dist/easy-tooltips.min.css" rel="stylesheet">`, "")
      .replace(`<script src="https://cdn.jsdelivr.net/npm/easy-tooltips@latest/dist/easy-tooltips.min.js"></script>`, `<script type="module" src="/src/easy-tooltips.ts"></script>`)
  },
})

export default defineConfig({
  appType: "mpa",
  plugins: [cssBannerPlugin(banner), demoDevPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: ".",
    cssCodeSplit: false,
    lib: {
      entry: "src/easy-tooltips.ts",
      cssFileName: "easy-tooltips.min",
      fileName: "easy-tooltips",
      name: "easyTooltips",
      formats: ["cjs"],
    },
    rolldownOptions: {
      output: {
        entryFileNames: "[name].min.js",
        topLevelVar: true,
        postBanner: banner
      }
    }
  }
})
