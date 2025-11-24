const CACHE_NAME = 'homepage-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js'
];

// 1. 安装阶段：预缓存核心文件
self.addEventListener('install', (event) => {
    self.skipWaiting(); // 跳过等待，立即激活
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// 2. 激活阶段：清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim(); // 立即控制所有页面
});

// 3. 拦截请求：核心缓存策略
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 策略 A：对于 JSON 配置文件 -> 网络优先 (Network First)
    // 确保你修改了配置后，用户能尽快看到更新
    if (url.pathname.endsWith('.json')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    return response;
                })
                .catch(() => caches.match(event.request)) // 网络失败才用缓存
        );
        return;
    }

    // 策略 B：对于其他所有资源 (HTML/CSS/JS/图片) -> 缓存优先，后台更新 (Stale-While-Revalidate)
    // 这是速度最快的策略，兼顾了速度和更新
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // 如果网络请求成功，更新缓存
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                }
                return networkResponse;
            }).catch(() => {
                // 网络失败不做处理，反正已经有 cachedResponse 了
            });

            // 如果有缓存，直接返回缓存；否则等待网络请求
            return cachedResponse || fetchPromise;
        })
    );
});