/* 生成 sw.js：把整站列进离线缓存，缓存名跟着文件内容走，改了什么就换一次缓存。
   改了网站文件以后跑一次： node build-sw.js */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const skipDirs = ["preview", "node_modules"];
const skipFiles = new Set(["build-sw.js", "sw.js", "README.md", "dev-server.py", "manifest.webmanifest"]);

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) { continue; }
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (skipDirs.indexOf(entry.name) >= 0) { continue; }
      walk(full);
      continue;
    }
    if (skipFiles.has(entry.name)) { continue; }
    if (/\.(js|css|html|png|jpg|jpeg|webp|svg|json)$/i.test(entry.name)) { files.push(rel); }
  }
})(root);
files.sort();

const fingerprint = files.map(function (rel) {
  const stat = fs.statSync(path.join(root, rel));
  return rel + ":" + stat.size + ":" + Math.round(stat.mtimeMs / 1000);
}).join("\n");

const hash = crypto.createHash("sha1").update(fingerprint).digest("hex").slice(0, 10);
const assets = ["./"].concat(files.map(function (rel) { return "./" + rel; }), ["./manifest.webmanifest"]);
const unique = Array.from(new Set(assets));

const sw = `/* 离线缓存：先给缓存，再后台更新本地副本。
   这个文件由 build-sw.js 生成，改了网站文件以后重新跑一次。 */
var CACHE = "fit-${hash}";
var ASSETS = ${JSON.stringify(unique, null, 2)};

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE ? null : caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") { return; }
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) { return; }

  event.respondWith(
    caches.match(request).then(function (cached) {
      var fresh = fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === "basic") {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () {
        return cached || caches.match("./index.html");
      });
      return cached || fresh;
    })
  );
});
`;
fs.writeFileSync(path.join(root, "sw.js"), sw, "utf8");
console.log("sw.js 已生成：cache=fit-" + hash + "，共 " + unique.length + " 个文件");