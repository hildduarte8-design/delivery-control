// api/validate-order.js - Validação Segura de Pedidos no Servidor

export default async function handler(req, res) {
    // Configuração de cabeçalhos CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método não permitido.' });
    }

    try {
        const { clientName, address, orderType, items, deliveryFee = 0, discount = 0 } = req.body;

        // 1. Validação inicial de campos obrigatórios
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'O pedido deve conter ao menos um item.' });
        }

        if (orderType === 'delivery' && (!address || String(address).trim() === '')) {
            return res.status(400).json({ success: false, error: 'Endereço é obrigatório para entregas.' });
        }

        // Tabela de preços estática de referência (fallback)
        const priceCatalog = {
            marmita: 20.00,
            batata: 25.00,
            pastel: 12.00,
            suco: 10.00
        };

        let calculatedSubtotal = 0;
        const validatedItems = [];

        // 2. Iteração e recálculo dos itens e seus adicionais
        for (const item of items) {
            const qty = Math.max(0, parseInt(item.qty || item.quantity) || 0);
            if (qty <= 0) continue;

            // Busca preço no catálogo fixo ou utiliza o preço enviado sanitizado
            let unitPrice = priceCatalog[item.id];
            if (unitPrice === undefined) {
                unitPrice = parseFloat(item.price || item.unitPrice || item.unit_price) || 0;
            }

            if (unitPrice <= 0 && priceCatalog[item.id] === undefined) {
                return res.status(400).json({ success: false, error: `Preço inválido para o item: ${item.name || item.id}` });
            }

            // Recálculo de adicionais / opcionais selecionados
            let complementsTotal = 0;
            const validatedComplements = [];

            if (Array.isArray(item.complements) && item.complements.length > 0) {
                for (const comp of item.complements) {
                    const compPrice = parseFloat(comp.price) || 0;
                    complementsTotal += compPrice;
                    validatedComplements.push({
                        name: String(comp.name || '').trim(),
                        price: compPrice
                    });
                }
            }

            const itemUnitPrice = unitPrice + complementsTotal;
            const itemTotal = itemUnitPrice * qty;
            calculatedSubtotal += itemTotal;

            validatedItems.push({
                id: String(item.id || ''),
                name: String(item.name || 'Item do Cardápio').trim(),
                qty,
                unitPrice: itemUnitPrice,
                totalPrice: itemTotal,
                complements: validatedComplements
            });
        }

        if (validatedItems.length === 0) {
            return res.status(400).json({ success: false, error: 'Selecione quantidades válidas para os itens.' });
        }

        // 3. Consolidação do valor final
        const validDeliveryFee = orderType === 'delivery' ? Math.max(0, parseFloat(deliveryFee) || 0) : 0;
        const validDiscount = Math.max(0, parseFloat(discount) || 0);
        const finalTotal = Math.max(0, calculatedSubtotal + validDeliveryFee - validDiscount);

        // 4. Retorno estruturado e validado
        return res.status(200).json({
            success: true,
            order: {
                clientName: String(clientName || 'Não informado').trim(),
                address: orderType === 'pickup' ? 'Retirada no Balcão' : String(address).trim(),
                orderType: orderType === 'delivery' ? 'delivery' : 'pickup',
                items: validatedItems,
                subtotal: Number(calculatedSubtotal.toFixed(2)),
                deliveryFee: Number(validDeliveryFee.toFixed(2)),
                discount: Number(validDiscount.toFixed(2)),
                total: Number(finalTotal.toFixed(2)),
                createdAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Erro na validação do pedido:', error);
        return res.status(500).json({ success: false, error: 'Erro interno ao processar e validar o pedido.' });
    }
}
