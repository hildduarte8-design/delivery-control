// js/menu.js - Estado e Regras de Negócio do Cardápio Digital

const MenuApp = {
    orderType: 'delivery',
    currentDeliveryFee: 0,
    
    // Regras de Tarifa
    BASE_FEE: 4.00,
    PRICE_PER_KM: 1.50,

    products: {
        marmita: { name: 'Marmita Executiva', price: 20.00, qty: 0 },
        batata: { name: 'Batata Recheada', price: 25.00, qty: 0 },
        pastel: { name: 'Pastel Especial', price: 12.00, qty: 0 },
        suco: { name: 'Suco de Morango (Puro)', price: 10.00, qty: 0 }
    },

    getStoreCoordinates() {
        const settings = JSON.parse(localStorage.getItem('dly_settings')) || {};
        return {
            lat: settings.storeLat ? parseFloat(settings.storeLat) : -17.8575,
            lon: settings.storeLon ? parseFloat(settings.storeLon) : -41.5053,
            phone: settings.phone ? settings.phone.replace(/\D/g, '') : '',
            storeName: settings.storeName || 'MADY'
        };
    },

    updateQty(id, delta) {
        if (this.products[id] && this.products[id].qty + delta >= 0) {
            this.products[id].qty += delta;
            document.getElementById(`qty-${id}`).textContent = this.products[id].qty;
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

    openCheckoutModal() {
        if (this.getSubtotal() === 0) return;
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

        const itemsList = Object.keys(this.products)
            .filter(id => this.products[id].qty > 0)
            .map(id => ({ id, name: this.products[id].name, qty: this.products[id].qty }));

        try {
            const response = await fetch('/api/validate-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientName: name, address, orderType: this.orderType, items: itemsList })
            });

            const data = await response.json();
            if (!data.success) return alert(`Atenção: ${data.error}`);

            const storeCoords = this.getStoreCoordinates();
            let storePhone = storeCoords.phone;
            if (storePhone && !storePhone.startsWith('55')) storePhone = '55' + storePhone;
            if (!storePhone) storePhone = '5533999999999';

            const order = data.order;
            let itemsFormatted = '';
            order.items.forEach(i => { itemsFormatted += `• *${i.qty}x ${i.name}* — R$ ${i.totalPrice.toFixed(2)}\n`; });

            const typeLabel = order.orderType === 'delivery' ? '🛵 *Entrega*' : '🏪 *Retirada no Balcão*';
            const totalFinal = order.subtotal + (order.orderType === 'delivery' ? this.currentDeliveryFee : 0);

            let totalsSection = '';
            if (order.orderType === 'delivery') {
                const freteTxt = this.currentDeliveryFee > 0 ? `R$ ${this.currentDeliveryFee.toFixed(2)}` : 'A combinar';
                totalsSection = `💵 *SUBTOTAL:* R$ ${order.subtotal.toFixed(2)}\n` +
                                `🛵 *FRETE:* ${freteTxt}\n` +
                                `💰 *TOTAL FINAL:* R$ ${totalFinal.toFixed(2)}`;
            } else {
                totalsSection = `💵 *SUBTOTAL:* R$ ${order.subtotal.toFixed(2)}\n` +
                                `🏪 *FRETE:* R$ 0.00 (Retirada)\n` +
                                `💰 *TOTAL FINAL:* R$ ${order.subtotal.toFixed(2)}`;
            }

            const msg = `🛍️ *NOVO PEDIDO - ${storeCoords.storeName.toUpperCase()}*\n` +
                        `═══════════════════════\n\n` +
                        `📍 *TIPO:* ${typeLabel}\n` +
                        `👤 *CLIENTE:* ${order.clientName}\n` +
                        `🏠 *ENDEREÇO:* ${order.address}\n` +
                        `🔢 *NÚMERO:* ${number || 'S/N'}\n` +
                        `🎯 *REFERÊNCIA:* ${reference || 'Não informada'}\n\n` +
                        `📋 *ITENS DO PEDIDO:*\n${itemsFormatted}\n` +
                        `═══════════════════════\n` +
                        `${totalsSection}\n\n` +
                        `✨ _Obrigado pela preferência! Aguardo a confirmação._`;

            window.open(`https://api.whatsapp.com/send?phone=${storePhone}&text=${encodeURIComponent(msg)}`, '_blank');
        } catch (err) {
            alert('Ocorreu um erro ao validar o pedido. Tente novamente.');
        }
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
