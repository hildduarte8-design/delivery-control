function setupManifest() {
    const manifest = {
        name: "Delivery Control",
        short_name: "Delivery",
        start_url: window.location.origin + "/",
        scope: window.location.origin + "/",
        display: "standalone",
        background_color: "#0F172A",
        theme_color: "#FF6B35"
    };
    const stringManifest = JSON.stringify(manifest);
    const blob = new Blob([stringManifest], {type: 'application/json'});
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
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
}
