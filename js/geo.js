// js/geo.js - Módulo de Geolocalização e Cálculo de Frete

const GeoService = {
    calculateDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return (R * c) * 1.3;
    },

    showGPSDenyHelp(onRetry) {
        let modal = document.getElementById('gps-help-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'gps-help-modal';
            modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; z-index:300; padding:20px;';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background:#1E293B; border-radius:16px; border:1px solid #334155; padding:20px; max-width:400px; width:100%; text-align:center;">
                <div style="font-size:40px; margin-bottom:10px;">📍⚠️</div>
                <h3 style="color:#F1F5F9; font-size:17px; margin-bottom:8px;">Precisamos do seu GPS</h3>
                <p style="color:#94A3B8; font-size:13px; line-height:1.5; margin-bottom:14px;">
                    Parece que o acesso à localização foi bloqueado. Para calcular o frete exato sem erros, ative a permissão:
                </p>
                <div style="background:#0F172A; border:1px solid #334155; border-radius:10px; padding:12px; text-align:left; font-size:12px; color:#CBD5E1; margin-bottom:16px; line-height:1.6;">
                    <strong>🔒 No Android (Chrome):</strong> Toque no ícone de cadeado ao lado do endereço ➔ Permissões ➔ Ative "Localização".<br><br>
                    <strong>📱 No iPhone (Safari):</strong> Toque no ícone "aA" ou cadeado ➔ Ajustes do Site ➔ Localização ➔ Permitir.
                </div>
                <div style="display:flex; gap:8px;">
                    <button onclick="document.getElementById('gps-help-modal').style.display='none'" style="flex:1; background:#334155; color:#fff; border:none; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer;">Digitar Manualmente</button>
                    <button id="btn-gps-retry" style="flex:1; background:#3B82F6; color:#fff; border:none; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer;">🔄 Tentar Novamente</button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
        document.getElementById('btn-gps-retry').onclick = () => {
            modal.style.display = 'none';
            if (onRetry) onRetry();
        };
    }
};
