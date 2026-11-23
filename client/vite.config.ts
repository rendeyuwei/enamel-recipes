import react from "@vitejs/plugin-react";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { deriveEnglishShell } from "../shared/html.ts";
import { SITE_NAME } from "../shared/site.ts";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    return "&quot;";
  });
}

// Static <title> before hydration. SITE_NAME stays the only site-name source.
function documentTitle(): Plugin {
  const title = `${SITE_NAME} · 菜谱`;
  return {
    name: "document-title",
    transformIndexHtml(html) {
      return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
    },
  };
}

function bilingualShell(): Plugin {
  return {
    name: "bilingual-shell",
    transformIndexHtml(html) {
      const langPath = fileURLToPath(new URL("./vendor/rf-lang.js", import.meta.url));
      const lang = readFileSync(langPath, "utf8").trim();
      if (/<\/script|<script|<!--/i.test(lang)) throw new Error("rf-lang.js cannot be inlined");
      const enter = '<script data-rf-enter src="/shell/lang.js"></script>';
      if (!html.includes(enter)) throw new Error(`index.html is missing ${enter}`);
      return html.replace(enter, () => `<script data-rf-enter>${lang}</script>`);
    },
    closeBundle() {
      const indexPath = fileURLToPath(new URL("./dist/index.html", import.meta.url));
      const html = readFileSync(indexPath, "utf8");
      const english = deriveEnglishShell(html);
      if (/<script\b[^>]*\bdata-rf-enter\b/i.test(english) || !english.includes('lang="en"')) {
        throw new Error("English shell was not derived");
      }
      const enDir = fileURLToPath(new URL("./dist/en", import.meta.url));
      mkdirSync(enDir, { recursive: true });
      writeFileSync(fileURLToPath(new URL("./dist/en/index.html", import.meta.url)), english);
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/recipes/",
  plugins: [react(), documentTitle(), bilingualShell()],
  build: { outDir: "dist", emptyOutDir: true },
});
