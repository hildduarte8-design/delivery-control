// js/pwa.js - Configuração Dinâmica do Manifest e Service Worker

function setupManifest() {
    const manifest = {
        name: "Pastel e Batata Imperial",
        short_name: "Imperial Delivery",
        description: "Gestão e Cardápio Digital do Pastel e Batata Imperial",
        start_url: window.location.origin + "/",
        scope: window.location.origin + "/",
        display: "standalone",
        background_color: "#0F172A",
        theme_color: "#FF6B35",
        orientation: "portrait",
        icons: [
            {
                src: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👑</text></svg>",
                sizes: "192x192 512x512",
                type: "image/svg+xml",
                purpose: "any maskable"
            }
        ]
    };

    const stringManifest = JSON.stringify(manifest);
    const blob = new Blob([stringManifest], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(blob);

    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
        link = document.createElement('link');
        link.rel = 'manifest';
        document.head.appendChild(link);
    }
    link.href = manifestURL;
}

function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker PWA registrado!'))
            .catch((err) => console.log('Erro no Service Worker:', err));
    }
}

// Captura do evento de instalação (instalação no celular)
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const welcomeBanner = document.getElementById('welcomeBanner');
    if (welcomeBanner) {
        welcomeBanner.style.display = 'block';
    }
});

// Inicialização automática ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
    setupManifest();
    setupServiceWorker();
});
