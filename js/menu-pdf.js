// js/menu-pdf.js - Exportação do Cardápio para Impressão PDF (A4)

async function exportMenuToPDF() {
    const pdfWindow = window.open('', '_blank');
    if (!pdfWindow) {
        if (typeof showToast === 'function') showToast('Permita pop-ups no navegador para abrir o PDF', 'error');
        else alert('Permita pop-ups no navegador para abrir o PDF');
        return;
    }

    pdfWindow.document.write(`
        <html>
            <head><title>Gerando Cardápio PDF...</title></head>
            <body style="font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #0F172A; color: #F1F5F9;">
                <h2>⌛ Gerando seu Cardápio...</h2>
                <p style="color: #94A3B8;">Formatando layout e imagens.</p>
            </body>
        </html>
    `);

    try {
        if (typeof dbClient === 'undefined') {
            pdfWindow.close();
            return typeof showToast === 'function' ? showToast('Sem conexão com o banco', 'error') : alert('Sem conexão');
        }

        const { data: products, error } = await dbClient
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error || !products || products.length === 0) {
            pdfWindow.document.body.innerHTML = `
                <div style="text-align:center; padding:40px; color:#EF4444;">
                    <h3>Nenhum prato ativo encontrado no cardápio.</h3>
                    <p style="color:#94A3B8;">Ative pelo menos um item no gestor para gerar o PDF.</p>
                </div>
            `;
            return;
        }

        const settings = (typeof DB !== 'undefined' && DB.load)
            ? DB.load('dly_settings', { storeName: 'Nosso Delivery', logoUrl: '', phone: '', primaryColor: '#FF6B35' })
            : { storeName: 'Nosso Delivery', logoUrl: '', phone: '', primaryColor: '#FF6B35' };

        const primaryColor = settings.primaryColor || settings.primary_color || '#FF6B35';

        const grouped = {};
        products.forEach(p => {
            const cat = p.category || 'Geral';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(p);
        });

        let categoriesHtml = '';
        for (const [catName, items] of Object.entries(grouped)) {
            categoriesHtml += `
                <div style="margin-top: 22px; margin-bottom: 10px; page-break-inside: avoid;">
                    <div style="display: flex; align-items: center; gap: 8px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px;">
                        <span style="font-size: 15px;">📌</span>
                        <h3 style="margin: 0; color: #0F172A; font-size: 15px; font-weight: 800; text-transform: uppercase;">${catName}</h3>
                    </div>
                </div>
            `;

            items.forEach(p => {
                const discount = Number(p.discount_pct || 0);
                const originalPrice = Number(p.price);
                const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;

                const itemImg = p.image_url ? `<img src="${p.image_url}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; flex-shrink: 0; border: 1px solid #E2E8F0;">` : '';

                categoriesHtml += `
                    <div style="display: flex; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px dashed #CBD5E1; page-break-inside: avoid;">
                        ${itemImg}
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: baseline;">
                                <strong style="font-size: 14px; color: #0F172A; font-weight: 700;">${p.name}</strong>
                                <div style="text-align: right; margin-left: 10px; flex-shrink: 0;">
                                    <span style="font-size: 15px; font-weight: 800; color: ${primaryColor};">R$ ${finalPrice.toFixed(2)}</span>
                                    ${discount > 0 ? `<br><s style="color: #94A3B8; font-size: 11px;">R$ ${originalPrice.toFixed(2)}</s>` : ''}
                                </div>
                            </div>
                            ${p.description ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #64748B; line-height: 1.3;">${p.description}</p>` : ''}
                        </div>
                    </div>
                `;
            });
        }

        const logoHtml = settings.logoUrl
            ? `<img src="${settings.logoUrl}" style="max-height: 80px; max-width: 180px; object-fit: contain; margin-bottom: 8px;">`
            : '';

        const phoneFormatted = settings.phone ? `📱 WhatsApp: (${settings.phone.substring(0,2)}) ${settings.phone.substring(2)}` : '';

        pdfWindow.document.open();
        pdfWindow.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Cardápio - ${settings.storeName}</title>
                <style>
                    @page { size: A4; margin: 0; }
                    * { box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        margin: 0;
                        padding: 15mm 18mm;
                        color: #1E293B;
                        background: #FFFFFF;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .menu-header {
                        text-align: center;
                        padding-bottom: 14px;
                        border-bottom: 3px double #CBD5E1;
                        margin-bottom: 8px;
                    }
                    .menu-header h1 {
                        margin: 4px 0 2px 0;
                        font-size: 24px;
                        font-weight: 900;
                        color: #0F172A;
                        letter-spacing: 0.5px;
                    }
                    .menu-header p {
                        margin: 0;
                        color: #64748B;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .menu-footer {
                        text-align: center;
                        margin-top: 24px;
                        padding-top: 12px;
                        border-top: 2px solid #E2E8F0;
                        font-size: 12px;
                        color: #64748B;
                        font-weight: 700;
                    }
                </style>
            </head>
            <body>
                <div class="menu-header">
                    ${logoHtml}
                    <h1>${(settings.storeName || 'NOSSO DELIVERY').toUpperCase()}</h1>
                    <p>Cardápio Oficial de Pedidos ${phoneFormatted ? '• ' + phoneFormatted : ''}</p>
                </div>

                ${categoriesHtml}

                <div class="menu-footer">
                    🛵 Faça seu pedido diretamente pelo nosso WhatsApp!
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 400);
                    }
                </script>
            </body>
            </html>
        `);
        pdfWindow.document.close();

    } catch (e) {
        if (pdfWindow) pdfWindow.document.body.innerHTML = '<h3 style="color:#EF4444; text-align:center; padding-top:40px;">Erro ao gerar PDF do cardápio.</h3>';
    }
}
