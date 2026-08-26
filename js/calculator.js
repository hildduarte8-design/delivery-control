// js/calculator.js - Ficha Técnica, Conversão de Unidades e Precificação para Delivery

const CalculatorManager = {
    ingredients: [],
    savedRecipes: [],

    init() {
        this.ingredients = [];
        this.addIngredientRow();
        this.loadSavedRecipes();
    },

    // Adiciona uma linha de ingrediente/embalagem na receita
    addIngredientRow(data = null) {
        const container = document.getElementById('ingredientsList');
        if (!container) return;

        const rowIndex = this.ingredients.length;
        const rowId = `ing_row_${Date.now()}_${rowIndex}`;

        const rowHtml = `
            <div class="card ingredient-row" id="${rowId}" style="padding:10px; margin-bottom:8px; background:#0F172A; border:1px solid #334155;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-size:11px; font-weight:700; color:#FF6B35;">Ingrediente / Embalagem #${rowIndex + 1}</span>
                    <button type="button" class="btn btn-sm" onclick="CalculatorManager.removeIngredientRow('${rowId}')" style="background:#EF4444; color:#fff; padding:2px 8px; font-size:11px;">✕ Remover</button>
                </div>

                <div class="form-group" style="margin-bottom:6px;">
                    <select class="ing-stock-select" onchange="CalculatorManager.onSelectStockItem('${rowId}', this.value)" style="font-size:12px; padding:8px;">
                        <option value="">-- Selecionar do Estoque ou Inserir Manual --</option>
                        ${this.getStockOptionsHtml()}
                    </select>
                </div>

                <div style="display:grid; grid-template-columns: 1.2fr 1fr 1fr; gap:6px;">
                    <div>
                        <input type="text" class="ing-name" value="${data?.name || ''}" placeholder="Nome (Ex: Muçarela)" style="font-size:12px; padding:6px;">
                    </div>
                    <div>
                        <input type="number" step="0.001" class="ing-qty" value="${data?.qty || ''}" placeholder="Qtd Usada" oninput="CalculatorManager.calculateCost()" style="font-size:12px; padding:6px;">
                    </div>
                    <div>
                        <select class="ing-unit" onchange="CalculatorManager.calculateCost()" style="font-size:12px; padding:6px;">
                            <option value="g" ${data?.unit === 'g' ? 'selected' : ''}>Gramas (g)</option>
                            <option value="kg" ${data?.unit === 'kg' ? 'selected' : ''}>Quilos (kg)</option>
                            <option value="ml" ${data?.unit === 'ml' ? 'selected' : ''}>Mililitros (ml)</option>
                            <option value="l" ${data?.unit === 'l' ? 'selected' : ''}>Litros (L)</option>
                            <option value="un" ${data?.unit === 'un' || !data ? 'selected' : ''}>Unidade (un)</option>
                        </select>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; margin-top:6px;">
                    <div>
                        <label style="font-size:10px; color:#94A3B8;">Preço de Compra (R$)</label>
                        <input type="number" step="0.01" class="ing-purchase-price" value="${data?.purchasePrice || ''}" placeholder="Ex: 45.00" oninput="CalculatorManager.calculateCost()" style="font-size:12px; padding:6px;">
                    </div>
                    <div>
                        <label style="font-size:10px; color:#94A3B8;">Qtd Comprada na Embalagem</label>
                        <input type="number" step="0.001" class="ing-purchase-qty" value="${data?.purchaseQty || '1'}" placeholder="Ex: 1 (kg/L/cx)" oninput="CalculatorManager.calculateCost()" style="font-size:12px; padding:6px;">
                    </div>
                </div>

                <div style="text-align:right; margin-top:6px; font-size:11px; color:#CBD5E1;">
                    Custo no prato: <strong class="ing-cost-display" style="color:#10B981;">R$ 0,00</strong>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', rowHtml);
        this.ingredients.push(rowId);
    },

    removeIngredientRow(rowId) {
        const el = document.getElementById(rowId);
        if (el) el.remove();
        this.ingredients = this.ingredients.filter(id => id !== rowId);
        this.calculateCost();
    },

    // Puxa lista de insumos do estoque cadastrado
    getStockOptionsHtml() {
        let options = '';
        if (typeof state !== 'undefined' && state.stock && state.stock.length > 0) {
            state.stock.forEach(item => {
                options += `<option value="${item.id}" data-name="${item.name}" data-price="${item.price || item.cost || 0}" data-qty="${item.quantity || 1}" data-unit="${item.unit || 'un'}">${item.name} (R$ ${Number(item.price || item.cost || 0).toFixed(2)} / ${item.unit || 'un'})</option>`;
            });
        }
        return options;
    },

    // Preenche automaticamente ao selecionar insumo do estoque
    onSelectStockItem(rowId, stockId) {
        if (!stockId) return;
        const row = document.getElementById(rowId);
        if (!row) return;

        const select = row.querySelector('.ing-stock-select');
        const selectedOpt = select.options[select.selectedIndex];

        const name = selectedOpt.getAttribute('data-name');
        const price = parseFloat(selectedOpt.getAttribute('data-price')) || 0;
        const qty = parseFloat(selectedOpt.getAttribute('data-qty')) || 1;
        const unit = selectedOpt.getAttribute('data-unit') || 'un';

        row.querySelector('.ing-name').value = name;
        row.querySelector('.ing-purchase-price').value = price;
        row.querySelector('.ing-purchase-qty').value = qty;

        // Ajusta unidade base do insumo
        const unitSelect = row.querySelector('.ing-unit');
        if (unit === 'kg' || unit === 'g') unitSelect.value = 'g';
        else if (unit === 'l' || unit === 'ml') unitSelect.value = 'ml';
        else unitSelect.value = 'un';

        this.calculateCost();
    },

    // Lógica Matemática de Conversão e Precificação
    calculateCost() {
        let totalRecipeCost = 0;
        const rowElements = document.querySelectorAll('.ingredient-row');

        rowElements.forEach(row => {
            const qtyUsed = parseFloat(row.querySelector('.ing-qty').value) || 0;
            const recipeUnit = row.querySelector('.ing-unit').value;
            const purchasePrice = parseFloat(row.querySelector('.ing-purchase-price').value) || 0;
            const purchaseQty = parseFloat(row.querySelector('.ing-purchase-qty').value) || 1;

            let unitCost = 0;

            // Matriz de conversão de unidades
            if (recipeUnit === 'g' || recipeUnit === 'ml') {
                // Preço por grama ou mililitro (assumindo preço informado por Kg ou Litro)
                const costPerBaseUnit = purchasePrice / purchaseQty;
                unitCost = (costPerBaseUnit / 1000) * qtyUsed;
            } else if (recipeUnit === 'kg' || recipeUnit === 'l') {
                unitCost = (purchasePrice / purchaseQty) * qtyUsed;
            } else {
                // Unidade, fatia, embalagem
                unitCost = (purchasePrice / purchaseQty) * qtyUsed;
            }

            totalRecipeCost += unitCost;

            const costDisplay = row.querySelector('.ing-cost-display');
            if (costDisplay) costDisplay.textContent = `R$ ${unitCost.toFixed(2)}`;
        });

        // Rendimento em porções
        const yieldQty = parseFloat(document.getElementById('recipeYield')?.value) || 1;
        const costPerPortion = totalRecipeCost / yieldQty;

        // Atualiza UI de Resultados
        const costValueEl = document.getElementById('costValue');
        const costPerPortionEl = document.getElementById('costPerPortion');
        const costResultCard = document.getElementById('costResult');

        if (costValueEl) costValueEl.textContent = `R$ ${totalRecipeCost.toFixed(2)}`;
        if (costPerPortionEl) costPerPortionEl.textContent = `R$ ${costPerPortion.toFixed(2)}`;
        if (costResultCard) costResultCard.classList.remove('hidden');

        // Cálculo de Sugestão com Taxas de Delivery
        this.calculateSuggestedPrices(costPerPortion);
    },

    calculateSuggestedPrices(costPerPortion) {
        const cardTaxPct = parseFloat(document.getElementById('calcCardFee')?.value) || 2.5;
        const deliveryFeePct = parseFloat(document.getElementById('calcDeliveryFee')?.value) || 12.0; // Ex: iFood
        const profitMarginPct = parseFloat(document.getElementById('calcProfitMargin')?.value) || 50.0;

        // 1. Preço Balcão (Custo + Cartão + Margem de Lucro)
        const counterDivisor = 1 - ((cardTaxPct + profitMarginPct) / 100);
        const counterPrice = counterDivisor > 0 ? (costPerPortion / counterDivisor) : (costPerPortion * 2);

        // 2. Preço iFood/Delivery (Custo + Cartão + Taxa do Aplicativo + Margem de Lucro)
        const deliveryDivisor = 1 - ((cardTaxPct + deliveryFeePct + profitMarginPct) / 100);
        const deliveryPrice = deliveryDivisor > 0 ? (costPerPortion / deliveryDivisor) : (costPerPortion * 2.5);

        // Renderiza nas sugestões
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
            if (typeof showToast === 'function') showToast('Informe o nome da receita!', 'error');
            return;
        }

        const ingredientsData = [];
        document.querySelectorAll('.ingredient-row').forEach(row => {
            ingredientsData.push({
                name: row.querySelector('.ing-name').value,
                qty: row.querySelector('.ing-qty').value,
                unit: row.querySelector('.ing-unit').value,
                purchasePrice: row.querySelector('.ing-purchase-price').value,
                purchaseQty: row.querySelector('.ing-purchase-qty').value
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

            if (typeof showToast === 'function') showToast('Receita e Ficha Técnica salvas!');
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
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:15px; font-size:12px;">Nenhuma receita salva ainda.</div>';
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
                        <button class="btn btn-sm btn-secondary" onclick="CalculatorManager.loadRecipeToForm('${r.id || r.name}')" style="font-size:11px; padding:4px 8px;">✏️ Editar</button>
                    </div>
                </div>
            `).join('');

        } catch (e) {
            container.innerHTML = '<div style="color:#EF4444; text-align:center; padding:10px;">Erro ao carregar receitas.</div>';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('ingredientsList')) {
        CalculatorManager.init();
    }
});
