// api/validate-order.js

export default async function handler(req, res) {
    // Liberar acesso CORS (para chamadas do próprio front-end)
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
        const { clientName, address, orderType, items } = req.body;

        // 1. Validação básica de campos obrigatórios
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'O pedido deve conter ao menos um item.' });
        }

        if (orderType === 'delivery' && (!address || address.trim() === '')) {
            return res.status(400).json({ success: false, error: 'Endereço é obrigatório para entregas.' });
        }

        // Tabela de preços de referência no servidor (evita manipulação no front-end)
        const priceCatalog = {
            marmita: 20.00,
            batata: 25.00,
            pastel: 12.00,
            suco: 10.00
        };

        // 2. Recálculo e validação do subtotal no servidor
        let calculatedSubtotal = 0;
        const validatedItems = [];

        for (const item of items) {
            const serverPrice = priceCatalog[item.id];

            if (serverPrice === undefined) {
                return res.status(400).json({ success: false, error: `Item inválido: ${item.id}` });
            }

            if (!item.qty || item.qty <= 0) {
                continue;
            }

            const itemTotal = serverPrice * item.qty;
            calculatedSubtotal += itemTotal;

            validatedItems.push({
                id: item.id,
                name: item.name,
                qty: item.qty,
                unitPrice: serverPrice,
                totalPrice: itemTotal
            });
        }

        if (validatedItems.length === 0) {
            return res.status(400).json({ success: false, error: 'Selecione uma quantidade válida.' });
        }

        // 3. Retorno do pedido validado
        return res.status(200).json({
            success: true,
            order: {
                clientName: clientName || 'Não informado',
                address: orderType === 'pickup' ? 'Retirada no Balcão' : address,
                orderType,
                items: validatedItems,
                subtotal: calculatedSubtotal,
                createdAt: new Date().toISOString()
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: 'Erro interno ao processar o pedido.' });
    }
}
