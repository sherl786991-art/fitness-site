/* 离线缓存：先给缓存，再后台更新本地副本。
   这个文件由 build-sw.js 生成，改了网站文件以后重新跑一次。 */
var CACHE = "fit-2a60ae6718";
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
