import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Focus Reader",
    description: "Save pages to Focus Reader as articles or bookmarks",
    permissions: ["activeTab", "storage", "contextMenus"],
    commands: {
      "save-page": {
        suggested_key: { default: "Alt+Shift+S" },
        description: "Save the current page to Focus Reader",
      },
      "save-bookmark": {
        suggested_key: { default: "Alt+Shift+B" },
        description: "Save the current page as a bookmark",
      },
    },
  },
});
