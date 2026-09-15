/* 离线缓存：先给缓存，再后台更新本地副本。
   这个文件由 build-sw.js 生成，改了网站文件以后重新跑一次。 */
var CACHE = "fit-01cfbc660b";
var ASSETS = [
  "./",
  "./assets/css/style.css",
  "./assets/img/arm-01.jpg",
  "./assets/img/arm-02.jpg",
  "./assets/img/arm-03.jpg",
  "./assets/img/arm-04.jpg",
  "./assets/img/arm-05.jpg",
  "./assets/img/arm-06.jpg",
  "./assets/img/icon-180.png",
  "./assets/img/icon-192.png",
  "./assets/img/icon-512.png",
  "./assets/img/leg-01.jpg",
  "./assets/img/leg-02.jpg",
  "./assets/img/leg-03.jpg",
  "./assets/img/leg-04.jpg",
  "./assets/img/leg-05.jpg",
  "./assets/img/leg-06.jpg",
  "./assets/img/leg-07.jpg",
  "./assets/img/leg-08.jpg",
  "./assets/img/leg-09.jpg",
  "./assets/img/mon-01.jpg",
  "./assets/img/mon-02.jpg",
  "./assets/img/mon-03.jpg",
  "./assets/img/mon-04.jpg",
  "./assets/img/mon-05.jpg",
  "./assets/img/mon-06.jpg",
  "./assets/img/og-cover.png",
  "./assets/img/tue-01.jpg",
  "./assets/img/tue-02.jpg",
  "./assets/img/tue-03.jpg",
  "./assets/img/tue-04.jpg",
  "./assets/img/tue-05.jpg",
  "./assets/img/tue-06.jpg",
  "./assets/img/wed-01.jpg",
  "./assets/img/wed-02.jpg",
  "./assets/img/wed-03.jpg",
  "./assets/img/wed-04.jpg",
  "./assets/img/wed-05.jpg",
  "./assets/img/wed-06.jpg",
  "./assets/js/app.js",
  "./assets/js/data/fri.js",
  "./assets/js/data/mon.js",
  "./assets/js/data/plan.js",
  "./assets/js/data/sat.js",
  "./assets/js/data/sun.js",
  "./assets/js/data/thu.js",
  "./assets/js/data/tue.js",
  "./assets/js/data/wed.js",
  "./index.html",
  "./manifest.webmanifest"
];

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
  var alwaysFresh = request.mode === "navigate" || /.(html|css|js|webmanifest)$/.test(url.pathname);
  event.respondWith(alwaysFresh ? networkFirst(request) : cacheFirst(request));
});
