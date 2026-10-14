import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
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

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/recipes/",
  plugins: [react(), documentTitle()],
  build: { outDir: "dist", emptyOutDir: true },
});
