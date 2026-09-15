/* 生成 dist/：只打包真正需要上线的文件（不含预览图、脚本、说明文档） */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");
const FILES = ["index.html", "manifest.webmanifest", "sw.js"];
const DIRS = ["assets"];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
FILES.forEach(function (name) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
});
DIRS.forEach(function (name) {
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
});

let count = 0;
let bytes = 0;
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); return; }
    count += 1;
    bytes += fs.statSync(full).size;
  });
})(OUT);

console.log("dist/ 已生成：" + count + " 个文件，" + (bytes / 1048576).toFixed(2) + " MB");
