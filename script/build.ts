import { build } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  await build({
    root: path.resolve(__dirname, "..", "client"),
    build: {
      outDir: path.resolve(__dirname, "..", "client", "dist"),
    },
  });
})();
