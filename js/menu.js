// js/menu.js - Lógica Completa do Cardápio Digital (Corrigido)

if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text ?? '')));
        return div.innerHTML;
    };
}

const escapeHtml = window.escapeHtml;

const MenuApp = {
    orderType: 'delivery',
    currentDeliveryFee: 0,
    products: {},
    rawProductsList: [],
    selectedCategory: 'all',
    storeData: {},
    
    currentModalState: {
        productId: null,
        tempQty: 1,
        selectedComplements: []
    },

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
                    id: p.id,
                    name: p.name, 
                    description: p.description,
                    imageUrl: p.image_url,
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

                let priceHtml = `<span style="font-size:15px; font-weight:800; color:#10B981;">R$ ${finalPrice.toFixed(2).replace('.', ',')}</span>`;
                if (discount > 0) {
                    priceHtml = `
                        <span style="font-size:11px; color:#94A3B8; text-decoration:line-through;">R$ ${originalPrice.toFixed(2).replace('.', ',')}</span>
                        <span style="font-size:15px; font-weight:800; color:#10B981; margin-left:4px;">R$ ${finalPrice.toFixed(2).replace('.', ',')}</span>
                    `;
                }

                const safeName = escapeHtml(p.name);
                const safeDesc = escapeHtml(p.description || 'Sem descrição.');
                const safeImg = escapeHtml(p.image_url || '');

                const imgHtml = p.image_url ? `
                    <div style="position:relative; width:75px; height:75px; flex-shrink:0; border-radius:10px; overflow:hidden; background:#0F172A;">
                        <img src="${safeImg}" style="width:100%; height:100%; object-fit:cover;" alt="${safeName}">
                        ${discount > 0 ? '<div style="position:absolute; top:2px; left:2px; background:#EF4444; color:#fff; font-size:10px; font-weight:bold; padding:2px 4px; border-radius:4px;">%</div>' : ''}
                    </div>
                ` : `
                    <div style="width:75px; height:75px; flex-shrink:0; border-radius:10px; background:#0F172A; display:flex; align-items:center; justify-content:center; font-size:30px; border:1px solid #334155;">
                        🍽️
                    </div>
                `;

                html += `
                    <div class="menu-product-card" onclick="MenuApp.openProductModal('${escapeHtml(p.id)}')" style="display:flex; align-items:center; gap:10px; padding:10px; background:#1E293B; border-radius:12px; margin-bottom:10px; border:1px solid #334155; cursor:pointer; touch-action:manipulation;">
                        ${imgHtml}
                        
                        <div style="flex:1; min-width:0; padding-right:2px;">
                            <div style="font-size:15px; font-weight:800; color:#F1F5F9; line-height:1.25; margin-bottom:3px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${safeName}</div>
                            <div style="font-size:12px; color:#94A3B8; line-height:1.35; margin-bottom:5px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${safeDesc}</div>
                            <div>${priceHtml}</div>
                        </div>

                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0;" onclick="event.stopPropagation();">
                            ${qty > 0 ? `<span style="background:#10B981; color:#fff; font-size:10px; font-weight:bold; padding:1px 6px; border-radius:10px;">${qty}x no pedido</span>` : ''}
                            
                            <div style="display:flex; align-items:center; gap:5px;">
                                <button onclick="MenuApp.quickAdd('${escapeHtml(p.id)}')" title="Adicionar 1 item" style="background:#10B981; color:#fff; border:none; width:34px; height:34px; border-radius:8px; font-weight:bold; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; touch-action:manipulation;">
                                    +
                                </button>
                                
                                <button onclick="MenuApp.openProductModal('${escapeHtml(p.id)}')" style="background:#FF6B35; color:#fff; border:none; padding:8px 10px; border-radius:8px; font-size:12px; font-weight:bold; white-space:nowrap; cursor:pointer; touch-action:manipulation;">
                                    ver +
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = html;
    },

    quickAdd(productId) {
        const p = this.products[productId];
        if (!p) return;

        if (Array.isArray(p.complements) && p.complements.length > 0) {
            this.openProductModal(productId);
            return;
        }

        p.qty += 1;
        this.calculateTotals();
        this.renderProductsList();
    },

    openProductModal(productId) {
        const p = this.products[productId];
        if (!p) return;

        const currentQty = p.qty > 0 ? p.qty : 1;
        
        this.currentModalState = {
            productId: productId,
            tempQty: currentQty,
            selectedComplements: [...(p.selectedComplements || [])]
        };

        const safeName = escapeHtml(p.name);
        const safeDesc = escapeHtml(p.description || 'Sem descrição cadastrada.');
        const safeImg = escapeHtml(p.imageUrl || '');

        const headerImgHtml = p.imageUrl 
            ? `<div style="width:100%; height:180px; overflow:hidden; position:relative; border-radius:16px 16px 0 0;">
                <img src="${safeImg}" style="width:100%; height:100%; object-fit:cover;" alt="${safeName}">
               </div>`
            : `<div style="width:100%; height:90px; background:#0F172A; display:flex; align-items:center; justify-content:center; font-size:42px; border-radius:16px 16px 0 0;">
                🍽️
               </div>`;

        let complementsHtml = '';
        if (Array.isArray(p.complements) && p.complements.length > 0) {
            const compsList = p.complements.map(c => {
                const isChecked = this.currentModalState.selectedComplements.some(sc => sc.name === c.name);
                const checkedAttr = isChecked ? 'checked' : '';
                return `
                    <label style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#0F172A; border-radius:8px; border:1px solid #334155; margin-bottom:8px; cursor:pointer;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <input type="checkbox" class="modal-comp-cb" data-name="${escapeHtml(c.name)}" data-price="${c.price}" ${checkedAttr} onchange="MenuApp.toggleModalComplement('${escapeHtml(productId)}')" style="width:20px; height:20px; accent-color:#FF6B35;">
                            <span style="font-size:13px; color:#F1F5F9;">${escapeHtml(c.name)}</span>
                        </div>
                        <strong style="color:#10B981; font-size:13px;">+ R$ ${Number(c.price).toFixed(2).replace('.', ',')}</strong>
                    </label>
                `;
            }).join('');

            complementsHtml = `
                <div style="margin-top:16px; border-top:1px dashed #334155; padding-top:14px;">
                    <strong style="font-size:13px; color:#F59E0B; text-transform:uppercase; display:block; margin-bottom:10px;">📌 Opcionais & Adicionais</strong>
                    ${compsList}
                </div>
            `;
        }

        let container = document.getElementById('product-detail-modal-box');
        if (!container) {
            container = document.createElement('div');
            container.id = 'product-detail-modal-box';
            container.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:99999; display:none; align-items:center; justify-content:center; padding:16px;';
            
            container.addEventListener('click', (e) => {
                if (e.target === container) MenuApp.closeProductModal();
            });

            document.body.appendChild(container);
        }

        container.innerHTML = `
            <div style="background:#1E293B; border:1px solid #334155; border-radius:16px; max-width:440px; width:100%; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.5);" onclick="event.stopPropagation();">
                
                <button type="button" onclick="window.MenuApp.closeProductModal()" style="position:absolute; top:10px; right:10px; background:rgba(15,23,42,0.85); border:1px solid #334155; color:#fff; width:36px; height:36px; border-radius:50%; font-size:18px; cursor:pointer; z-index:99; display:flex; align-items:center; justify-content:center;">✕</button>

                <div style="overflow-y:auto; padding:0; flex:1;">
                    ${headerImgHtml}
                    <div style="padding:16px;">
                        <h2 style="color:#F1F5F9; font-size:20px; font-weight:800; line-height:1.3; margin:0 0 8px 0;">${safeName}</h2>
                        <p style="color:#CBD5E1; font-size:14px; line-height:1.5; margin:0 0 12px 0;">${safeDesc}</p>
                        
                        <div style="font-size:18px; font-weight:800; color:#10B981; margin-bottom:4px;">
                            R$ ${p.price.toFixed(2).replace('.', ',')}
                        </div>

                        ${complementsHtml}
                    </div>
                </div>

                <div style="background:#0F172A; padding:14px; border-top:1px solid #334155; display:flex; align-items:center; gap:12px;">
                    <div style="display:flex; align-items:center; gap:8px; background:#1E293B; padding:4px 8px; border-radius:8px; border:1px solid #334155;">
                        <button type="button" onclick="MenuApp.updateModalQty(-1)" style="width:36px; height:36px; background:#0F172A; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size:18px; cursor:pointer;">-</button>
                        <span id="modal-qty-val" style="font-size:15px; font-weight:bold; color:#F1F5F9; min-width:22px; text-align:center;">${this.currentModalState.tempQty}</span>
                        <button type="button" onclick="MenuApp.updateModalQty(1)" style="width:36px; height:36px; background:#FF6B35; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size:18px; cursor:pointer;">+</button>
                    </div>

                    <button type="button" onclick="MenuApp.confirmModalAdd()" style="flex:1; background:#10B981; color:#fff; border:none; padding:12px; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                        <span>🛒 Confirmar</span>
                        <span id="modal-btn-total-val">R$ 0,00</span>
                    </button>
                </div>
            </div>
        `;

        container.style.display = 'flex';
        this.recalculateModalTotal();
    },

    closeProductModal() {
        const box = document.getElementById('product-detail-modal-box');
        if (box) box.style.display = 'none';
    },

    updateModalQty(delta) {
        if (this.currentModalState.tempQty + delta >= 1) {
            this.currentModalState.tempQty += delta;
            const el = document.getElementById('modal-qty-val');
            if (el) el.textContent = this.currentModalState.tempQty;
            this.recalculateModalTotal();
        }
    },

    toggleModalComplement(productId) {
        const checkboxes = document.querySelectorAll('#product-detail-modal-box .modal-comp-cb:checked');
        const selected = [];

        checkboxes.forEach(cb => {
            selected.push({
                name: cb.dataset.name,
                price: parseFloat(cb.dataset.price) || 0
            });
        });

        this.currentModalState.selectedComplements = selected;
        this.recalculateModalTotal();
    },

    recalculateModalTotal() {
        const p = this.products[this.currentModalState.productId];
        if (!p) return;

        let unitPrice = p.price;
        if (Array.isArray(this.currentModalState.selectedComplements)) {
            unitPrice += this.currentModalState.selectedComplements.reduce((acc, c) => acc + Number(c.price || 0), 0);
        }

        const total = unitPrice * this.currentModalState.tempQty;
        const btnTotalEl = document.getElementById('modal-btn-total-val');
        if (btnTotalEl) {
            btnTotalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        }
    },

    confirmModalAdd() {
        const productId = this.currentModalState.productId;
        if (this.products[productId]) {
            this.products[productId].qty = this.currentModalState.tempQty;
            this.products[productId].selectedComplements = [...this.currentModalState.selectedComplements];
        }

        this.closeProductModal();
        this.calculateTotals();
        this.renderProductsList();
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
            if (bar) {
                bar.style.display = 'flex';
                bar.classList.add('active');
            }
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
            if (bar) {
                bar.style.display = 'none';
                bar.classList.remove('active');
            }
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
                    <button class="btn btn-sm" onclick="MenuApp.products['${escapeHtml(p.id)}'].qty = 1; MenuApp.calculateTotals(); MenuApp.renderProductsList(); MenuApp.renderCrossSellOffers();" style="font-size:12px; padding:8px; width:100%; min-height:44px; touch-action:manipulation;">
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
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
        }
    },

    closeCheckoutModal() {
        const modal = document.getElementById('checkout-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
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
                this.currentDeliveryFee = 0;

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
                    status: 'pending',
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

window.MenuApp = MenuApp;

document.addEventListener('DOMContentLoaded', () => {
    MenuApp.init();
});
