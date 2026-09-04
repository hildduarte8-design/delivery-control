// sw.js - Service Worker com Suporte Offline para PWA

const CACHE_NAME = 'imperial-delivery-v2';

// Arquivos vitais para pré-cache estático
const ASSETS_TO_CACHE = [
    './',
    'index.html',
    'cardapio.html',
    'css/styles.css',
    'manifest.json',
    'js/storage.js',
    'js/calculations.js',
    'js/ui.js',
    'js/pwa.js',
    'js/stock.js',
    'js/sales.js',
    'js/expenses.js',
    'js/expenses-admin.js',
    'js/shopping-list.js',
    'js/calculator.js',
    'js/settings.js',
    'js/menu-admin.js',
    'js/menu-pdf.js',
    'js/orders.js',
    'js/customers.js',
    'js/analytics.js',
    'js/dashboard.js',
    'js/notifications.js',
    'js/app.js'
];

// Instalação: grava os arquivos essenciais no cache do navegador
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Ativação: remove caches antigos e assume controle
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estratégia de requisição: Rede primeiro com fallback para Cache
self.addEventListener('fetch', (event) => {
    // Não tenta cachear chamadas de API de banco de dados em tempo real
    if (event.request.url.includes('supabase.co')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Atualiza o cache dinamicamente em sucesso para requisições GET
                if (response && response.status === 200 && event.request.method === 'GET') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Se estiver sem internet, entrega o arquivo diretamente do cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    if (event.request.mode === 'navigate') {
                        return caches.match('index.html');
                    }
                });
            })
    );
});
