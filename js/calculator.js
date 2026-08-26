// js/calculator.js - Ficha Técnica Profissional e Precificação Amigável

const CalculatorManager = {
    ingredientRows: [],

    init() {
        this.ingredientRows = [];
        const container = document.getElementById('ingredientsList');
        if (container) {
            container.innerHTML = '';
            this.addIngredientRow();
        }
        this.loadSavedRecipes();
    },

    addIngredientRow(data = null) {
        const container = document.getElementById('ingredientsList');
        if (!container) return;

        const rowId = `ing_row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

        const rowHtml = `
            <div class="card ingredient-card" id="${rowId}" style="padding:12px; margin-bottom:10px; background:#0F172A; border:1px solid #334155; border-left:4px solid #F59E0B;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:12px; font-weight:700; color:#F59E0B;">📦 Insumo / Embalagem</span>
                    <button type="button" class="btn btn-sm" onclick="CalculatorManager.removeIngredientRow('${rowId}')" style="background:#EF4444; color:#fff; padding:2px 8px; font-size:10px;">✕ Excluir</button>
                </div>

                <!-- SELETOR RÁPIDO DO ESTOQUE -->
                <div class="form-group" style="margin-bottom:8px;">
                    <select class="ing-stock-select" onchange="CalculatorManager.onSelectStockItem('${rowId}', this.value)" style="font-size:12px; padding:6px; background:#1E293B; color:#F1F5F9; border:1px solid #475569;">
                        <option value="">-- Puxar Item do Estoque (Opcional) --</option>
                        ${this.getStockOptionsHtml()}
                    </select>
                </div>

                <div class="form-group" style="margin-bottom:8px;">
                    <label style="font-size:11px; color:#94A3B8;">Nome do Ingrediente ou Embalagem</label>
                    <input type="text" class="ing-name" value="${data?.name || ''}" placeholder="Ex: Queijo Muçarela, Caixa de Pizza, Óleo" style="font-size:12px; padding:6px;">
                </div>

                <!-- EMBALAGEM COMPRADA (PREÇO x TAMANHO) -->
                <div style="background:#1E293B; padding:8px; border-radius:6px; margin-bottom:8px;">
                    <div style="font-size:10px; font-weight:700; color:#CBD5E1; margin-bottom:4px; text-transform:uppercase;">1. Dados da Embalagem Comprada no Mercado</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:6px;">
                        <div>
                            <label style="font-size:10px; color:#94A3B8;">Preço Pago (R$)</label>
                            <input type="number" step="0.01" class="ing-purchase-price" value="${data?.purchasePrice || ''}" placeholder="Ex: 45.00" oninput="CalculatorManager.calculateCost()" style="font-size:12px; padding:6px;">
                        </div>
                        <div>
                            <label style="font-size:10px; color:#94A3B8;">Tamanho / Peso</label>
                            <input type="number" step="0.001" class="ing-purchase-qty" value="${data?.purchaseQty || '1'}" placeholder="Ex: 1 ou 500" oninput="CalculatorManager.calculateCost()" style="font-size:12px; padding:6px;">
                        </div>
                        <div>
                            <label style="font-size:10px; color:#94A3B8;">Unidade</label>
                            <select class="ing-purchase-unit" onchange="CalculatorManager.calculateCost()" style="font-size:11px; padding:6px;">
                                <option value="kg" ${data?.purchaseUnit === 'kg' ? 'selected' : ''}>Quilo (kg)</option>
                                <option value="g" ${data?.purchaseUnit === 'g' ? 'selected' : ''}>Grama (g)</option>
                                <option value="l" ${data?.purchaseUnit === 'l' ? 'selected' : ''}>Litro (L)</option>
                                <option value="ml" ${data?.purchaseUnit === 'ml' ? 'selected' : ''}>Mililitro (ml)</option>
                                <option value="un" ${data?.purchaseUnit === 'un' || !data ? 'selected' : ''}>Unidade (un)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- QUANTIDADE USADA NA RECEITA -->
                <div style="background:#1E293B; padding:8px; border-radius:6px;">
                    <div style="font-size:10px; font-weight:700; color:#CBD5E1; margin-bottom:4px; text-transform:uppercase;">2. Quanto vai no prato / porção</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; align-items:center;">
                        <div>
                            <label style="font-size:10px; color:#94A3B8;">Qtd Usada</label>
                            <input type="number" step="0.001" class="ing-recipe-qty" value="${data?.recipeQty || ''}" placeholder="Ex: 150 (g) ou 1 (un)" oninput="CalculatorManager.calculateCost()" style="font-size:12px; padding:6px;">
                        </div>
                        <div>
                            <label style="font-size:10px; color:#94A3B8;">Unidade Usada</label>
                            <select class="ing-recipe-unit" onchange="CalculatorManager.calculateCost()" style="font-size:11px; padding:6px;">
                                <option value="g" ${data?.recipeUnit === 'g' || !data ? 'selected' : ''}>Gramas (g)</option>
                                <option value="kg" ${data?.recipeUnit === 'kg' ? 'selected' : ''}>Quilos (kg)</option>
                                <option value="ml" ${data?.recipeUnit === 'ml' ? 'selected' : ''}>Mililitros (ml)</option>
                                <option value="l" ${data?.recipeUnit === 'l' ? 'selected' : ''}>Litros (L)</option>
                                <option value="un" ${data?.recipeUnit === 'un' ? 'selected' : ''}>Unidade (un)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style="text-align:right; margin-top:8px; font-size:12px; color:#F1F5F9;">
                    Custo deste item na receita: <strong class="ing-cost-display" style="color:#10B981;">R$ 0,00</strong>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', rowHtml);
        this.ingredientRows.push(rowId);
    },

    removeIngredientRow(rowId) {
        const el = document.getElementById(rowId);
        if (el) el.remove();
        this.ingredientRows = this.ingredientRows.filter(id => id !== rowId);
        this.calculateCost();
    },

    getStockOptionsHtml() {
        let options = '';
        if (typeof state !== 'undefined' && state.stock && state.stock.length > 0) {
            state.stock.forEach(item => {
                options += `<option value="${item.id}" data-name="${item.name}" data-price="${item.price || item.cost || 0}" data-qty="${item.quantity || 1}" data-unit="${item.unit || 'un'}">${item.name} (R$ ${Number(item.price || item.cost || 0).toFixed(2)} / ${item.unit || 'un'})</option>`;
            });
        }
        return options;
    },

    onSelectStockItem(rowId, stockId) {
        if (!stockId) return;
        const row = document.getElementById(rowId);
        if (!row) return;

        const select = row.querySelector('.ing-stock-select');
        const opt = select.options[select.selectedIndex];

        row.querySelector('.ing-name').value = opt.getAttribute('data-name');
        row.querySelector('.ing-purchase-price').value = parseFloat(opt.getAttribute('data-price')) || 0;
        row.querySelector('.ing-purchase-qty').value = parseFloat(opt.getAttribute('data-qty')) || 1;

        const unit = opt.getAttribute('data-unit') || 'un';
        row.querySelector('.ing-purchase-unit').value = unit;

        const recipeUnitSelect = row.querySelector('.ing-recipe-unit');
        if (unit === 'kg' || unit === 'g') recipeUnitSelect.value = 'g';
        else if (unit === 'l' || unit === 'ml') recipeUnitSelect.value = 'ml';
        else recipeUnitSelect.value = 'un';

        this.calculateCost();
    },

    calculateCost() {
        let totalCost = 0;
        const cards = document.querySelectorAll('.ingredient-card');

        cards.forEach(card => {
            const purchasePrice = parseFloat(card.querySelector('.ing-purchase-price').value) || 0;
            const purchaseQty = parseFloat(card.querySelector('.ing-purchase-qty').value) || 1;
            const purchaseUnit = card.querySelector('.ing-purchase-unit').value;

            const recipeQty = parseFloat(card.querySelector('.ing-recipe-qty').value) || 0;
            const recipeUnit = card.querySelector('.ing-recipe-unit').value;

            // Transforma tudo para a unidade base (grama, ml ou unidade)
            let totalBasePurchaseQty = purchaseQty;
            if (purchaseUnit === 'kg') totalBasePurchaseQty = purchaseQty * 1000;
            else if (purchaseUnit === 'l') totalBasePurchaseQty = purchaseQty * 1000;

            let totalBaseRecipeQty = recipeQty;
            if (recipeUnit === 'kg') totalBaseRecipeQty = recipeQty * 1000;
            else if (recipeUnit === 'l') totalBaseRecipeQty = recipeQty * 1000;

            const costPerBaseUnit = purchasePrice / (totalBasePurchaseQty || 1);
            const itemCost = costPerBaseUnit * totalBaseRecipeQty;

            totalCost += itemCost;

            const display = card.querySelector('.ing-cost-display');
            if (display) display.textContent = `R$ ${itemCost.toFixed(2)}`;
        });

        const yieldQty = parseFloat(document.getElementById('recipeYield')?.value) || 1;
        const costPerPortion = totalCost / yieldQty;

        const costValueEl = document.getElementById('costValue');
        const costPerPortionEl = document.getElementById('costPerPortion');
        const costResult = document.getElementById('costResult');

        if (costValueEl) costValueEl.textContent = `R$ ${totalCost.toFixed(2)}`;
        if (costPerPortionEl) costPerPortionEl.textContent = `R$ ${costPerPortion.toFixed(2)}`;
        if (costResult) costResult.classList.remove('hidden');

        this.calculateSuggestedPrices(costPerPortion);
    },

    calculateSuggestedPrices(costPerPortion) {
        const cardTaxPct = parseFloat(document.getElementById('calcCardFee')?.value) || 2.5;
        const deliveryFeePct = parseFloat(document.getElementById('calcDeliveryFee')?.value) || 12.0;
        const profitMarginPct = parseFloat(document.getElementById('calcProfitMargin')?.value) || 50.0;

        // Divisor de Margem para Balcão
        const counterDivisor = 1 - ((cardTaxPct + profitMarginPct) / 100);
        const counterPrice = counterDivisor > 0 ? (costPerPortion / counterDivisor) : (costPerPortion * 2);

        // Divisor de Margem para iFood/Delivery
        const deliveryDivisor = 1 - ((cardTaxPct + deliveryFeePct + profitMarginPct) / 100);
        const deliveryPrice = deliveryDivisor > 0 ? (costPerPortion / deliveryDivisor) : (costPerPortion * 2.5);

        const balcaoEl = document.getElementById('suggestedCounterPrice');
        const deliveryEl = document.getElementById('suggestedDeliveryPrice');

        if (balcaoEl) balcaoEl.textContent = `R$ ${counterPrice.toFixed(2)}`;
        if (deliveryEl) deliveryEl.textContent = `R$ ${deliveryPrice.toFixed(2)}`;
    },

    async saveCurrentRecipe() {
        const name = document.getElementById('recipeName')?.value.trim();
        const yieldQty = parseFloat(document.getElementById('recipeYield')?.value) || 1;
        const costValText = document.getElementById('costValue')?.textContent.replace('R$', '').replace(',', '.').trim();
        const totalCost = parseFloat(costValText) || 0;

        if (!name) {
            if (typeof showToast === 'function') showToast('Informe o nome do prato ou receita!', 'error');
            else alert('Informe o nome da receita!');
            return;
        }

        const ingredientsData = [];
        document.querySelectorAll('.ingredient-card').forEach(card => {
            ingredientsData.push({
                name: card.querySelector('.ing-name').value,
                purchasePrice: card.querySelector('.ing-purchase-price').value,
                purchaseQty: card.querySelector('.ing-purchase-qty').value,
                purchaseUnit: card.querySelector('.ing-purchase-unit').value,
                recipeQty: card.querySelector('.ing-recipe-qty').value,
                recipeUnit: card.querySelector('.ing-recipe-unit').value
            });
        });

        const recipePayload = {
            name,
            yield_qty: yieldQty,
            total_cost: totalCost,
            cost_per_portion: totalCost / yieldQty,
            ingredients: ingredientsData,
            created_at: new Date().toISOString()
        };

        try {
            if (typeof dbClient !== 'undefined') {
                await dbClient.from('recipes').upsert([recipePayload]);
            } else if (typeof DB !== 'undefined') {
                const local = DB.load('dly_recipes', []);
                local.push(recipePayload);
                DB.save('dly_recipes', local);
            }

            if (typeof showToast === 'function') showToast('Ficha Técnica salva com sucesso!');
            this.loadSavedRecipes();

        } catch (e) {
            console.error('Erro ao salvar receita:', e);
        }
    },

    async loadSavedRecipes() {
        const container = document.getElementById('recipesList');
        if (!container) return;

        try {
            let recipes = [];
            if (typeof dbClient !== 'undefined') {
                const { data } = await dbClient.from('recipes').select('*').order('created_at', { ascending: false });
                recipes = data || [];
            } else if (typeof DB !== 'undefined') {
                recipes = DB.load('dly_recipes', []);
            }

            if (recipes.length === 0) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:15px; font-size:12px;">Nenhuma ficha técnica salva ainda.</div>';
                return;
            }

            container.innerHTML = recipes.map(r => `
                <div class="card" style="margin-bottom:8px; padding:12px; background:#1E293B; border-left:4px solid #3B82F6;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="color:#F1F5F9; font-size:14px; display:block;">🍲 ${r.name}</strong>
                            <span style="font-size:11px; color:#94A3B8;">
                                Rendimento: ${r.yield_qty || 1} porção(ões) • Custo/Un: <strong style="color:#10B981;">R$ ${Number(r.cost_per_portion || r.total_cost).toFixed(2)}</strong>
                            </span>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (e) {
            container.innerHTML = '<div style="color:#EF4444; text-align:center; padding:10px;">Erro ao carregar fichas salvas.</div>';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('ingredientsList')) {
        CalculatorManager.init();
    }
});
