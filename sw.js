/**
 * Service Worker — PPM判定アプリ
 * オフライン時もキャッシュから動作できるようにする
 */

const CACHE_NAME = "ppm-app-v12";

// キャッシュ対象ファイル（すべて必要）
const CACHE_FILES = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];
// 読み上げの録音（Gemini TTS）。無くてもアプリは端末の読み上げで動くので、取れたものだけ入れる
const AUDIO_FILES = [
  "./audio/ppm_green.mp3",
  "./audio/ppm_orange.mp3",
  "./audio/ppm_red.mp3"
];
// アプリのページ。/ppm-app/ と /ppm-app/index.html は URL が違うだけで同じページ
const APP_PAGE_URL = new URL("./index.html", self.location).href;
const APP_PAGE_PATHS = [new URL("./", self.location).pathname, new URL(APP_PAGE_URL).pathname];

// インストール時: 全ファイルをキャッシュ
self.addEventListener("install", (event) => {
  event.waitUntil(
    // HTTP キャッシュの古い版を拾わないよう、ネットワークから取り直す
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CACHE_FILES.map((u) => new Request(u, { cache: "reload" })));
      await Promise.all(AUDIO_FILES.map((u) =>
        cache.add(new Request(u, { cache: "reload" })).catch(() => {})
      ));
    })
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

  // ページを開く要求は、URL の形によらず index.html として扱う（インストール時と同じく取り直した版）。
  // /ppm-app/ を別に保存すると、HTTP キャッシュに残った古い版を取り込み、次の版まで古いままになるため
  const request = (event.request.mode === "navigate" && APP_PAGE_PATHS.includes(url.pathname))
    ? new Request(APP_PAGE_URL, { cache: "reload" })
    : event.request;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // 正常レスポンスのみキャッシュに追加
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(request, clone)
          );
        }
        return response;
      });
    })
  );
});
