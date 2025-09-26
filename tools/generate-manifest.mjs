import { promises as fs } from "fs";
import path from "path";

const IMAGES_DIR = "assets/images";
const MANIFEST_PATH = path.join(IMAGES_DIR, "manifest.json");
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const naturalSort = (a,b)=> a.localeCompare(b, undefined, { numeric:true, sensitivity:"base" });

async function run() {
  const files = await fs.readdir(IMAGES_DIR, { withFileTypes: true });
  const images = files
    .filter(f => f.isFile())
    .map(f => f.name)
    .filter(name => ALLOWED.has(path.extname(name).toLowerCase()))
    .sort(naturalSort)
    .map(name => `${IMAGES_DIR}/${name}`);

  await fs.writeFile(MANIFEST_PATH, JSON.stringify({ images }, null, 2), "utf8");
  console.log(`✅ Skrev ${images.length} bilder till ${MANIFEST_PATH}`);
}

run().catch(err => { console.error(err); process.exit(1); });
