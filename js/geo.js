// js/geo.js - Módulo de Geolocalização e Cálculo de Frete

const GeoService = {
    // Fórmula de Haversine para cálculo de distância direta em KM
    calculateDistanceKm(lat1, lon1, lat2, lon2) {
        const nLat1 = parseFloat(lat1);
        const nLon1 = parseFloat(lon1);
        const nLat2 = parseFloat(lat2);
        const nLon2 = parseFloat(lon2);

        if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) {
            return 0;
        }

        const R = 6371; // Raio da Terra em km
        const dLat = (nLat2 - nLat1) * Math.PI / 180;
        const dLon = (nLon2 - nLon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(nLat1 * Math.PI / 180) * Math.cos(nLat2 * Math.PI / 180) * 
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return Number(distance.toFixed(2));
    },

    // Obtém localização GPS do dispositivo com alta precisão e modal de ajuda em caso de bloqueio
    getUserLocation(onSuccess, onError) {
        if (!navigator.geolocation) {
            if (onError) onError('Geolocalização não suportada neste navegador.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (onSuccess) onSuccess({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => {
                console.warn('Erro ao obter GPS:', error.message);
                this.showGPSDenyHelp(() => this.getUserLocation(onSuccess, onError));
                if (onError) onError(error);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    },

    // Exibe modal com instruções visuais de desbloqueio de GPS
    showGPSDenyHelp(onRetry) {
        let modal = document.getElementById('gps-help-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'gps-help-modal';
            modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;';
            document.body.appendChild(modal);
        }

        document.body.style.overflow = 'hidden';

        modal.innerHTML = `
            <div style="background:#1E293B; border-radius:16px; border:1px solid #334155; padding:20px; max-width:400px; width:100%; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <div style="font-size:40px; margin-bottom:10px;">📍⚠️</div>
                <h3 style="color:#F1F5F9; font-size:17px; margin-bottom:8px; font-weight:700;">Precisamos do seu GPS</h3>
                <p style="color:#94A3B8; font-size:13px; line-height:1.5; margin-bottom:14px;">
                    Parece que o acesso à localização foi bloqueado. Para calcular a taxa de entrega exata sem erros, ative a permissão:
                </p>
                <div style="background:#0F172A; border:1px solid #334155; border-radius:10px; padding:12px; text-align:left; font-size:12px; color:#CBD5E1; margin-bottom:16px; line-height:1.6;">
                    <strong>🔒 No Android (Chrome):</strong> Toque no ícone de cadeado ao lado do endereço ➔ Permissões ➔ Ative "Localização".<br><br>
                    <strong>📱 No iPhone (Safari):</strong> Toque no ícone "aA" ou cadeado ➔ Ajustes do Site ➔ Localização ➔ Permitir.
                </div>
                <div style="display:flex; gap:8px;">
                    <button id="btn-gps-cancel" style="flex:1; background:#334155; color:#fff; border:none; padding:12px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer; min-height:44px; touch-action:manipulation;">Digitar Manualmente</button>
                    <button id="btn-gps-retry" style="flex:1; background:#FF6B35; color:#fff; border:none; padding:12px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer; min-height:44px; touch-action:manipulation;">🔄 Tentar Novamente</button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';

        const closeModal = () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        const cancelBtn = document.getElementById('btn-gps-cancel');
        const retryBtn = document.getElementById('btn-gps-retry');

        if (cancelBtn) cancelBtn.onclick = closeModal;
        if (retryBtn) {
            retryBtn.onclick = () => {
                closeModal();
                if (onRetry) onRetry();
            };
        }
    }
};

window.GeoService = GeoService;
