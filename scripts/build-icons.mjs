import sharp from "sharp"
import { readFileSync, mkdirSync, copyFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..")
const src = resolve(root, "scripts/icon-source.svg")
const publicDir = resolve(root, "public")
const svg = readFileSync(src)

mkdirSync(publicDir, { recursive: true })

const targets = [
  { file: "icon-512x512.png", size: 512 },
  { file: "icon-192x192.png", size: 192 },
  { file: "apple-icon-180x180.png", size: 180 },
  { file: "favicon-32x32.png", size: 32 },
]

for (const { file, size } of targets) {
  await sharp(svg, { density: 600 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(resolve(publicDir, file))
  console.log(`wrote public/${file}`)
}

copyFileSync(src, resolve(publicDir, "icon.svg"))
console.log("wrote public/icon.svg")

const splashSrc = resolve(root, "scripts/splash-source.svg")
const splash = readFileSync(splashSrc)
await sharp(splash, { density: 300 })
  .resize(1206, 2622)
  .png({ compressionLevel: 9 })
  .toFile(resolve(publicDir, "splash-iphone-17pro.png"))
console.log("wrote public/splash-iphone-17pro.png")
