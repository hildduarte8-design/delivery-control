// js/menu.js - Lógica Completa do Cardápio Digital (Frete a Combinar / Manual)

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text ?? '')));
    return div.innerHTML;
}

const MenuApp = {
    orderType: 'delivery',
    currentDeliveryFee: 0,
    products: {},
    rawProductsList: [],
    selectedCategory: 'all',
    storeData: {},

    async init() {
        await this.loadStoreSettings();
        await this.loadProductsFromDatabase();
    },

    async loadStoreSettings() {
        try {
            if (typeof dbClient === 'undefined') return;
            const { data } = await dbClient.from('store_settings').select('*').single();
            if (data) {
                this.storeData = data;

                if (data.primary_color) {
                    document.documentElement.style.setProperty('--primary-color', data.primary_color);
                }
                const titleEl = document.getElementById('store-title');
                if (titleEl && data.store_name) {
                    titleEl.textContent = data.store_name;
                }

                const settings = {
                    storeName: data.store_name,
                    phone: data.phone,
                    storeLat: data.store_lat,
                    storeLon: data.store_lon,
                    primaryColor: data.primary_color,
                    pixKey: data.pix_key || ''
                };
                localStorage.setItem('dly_settings', JSON.stringify(settings));
            }
        } catch (e) {
            console.error('Erro ao carregar configurações:', e);
        }
    },

    async loadProductsFromDatabase() {
        const container = document.getElementById('products-container');
        if (!container) return;

        try {
            if (typeof dbClient === 'undefined') {
                container.innerHTML = '<div style="text-align:center; color:#EF4444; padding:30px;">⚠️ Erro: Conexão dbClient não encontrada.</div>';
                return;
            }

            const { data: items, error } = await dbClient
                .from('products')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) {
                container.innerHTML = `<div style="text-align:center; color:#EF4444; padding:30px;">⚠️ Erro ao buscar produtos: ${escapeHtml(error.message)}</div>`;
                return;
            }

            if (!items || items.length === 0) {
                container.innerHTML = '<div style="text-align:center; color:#94A3B8; padding:30px;">Nenhum produto disponível no momento.</div>';
                return;
            }

            this.rawProductsList = items;
            
            items.forEach(p => {
                const discount = Number(p.discount_pct || 0);
                const originalPrice = Number(p.price);
                const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;
                const prevQty = this.products[p.id]?.qty || 0;

                let complements = [];
                if (Array.isArray(p.complements)) complements = p.complements;
                else if (typeof p.complements === 'string') {
                    try { complements = JSON.parse(p.complements); } catch (e) {}
                }

                this.products[p.id] = { 
                    name: p.name, 
                    price: finalPrice, 
                    originalPrice: originalPrice,
                    discountPct: discount,
                    isCrossSell: p.is_cross_sell,
                    category: p.category || 'Geral',
                    complements: complements,
                    selectedComplements: this.products[p.id]?.selectedComplements || [],
                    qty: prevQty 
                };
            });

            this.renderCategoriesBar();
            this.renderProductsList();

        } catch (e) {
            container.innerHTML = `<div style="text-align:center; color:#EF4444; padding:30px;">⚠️ Falha ao carregar cardápio: ${escapeHtml(e.message)}</div>`;
        }
    },

    renderCategoriesBar() {
        const categoryBar = document.getElementById('category-bar');
        if (!categoryBar) return;

        const categories = ['all', ...new Set(this.rawProductsList.map(p => p.category || 'Geral'))];

        categoryBar.innerHTML = categories.map(cat => {
            const label = cat === 'all' ? 'Todos' : escapeHtml(cat);
            const activeClass = this.selectedCategory === cat ? 'active' : '';
            return `<button class="category-chip ${activeClass}" onclick="MenuApp.filterCategory('${escapeHtml(cat)}')">${label}</button>`;
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
            html += `<div style="font-size:14px; font-weight:800; color:#F59E0B; margin:18px 0 10px 0; text-transform:uppercase; letter-spacing:0.5px;">📌 ${escapeHtml(catName)}</div>`;
            
            products.forEach(p => {
                const discount = Number(p.discount_pct || 0);
                const originalPrice = Number(p.price);
                const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;
                const qty = this.products[p.id]?.qty || 0;

                let priceHtml = `<span class="price-normal">R$ ${finalPrice.toFixed(2).replace('.', ',')}</span>`;
                if (discount > 0) {
                    priceHtml = `
                        <span style="font-size:11px; color:#94A3B8;">De </span>
                        <span class="price-old">R$ ${originalPrice.toFixed(2).replace('.', ',')}</span>
                        <span style="font-size:11px; color:#94A3B8;"> por </span>
                        <span class="price-discount">R$ ${finalPrice.toFixed(2).replace('.', ',')}</span>
                    `;
                }

                const safeName = escapeHtml(p.name);
                const safeDesc = escapeHtml(p.description || 'Sem descrição.');
                const safeImg = escapeHtml(p.image_url || '');

                const imgHtml = p.image_url ? `
                    <div class="menu-product-img-box" onclick="MenuApp.openLightbox('${safeImg}', '${safeName}')">
                        <img src="${safeImg}" class="menu-product-img" alt="${safeName}">
                        ${discount > 0 ? '<div class="promo-badge">%</div>' : ''}
                    </div>
                ` : `
                    <div class="menu-product-img-box" style="background:#0F172A; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:32px;">
                        🍽️
                    </div>
                `;

                const hasComplements = Array.isArray(p.complements) && p.complements.length > 0;
                let actionBtnHtml = '';

                if (hasComplements) {
                    actionBtnHtml = `
                        <button onclick="MenuApp.openComplementsModal('${escapeHtml(p.id)}')" style="background:#3B82F6; color:#fff; border:none; padding:10px 12px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer; min-height:44px; touch-action:manipulation;">
                            + Opções ${qty > 0 ? `(${qty})` : ''}
                        </button>
                    `;
                } else {
                    actionBtnHtml = `
                        <div style="display:flex; align-items:center; gap:6px; background:#0F172A; padding:4px; border-radius:8px; border:1px solid #334155;">
                            <button onclick="MenuApp.updateQty('${escapeHtml(p.id)}', -1)" style="width:44px; height:44px; min-width:44px; min-height:44px; background:#1E293B; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size:18px; cursor:pointer; touch-action:manipulation;">-</button>
                            <span id="qty-${escapeHtml(p.id)}" style="font-size:14px; font-weight:bold; color:#F1F5F9; min-width:20px; text-align:center;">${qty}</span>
                            <button onclick="MenuApp.updateQty('${escapeHtml(p.id)}', 1)" style="width:44px; height:44px; min-width:44px; min-height:44px; background:#FF6B35; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size:18px; cursor:pointer; touch-action:manipulation;">+</button>
                        </div>
                    `;
                }

                html += `
                    <div class="menu-product-card">
                        ${imgHtml}
                        <div class="menu-product-details">
                            <div class="menu-product-title">${safeName}</div>
                            <div class="menu-product-desc">${safeDesc}</div>
                            <div class="menu-product-price">${priceHtml}</div>
                        </div>
                        <div style="margin-left:8px;">
                            ${actionBtnHtml}
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = html;
    },

    openComplementsModal(productId) {
        const p = this.products[productId];
        if (!p || !Array.isArray(p.complements)) return;

        let compsHtml = p.complements.map((c) => `
            <label style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#0F172A; border-radius:8px; border:1px solid #334155; margin-bottom:8px; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" class="comp-checkbox" data-name="${escapeHtml(c.name)}" data-price="${c.price}" style="width:20px; height:20px;">
                    <span style="font-size:13px; color:#F1F5F9;">${escapeHtml(c.name)}</span>
                </div>
                <strong style="color:#10B981; font-size:13px;">+ R$ ${Number(c.price).toFixed(2)}</strong>
            </label>
        `).join('');

        const modalBody = `
            <div style="margin-bottom:12px;">
                <h3 style="color:#F1F5F9; font-size:16px; margin-bottom:4px;">${escapeHtml(p.name)}</h3>
                <p style="color:#94A3B8; font-size:12px;">Escolha os adicionais desejados:</p>
            </div>
            <div id="modal_complements_list">${compsHtml}</div>
            <button onclick="MenuApp.saveComplementsSelection('${escapeHtml(productId)}')" style="background:#FF6B35; color:#fff; width:100%; padding:14px; border:none; border-radius:8px; font-weight:bold; margin-top:10px; cursor:pointer; font-size:14px; min-height:44px; touch-action:manipulation;">
                🛒 Adicionar ao Pedido
            </button>
        `;

        const overlay = document.getElementById('checkout-modal');
        if (overlay) {
            let compContainer = document.getElementById('complements-modal-box');
            if (!compContainer) {
                compContainer = document.createElement('div');
                compContainer.id = 'complements-modal-box';
                compContainer.className = 'modal-overlay';
                compContainer.style.zIndex = '99999';
                document.body.appendChild(compContainer);
            }
            compContainer.innerHTML = `
                <div class="modal-body" style="background:#1E293B; border:1px solid #334155; padding:16px; border-radius:12px; max-width:380px; width:100%;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <strong style="color:#FF6B35;">Opcionais do Prato</strong>
                        <button onclick="document.getElementById('complements-modal-box').style.display='none'" style="background:none; border:none; color:#94A3B8; font-size:22px; cursor:pointer; padding:4px;">✕</button>
                    </div>
                    ${modalBody}
                </div>
            `;
            compContainer.style.display = 'flex';
        }
    },

    saveComplementsSelection(productId) {
        const checkboxes = document.querySelectorAll('#modal_complements_list .comp-checkbox:checked');
        const selected = [];

        checkboxes.forEach(cb => {
            const name = cb.dataset.name;
            const price = parseFloat(cb.dataset.price) || 0;
            selected.push({ name, price });
        });

        if (this.products[productId]) {
            this.products[productId].qty += 1;
            this.products[productId].selectedComplements = selected;
        }

        const box = document.getElementById('complements-modal-box');
        if (box) box.style.display = 'none';

        this.calculateTotals();
        this.renderProductsList();
    },

    openLightbox(imageUrl, title) {
        if (!imageUrl) return;
        let modal = document.getElementById('image-lightbox');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'image-lightbox';
            modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:999999; display:none; flex-direction:column; align-items:center; justify-content:center; padding:20px;';
            modal.innerHTML = `
                <button onclick="MenuApp.closeLightbox()" style="position:absolute; top:20px; right:20px; background:none; border:none; color:#fff; font-size:30px; cursor:pointer;">✕</button>
                <img id="lightbox-img" style="max-width:90%; max-height:80vh; border-radius:12px; object-fit:contain;">
                <div id="lightbox-caption" style="color:#fff; font-size:16px; font-weight:bold; margin-top:12px;"></div>
            `;
            document.body.appendChild(modal);
        }
        const img = document.getElementById('lightbox-img');
        const caption = document.getElementById('lightbox-caption');
        if (img) img.src = imageUrl;
        if (caption) caption.textContent = title || '';
        modal.style.display = 'flex';
    },

    closeLightbox() {
        const modal = document.getElementById('image-lightbox');
        if (modal) modal.style.display = 'none';
    },

    getStoreCoordinates() {
        const localSettings = JSON.parse(localStorage.getItem('dly_settings') || '{}');
        const phoneVal = this.storeData.phone || localSettings.phone || '';
        const nameVal = this.storeData.store_name || localSettings.storeName || 'Delivery Control';

        return {
            lat: this.storeData.store_lat || localSettings.storeLat || -17.8575,
            lon: this.storeData.store_lon || localSettings.storeLon || -41.5053,
            phone: phoneVal.toString().replace(/\D/g, ''),
            storeName: nameVal
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
        return Object.values(this.products).reduce((acc, p) => {
            let itemPrice = p.price;
            if (Array.isArray(p.selectedComplements)) {
                itemPrice += p.selectedComplements.reduce((cAcc, c) => cAcc + Number(c.price || 0), 0);
            }
            return acc + (itemPrice * p.qty);
        }, 0);
    },

    calculateTotals() {
        const count = this.getTotalItemsCount();
        const subtotal = this.getSubtotal();
        const freight = this.orderType === 'delivery' ? this.currentDeliveryFee : 0;
        const totalFinal = subtotal + freight;

        const subtotalFormatted = subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const freightFormatted = freight > 0 
            ? freight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : 'A combinar';
            
        const totalFormatted = freight > 0
            ? totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : subtotalFormatted;

        const bar = document.getElementById('cart-floating-bar');
        
        if (count > 0) {
            if (bar) bar.style.display = 'flex';
            const qtyLbl = document.getElementById('float-qty-label');
            const totalLbl = document.getElementById('float-total-val');
            if (qtyLbl) qtyLbl.textContent = `${count} ${count === 1 ? 'item selecionado' : 'itens selecionados'}`;
            if (totalLbl) totalLbl.textContent = subtotalFormatted;
            
            const subModal = document.getElementById('modal-subtotal-val');
            const freModal = document.getElementById('modal-freight-val');
            const totModal = document.getElementById('modal-total-val');
            if (subModal) subModal.textContent = subtotalFormatted;
            if (freModal) freModal.textContent = this.orderType === 'delivery' ? freightFormatted : 'R$ 0,00';
            if (totModal) totModal.textContent = totalFormatted;

            const freightRow = document.getElementById('modal-freight-row');
            if (freightRow) freightRow.style.display = this.orderType === 'delivery' ? 'flex' : 'none';
        } else {
            if (bar) bar.style.display = 'none';
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
                    <div class="cross-item-name">${escapeHtml(p.name)}</div>
                    <div class="cross-item-price">R$ ${price.toFixed(2)}</div>
                    <button class="btn btn-sm" onclick="MenuApp.updateQty('${escapeHtml(p.id)}', 1); MenuApp.renderCrossSellOffers();" style="font-size:12px; padding:8px; width:100%; min-height:44px; touch-action:manipulation;">
                        + Adicionar
                    </button>
                </div>
            `;
        }).join('');

        section.style.display = 'block';
    },

    selectPayment(method, element) {
        const paymentInput = document.getElementById('cli-payment');
        if (paymentInput) paymentInput.value = method;

        const cards = document.querySelectorAll('.payment-card');
        cards.forEach(card => card.classList.remove('active'));

        if (element) {
            element.classList.add('active');
        } else {
            cards.forEach(card => {
                if (card.getAttribute('onclick')?.includes(`'${method}'`)) {
                    card.classList.add('active');
                }
            });
        }

        this.toggleChangeInput(method);
    },

    toggleChangeInput(val) {
        const changeGroup = document.getElementById('change-group');
        const pixGroup = document.getElementById('pix-info-group');

        if (changeGroup) changeGroup.style.display = val === 'Dinheiro' ? 'block' : 'none';
        if (pixGroup) pixGroup.style.display = val === 'Pix' ? 'block' : 'none';
    },

    openCheckoutModal() {
        if (this.getSubtotal() === 0) return;
        this.renderCrossSellOffers();

        const localSettings = JSON.parse(localStorage.getItem('dly_settings') || '{}');
        const pixVal = this.storeData.pix_key || localSettings.pixKey || '';
        const pixInput = document.getElementById('store-pix-key');
        if (pixInput) pixInput.value = pixVal || 'Consulte a chave no WhatsApp';

        const paymentInput = document.getElementById('cli-payment');
        const currentMethod = paymentInput?.value || 'Pix';
        this.selectPayment(currentMethod);

        const modal = document.getElementById('checkout-modal');
        if (modal) modal.style.display = 'flex';
    },

    closeCheckoutModal() {
        const modal = document.getElementById('checkout-modal');
        if (modal) modal.style.display = 'none';
    },

    copyPixKey() {
        const keyInput = document.getElementById('store-pix-key');
        if (keyInput && keyInput.value) {
            navigator.clipboard.writeText(keyInput.value);
            alert('⚡ Chave Pix copiada com sucesso!');
        }
    },

    setOrderType(type) {
        this.orderType = type;
        const buttons = document.querySelectorAll('#orderTypeToggle button');
        if (buttons.length >= 2) {
            buttons[0].classList.toggle('active', type === 'delivery');
            buttons[1].classList.toggle('active', type === 'pickup');
        }

        const deliveryGroup = document.getElementById('delivery-address-group');
        if (type === 'pickup') {
            if (deliveryGroup) deliveryGroup.style.display = 'none';
            this.currentDeliveryFee = 0;
        } else {
            if (deliveryGroup) deliveryGroup.style.display = 'block';
        }
        this.calculateTotals();
    },

    // Pega a rua via GPS apenas para facilitar a digitação do cliente
    getGPSLocation() {
        const btn = document.getElementById('btn-gps');
        if (btn) {
            btn.textContent = "⌛ Obtendo localização do GPS...";
            btn.disabled = true;
        }

        if (!navigator.geolocation) {
            alert("Seu navegador não suporta GPS. Digite o endereço manualmente.");
            if (btn) {
                btn.disabled = false;
                btn.textContent = "📍 Usar Minha Localização Atual (GPS)";
            }
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                this.currentDeliveryFee = 0; // Mantém o frete a combinar

                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                    const data = await res.json();
                    const street = data.address?.road || data.address?.suburb || "Endereço via GPS";
                    
                    const addrInput = document.getElementById('cli-address');
                    if (addrInput) {
                        addrInput.value = `${street} (📍 GPS - Frete a combinar)`;
                    }
                    if (btn) btn.textContent = "✅ Localização Capturada!";
                } catch (e) {
                    const addrInput = document.getElementById('cli-address');
                    if (addrInput) {
                        addrInput.value = `📍 GPS (Frete a combinar)`;
                    }
                    if (btn) btn.textContent = "✅ Localização Capturada!";
                }
                if (btn) btn.disabled = false;
                this.calculateTotals();
            },
            (error) => {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = "📍 Usar Minha Localização Atual (GPS)";
                }
                alert("Sinal de GPS indisponível. Digite seu endereço de entrega.");
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    },

    async checkExistingCustomer(phoneVal) {
        if (!phoneVal) return;
        const cleanPhone = phoneVal.replace(/\D/g, '');
        const badge = document.getElementById('welcome-customer-badge');
        const msgText = document.getElementById('welcome-msg-text');

        if (cleanPhone.length < 10) {
            if (badge) badge.style.display = 'none';
            return;
        }

        try {
            if (typeof dbClient === 'undefined') return;

            const { data, error } = await dbClient
                .from('orders')
                .select('customer_name, client_name, delivery_address, address, number, reference')
                .or(`phone.eq.${cleanPhone},customer_phone.eq.${cleanPhone}`)
                .order('created_at', { ascending: false })
                .limit(1);

            if (!error && data && data.length > 0) {
                const lastOrder = data[0];
                const savedName = lastOrder.customer_name || lastOrder.client_name || '';
                const savedAddress = lastOrder.delivery_address || lastOrder.address || '';
                const savedNumber = lastOrder.number || '';
                const savedRef = lastOrder.reference || '';

                const nameInput = document.getElementById('cli-name');
                const addrInput = document.getElementById('cli-address');
                const numInput = document.getElementById('cli-number');
                const refInput = document.getElementById('cli-reference');

                if (nameInput && savedName) nameInput.value = savedName;
                if (addrInput && savedAddress) addrInput.value = savedAddress;
                if (numInput && savedNumber) numInput.value = savedNumber;
                if (refInput && savedRef) refInput.value = savedRef;

                if (badge && msgText && savedName) {
                    const firstName = escapeHtml(savedName.split(' ')[0]);
                    msgText.innerHTML = `Que bom ter você de volta, <strong>${firstName}</strong>! Preenchemos seus dados automaticamente para facilitar.`;
                    badge.style.display = 'block';
                }
            } else {
                if (badge) badge.style.display = 'none';
            }
        } catch (e) {
            console.warn('Erro ao consultar cadastro prévio por telefone:', e);
        }
    },

    async sendWhatsApp() {
        const submitBtn = document.querySelector('[onclick*="sendWhatsApp"]');

        const nameEl = document.getElementById('cli-name');
        const phoneEl = document.getElementById('cli-phone');
        const addrEl = document.getElementById('cli-address');
        const numEl = document.getElementById('cli-number');
        const refEl = document.getElementById('cli-reference');
        const paymentEl = document.getElementById('cli-payment');
        const changeEl = document.getElementById('cli-change');

        const name = nameEl?.value.trim() || 'Não informado';
        const phone = phoneEl?.value.trim() || '';
        const address = addrEl?.value.trim() || 'A combinar';
        const number = numEl?.value.trim() || '';
        const reference = refEl?.value.trim() || '';
        const payment = paymentEl?.value || 'Pix';
        const changeVal = changeEl?.value.trim() || '';
        const subtotal = this.getSubtotal();

        if (subtotal === 0) return alert('Adicione pelo menos 1 item ao pedido!');
        if (!phone) return alert('Por favor, informe seu número de WhatsApp com DDD!');

        if (this.orderType === 'delivery') {
            if (!address || address === 'A combinar') return alert('Por favor, informe seu endereço ou use o GPS!');
            if (!number) return alert('Por favor, digite o NÚMERO da sua casa!');
        }

        const storeCoords = this.getStoreCoordinates();
        let storePhone = storeCoords.phone;

        if (!storePhone) {
            return alert('Atenção: O WhatsApp da loja ainda não foi configurado no painel.');
        }

        if (!storePhone.startsWith('55')) storePhone = '55' + storePhone;

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '⌛ Gravando pedido...';
        }

        const orderId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? crypto.randomUUID() 
            : `ord_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

        const orderItems = [];
        let itemsFormatted = '';

        Object.keys(this.products).forEach(id => {
            const p = this.products[id];
            if (p.qty > 0) {
                let itemPrice = p.price;
                let compsTxt = '';
                if (Array.isArray(p.selectedComplements) && p.selectedComplements.length > 0) {
                    const compsListTxt = p.selectedComplements.map(c => {
                        itemPrice += Number(c.price || 0);
                        return c.name;
                    }).join(', ');
                    compsTxt = ` (+ Opcionais: ${compsListTxt})`;
                }

                const itemTotal = itemPrice * p.qty;
                orderItems.push({ id, name: p.name + compsTxt, qty: p.qty, unit_price: itemPrice, total: itemTotal });
                itemsFormatted += `• *${p.qty}x ${p.name}*${compsTxt} — R$ ${itemTotal.toFixed(2)}\n`;
            }
        });

        const freight = this.orderType === 'delivery' ? this.currentDeliveryFee : 0;
        const totalFinal = subtotal + freight;

        let paymentFormatted = payment;
        if (payment === 'Dinheiro' && changeVal) {
            paymentFormatted += ` (Troco para: ${changeVal})`;
        }

        const fullReference = reference ? `${reference} | PGTO: ${paymentFormatted}` : `PGTO: ${paymentFormatted}`;

        try {
            if (typeof dbClient !== 'undefined') {
                const { error: dbError } = await dbClient.from('orders').insert([{
                    id: orderId,
                    customer_name: name,
                    client_name: name,
                    customer_phone: phone,
                    phone: phone,
                    order_type: this.orderType,
                    delivery_address: address,
                    address: address,
                    number: number,
                    reference: fullReference,
                    payment_method: payment,
                    items: orderItems,
                    subtotal: subtotal,
                    delivery_fee: freight,
                    total: totalFinal,
                    status: 'preparing',
                    source: 'Cardápio Digital',
                    created_at: new Date().toISOString()
                }]);

                if (dbError) {
                    throw new Error(dbError.message);
                }
            }
        } catch (e) {
            console.error('❌ Erro de gravação no Supabase:', e);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '🚀 Finalizar Pedido';
            }
            alert(`⚠️ Não foi possível registrar seu pedido no sistema.\n\nVerifique sua conexão e tente novamente.\n\nDetalhes: ${e.message}`);
            return;
        }

        const typeLabel = this.orderType === 'delivery' ? '🛵 *Entrega*' : '🏪 *Retirada no Balcão*';
        
        let totalsSection = '';
        if (this.orderType === 'delivery') {
            const freteTxt = this.currentDeliveryFee > 0 ? `R$ ${this.currentDeliveryFee.toFixed(2)}` : 'A combinar (consultar via WhatsApp)';
            totalsSection = `💵 *SUBTOTAL:* R$ ${subtotal.toFixed(2)}\n` +
                            `🛵 *FRETE:* ${freteTxt}\n` +
                            `💰 *TOTAL DOS ITENS:* R$ ${subtotal.toFixed(2)}`;
        } else {
            totalsSection = `💵 *SUBTOTAL:* R$ ${subtotal.toFixed(2)}\n` +
                            `🏪 *FRETE:* R$ 0.00 (Retirada no Balcão)\n` +
                            `💰 *TOTAL FINAL:* R$ ${subtotal.toFixed(2)}`;
        }

        const currentOrigin = window.location.origin;
        const adminOrderUrl = `${currentOrigin}/index.html?orderId=${orderId}`;

        const msg = `🛍️ *NOVO PEDIDO - ${storeCoords.storeName.toUpperCase()}*\n` +
                    `═══════════════════════\n\n` +
                    `📍 *TIPO:* ${typeLabel}\n` +
                    `👤 *CLIENTE:* ${name}\n` +
                    `📱 *WHATSAPP:* ${phone}\n` +
                    `💳 *PAGAMENTO:* ${paymentFormatted}\n` +
                    `🏠 *ENDEREÇO:* ${address}\n` +
                    `🔢 *NÚMERO:* ${number || 'S/N'}\n` +
                    `🎯 *REFERÊNCIA:* ${reference || 'Não informada'}\n\n` +
                    `📋 *ITENS DO PEDIDO:*\n${itemsFormatted}\n` +
                    `═══════════════════════\n` +
                    `${totalsSection}\n\n` +
                    `🔗 *Ver comanda no Painel:* ${adminOrderUrl}\n\n` +
                    `✨ _Obrigado pela preferência! Aguardo a confirmação do valor do frete._`;

        window.open(`https://api.whatsapp.com/send?phone=${storePhone}&text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '🚀 Finalizar Pedido';
        }
    },

    printReceipt() {
        const subtotal = this.getSubtotal();
        if (subtotal === 0) return alert('Selecione itens antes de imprimir!');

        const storeCoords = this.getStoreCoordinates();
        const storeNameEl = document.getElementById('rec-store-name');
        const dateEl = document.getElementById('rec-date');
        const nameEl = document.getElementById('rec-name');
        const addrEl = document.getElementById('rec-address');
        const numEl = document.getElementById('rec-number');
        const refEl = document.getElementById('rec-reference');

        if (storeNameEl) storeNameEl.textContent = storeCoords.storeName.toUpperCase();
        if (dateEl) dateEl.textContent = new Date().toLocaleString('pt-BR');
        if (nameEl) nameEl.textContent = document.getElementById('cli-name')?.value || 'Não informado';
        
        if (this.orderType === 'delivery') {
            if (addrEl) addrEl.textContent = document.getElementById('cli-address')?.value || 'A combinar';
            if (numEl) numEl.textContent = document.getElementById('cli-number')?.value || 'S/N';
            if (refEl) refEl.textContent = document.getElementById('cli-reference')?.value || 'Não informada';
        } else {
            if (addrEl) addrEl.textContent = 'Retirada no Balcão';
            if (numEl) numEl.textContent = '-';
            if (refEl) refEl.textContent = '-';
        }

        let itemsHtml = '';
        Object.values(this.products).forEach(p => {
            if (p.qty > 0) itemsHtml += `<p>${p.qty}x ${escapeHtml(p.name)} - R$ ${(p.price * p.qty).toFixed(2)}</p>`;
        });
        const recItems = document.getElementById('rec-items');
        if (recItems) recItems.innerHTML = itemsHtml;

        const freightArea = document.getElementById('rec-freight-area');

        if (freightArea) {
            if (this.orderType === 'pickup') {
                freightArea.innerHTML = `
                    <p><strong>Frete:</strong> R$ 0,00 (Retirada)</p>
                    <p style="font-size: 16px; margin-top: 8px;"><strong>TOTAL: R$ ${subtotal.toFixed(2)}</strong></p>
                `;
            } else {
                freightArea.innerHTML = `
                    <p><strong>Subtotal:</strong> R$ ${subtotal.toFixed(2)}</p>
                    <p><strong>Frete:</strong> A combinar</p>
                    <p style="font-size: 16px; margin-top: 8px;"><strong>TOTAL ITENS: R$ ${subtotal.toFixed(2)}</strong></p>
                `;
            }
        }

        const receiptEl = document.getElementById('printable-receipt');
        if (receiptEl) {
            receiptEl.style.display = 'block';
            window.print();
            receiptEl.style.display = 'none';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    MenuApp.init();
});
