import pkg from "./package.json" with { type: "json" }
import CleanCSS from "clean-css"
import { minify } from "terser"
import fs from "node:fs"

const version = pkg.version

fs.mkdirSync("dist", { recursive: true })

const js = fs.readFileSync("src/easy-tooltips.js", "utf8")
const css = fs.readFileSync("src/easy-tooltips.css", "utf8")

const banner = `/*!
 * easy-tooltips
 * Version  : 1.0.0
 * License  : MIT
 * Copyright: 2025 Ewan Howell
 */
`

const minifiedJs = (await minify(js, {
  module: true,
  compress: true,
  mangle: {
    toplevel: true
  }
})).code

const minifiedCss = new CleanCSS().minify(css).styles

fs.writeFileSync("dist/easy-tooltips.js", banner + minifiedJs)
fs.writeFileSync("dist/easy-tooltips.css", banner + minifiedCss)

console.log("Built easy-tooltips v" + version)
