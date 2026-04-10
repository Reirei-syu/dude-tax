import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import IconFile from "../node_modules/resedit/dist/data/IconFile.js";
import RawIconItem from "../node_modules/resedit/dist/data/RawIconItem.js";

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`不支持的位置参数：${token}`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`缺少参数值：--${key}`);
    }

    args[key] = value;
    index += 1;
  }

  return {
    assetDir: path.resolve(
      args["asset-dir"] ?? path.join(process.cwd(), "apps", "desktop", "assets"),
    ),
  };
};

const { assetDir } = parseArgs(process.argv.slice(2));
const iconSizesDir = path.join(assetDir, "icon-sizes");
const outputPath = path.join(assetDir, "app-icon.ico");
const sizes = [16, 24, 32, 48, 64, 128, 256];

const iconFile = new IconFile();
iconFile.icons = await Promise.all(
  sizes.map(async (size) => {
    const pngPath = path.join(iconSizesDir, `app-icon-${size}.png`);
    const bytes = await fs.readFile(pngPath);
    return {
      width: size,
      height: size,
      colors: 0,
      planes: 1,
      bitCount: 32,
      data: RawIconItem.from(bytes, size, size, 32),
    };
  }),
);

await fs.writeFile(outputPath, Buffer.from(iconFile.generate()));
process.stdout.write(`${outputPath}\n`);
