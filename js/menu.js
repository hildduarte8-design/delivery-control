// js/menu.js - Lógica Dinâmica com Categorias, Descontos, Cross-Sell, Lupa/Lightbox e GPS

const MenuApp = {
    orderType: 'delivery',
    currentDeliveryFee: 0,
    BASE_FEE: 4.00,
    PRICE_PER_KM: 1.50,
    products: {},
    rawProductsList: [],
    selectedCategory: 'all',

    async init() {
        await this.loadStoreSettings();
        await this.loadProductsFromDatabase();
    },

    async loadStoreSettings() {
        try {
            if (typeof dbClient === 'undefined') return;
            const { data } = await dbClient.from('store_settings').select('*').single();
            if (data) {
                if (data.primary_color) {
                    document.documentElement.style.setProperty('--primary-color', data.primary_color);
                }
                const titleEl = document.getElementById('store-title');
                if (titleEl && data.store_name) {
                    titleEl.textContent = data.store_name;
                }
            }
        } catch (e) {
            console.error('Erro ao carregar loja:', e);
        }
    },

    async loadProductsFromDatabase() {
        const container = document.getElementById('products-container');
        if (!container) return;

        try {
            if (typeof dbClient === 'undefined') return;

            const { data: items, error } = await dbClient
                .from('products')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (error || !items || items.length === 0) {
                container.innerHTML = '<div style="text-align:center; color:#94A3B8; padding:30px;">Nenhum item disponível no momento.</div>';
                return;
            }

            this.rawProductsList = items;
            
            items.forEach(p => {
                const discount = Number(p.discount_pct || 0);
                const originalPrice = Number(p.price);
                const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;
                const prevQty = this.products[p.id]?.qty || 0;

                this.products[p.id] = { 
                    name: p.name, 
                    price: finalPrice, 
                    isCrossSell: p.is_cross_sell,
                    category: p.category || 'Geral',
                    qty: prevQty 
                };
            });

            this.renderCategoriesBar();
            this.renderProductsList();

        } catch (e) {
            container.innerHTML = '<div style="text-align:center; color:#EF4444; padding:30px;">Erro ao carregar cardápio.</div>';
        }
    },

    renderCategoriesBar() {
        const categoryBar = document.getElementById('category-bar');
        if (!categoryBar) return;

        const categories = ['all', ...new Set(this.rawProductsList.map(p => p.category || 'Geral'))];

        categoryBar.innerHTML = categories.map(cat => {
            const label = cat === 'all' ? 'Todos' : cat;
            const activeClass = this.selectedCategory === cat ? 'active' : '';
            return `<button class="category-chip ${activeClass}" onclick="MenuApp.filterCategory('${cat}')">${label}</button>`;
        }).join('');
    },

    filterCategory(cat) {
        this.selectedCategory = cat;
        this.renderCategoriesBar();
        this.renderProductsList();
    },

    renderProductsList() {
        const container = document.getElementById('products-container');
        if (!container) return;

        const filteredItems = this.selectedCategory === 'all' 
            ? this.rawProductsList 
            : this.rawProductsList.filter(p => (p.category || 'Geral') === this.selectedCategory);

        if (filteredItems.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94A3B8; padding:30px;">Nenhum item nesta categoria.</div>';
            return;
        }

        const grouped = {};
        filteredItems.forEach(p => {
            const cat = p.category || 'Geral';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(p);
        });

        let html = '';
        for (const [catName, products] of Object.entries(grouped)) {
            html += `<div class="section-title" style="margin-top:16px;">📌 ${catName}</div>`;
            
            products.forEach(p => {
                const discount = Number(p.discount_pct || 0);
                const originalPrice = Number(p.price);
                const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;
                const qty = this.products[p.id]?.qty || 0;

                let priceHtml = `<div class="product-price">R$ ${finalPrice.toFixed(2)}</div>`;
                if (discount > 0) {
                    priceHtml = `
                        <div class="price-tag-container">
                            <div class="product-price">R$ ${finalPrice.toFixed(2)}</div>
                            <div class="old-price">R$ ${originalPrice.toFixed(2)}</div>
                            <div class="discount-badge">${discount}% OFF</div>
                        </div>
                    `;
                }

                const imgHtml = p.image_url ? `
                    <div class="img-zoom-wrapper" onclick="MenuApp.openLightbox('${p.image_url}', '${p.name.replace(/'/g, "\\'")}')" title="Toque para ampliar">
                        <img src="${p.image_url}" style="width:60px; height:60px; border-radius:10px; object-fit:cover;">
                        <span class="img-zoom-badge">🔍</span>
                    </div>
                ` : '<span style="font-size:32px;">🍽️</span>';

                html += `
                    <div class="product-card">
                        <div style="display:flex; align-items:center; gap:12px; flex:1;">
                            ${imgHtml}
                            <div class="product-info">
                                <h4>${p.name}</h4>
                                <p>${p.description || ''}</p>
                                ${priceHtml}
                            </div>
                        </div>
                        <div class="qty-controls">
                            <button class="qty-btn" onclick="MenuApp.updateQty('${p.id}', -1)">-</button>
                            <span class="qty-value" id="qty-${p.id}">${qty}</span>
                            <button class="qty-btn" onclick="MenuApp.updateQty('${p.id}', 1)">+</button>
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = html;
    },

    openLightbox(imageUrl, title) {
        if (!imageUrl) return;
        const modal = document.getElementById('image-lightbox');
        const img = document.getElementById('lightbox-img');
        const caption = document.getElementById('lightbox-caption');

        if (modal && img) {
            img.src = imageUrl;
            if (caption) caption.textContent = title || '';
            modal.style.display = 'flex';
        }
    },

    closeLightbox() {
        const modal = document.getElementById('image-lightbox');
        if (modal) modal.style.display = 'none';
    },

    getStoreCoordinates() {
        const settings = JSON.parse(localStorage.getItem('dly_settings')) || {};
        return {
            lat: settings.storeLat ? parseFloat(settings.storeLat) : -17.8575,
            lon: settings.storeLon ? parseFloat(settings.storeLon) : -41.5053,
            phone: settings.phone ? settings.phone.replace(/\D/g, '') : '',
            storeName: settings.storeName || 'Delivery'
        };
    },

    updateQty(id, delta) {
        if (this.products[id] && this.products[id].qty + delta >= 0) {
            this.products[id].qty += delta;
            const el = document.getElementById(`qty-${id}`);
            if (el) el.textContent = this.products[id].qty;
            this.calculateTotals();
        }
    },

    getTotalItemsCount() {
        return Object.values(this.products).reduce((acc, p) => acc + p.qty, 0);
    },

    getSubtotal() {
        return Object.values(this.products).reduce((acc, p) => acc + (p.price * p.qty), 0);
    },

    calculateTotals() {
        const count = this.getTotalItemsCount();
        const subtotal = this.getSubtotal();
        const freight = this.orderType === 'delivery' ? this.currentDeliveryFee : 0;
        const totalFinal = subtotal + freight;

        const subtotalFormatted = subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const freightFormatted = freight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const totalFormatted = totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const bar = document.getElementById('cart-floating-bar');
        
        if (count > 0) {
            bar.style.display = 'flex';
            document.getElementById('float-qty-label').textContent = `${count} ${count === 1 ? 'item selecionado' : 'itens selecionados'}`;
            document.getElementById('float-total-val').textContent = subtotalFormatted;
            
            document.getElementById('modal-subtotal-val').textContent = subtotalFormatted;
            document.getElementById('modal-freight-val').textContent = freightFormatted;
            document.getElementById('modal-total-val').textContent = totalFormatted;

            const freightRow = document.getElementById('modal-freight-row');
            if (freightRow) freightRow.style.display = this.orderType === 'delivery' ? 'flex' : 'none';
        } else {
            bar.style.display = 'none';
            this.closeCheckoutModal();
        }
    },

    renderCrossSellOffers() {
        const section = document.getElementById('cross-sell-section');
        const listContainer = document.getElementById('cross-sell-items-list');
        if (!section || !listContainer) return;

        const crossSellItems = this.rawProductsList.filter(p => p.is_cross_sell && this.products[p.id]?.qty === 0);

        if (crossSellItems.length === 0) {
            section.style.display = 'none';
            return;
        }

        listContainer.innerHTML = crossSellItems.map(p => {
            const price = this.products[p.id].price;
            return `
                <div class="cross-item-card">
                    <div class="cross-item-name">${p.name}</div>
                    <div class="cross-item-price">R$ ${price.toFixed(2)}</div>
                    <button class="btn btn-sm" onclick="MenuApp.updateQty('${p.id}', 1); MenuApp.renderCrossSellOffers();" style="font-size:11px; padding:4px 8px; width:100%;">
                        + Adicionar
                    </button>
                </div>
            `;
        }).join('');

        section.style.display = 'block';
    },

    openCheckoutModal() {
        if (this.getSubtotal() === 0) return;
        this.renderCrossSellOffers();
        document.getElementById('checkout-modal').style.display = 'flex';
    },

    closeCheckoutModal() {
        document.getElementById('checkout-modal').style.display = 'none';
    },

    setOrderType(type) {
        this.orderType = type;
        const buttons = document.querySelectorAll('#orderTypeToggle button');
        buttons[0].classList.toggle('active', type === 'delivery');
        buttons[1].classList.toggle('active', type === 'pickup');

        const deliveryGroup = document.getElementById('delivery-address-group');
        if (type === 'pickup') {
            deliveryGroup.style.display = 'none';
            this.currentDeliveryFee = 0;
        } else {
            deliveryGroup.style.display = 'block';
        }
        this.calculateTotals();
    },

    getGPSLocation() {
        if (!navigator.geolocation) {
            alert("Seu navegador não suporta GPS. Digite o endereço manualmente.");
            return;
        }

        const btn = document.getElementById('btn-gps');
        btn.textContent = "⌛ Obtendo localização do GPS...";
        btn.disabled = true;

        const storeCoords = this.getStoreCoordinates();

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                const km = GeoService.calculateDistanceKm(storeCoords.lat, storeCoords.lon, lat, lon);
                let fee = this.BASE_FEE;
                if (km > 0.3) fee = Math.ceil(this.BASE_FEE + (km * this.PRICE_PER_KM));

                this.currentDeliveryFee = fee;

                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                    const data = await res.json();
                    const street = data.address.road || data.address.suburb || "Endereço via GPS";
                    
                    document.getElementById('cli-address').value = `${street} (📍 ~${km.toFixed(1)} km - Frete: R$ ${fee.toFixed(2)})`;
                    btn.textContent = "✅ Localização Capturada!";
                } catch (e) {
                    document.getElementById('cli-address').value = `📍 GPS (~${km.toFixed(1)} km - Frete: R$ ${fee.toFixed(2)})`;
                    btn.textContent = "✅ Localização Capturada!";
                }
                btn.disabled = false;
                this.calculateTotals();
            },
            (error) => {
                btn.disabled = false;
                btn.textContent = "📍 Usar Minha Localização Atual (GPS)";

                if (error.code === error.PERMISSION_DENIED) {
                    GeoService.showGPSDenyHelp(() => this.getGPSLocation());
                } else {
                    alert("Sinal de GPS fraco ou indisponível. Tente novamente ou digite o endereço.");
                }
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    },

async sendWhatsApp() {
    const name = document.getElementById('cli-name').value.trim() || 'Não informado';
    const address = document.getElementById('cli-address').value.trim() || 'A combinar';
    const number = document.getElementById('cli-number')?.value.trim() || '';
    const reference = document.getElementById('cli-reference')?.value.trim() || '';
    const subtotal = this.getSubtotal();

    if (subtotal === 0) return alert('Adicione pelo menos 1 item ao pedido!');

    if (this.orderType === 'delivery') {
        if (!address || address === 'A combinar') return alert('Por favor, informe seu endereço ou use o GPS!');
        if (!number) return alert('Por favor, digite o NÚMERO da sua casa!');
    }

    const storeCoords = this.getStoreCoordinates();
    let storePhone = storeCoords.phone;
    if (storePhone && !storePhone.startsWith('55')) storePhone = '55' + storePhone;
    if (!storePhone) storePhone = '5533999999999';

    // Organiza os itens em formato de array para o banco de dados
    const orderItems = [];
    let itemsFormatted = '';

    Object.keys(this.products).forEach(id => {
        const p = this.products[id];
        if (p.qty > 0) {
            orderItems.push({ id, name: p.name, qty: p.qty, unit_price: p.price, total: p.price * p.qty });
            itemsFormatted += `• *${p.qty}x ${p.name}* — R$ ${(p.price * p.qty).toFixed(2)}\n`;
        }
    });

    const freight = this.orderType === 'delivery' ? this.currentDeliveryFee : 0;
    const totalFinal = subtotal + freight;

    // GRAVA O PEDIDO NO SUPABASE EM TEMPO REAL
    try {
        if (typeof dbClient !== 'undefined') {
            await dbClient.from('orders').insert([{
                client_name: name,
                order_type: this.orderType,
                address: address,
                number: number,
                reference: reference,
                items: orderItems,
                subtotal: subtotal,
                delivery_fee: freight,
                total: totalFinal,
                status: 'pending'
            }]);
        }
    } catch (e) {
        console.error('Erro ao salvar pedido no banco:', e);
    }

    const typeLabel = this.orderType === 'delivery' ? '🛵 *Entrega*' : '🏪 *Retirada no Balcão*';
    
    let totalsSection = '';
    if (this.orderType === 'delivery') {
        const freteTxt = this.currentDeliveryFee > 0 ? `R$ ${this.currentDeliveryFee.toFixed(2)}` : 'A combinar';
        totalsSection = `💵 *SUBTOTAL:* R$ ${subtotal.toFixed(2)}\n` +
                        `🛵 *FRETE:* ${freteTxt}\n` +
                        `💰 *TOTAL FINAL:* R$ ${totalFinal.toFixed(2)}`;
    } else {
        totalsSection = `💵 *SUBTOTAL:* R$ ${subtotal.toFixed(2)}\n` +
                        `🏪 *FRETE:* R$ 0.00 (Retirada)\n` +
                        `💰 *TOTAL FINAL:* R$ ${subtotal.toFixed(2)}`;
    }

    const msg = `🛍️ *NOVO PEDIDO - ${storeCoords.storeName.toUpperCase()}*\n` +
                `═══════════════════════\n\n` +
                `📍 *TIPO:* ${typeLabel}\n` +
                `👤 *CLIENTE:* ${name}\n` +
                `🏠 *ENDEREÇO:* ${address}\n` +
                `🔢 *NÚMERO:* ${number || 'S/N'}\n` +
                `🎯 *REFERÊNCIA:* ${reference || 'Não informada'}\n\n` +
                `📋 *ITENS DO PEDIDO:*\n${itemsFormatted}\n` +
                `═══════════════════════\n` +
                `${totalsSection}\n\n` +
                `✨ _Obrigado pela preferência! Aguardo a confirmação._`;

    window.open(`https://api.whatsapp.com/send?phone=${storePhone}&text=${encodeURIComponent(msg)}`, '_blank');
},

    printReceipt() {
        const subtotal = this.getSubtotal();
        if (subtotal === 0) return alert('Selecione itens antes de imprimir!');

        const storeCoords = this.getStoreCoordinates();
        document.getElementById('rec-store-name').textContent = storeCoords.storeName.toUpperCase();
        document.getElementById('rec-date').textContent = new Date().toLocaleString('pt-BR');
        document.getElementById('rec-name').textContent = document.getElementById('cli-name').value || 'Não informado';
        
        if (this.orderType === 'delivery') {
            document.getElementById('rec-address').textContent = document.getElementById('cli-address').value || 'A combinar';
            document.getElementById('rec-number').textContent = document.getElementById('cli-number').value || 'S/N';
            document.getElementById('rec-reference').textContent = document.getElementById('cli-reference').value || 'Não informada';
        } else {
            document.getElementById('rec-address').textContent = 'Retirada no Balcão';
            document.getElementById('rec-number').textContent = '-';
            document.getElementById('rec-reference').textContent = '-';
        }

        let itemsHtml = '';
        Object.values(this.products).forEach(p => {
            if (p.qty > 0) itemsHtml += `<p>${p.qty}x ${p.name} - R$ ${(p.price * p.qty).toFixed(2)}</p>`;
        });
        document.getElementById('rec-items').innerHTML = itemsHtml;

        const freightArea = document.getElementById('rec-freight-area');
        const totalFinal = subtotal + (this.orderType === 'delivery' ? this.currentDeliveryFee : 0);

        if (this.orderType === 'pickup') {
            freightArea.innerHTML = `
                <p><strong>Frete:</strong> R$ 0,00 (Retirada)</p>
                <p style="font-size: 16px; margin-top: 8px;"><strong>TOTAL: R$ ${subtotal.toFixed(2)}</strong></p>
            `;
        } else {
            freightArea.innerHTML = `
                <p><strong>Subtotal:</strong> R$ ${subtotal.toFixed(2)}</p>
                <p><strong>Frete (GPS):</strong> R$ ${this.currentDeliveryFee.toFixed(2)}</p>
                <p style="font-size: 16px; margin-top: 8px;"><strong>TOTAL: R$ ${totalFinal.toFixed(2)}</strong></p>
            `;
        }

        const receiptEl = document.getElementById('printable-receipt');
        receiptEl.style.display = 'block';
        window.print();
        receiptEl.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    MenuApp.init();
});
