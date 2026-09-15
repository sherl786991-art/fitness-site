/* 生成 sw.js：把整站列进离线缓存，缓存名跟着文件内容走，改了什么就换一次缓存。
   改了网站文件以后跑一次： node build-sw.js */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const skipDirs = ["preview", "node_modules", "dist"];
const skipFiles = new Set(["build-sw.js", "build-dist.js", "sw.js", "README.md", "dev-server.py", "manifest.webmanifest"]);

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

function cachePut(request, response) {
  if (response && response.status === 200 && response.type === "basic") {
    var copy = response.clone();
    return caches.open(CACHE).then(function (cache) { return cache.put(request, copy); });
  }
  return Promise.resolve();
}

function offlineResponse(isPage) {
  if (!isPage) { return Promise.resolve(new Response("", { status: 504, statusText: "offline" })); }
  return caches.match("./index.html").then(function (page) {
    if (page) { return page; }
    return new Response("离线了，而且本机没有缓存。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  });
}

/* 页面、样式、脚本：先要最新的，成功就更新缓存；断网才退回缓存 */
function networkFirst(request) {
  return fetch(request).then(function (response) {
    if (response && response.status === 200 && response.type === "basic") {
      var copy = response.clone();
      return caches.open(CACHE).then(function (cache) {
        return cache.put(request, copy);
      }).then(function () { return response; });
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      return cached || offlineResponse(request.mode === "navigate");
    });
  });
}

/* 图片等静态资源：直接用缓存，省流量也快。
   有变动时缓存名会跟着换，install 阶段会整包重新下载，所以不需要每次后台重取。 */
function cacheFirst(request) {
  return caches.match(request).then(function (cached) {
    if (cached) { return cached; }
    return fetch(request).then(function (response) {
      return cachePut(request, response).then(function () { return response; });
    }).catch(function () {
      return offlineResponse(false);
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") { return; }
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) { return; }

  /* 页面本体和样式脚本走“网络优先”，图片走“缓存优先” */
  var alwaysFresh = request.mode === "navigate" || /\.(html|css|js|webmanifest)$/.test(url.pathname);
  event.respondWith(alwaysFresh ? networkFirst(request) : cacheFirst(request));
});
`;
fs.writeFileSync(path.join(root, "sw.js"), sw, "utf8");
console.log("sw.js 已生成：cache=fit-" + hash + "，共 " + unique.length + " 个文件");
