// js/menu-admin.js - Gestão, CRUD, Reordenação por Drag & Drop e Categorias Expansíveis/Recolhíveis

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text || '')));
    return div.innerHTML;
}

const MenuAdminManager = {
    async init() {
        await this.renderAdminProductsList();
    },

    async uploadProductImage(file) {
        try {
            if (typeof dbClient === 'undefined') return null;
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `dishes/${fileName}`;

            const { error } = await dbClient.storage
                .from('product-images')
                .upload(filePath, file, { cacheControl: '3600', upsert: false });

            if (error) {
                console.error('Erro no upload:', error);
                return null;
            }

            const { data: publicUrlData } = dbClient.storage
                .from('product-images')
                .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
        } catch (e) {
            console.error('Erro ao processar imagem:', e);
            return null;
        }
    },

    addComplementRow(name = '', price = '') {
        const list = document.getElementById('complements_list');
        if (!list) return;

        const row = document.createElement('div');
        row.className = 'complement-row';
        row.style.cssText = 'display:flex; gap:8px; align-items:center; margin-bottom:8px;';
        row.innerHTML = `
            <input type="text" class="comp-name" value="${escapeHtml(name)}" placeholder="Ex: Queijo Extra" style="flex:2; font-size:12px; padding:8px; background:#1E293B; color:#F1F5F9; border:1px solid #334155; border-radius:6px;">
            <input type="number" step="0.01" class="comp-price" value="${price !== '' ? price : ''}" placeholder="R$ 0.00" style="flex:1; font-size:12px; padding:8px; background:#1E293B; color:#F1F5F9; border:1px solid #334155; border-radius:6px;">
            <button type="button" onclick="this.parentElement.remove()" style="background:#EF4444; color:#fff; border:none; border-radius:6px; padding:8px 12px; cursor:pointer; font-size:12px;" title="Remover">🗑️</button>
        `;
        list.appendChild(row);
    },

    toggleCategoryCollapse(btn) {
        const catBlock = btn.closest('.category-block');
        if (!catBlock) return;
        const container = catBlock.querySelector('.category-products-container');
        if (!container) return;

        const isCollapsed = container.style.display === 'none';
        if (isCollapsed) {
            container.style.display = 'flex';
            btn.innerHTML = '▼';
            btn.title = 'Recolher Categoria';
        } else {
            container.style.display = 'none';
            btn.innerHTML = '▶';
            btn.title = 'Expandir Categoria';
        }
    },

    async renderAdminProductsList() {
        const container = document.getElementById('admin-products-list');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; color:#94A3B8; padding:20px;">Carregando pratos e categorias...</div>';

        try {
            if (typeof dbClient === 'undefined') return;

            const { data: products, error } = await dbClient
                .from('products')
                .select('*')
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) {
                container.innerHTML = `<div style="color:#EF4444; text-align:center;">Erro: ${escapeHtml(error.message)}</div>`;
                return;
            }

            if (!products || products.length === 0) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px;">Nenhum prato cadastrado ainda.</div>';
                return;
            }

            window.currentAdminProducts = products;

            // Agrupa produtos por Categoria preservando a ordem do display_order
            const grouped = {};
            products.forEach(p => {
                const cat = p.category || 'Geral';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(p);
            });

            let html = '';
            for (const [catName, catProducts] of Object.entries(grouped)) {
                const safeCat = escapeHtml(catName);
                const activeCount = catProducts.filter(p => p.is_active).length;

                html += `
                    <div class="category-block" data-category="${safeCat}" style="margin-bottom:16px; background:#0F172A; border:1px solid #334155; border-radius:12px; padding:12px; transition: all 0.2s;">
                        
                        <!-- Cabeçalho da Categoria com Alça Master -->
                        <div class="category-header" style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div class="category-drag-handle" style="cursor:grab; padding:6px 12px; background:#1E293B; color:#FF6B35; border-radius:6px; font-size:18px; user-select:none; touch-action:none; border:1px solid #334155;" title="Clique e arraste para mover esta CATEGORIA inteira">
                                    ⣿ <span style="font-size:11px; font-weight:bold; color:#F1F5F9;">Categoria</span>
                                </div>
                                <div>
                                    <strong style="color:#F59E0B; font-size:15px; text-transform:uppercase; letter-spacing:0.5px;">📌 ${safeCat}</strong>
                                    <span style="font-size:11px; color:#94A3B8; display:block;">${catProducts.length} item(ns) • ${activeCount} ativo(s)</span>
                                </div>
                            </div>

                            <button type="button" class="btn-toggle-category" onclick="MenuAdminManager.toggleCategoryCollapse(this)" style="background:#1E293B; border:1px solid #334155; color:#F1F5F9; border-radius:8px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; font-weight:bold; transition: background 0.2s;" title="Recolher / Expandir Categoria">
                                ▼
                            </button>
                        </div>

                        <!-- Lista dos Pratos desta Categoria -->
                        <div class="category-products-container" style="display:flex; flex-direction:column; gap:8px; margin-top:12px; padding-top:10px; border-top:1px solid #1E293B;">
                            ${catProducts.map(p => {
                                const discount = Number(p.discount_pct || 0);
                                const originalPrice = Number(p.price || 0);
                                const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;
                                const safeName = escapeHtml(p.name);

                                return `
                                    <div class="card product-admin-card" data-id="${escapeHtml(p.id)}" style="padding:10px 12px; display:flex; justify-content:space-between; align-items:center; background:#1E293B; border-left:4px solid ${p.is_active ? '#10B981' : '#64748B'}; transition: transform 0.15s;">
                                        <div style="display:flex; align-items:center; gap:10px; flex:1;">
                                            <div class="product-drag-handle" style="cursor:grab; padding:4px 8px; color:#64748B; font-size:18px; user-select:none; touch-action:none;" title="Arrastar prato">
                                                ⣿
                                            </div>
                                            ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" style="width:42px; height:42px; border-radius:8px; object-fit:cover; pointer-events:none;">` : '<span style="font-size:20px;">🍽️</span>'}
                                            <div>
                                                <strong style="color:#F1F5F9; font-size:13px; display:block;">
                                                    ${safeName} ${p.is_cross_sell ? '<small style="color:#60A5FA;">[Peça Junto]</small>' : ''}
                                                </strong>
                                                <span style="font-size:11px; color:#94A3B8;">
                                                    R$ ${finalPrice.toFixed(2)} 
                                                    ${discount > 0 ? `<span style="color:#10B981;">(-${discount}%)</span>` : ''}
                                                </span>
                                            </div>
                                        </div>

                                        <div style="display:flex; gap:6px; align-items:center;" onclick="event.stopPropagation();">
                                            <button class="btn btn-sm ${p.is_active ? 'btn-success' : 'btn-secondary'}" onclick="MenuAdminManager.toggleProductActive('${escapeHtml(p.id)}', ${!p.is_active})" title="${p.is_active ? 'Pausar item' : 'Ativar item'}">
                                                ${p.is_active ? '🟢' : '⚪'}
                                            </button>
                                            <button class="btn btn-sm btn-secondary" onclick="MenuAdminManager.openProductModal('${escapeHtml(p.id)}')" title="Editar">✏️</button>
                                            <button class="btn btn-sm btn-danger" onclick="MenuAdminManager.deleteProduct('${escapeHtml(p.id)}')" title="Excluir">🗑️</button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            container.innerHTML = html;

            // Ativa Drag & Drop independente para Categorias e Pratos
            this.initCategoryAndProductDrag();

        } catch (e) {
            console.error('Erro ao renderizar lista administrativa:', e);
        }
    },

    initCategoryAndProductDrag() {
        const mainContainer = document.getElementById('admin-products-list');
        if (!mainContainer) return;

        let draggedCategory = null;
        let touchActiveCategory = null;

        // 1. REORDENAÇÃO DE CATEGORIAS (Desktop & Mobile)
        const categoryBlocks = mainContainer.querySelectorAll('.category-block');

        categoryBlocks.forEach(catBlock => {
            const catHandle = catBlock.querySelector('.category-drag-handle');
            if (!catHandle) return;

            // Habilita drag nativo apenas ao pressionar a alça da categoria
            catHandle.addEventListener('mousedown', () => {
                catBlock.setAttribute('draggable', 'true');
            });

            catHandle.addEventListener('mouseup', () => {
                if (!draggedCategory) catBlock.removeAttribute('draggable');
            });

            catBlock.addEventListener('dragstart', (e) => {
                if (e.target !== catBlock) return;
                draggedCategory = catBlock;
                catBlock.style.opacity = '0.5';
                catBlock.style.border = '2px dashed #FF6B35';
                e.dataTransfer.effectAllowed = 'move';
                e.stopPropagation();
            });

            catBlock.addEventListener('dragend', async (e) => {
                e.stopPropagation();
                catBlock.removeAttribute('draggable');
                if (draggedCategory) {
                    catBlock.style.opacity = '1';
                    catBlock.style.border = '1px solid #334155';
                    draggedCategory = null;
                    await this.saveGlobalSequenceFromDOM();
                }
            });

            catBlock.addEventListener('dragover', (e) => {
                if (!draggedCategory || draggedCategory === catBlock) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';

                const rect = catBlock.getBoundingClientRect();
                const midPoint = rect.top + rect.height / 2;

                if (e.clientY < midPoint) {
                    mainContainer.insertBefore(draggedCategory, catBlock);
                } else {
                    mainContainer.insertBefore(draggedCategory, catBlock.nextSibling);
                }
            });

            // Touch para Celulares/Tablets (Categorias)
            catHandle.addEventListener('touchstart', (e) => {
                touchActiveCategory = catBlock;
                catBlock.style.opacity = '0.6';
                catBlock.style.border = '2px dashed #FF6B35';
            }, { passive: true });

            catHandle.addEventListener('touchmove', (e) => {
                if (!touchActiveCategory) return;
                if (e.cancelable) e.preventDefault(); // Impede rolagem da tela durante arrasto
                const touch = e.touches[0];
                const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
                if (!targetEl) return;

                const targetCat = targetEl.closest('.category-block');
                if (targetCat && targetCat !== touchActiveCategory && targetCat.parentNode === mainContainer) {
                    const rect = targetCat.getBoundingClientRect();
                    const midPoint = rect.top + rect.height / 2;

                    if (touch.clientY < midPoint) {
                        mainContainer.insertBefore(touchActiveCategory, targetCat);
                    } else {
                        mainContainer.insertBefore(touchActiveCategory, targetCat.nextSibling);
                    }
                }
            }, { passive: false });

            catHandle.addEventListener('touchend', async () => {
                if (touchActiveCategory) {
                    touchActiveCategory.style.opacity = '1';
                    touchActiveCategory.style.border = '1px solid #334155';
                    touchActiveCategory = null;
                    await this.saveGlobalSequenceFromDOM();
                }
            });
        });

        // 2. REORDENAÇÃO DE PRATOS DENTRO DA CATEGORIA (Desktop & Mobile)
        let draggedProduct = null;
        let touchActiveProduct = null;
        const productCards = mainContainer.querySelectorAll('.product-admin-card');

        productCards.forEach(prodCard => {
            const prodHandle = prodCard.querySelector('.product-drag-handle');
            if (!prodHandle) return;

            prodHandle.addEventListener('mousedown', () => {
                prodCard.setAttribute('draggable', 'true');
            });

            prodHandle.addEventListener('mouseup', () => {
                if (!draggedProduct) prodCard.removeAttribute('draggable');
            });

            prodCard.addEventListener('dragstart', (e) => {
                draggedProduct = prodCard;
                prodCard.style.opacity = '0.4';
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'move';
            });

            prodCard.addEventListener('dragend', async (e) => {
                e.stopPropagation();
                prodCard.removeAttribute('draggable');
                if (draggedProduct) {
                    prodCard.style.opacity = '1';
                    draggedProduct = null;
                    await this.saveGlobalSequenceFromDOM();
                }
            });

            prodCard.addEventListener('dragover', (e) => {
                if (!draggedProduct || draggedProduct === prodCard) return;
                e.preventDefault();
                e.stopPropagation();

                const parentContainer = prodCard.parentNode;
                const rect = prodCard.getBoundingClientRect();
                const midPoint = rect.top + rect.height / 2;

                if (e.clientY < midPoint) {
                    parentContainer.insertBefore(draggedProduct, prodCard);
                } else {
                    parentContainer.insertBefore(draggedProduct, prodCard.nextSibling);
                }
            });

            // Touch para Celulares/Tablets (Pratos)
            prodHandle.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                touchActiveProduct = prodCard;
                prodCard.style.opacity = '0.6';
            }, { passive: true });

            prodHandle.addEventListener('touchmove', (e) => {
                if (!touchActiveProduct) return;
                e.stopPropagation();
                if (e.cancelable) e.preventDefault();
                const touch = e.touches[0];
                const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
                if (!targetEl) return;

                const targetProd = targetEl.closest('.product-admin-card');
                const parentCat = touchActiveProduct.parentNode;

                if (targetProd && targetProd !== touchActiveProduct && targetProd.parentNode === parentCat) {
                    const rect = targetProd.getBoundingClientRect();
                    const midPoint = rect.top + rect.height / 2;

                    if (touch.clientY < midPoint) {
                        parentCat.insertBefore(touchActiveProduct, targetProd);
                    } else {
                        parentCat.insertBefore(touchActiveProduct, targetProd.nextSibling);
                    }
                }
            }, { passive: false });

            prodHandle.addEventListener('touchend', async (e) => {
                e.stopPropagation();
                if (touchActiveProduct) {
                    touchActiveProduct.style.opacity = '1';
                    touchActiveProduct = null;
                    await this.saveGlobalSequenceFromDOM();
                }
            });
        });
    },

    async saveGlobalSequenceFromDOM() {
        const mainContainer = document.getElementById('admin-products-list');
        if (!mainContainer) return;

        const productCards = Array.from(mainContainer.querySelectorAll('.product-admin-card'));
        if (productCards.length === 0) return;

        try {
            if (typeof dbClient === 'undefined') return;

            const updatePromises = productCards.map((card, index) => {
                const id = card.getAttribute('data-id');
                if (!id) return Promise.resolve();

                return dbClient
                    .from('products')
                    .update({ display_order: index })
                    .eq('id', id);
            });

            await Promise.all(updatePromises);

            if (typeof showToast === 'function') {
                showToast('Nova ordem salva com sucesso!', 'success');
            }
        } catch (e) {
            console.error('Erro ao salvar nova ordem:', e);
            if (typeof showToast === 'function') {
                showToast('Erro ao salvar ordem no banco de dados.', 'error');
            }
        }
    },

    handleCategoryChange(val) {
        const newCatGroup = document.getElementById('new_category_group');
        if (newCatGroup) {
            if (val === '__new__') {
                newCatGroup.style.display = 'block';
                const input = document.getElementById('prod_custom_category');
                if (input) input.focus();
            } else {
                newCatGroup.style.display = 'none';
            }
        }
    },

    async openProductModal(productId = null) {
        let p = { name: '', description: '', price: '', category: 'Pastéis Especialidades', discount_pct: 0, is_active: true, is_cross_sell: false, image_url: '', complements: [] };

        if (productId && typeof dbClient !== 'undefined') {
            const { data } = await dbClient.from('products').select('*').eq('id', productId).single();
            if (data) p = data;
        }

        const defaultCategories = ["Pastéis Especialidades", "Pastéis", "Marmitas", "Batatas Recheadas", "Bebidas", "Sobremesas"];
        const customCategories = window.currentAdminProducts 
            ? window.currentAdminProducts.map(item => item.category).filter(Boolean)
            : [];
        
        if (p.category) customCategories.push(p.category);

        const uniqueCategories = [...new Set([...defaultCategories, ...customCategories])];
        const isExistingCategory = uniqueCategories.includes(p.category);
        const selectedValue = isExistingCategory ? p.category : (p.category ? p.category : uniqueCategories[0]);

        const categoryOptionsHtml = uniqueCategories.map(cat => 
            `<option value="${escapeHtml(cat)}" ${cat === selectedValue ? 'selected' : ''}>📌 ${escapeHtml(cat)}</option>`
        ).join('') + `<option value="__new__" style="color:#FF6B35; font-weight:bold;">➕ Nova Categoria...</option>`;

        let compsList = [];
        if (Array.isArray(p.complements)) {
            compsList = p.complements;
        } else if (typeof p.complements === 'string') {
            try { compsList = JSON.parse(p.complements); } catch(e){}
        }

        let complementsRowsHtml = compsList.map(c => `
            <div class="complement-row" style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                <input type="text" class="comp-name" value="${escapeHtml(c.name || '')}" placeholder="Ex: Queijo Extra" style="flex:2; font-size:12px; padding:8px; background:#1E293B; color:#F1F5F9; border:1px solid #334155; border-radius:6px;">
                <input type="number" step="0.01" class="comp-price" value="${c.price !== undefined ? c.price : ''}" placeholder="R$ 0.00" style="flex:1; font-size:12px; padding:8px; background:#1E293B; color:#F1F5F9; border:1px solid #334155; border-radius:6px;">
                <button type="button" onclick="this.parentElement.remove()" style="background:#EF4444; color:#fff; border:none; border-radius:6px; padding:8px 12px; cursor:pointer; font-size:12px;" title="Remover">🗑️</button>
            </div>
        `).join('');

        const bodyHtml = `
            <div class="form-group">
                <label>Nome do Prato / Item *</label>
                <input type="text" id="prod_name" value="${escapeHtml(p.name || '')}" placeholder="Ex: Pastel Duplo de Carne">
            </div>

            <div class="form-group">
                <label>Categoria *</label>
                <select id="select_prod_category" onchange="MenuAdminManager.handleCategoryChange(this.value)" style="width:100%; padding:10px; background:#1E293B; color:#F1F5F9; border:1px solid #334155; border-radius:8px; font-size:14px; cursor:pointer;">
                    ${categoryOptionsHtml}
                </select>
                <div id="new_category_group" style="display:none; margin-top:8px;">
                    <input type="text" id="prod_custom_category" placeholder="Digite o nome da nova categoria..." style="width:100%; padding:10px; background:#0F172A; color:#FF6B35; border:1px solid #FF6B35; border-radius:8px; font-size:13px; font-weight:bold;">
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="form-group">
                    <label>Preço (R$) *</label>
                    <input type="number" step="0.01" id="prod_price" value="${p.price || ''}" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Desconto (%)</label>
                    <input type="number" id="prod_discount" value="${p.discount_pct || 0}" placeholder="0" min="0" max="100">
                </div>
            </div>

            <div class="form-group">
                <label>Descrição / Ingredientes</label>
                <textarea id="prod_desc" rows="2" placeholder="Ex: Carne moída especial e tempero da casa">${escapeHtml(p.description || '')}</textarea>
            </div>

            <div class="form-group" style="background:#0F172A; padding:12px; border-radius:8px; border:1px solid #334155;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div>
                        <label style="color:#F59E0B; font-weight:bold; margin:0; display:block;">➕ Adicionais / Opcionais do Prato</label>
                        <small style="color:#94A3B8; font-size:10px;">Defina o nome e o preço exato do item</small>
                    </div>
                    <button type="button" class="btn btn-sm btn-secondary" onclick="MenuAdminManager.addComplementRow()" style="width:auto; font-size:11px; padding:5px 10px; background:#334155;">+ Adicionar Item</button>
                </div>
                <div id="complements_list">
                    ${complementsRowsHtml}
                </div>
            </div>

            <div class="form-group">
                <label>Foto do Prato (Galeria / PC)</label>
                <input type="file" id="prod_file" accept="image/*" style="padding:8px; font-size:12px;">
            </div>
            <div class="form-group">
                <label>Ou URL da Imagem</label>
                <input type="text" id="prod_img" value="${escapeHtml(p.image_url || '')}" placeholder="https://link-da-imagem.com/foto.jpg">
            </div>

            <div style="margin-bottom:14px; display:flex; gap:12px; flex-wrap:wrap;">
                <label style="font-size:12px; color:#CBD5E1; display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="prod_active" ${p.is_active ? 'checked' : ''}> Item Ativo
                </label>
                <label style="font-size:12px; color:#CBD5E1; display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="prod_cross" ${p.is_cross_sell ? 'checked' : ''}> Sugerir no Checkout (Peça Junto)
                </label>
            </div>
            <button class="btn btn-large" id="btn_save_prod" onclick="MenuAdminManager.saveProduct('${escapeHtml(productId || '')}')">💾 Salvar Prato</button>
        `;

        if (typeof openModal === 'function') {
            openModal(productId ? '✏️ Editar Prato' : '➕ Novo Prato', bodyHtml);
        }
    },

    async saveProduct(productId = '') {
        const name = document.getElementById('prod_name')?.value.trim();
        const selectedCat = document.getElementById('select_prod_category')?.value;
        const customCat = document.getElementById('prod_custom_category')?.value.trim();

        if (selectedCat === '__new__' && !customCat) {
            if (typeof showToast === 'function') showToast('Por favor, digite o nome da nova categoria!', 'error');
            else alert('Por favor, digite o nome da nova categoria!');
            return;
        }

        const category = (selectedCat === '__new__' ? customCat : selectedCat) || 'Geral';
        const price = parseFloat(document.getElementById('prod_price')?.value) || 0;
        const discount_pct = parseInt(document.getElementById('prod_discount')?.value) || 0;
        const description = document.getElementById('prod_desc')?.value.trim() || '';
        let image_url = document.getElementById('prod_img')?.value.trim() || '';
        const is_active = document.getElementById('prod_active')?.checked ?? true;
        const is_cross_sell = document.getElementById('prod_cross')?.checked ?? false;
        const fileInput = document.getElementById('prod_file');
        const saveBtn = document.getElementById('btn_save_prod');

        if (!name || price <= 0) {
            if (typeof showToast === 'function') showToast('Preencha o nome e um preço válido!', 'error');
            else alert('Preencha o nome e um preço válido!');
            return;
        }

        const complementRows = document.querySelectorAll('#complements_list .complement-row');
        const complements = [];
        complementRows.forEach(row => {
            const compName = row.querySelector('.comp-name')?.value.trim();
            const compPrice = parseFloat(row.querySelector('.comp-price')?.value) || 0;
            if (compName) {
                complements.push({ name: compName, price: compPrice });
            }
        });

        try {
            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.textContent = '⌛ Enviando foto...';
                }
                const uploadedUrl = await this.uploadProductImage(fileInput.files[0]);
                if (uploadedUrl) {
                    image_url = uploadedUrl;
                }
            }

            const payload = { name, category, price, discount_pct, description, image_url, is_active, is_cross_sell, complements };

            if (productId) {
                await dbClient.from('products').update(payload).eq('id', productId);
            } else {
                await dbClient.from('products').insert([payload]);
            }

            if (typeof showToast === 'function') showToast('Prato salvo com sucesso!');
            if (typeof closeModal === 'function') closeModal();
            this.renderAdminProductsList();

        } catch (e) {
            console.error('Erro ao salvar produto:', e);
            if (typeof showToast === 'function') showToast('Erro ao salvar prato.', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Salvar Prato';
            }
        }
    },

    async toggleProductActive(productId, newStatus) {
        try {
            if (typeof dbClient === 'undefined') return;
            const { error } = await dbClient.from('products').update({ is_active: newStatus }).eq('id', productId);
            if (error) throw error;
            if (typeof showToast === 'function') showToast(newStatus ? 'Prato ativado!' : 'Prato pausado!');
            this.renderAdminProductsList();
        } catch (e) {
            console.error('Erro ao alterar status do produto:', e);
            if (typeof showToast === 'function') showToast('Erro ao atualizar produto.', 'error');
        }
    },

    async deleteProduct(productId) {
        if (!confirm('Tem certeza que deseja remover este prato do cardápio?')) return;
        try {
            if (typeof dbClient === 'undefined') return;
            const { error } = await dbClient.from('products').delete().eq('id', productId);
            if (error) throw error;
            if (typeof showToast === 'function') showToast('Prato removido do cardápio!');
            this.renderAdminProductsList();
        } catch (e) {
            console.error('Erro ao deletar produto:', e);
            if (typeof showToast === 'function') showToast('Erro ao remover prato.', 'error');
        }
    }
};

window.MenuAdminManager = MenuAdminManager;
window.openNewProductModal = () => MenuAdminManager.openProductModal();

document.addEventListener('DOMContentLoaded', () => {
    MenuAdminManager.init();
});
