/**
 * Service Worker — PPM判定アプリ
 * オフライン時もキャッシュから動作できるようにする
 */

const CACHE_NAME = "ppm-app-v2";

// キャッシュ対象ファイル
const CACHE_FILES = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// インストール時: 全ファイルをキャッシュ
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_FILES))
  );
  self.skipWaiting();
});

// アクティベート時: 古いキャッシュを削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// フェッチ: キャッシュ優先（Cache First）
// OpenAI API など外部リクエストはネットワーク直通
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 外部 API はキャッシュしない
  if (url.hostname !== self.location.hostname) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // 正常レスポンスのみキャッシュに追加
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, clone)
          );
        }
        return response;
      });
    })
  );
});
