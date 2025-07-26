import CleanCSS from "clean-css"
import { minify } from "terser"
import fs from "node:fs"

const version = "1.2.2"

fs.mkdirSync("dist", { recursive: true })

const js = fs.readFileSync("src/easy-tooltips.js", "utf8")
const css = fs.readFileSync("src/easy-tooltips.css", "utf8")

const banner = `/*!
 * easy-tooltips
 * Version  : ${version}
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

fs.writeFileSync("dist/easy-tooltips.min.js", banner + minifiedJs)
fs.writeFileSync("dist/easy-tooltips.min.css", banner + minifiedCss)

console.log("Built easy-tooltips v" + version)
