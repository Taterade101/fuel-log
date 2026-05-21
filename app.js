  // ---- VERSION ----
  const APP_VERSION = 'v3.0.4';

  // ---- MEALS CONFIG ----
  const MEALS = [
    { key: 'breakfast', label: 'Breakfast', tiIcon: 'ti-coffee',  iconColor: 'var(--accent3)' },
    { key: 'lunch',     label: 'Lunch',     tiIcon: 'ti-sun',     iconColor: 'var(--accent)'  },
    { key: 'dinner',    label: 'Dinner',    tiIcon: 'ti-moon',    iconColor: 'var(--accent2)' },
    { key: 'snack',     label: 'Snacks',    tiIcon: 'ti-star',    iconColor: 'var(--danger)'  },
  ];

  // ---- SERVING SIZES ----
  const SERVING_SIZES = [
    '1 serving', '1 cup', '1 slice', '1 piece', '1 scoop',
    '2 tbsp', '1 oz', '2 oz', '4 oz', '6 oz', '8 oz',
    '12 fl oz', '16 fl oz', '1 bar', '1 packet',
  ];

  // ---- SAVED FOODS ----
  function loadSavedFoods() {
    try { return JSON.parse(localStorage.getItem('fuelSavedFoods') || '[]'); }
    catch { return []; }
  }
  function saveSavedFoods(arr) { localStorage.setItem('fuelSavedFoods', JSON.stringify(arr)); }

  // My Foods state
  let myFoodsView = 'library'; // 'library' | 'form'
  let editingFoodId = null;
  let sfDraft = { name: '', calories: 0, protein_g: 0, serving_size: '1 serving', meal: 'breakfast' };
  let sfPendingImages = [];
  let sfAnalyzed = false;
  let sfParsedItems = [];
  let sfFinalName = '';
  let editModalSource = 'sheet';

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderMyFoods() {
    if (myFoodsView === 'library') {
      const el = document.getElementById('myfoodsContent');
      if (!el) return;
      el.innerHTML = renderFoodsLibrary();
      attachSwipeHandlers();
    } else {
      const el = document.getElementById('sfFormContent');
      if (!el) return;
      el.innerHTML = renderFoodForm();
      attachFoodFormHandlers();
    }
  }

  function renderFoodsLibrary() {
    const foods = loadSavedFoods();
    let html = '';
    MEALS.forEach(m => {
      const mFoods = foods.filter(f => f.meal === m.key);
      html += `<div class="sf-section-hdr">
        <i class="ti ${m.tiIcon} sf-section-hdr-icon" aria-hidden="true" style="color:${m.iconColor}"></i>
        <span class="sf-section-hdr-label">${m.label}</span>
        <button class="sf-section-add-btn" onclick="openNewFood('${m.key}')" aria-label="Add ${m.label} item">
          <i class="ti ti-plus"></i>
        </button>
      </div>`;
      if (mFoods.length > 0) {
        mFoods.forEach(f => {
          html += `<div class="sf-row-wrap" data-id="${f.id}">
            <div class="sf-row-inner">
              <span class="sf-row-name">${escHtml(f.name)}</span>
              <span class="sf-row-meta">${escHtml(f.serving_size || '1 serving')} · ${f.calories} cal · ${f.protein_g}g</span>
              <i class="ti ti-chevron-right sf-row-chevron" aria-hidden="true"></i>
            </div>
            <button class="sf-row-delete-btn" onclick="deleteFood('${f.id}')">Delete</button>
          </div>`;
        });
      } else {
        html += `<div class="sf-empty-row" onclick="openNewFood('${m.key}')">
          <i class="ti ti-plus" aria-hidden="true"></i>
          <span>Add a ${m.label.toLowerCase()} item</span>
        </div>`;
      }
    });
    return html;
  }

  function renderFoodForm() {
    const isEdit = editingFoodId !== null;
    const hasResults = sfParsedItems.length > 0;
    const totalCal = sfParsedItems.reduce((s, x) => s + (x.calories || 0), 0);
    const totalPro = Math.round(sfParsedItems.reduce((s, x) => s + (x.protein_g || 0), 0) * 10) / 10;

    const header = `
      <div class="sf-form-header">
        <button class="sf-back-btn" onclick="backToLibrary()">
          <i class="ti ti-arrow-left" style="font-size:17px"></i>
          My Foods
        </button>
        <span class="sf-form-title">${isEdit ? 'Edit Item' : 'New Item'}</span>
      </div>`;

    // ── Edit mode: flat form, all fields directly editable ──────────────────
    if (isEdit) {
      const editCal = sfParsedItems[0] ? sfParsedItems[0].calories : 0;
      const editPro = sfParsedItems[0] ? sfParsedItems[0].protein_g : 0;
      return header + `
        <div class="sf-summary-card">
          <label class="sf-field-label" style="display:flex;align-items:center;gap:4px">
            Name <i class="ti ti-pencil" style="font-size:10px" aria-hidden="true"></i>
          </label>
          <input type="text" id="sfFinalNameInput" class="sf-name-input" value="${escHtml(sfFinalName)}" placeholder="Item name" style="margin-bottom:14px" />
          <div class="sf-macro-grid">
            <div class="sf-macro-item">
              <div class="sf-macro-label">Calories <i class="ti ti-pencil" style="font-size:9px" aria-hidden="true"></i></div>
              <input type="number" id="sfEditCal" class="sf-macro-input cal" value="${editCal}" min="0" />
            </div>
            <div class="sf-macro-item">
              <div class="sf-macro-label">Protein (g) <i class="ti ti-pencil" style="font-size:9px" aria-hidden="true"></i></div>
              <input type="number" id="sfEditPro" class="sf-macro-input pro" value="${editPro}" min="0" step="0.1" />
            </div>
          </div>
          <label class="sf-field-label">Serving size</label>
          <button class="sf-serving-btn" onclick="openServingPicker()" type="button">
            <span class="sf-serving-val" id="sfServingDisplay">${escHtml(sfDraft.serving_size || '1 serving')}</span>
            <i class="ti ti-chevron-down" aria-hidden="true"></i>
          </button>
          <label class="sf-field-label">Default meal group</label>
          <div class="meal-pills" id="sfMealPills" style="margin-bottom:16px"></div>
          <button class="lv-primary-btn" onclick="saveFood()">Save Item</button>
          <button class="lv-secondary-btn" onclick="confirmDeleteFood('${editingFoodId}')" style="margin-top:8px;color:var(--danger);border-color:var(--danger)">Delete item</button>
        </div>`;
    }

    // ── New item mode: analyze flow ──────────────────────────────────────────
    const summaryHTML = hasResults ? `
      <div class="sf-summary-card">
        <div style="position:relative;">
          <input type="text" id="sfFinalNameInput" class="sf-name-input" value="${escHtml(sfFinalName)}" placeholder="Name this item…" style="padding-right:22px" />
          <i class="ti ti-pencil" style="position:absolute;right:2px;bottom:12px;font-size:13px;color:var(--muted);pointer-events:none" aria-hidden="true"></i>
        </div>
        <div class="sf-summary-totals">
          <span class="sf-total-badge cal">${totalCal} cal</span>
          <span class="sf-total-badge pro">${totalPro}g protein</span>
        </div>
        <label class="sf-field-label">Serving size</label>
        <button class="sf-serving-btn" onclick="openServingPicker()" type="button">
          <span class="sf-serving-val" id="sfServingDisplay">${escHtml(sfDraft.serving_size || '1 serving')}</span>
          <i class="ti ti-chevron-down" aria-hidden="true"></i>
        </button>
        <label class="sf-field-label">Default meal group</label>
        <div class="meal-pills" id="sfMealPills" style="margin-bottom:16px"></div>
        <button class="lv-primary-btn" onclick="saveFood()">Save Item</button>
      </div>` : '';

    return header + `
      <div id="sfComponentsSection" style="display:${hasResults ? 'block' : 'none'}">
        <div class="sf-section-label">COMPONENTS</div>
        <div id="sfResultsArea">
          <div id="sfResultsList"></div>
        </div>
        <div class="sf-combines-into">
          <div class="sf-combines-line"></div>
          <span><i class="ti ti-arrow-down" aria-hidden="true"></i> saves as one item</span>
          <div class="sf-combines-line"></div>
        </div>
      </div>
      ${summaryHTML}
      <div id="sfReanalyzeLabel" style="display:${hasResults ? 'block' : 'none'}">RE-ANALYZE</div>
      <div class="lv-input-card">
        <div id="sfPhotoArea" style="display:none">
          <div class="photo-hint" id="sfPhotoHint"></div>
          <div class="photo-grid" id="sfPhotoGrid"></div>
        </div>
        <textarea id="sfInput" placeholder="Describe it… e.g. Dunkin iced coffee with oat milk, one pump vanilla"></textarea>
        <div class="lv-input-footer">
          <button id="sfPhotoBtn" onclick="(function(){var inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.multiple=true;inp.onchange=function(e){handleSfPhoto(e)};inp.click();})()" aria-label="Add photo">
            <i class="ti ti-camera" aria-hidden="true"></i>Add photo
          </button>
        </div>
      </div>
      <button class="${hasResults ? 'lv-secondary-btn' : 'lv-primary-btn'}" id="sfAnalyzeBtn" onclick="analyzeFood()" style="margin-top:8px">${hasResults ? 'Re-analyze' : 'Analyze'}</button>`;
  }

  function attachFoodFormHandlers() {
    renderSfMealPills(sfDraft.meal);
    renderSfResultsList();
    if (sfPendingImages.length > 0) renderSfPhotoGrid();
  }

  function renderSfMealPills(selected) {
    const el = document.getElementById('sfMealPills');
    if (!el) return;
    el.innerHTML = MEALS.map(m =>
      `<button class="mpill${m.key === selected ? ' sel' : ''}" onclick="selectSfMeal('${m.key}')">${m.label}</button>`
    ).join('');
  }

  function selectSfMeal(key) {
    sfDraft.meal = key;
    renderSfMealPills(key);
  }

  function openNewFood(mealKey) {
    myFoodsView = 'form';
    editingFoodId = null;
    sfPendingImages = [];
    sfAnalyzed = false;
    sfParsedItems = [];
    sfFinalName = '';
    sfDraft = { name: '', calories: 0, protein_g: 0, serving_size: '1 serving', meal: mealKey || 'breakfast' };
    const tb = document.querySelector('.tab-bar'); if (tb) tb.style.display = 'none';
    renderMyFoods();
    document.getElementById('sfFormView').classList.add('open');
    lockScroll();
  }

  function openEditFood(id) {
    const food = loadSavedFoods().find(f => f.id === id);
    if (!food) return;
    myFoodsView = 'form';
    editingFoodId = id;
    sfPendingImages = [];
    sfAnalyzed = true;
    sfFinalName = food.name;
    const ss = food.serving_size || '1 serving';
    const ssM = ss.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    const ssQty = ssM ? parseFloat(ssM[1]) : 1;
    const ssUnit = ssM ? ssM[2] : ss;
    sfParsedItems = [{
      name: food.name,
      calories: food.calories,
      protein_g: food.protein_g,
      quantity: ssQty,
      quantity_unit: ssUnit,
      cal_per_unit: ssQty > 0 ? Math.round(food.calories / ssQty * 10) / 10 : food.calories,
      protein_per_unit: ssQty > 0 ? Math.round(food.protein_g / ssQty * 10) / 10 : food.protein_g
    }];
    sfDraft = { name: food.name, calories: food.calories, protein_g: food.protein_g, serving_size: food.serving_size || '1 serving', meal: food.meal };
    const tb = document.querySelector('.tab-bar'); if (tb) tb.style.display = 'none';
    renderMyFoods();
    document.getElementById('sfFormView').classList.add('open');
    lockScroll();
  }

  function backToLibrary() {
    myFoodsView = 'library';
    editingFoodId = null;
    sfPendingImages = [];
    sfAnalyzed = false;
    sfParsedItems = [];
    sfFinalName = '';
    const tb = document.querySelector('.tab-bar'); if (tb) tb.style.display = '';
    document.getElementById('sfFormView').classList.remove('open');
    unlockScroll();
    renderMyFoods();
  }

  async function analyzeFood() {
    const input = document.getElementById('sfInput');
    const btn   = document.getElementById('sfAnalyzeBtn');
    const text  = input ? input.value.trim() : '';
    if (!text && sfPendingImages.length === 0) return;
    if (!getApiKey()) { showToast('Add your API key in Settings first'); return; }
    btn.disabled = true;
    btn.textContent = 'Analyzing…';

    const systemPrompt = `You are a nutrition assistant. The user wants to save a custom food item to their personal library.

Respond with JSON ONLY. No markdown, no backticks.
Format: {"name":"Suggested overall name for the item","items":[{"name":"...","calories":number,"protein_g":number,"quantity":number,"quantity_unit":"...","cal_per_unit":number,"protein_per_unit":number}]}

Break the food into its components (ingredients, add-ins, etc.). Each item must have all fields.
quantity_unit describes the portion (e.g. "serving", "oz", "cup", "pump", "tbsp").
cal_per_unit and protein_per_unit equal calories/protein_g when quantity is 1.
The top-level "name" should be a natural overall label for the combined item.`;

    const userContent = sfPendingImages.length > 0
      ? [...sfPendingImages.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })),
         { type: 'text', text: text || 'What is this food? List all components with calories and protein.' }]
      : text;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': getApiKey(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800, system: systemPrompt, messages: [{ role: 'user', content: userContent }] })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('API error: ' + ((data.error && data.error.message) || res.status));
        btn.disabled = false; btn.textContent = sfParsedItems.length > 0 ? 'Re-analyze' : 'Analyze';
        return;
      }
      const rawText = data.content[0].text.trim();
      let parsed;
      try { parsed = JSON.parse(rawText); }
      catch(e) { const m = rawText.match(/\{[\s\S]*\}/); try { parsed = m ? JSON.parse(m[0]) : null; } catch(e2) { parsed = null; } }
      if (parsed && parsed.items && parsed.items.length > 0) {
        sfParsedItems = parsed.items.map(item => ({
          name: item.name,
          calories: Math.round(item.calories || 0),
          protein_g: Math.round((item.protein_g || 0) * 10) / 10,
          quantity: item.quantity || 1,
          quantity_unit: item.quantity_unit || 'serving',
          cal_per_unit: item.cal_per_unit || item.calories,
          protein_per_unit: item.protein_per_unit || item.protein_g
        }));
        sfFinalName = parsed.name || sfParsedItems[0].name;
        sfAnalyzed = true;
        renderMyFoods();
      } else {
        showToast('Could not parse — try rephrasing');
        btn.disabled = false; btn.textContent = sfParsedItems.length > 0 ? 'Re-analyze' : 'Analyze';
      }
    } catch(err) {
      showToast('Error: ' + (err && err.message ? err.message : 'Unknown'));
      btn.disabled = false; btn.textContent = sfParsedItems.length > 0 ? 'Re-analyze' : 'Analyze';
    }
  }

  function saveFood() {
    const nameInput = document.getElementById('sfFinalNameInput');
    const name = (nameInput && nameInput.value.trim()) || sfFinalName;
    if (!name) { showToast('Add a name first'); return; }
    let cal, pro;
    if (editingFoodId) {
      // Edit mode: read directly from the flat form inputs
      const calInput = document.getElementById('sfEditCal');
      const proInput = document.getElementById('sfEditPro');
      cal = calInput ? Math.round(parseFloat(calInput.value) || 0) : 0;
      pro = Math.round((proInput ? parseFloat(proInput.value) || 0 : 0) * 10) / 10;
    } else {
      if (sfParsedItems.length === 0) { showToast('Analyze the food first'); return; }
      cal = sfParsedItems.reduce((s, x) => s + (x.calories || 0), 0);
      pro = Math.round(sfParsedItems.reduce((s, x) => s + (x.protein_g || 0), 0) * 10) / 10;
    }
    const foods = loadSavedFoods();
    if (editingFoodId) {
      const idx = foods.findIndex(f => f.id === editingFoodId);
      if (idx >= 0) foods[idx] = { ...foods[idx], name, calories: cal, protein_g: pro, serving_size: sfDraft.serving_size, meal: sfDraft.meal };
    } else {
      foods.push({ id: Date.now().toString(), name, calories: cal, protein_g: pro, serving_size: sfDraft.serving_size, meal: sfDraft.meal });
    }
    saveSavedFoods(foods);
    const wasEdit = !!editingFoodId;
    backToLibrary();
    showToast(wasEdit ? 'Item updated' : 'Item saved');
  }

  function deleteFood(id) {
    saveSavedFoods(loadSavedFoods().filter(f => f.id !== id));
    if (myFoodsView === 'form') {
      backToLibrary();
    } else {
      renderMyFoods();
    }
    showToast('Item deleted');
  }

  function confirmDeleteFood(id) {
    showConfirm('Delete this item?', 'It will be removed from your My Foods library.', 'Delete', () => deleteFood(id));
  }

  // ---- SWIPE TO DELETE ----
  function attachSwipeHandlers() {
    document.querySelectorAll('.sf-row-wrap').forEach(wrap => {
      const inner = wrap.querySelector('.sf-row-inner');
      if (!inner) return;
      let startX = 0, startY = 0, swiping = false, scrolling = false;
      inner.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        swiping = false; scrolling = false;
      }, { passive: true });
      inner.addEventListener('touchmove', e => {
        if (scrolling) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (!swiping && Math.abs(dy) > Math.abs(dx)) { scrolling = true; return; }
        if (Math.abs(dx) > 6) { swiping = true; e.preventDefault(); }
      }, { passive: false });
      inner.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (swiping) {
          if (dx < -40) {
            document.querySelectorAll('.sf-row-inner.swiped').forEach(el => { if (el !== inner) el.classList.remove('swiped'); });
            inner.classList.add('swiped');
          } else {
            inner.classList.remove('swiped');
          }
        } else if (!scrolling && Math.abs(dx) < 8 && Math.abs(dy) < 8) {
          if (inner.classList.contains('swiped')) {
            inner.classList.remove('swiped');
          } else {
            openEditFood(wrap.dataset.id);
          }
        }
      }, { passive: true });
    });
  }

  document.addEventListener('touchstart', e => {
    if (!e.target.closest('.sf-row-wrap')) {
      document.querySelectorAll('.sf-row-inner.swiped').forEach(el => el.classList.remove('swiped'));
    }
  }, { passive: true });

  // ---- SERVING SIZE PICKER ----
  function openServingPicker() {
    const current = sfDraft.serving_size || '1 serving';
    document.getElementById('servingPickerList').innerHTML = SERVING_SIZES.map(s =>
      `<div class="sf-picker-item${s === current ? ' selected' : ''}" onclick="selectServingSize('${s}')">
        <span>${s}</span>
        ${s === current ? '<i class="ti ti-check" aria-hidden="true"></i>' : '<span></span>'}
      </div>`
    ).join('');
    document.getElementById('servingPicker').classList.add('open');
  }

  function closeServingPicker() { document.getElementById('servingPicker').classList.remove('open'); }

  function handleServingPickerBg(e) {
    if (e.target === document.getElementById('servingPicker')) closeServingPicker();
  }

  function selectServingSize(size) {
    sfDraft.serving_size = size;
    const el = document.getElementById('sfServingDisplay');
    if (el) el.textContent = size;
    closeServingPicker();
  }

  // ---- PHOTO for My Foods ----
  function renderSfPhotoGrid() {
    const grid = document.getElementById('sfPhotoGrid');
    const hint = document.getElementById('sfPhotoHint');
    const area = document.getElementById('sfPhotoArea');
    const btn  = document.getElementById('sfPhotoBtn');
    if (!grid) return;
    if (sfPendingImages.length === 0) {
      if (area) area.style.display = 'none';
      if (btn) btn.classList.remove('has-photo');
      return;
    }
    if (area) area.style.display = 'block';
    if (hint) hint.innerHTML =
      '<i class="ti ti-camera" style="font-size:13px;vertical-align:-1px;margin-right:4px"></i>' +
      (sfPendingImages.length === 1 ? '1 photo ready' : sfPendingImages.length + ' photos ready');
    if (btn) btn.classList.add('has-photo');
    grid.style.display = 'flex';
    grid.innerHTML = sfPendingImages.map((img, i) =>
      `<div class="photo-thumb">
        <img src="${img.previewURL}" alt="Photo ${i+1}" />
        <button class="photo-thumb-clear" onclick="clearSfPhoto(${i})">&#215;</button>
      </div>`).join('');
  }

  function clearSfPhoto(i) { sfPendingImages.splice(i, 1); renderSfPhotoGrid(); }

  function handleSfPhoto(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    const remaining = 3 - sfPendingImages.length;
    if (remaining <= 0) { showToast('Max 3 photos'); event.target.value = ''; return; }
    files.slice(0, remaining).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        compressImage(e.target.result, (data, mediaType) => {
          sfPendingImages.push({ data, mediaType, previewURL: e.target.result });
          renderSfPhotoGrid();
        });
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  }

  function renderSfResultsList() {
    const section        = document.getElementById('sfComponentsSection');
    const resultsList    = document.getElementById('sfResultsList');
    const reanalyzeLabel = document.getElementById('sfReanalyzeLabel');
    if (!section || !resultsList) return;
    if (sfParsedItems.length === 0) {
      section.style.display = 'none';
      if (reanalyzeLabel) reanalyzeLabel.style.display = 'none';
      const aBtn = document.getElementById('sfAnalyzeBtn');
      if (aBtn) { aBtn.className = 'lv-primary-btn'; aBtn.textContent = 'Analyze'; aBtn.style.marginTop = '8px'; }
      return;
    }
    resultsList.innerHTML = sfParsedItems.map((item, i) =>
      `<div class="sheet-result-row" onclick="editSfItem(${i})">
        <div class="sheet-result-info">
          <div class="sheet-result-name">${escHtml(item.name)}</div>
          <div class="sheet-result-meta">${item.quantity} ${escHtml(item.quantity_unit)} · ${item.calories} cal · ${item.protein_g}g protein</div>
        </div>
        <i class="ti ti-pencil" style="font-size:13px;color:var(--muted);flex-shrink:0;margin-right:6px" aria-hidden="true"></i>
        <button class="sheet-result-del" onclick="event.stopPropagation();deleteSfItem(${i})" aria-label="Remove item">&#215;</button>
      </div>`
    ).join('');
    resultsArea.style.display = 'block';
    if (reanalyzeLabel) reanalyzeLabel.style.display = 'block';
    const aBtn = document.getElementById('sfAnalyzeBtn');
    if (aBtn) { aBtn.className = 'lv-secondary-btn'; aBtn.textContent = 'Re-analyze'; }
    // Update totals in summary card if visible
    const totalCal = sfParsedItems.reduce((s, x) => s + (x.calories || 0), 0);
    const totalPro = Math.round(sfParsedItems.reduce((s, x) => s + (x.protein_g || 0), 0) * 10) / 10;
    const calEl = document.querySelector('.sf-summary-card .sf-total-badge.cal');
    const proEl = document.querySelector('.sf-summary-card .sf-total-badge.pro');
    if (calEl) calEl.textContent = totalCal + ' cal';
    if (proEl) proEl.textContent = totalPro + 'g protein';
  }

  function editSfItem(i) {
    const item = sfParsedItems[i];
    if (!item) return;
    editModalSource = 'sf';
    editModalIndex = i;
    const qty = item.quantity || 1;
    stagingEditCalPer = item.cal_per_unit != null ? item.cal_per_unit : item.calories / qty;
    stagingEditProPer = item.protein_per_unit != null ? item.protein_per_unit : item.protein_g / qty;
    document.getElementById('emName').value = item.name;
    document.getElementById('emQty').value  = qty;
    document.getElementById('emQtyUnit').textContent = item.quantity_unit || 'serving';
    document.getElementById('emCal').value  = item.calories;
    document.getElementById('emPro').value  = item.protein_g;
    document.getElementById('editItemOverlay').style.display = 'block';
    document.getElementById('editItemModal').style.display  = 'block';
    setTimeout(function() { document.getElementById('emName').focus(); }, 80);
  }

  function deleteSfItem(i) {
    sfParsedItems.splice(i, 1);
    if (sfParsedItems.length === 0) {
      sfFinalName = '';
      sfAnalyzed = false;
      renderMyFoods();
      return;
    }
    renderSfResultsList();
  }

  // ---- MEAL STATE ----
  let collapsedMeals = new Set();

  function toggleMealCollapse(key) {
    if (collapsedMeals.has(key)) collapsedMeals.delete(key);
    else collapsedMeals.add(key);
    const section = document.querySelector('.meal-section[data-meal="' + key + '"]');
    if (!section) return;
    const items   = section.querySelector('.meal-items');
    const hdr     = section.querySelector('.meal-hdr');
    const isCollapsed = collapsedMeals.has(key);
    if (items) items.classList.toggle('collapsed', isCollapsed);
    if (hdr)   hdr.classList.toggle('collapsed', isCollapsed);
  }


  // ---- PWA SETUP ----
  const APP_ICON_B64 = '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';

  function setupPWA() {
    // iOS requires PNG for apple-touch-icon — JPEG data URLs are silently ignored.
    // Draw the JPEG onto a canvas and export as PNG before setting the links.
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      canvas.getContext('2d').drawImage(img, 0, 0, 256, 256);
      const pngUrl = canvas.toDataURL('image/png');
      const manifest = { name: 'Fuel Log', short_name: 'Fuel Log', start_url: '/fuel-log/', display: 'standalone', background_color: '#0C0C0E', theme_color: '#0C0C0E', icons: [
        { src: pngUrl, sizes: '256x256', type: 'image/png' }
      ] };
      const ml = document.createElement('link');
      ml.rel = 'manifest';
      ml.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));
      document.head.appendChild(ml);
      const il = document.createElement('link');
      il.rel = 'apple-touch-icon'; il.href = pngUrl;
      document.head.appendChild(il);
    };
    img.src = 'data:image/jpeg;base64,' + APP_ICON_B64;
  }

  // ---- SETTINGS ----
  function getApiKey() { return localStorage.getItem('fuelApiKey') || ''; }

  function saveApiKey() {
    const val = document.getElementById('s-apikey').value.trim();
    if (!val.startsWith('sk-ant-')) {
      document.getElementById('apiKeyStatus').textContent = 'That doesn\'t look right — keys start with sk-ant-';
      document.getElementById('apiKeyStatus').style.color = 'var(--danger)';
      return;
    }
    localStorage.setItem('fuelApiKey', val);
    document.getElementById('s-apikey').value = '';
    const c = document.getElementById('apiKeyConfirm');
    c.style.display = 'block'; setTimeout(() => c.style.display = 'none', 2000);
    document.getElementById('apiKeyStatus').textContent = '✓ API key is saved';
    document.getElementById('apiKeyStatus').style.color = 'var(--accent)';
  }

  function defaultSettings() { return { name: '', calGoal: 2000, proGoal: 160, maintenance: 2500, startWeight: 186, goalWeight: 175 }; }
  function loadSettings() {
    try { return Object.assign(defaultSettings(), JSON.parse(localStorage.getItem('fuelSettings') || '{}')); }
    catch { return defaultSettings(); }
  }
  function saveSettings() {
    const s = {
      name: document.getElementById('s-name').value.trim(),
      calGoal: parseInt(document.getElementById('s-cal').value) || 2000,
      proGoal: parseInt(document.getElementById('s-pro').value) || 160,
      maintenance: parseInt(document.getElementById('s-maint').value) || 2500,
      startWeight: parseFloat(document.getElementById('s-start').value) || 186,
      goalWeight: parseFloat(document.getElementById('s-goal').value) || 175,
    };
    localStorage.setItem('fuelSettings', JSON.stringify(s));
    applySettings(s);
    const c = document.getElementById('saveConfirm');
    c.style.display = 'block'; setTimeout(() => c.style.display = 'none', 2000);
  }
  function applySettings(s) {
    const name = s.name ? s.name + "'s " : '';
    document.getElementById('headerSubtitle').textContent =
      s.startWeight + ' → ' + s.goalWeight + ' lbs  ·  ' + s.calGoal.toLocaleString() + ' cal  ·  ' + s.proGoal + 'g protein';
    document.title = name ? name + 'Fuel Log' : 'Fuel Log';
    updateDayUI();
    updateStickyTop();
  }
  function populateSettingsForm(s) {
    const hasKey = !!getApiKey();
    const statusEl = document.getElementById('apiKeyStatus');
    if (statusEl) {
      statusEl.textContent = hasKey ? '✓ API key is saved' : '⚠ No API key yet — logging won\'t work without one';
      statusEl.style.color = hasKey ? 'var(--accent)' : 'var(--danger)';
    }
    document.getElementById('s-name').value = s.name || '';
    document.getElementById('s-cal').value = s.calGoal;
    document.getElementById('s-pro').value = s.proGoal;
    document.getElementById('s-maint').value = s.maintenance;
    document.getElementById('s-start').value = s.startWeight;
    document.getElementById('s-goal').value = s.goalWeight;
  }

  // ---- CORE ----
  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function getWeekOffsetForDate(dateStr) {
    // Returns the week offset (0, -1, -2 ...) whose Mon–Sun range contains dateStr
    const target = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const curMonday = new Date(now);
    curMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    curMonday.setHours(0, 0, 0, 0);
    const tgtMonday = new Date(target);
    tgtMonday.setDate(target.getDate() - ((target.getDay() + 6) % 7));
    tgtMonday.setHours(0, 0, 0, 0);
    return Math.round((tgtMonday - curMonday) / (7 * 86400000));
  }

  function getWeekDatesForOffset(offset) {
    const dates = [], now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + (offset * 7));
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      dates.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
    }
    return dates;
  }
  function getWeekDates() { return getWeekDatesForOffset(0); }
  function loadLog(date) { return JSON.parse(localStorage.getItem('fuelLog_' + date) || '[]'); }
  function saveLog(date, log) { localStorage.setItem('fuelLog_' + date, JSON.stringify(log)); }
  function loadWeights() { return JSON.parse(localStorage.getItem('weightLog') || '[]'); }
  function saveWeights(w) { localStorage.setItem('weightLog', JSON.stringify(w)); }
  function isDayLocked(date) { return localStorage.getItem('fuelDayLocked_' + date) === 'true'; }
  function formatDateNice(dateStr) { return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
  function formatDateShort(dateStr) { return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

  // ---- STATE ----
  let selectedDate = today();
  let currentWeekOffset = 0;
  let weekTabOffset = 0;
  let currentDayLog = loadLog(selectedDate);
  let sheetImages = [];
  let sheetParsedItems = [];
  let sheetClaudeResponse = '';
  let sheetMeal = 'breakfast';
  let sheetMealPillsOpen = false;
  let sheetViewMode = 'describe';
  let sheetAnalyzed = false;
  let editModalIndex = -1;

  // ---- DAY NAV ----
  function renderDayNav() {
    const dates = getWeekDatesForOffset(currentWeekOffset);
    const todayStr = today();
    const dayNames = ['M','T','W','T','F','S','S'];
    const weekLabel = currentWeekOffset === 0 ? 'This Week' : formatDateShort(dates[0]) + ' – ' + formatDateShort(dates[6]);
    const backPill = currentWeekOffset < 0
      ? `<button class="back-to-today-btn" onclick="goToCurrentWeek()"><i class="ti ti-arrow-back-up"></i> Today</button>`
      : '';
    document.getElementById('weekNav').innerHTML = `
      <button class="week-nav-btn" onclick="changeWeek(-1)">&#8249;</button>
      <span class="week-nav-label">${weekLabel}</span>
      ${backPill}
      <button class="week-nav-btn" onclick="changeWeek(1)" ${currentWeekOffset >= 0 ? 'disabled' : ''}>&#8250;</button>`;
    document.getElementById('dayTabs').innerHTML = dates.map((date, i) => {
      const isFuture = date > todayStr;
      const isToday = date === todayStr;
      const locked = isDayLocked(date);
      const hasData = loadLog(date).length > 0;
      const isSelected = date === selectedDate;
      const isPast = !isToday && !isFuture;
      const unlocked_past = isPast && hasData && !locked;
      let cls = 'day-tab';
      if (isSelected) cls += ' active';
      if (isToday) cls += ' is-today';
      if (locked) cls += ' locked';
      else if (unlocked_past) cls += ' unlocked-past';
      else if (hasData) cls += ' has-data';
      const dot = locked ? '✓' : (unlocked_past ? '⚠' : (hasData ? '●' : ''));
      return `<button class="${cls}" onclick="selectDay('${date}')" ${isFuture ? 'disabled' : ''}>
        <span class="day-tab-name">${dayNames[i]}</span>
        <span class="day-tab-dot">${dot}</span>
      </button>`;
    }).join('');
    renderStickyDayTabs();
  }

  function changeWeek(dir) {
    const newOffset = currentWeekOffset + dir;
    if (newOffset > 0) return;
    currentWeekOffset = newOffset;
    renderDayNav();
    // Slide animation: left arrow → slide in from left, right arrow → from right
    const tabs = document.getElementById('dayTabs');
    const cls = dir < 0 ? 'slide-left' : 'slide-right';
    tabs.classList.add(cls);
    setTimeout(() => tabs.classList.remove(cls), 250);
    // Note: selectedDate and data do NOT change — user must tap a day to load it
  }

  function goToCurrentWeek() {
    currentWeekOffset = 0;
    renderDayNav();
  }

  function selectDay(date) {
    if (date > today()) return;
    selectedDate = date;
    currentDayLog = loadLog(date);
    renderDayNav(); updateDayUI();
  }

  // ---- CONFIRM MODAL ----
  let _confirmCb = null;

  function showConfirm(title, body, okLabel, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmBody').textContent = body;
    document.getElementById('confirmOkBtn').textContent = okLabel;
    _confirmCb = onConfirm;
    document.getElementById('confirmModal').classList.add('open');
  }
  function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('open');
    _confirmCb = null;
  }
  function handleConfirmOk() {
    const cb = _confirmCb;
    closeConfirmModal();
    if (cb) cb();
  }
  function handleConfirmBgClick(e) {
    if (e.target === document.getElementById('confirmModal')) closeConfirmModal();
  }

  function lockDay(date) {
    showConfirm(
      'Lock in ' + formatDateNice(date) + '?',
      'You can unlock it later to make changes.',
      'Lock in Day',
      () => {
        localStorage.setItem('fuelDayLocked_' + date, 'true');
        renderDayNav(); updateDayUI();
        analyzeDayOnLock(date);
      }
    );
  }
  function unlockDay(date) { localStorage.removeItem('fuelDayLocked_' + date); renderDayNav(); updateDayUI(); }

  function hashLog(log) {
    const str = JSON.stringify(log.map(e => ({ n: e.name, c: e.calories, p: e.protein_g, m: e.meal || 'snack' })));
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return h.toString(36);
  }

  function renderLockAnalysis(card, text) {
    card.innerHTML = `<div class="lock-analysis"><div class="ai-label" style="color:var(--accent);margin-bottom:4px">Claude</div><span>${text}</span></div>`;
  }

  async function analyzeDayOnLock(date) {
    if (!getApiKey()) return;
    const log = loadLog(date);
    if (log.length === 0) return;
    const s = loadSettings();
    const cacheKey = 'fuelLockAnalysis_' + date;
    const hash = hashLog(log);
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    const card = document.getElementById('lockAnalysisCard');
    if (!card) return;
    if (cached && cached.hash === hash) { renderLockAnalysis(card, cached.text); return; }
    card.innerHTML = `<div class="lock-analysis loading"><span>Analyzing your day…</span></div>`;
    const totalCal = log.reduce((a, e) => a + e.calories, 0);
    const totalPro = log.reduce((a, e) => a + e.protein_g, 0);
    const deficit = s.maintenance - totalCal;
    const mealBreakdown = MEALS.map(m => {
      const items = log.filter(e => (e.meal || 'snack') === m.key);
      if (!items.length) return null;
      return m.label + ': ' + items.map(e => `${e.name} (${e.calories} cal, ${e.protein_g}g protein)`).join(', ');
    }).filter(Boolean).join('\n');
    const weights = loadWeights();
    const todayWeight = weights.find(w => w.date === date);
    const userMsg = `Date: ${date}\nGoals: ${s.calGoal} cal, ${s.proGoal}g protein, ${s.maintenance} cal maintenance\nLogged: ${totalCal} cal, ${totalPro}g protein\n${deficit >= 0 ? 'Deficit' : 'Surplus'}: ${Math.abs(deficit)} cal\n${todayWeight ? 'Weight today: ' + todayWeight.weight + ' lbs\n' : ''}Meal breakdown:\n${mealBreakdown}`;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': getApiKey(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, system: 'You are a brief, direct fitness coach. The user just locked in their day of eating. Give 1–2 sentences of honest feedback — mention what stood out (deficit, protein, total cals). Be encouraging but direct. No lists, no markdown, plain text only.', messages: [{ role: 'user', content: userMsg }] })
      });
      const data = await res.json();
      if (!res.ok || !data.content || !data.content[0]) { card.innerHTML = ''; return; }
      const text = data.content[0].text.trim();
      localStorage.setItem(cacheKey, JSON.stringify({ hash, text }));
      const currentCard = document.getElementById('lockAnalysisCard');
      if (currentCard) renderLockAnalysis(currentCard, text);
    } catch(e) { card.innerHTML = ''; }
  }

  // ---- RENDER MEAL SECTIONS ----
  function renderMealSections(log, locked, isFuture) {
    if (isFuture) return '<div class="empty-state">Future day.</div>';

    return MEALS.map(m => {
      // Entries for this meal (legacy entries without meal field default to 'snack')
      const itemsWithIdx = log
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => (e.meal || 'snack') === m.key);

      const totalCal = itemsWithIdx.reduce((a, { e }) => a + e.calories, 0);
      const totalPro = itemsWithIdx.reduce((a, { e }) => a + e.protein_g, 0);
      const hasItems = itemsWithIdx.length > 0;

      const itemsHTML = itemsWithIdx.map(({ e, i }) => `
        <div class="food-row${!locked ? ' editable' : ''}"${!locked ? ` onclick="openEditOverlay(${i})"` : ''}>
          <div style="flex:1">
            <div class="food-name">${e.name}</div>
            ${e.note ? `<div class="food-note">${e.note}</div>` : ''}
          </div>
          <div class="food-macros">
            <div class="food-cal">${e.calories}</div>
            <div class="food-pro">${e.protein_g}g protein</div>
          </div>
          ${!locked ? `<button class="food-del-btn" onclick="event.stopPropagation();deleteEntry(${i})" aria-label="Delete">&#215;</button>` : ''}
        </div>`).join('');

      const subtotalHTML = hasItems ? `
        <div class="meal-subtotal-row">
          <span class="meal-subtotal-text"><strong>${totalCal.toLocaleString()} cal</strong> · <strong>${totalPro}g</strong> protein</span>
        </div>` : '';

      const addBtn = (!locked && !isFuture) ? `<button class="meal-add-btn" onclick="event.stopPropagation();openLogView('${m.key}')" aria-label="Add to ${m.label}"><i class="ti ti-plus" aria-hidden="true"></i></button>` : '';
      const isCollapsed = collapsedMeals.has(m.key);
      const chevron = hasItems ? `<i class="ti ti-chevron-down meal-chevron" aria-hidden="true"></i>` : '';

      return `<div class="meal-section" data-meal="${m.key}">
        <div class="meal-hdr${hasItems ? ' has-items' : ''}${isCollapsed ? ' collapsed' : ''}"${hasItems ? ` onclick="toggleMealCollapse('${m.key}')"` : ''}>
          <i class="ti ${m.tiIcon} meal-hdr-icon" aria-hidden="true" style="color:${m.iconColor}"></i>
          <span class="meal-hdr-name">${m.label}</span>
          <span class="meal-hdr-total${hasItems ? ' has' : ''}">${hasItems ? totalCal.toLocaleString() + ' cal' : '—'}</span>
          ${chevron}
          ${addBtn}
        </div>
        ${hasItems ? `<div class="meal-items${isCollapsed ? ' collapsed' : ''}">${itemsHTML}${subtotalHTML}</div>` : ''}
      </div>`;
    }).join('');
  }

  // ---- TABS ----
  function switchTab(tab) {
    document.querySelectorAll('.tab-item').forEach((t, i) => {
      t.classList.toggle('active', ['today','week','weight','myfoods','settings'][i] === tab);
    });
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + tab).classList.add('active');
    if (tab !== 'today') {
      closeLogView();
      _stickyShown = false;
      _stickyInited = false;
      const _hdrEl = document.getElementById('stickySubHeader');
      _hdrEl.classList.remove('visible');
      _hdrEl.style.opacity = '0';
      _hdrEl.style.pointerEvents = 'none';
      document.getElementById('stickyCalFill').style.width = '0%';
      document.getElementById('stickyProFill').style.width = '0%';
      document.getElementById('stickyProgress').style.height = '0px';
      // Restore main weekNav/dayTabs visibility (may have been hidden by sticky logic)
      const _wn = document.getElementById('weekNav');
      const _dt = document.getElementById('dayTabs');
      if (_wn) { _wn.style.opacity = ''; _wn.style.visibility = ''; }
      if (_dt) { _dt.style.opacity = ''; _dt.style.visibility = ''; }
    }
    if (tab === 'today') { renderDayNav(); updateDayUI(); requestAnimationFrame(_applyStickyScroll); }
    if (tab === 'week') renderWeek();
    if (tab === 'weight') renderWeight();
    if (tab === 'settings') populateSettingsForm(loadSettings());
    if (tab === 'myfoods') {
      const sfv = document.getElementById('sfFormView');
      if (sfv && sfv.classList.contains('open')) { sfv.classList.remove('open'); unlockScroll(); }
      myFoodsView = 'library';
      editingFoodId = null;
      sfPendingImages = [];
      sfAnalyzed = false;
      sfParsedItems = [];
      sfFinalName = '';
      renderMyFoods();
    }
  }

  // ---- DAY UI ----
  const CIRC = 515.2; // 2 * π * 82

  function updateDayUI() {
    const s = loadSettings();
    const log = currentDayLog;
    const totalCal = log.reduce((a, e) => a + e.calories, 0);
    const totalPro = log.reduce((a, e) => a + e.protein_g, 0);
    const locked = isDayLocked(selectedDate);
    const isToday = selectedDate === today();
    const isFuture = selectedDate > today();

    // Date label
    document.getElementById('dateLabel').textContent = formatDateNice(selectedDate);

    // Calorie ring
    const calPct = Math.min(totalCal / s.calGoal, 1);
    const arc = document.getElementById('calRingArc');
    arc.style.strokeDashoffset = CIRC * (1 - calPct);
    const over = totalCal > s.calGoal;
    arc.style.stroke = over ? 'var(--danger)' : 'var(--accent)';
    document.getElementById('calRingSvg').className = over ? 'over' : '';
    document.getElementById('calRingNum').textContent = totalCal.toLocaleString();
    document.getElementById('calRingOf').textContent = 'of ' + s.calGoal.toLocaleString() + ' cal';
    const calLeft = s.calGoal - totalCal;
    const remainEl = document.getElementById('calRingRemain');
    remainEl.textContent = calLeft >= 0 ? calLeft.toLocaleString() + ' remaining' : Math.abs(calLeft).toLocaleString() + ' over goal';
    remainEl.setAttribute('fill', calLeft >= 0 ? 'var(--accent)' : 'var(--danger)');

    // Protein bar
    const proBar = document.getElementById('proBar');
    proBar.style.width = Math.min((totalPro / s.proGoal) * 100, 100) + '%';
    proBar.className = 'macro-bar-fill' + (totalPro > s.proGoal ? ' over' : '');
    document.getElementById('proCurrent').textContent = totalPro + 'g';
    document.getElementById('proTarget').textContent = '/ ' + s.proGoal + 'g';

    // Meal sections
    document.getElementById('mealSections').innerHTML = renderMealSections(log, locked, isFuture);

    // Lock section
    const lockSection = document.getElementById('dayLockSection');
    if (locked) {
      lockSection.innerHTML = `
        <div class="lock-summary">
          <div>
            <div class="lock-summary-label">✓ Day locked</div>
            <div class="lock-summary-stats">${totalCal.toLocaleString()} cal · ${totalPro}g protein</div>
          </div>
          <button class="unlock-btn" onclick="unlockDay('${selectedDate}')">Unlock</button>
        </div>
        <div id="lockAnalysisCard"></div>`;
      const cached = JSON.parse(localStorage.getItem('fuelLockAnalysis_' + selectedDate) || 'null');
      if (cached && cached.hash === hashLog(log)) {
        const card = document.getElementById('lockAnalysisCard');
        if (card) renderLockAnalysis(card, cached.text);
      }
    } else if (!isFuture && log.length > 0) {
      lockSection.innerHTML = `<button class="lock-btn" onclick="lockDay('${selectedDate}')"><i class="ti ti-lock" style="font-size:16px;vertical-align:-2px;margin-right:7px" aria-hidden="true"></i>Lock in Day</button>`;
    } else {
      lockSection.innerHTML = '';
    }

    document.getElementById('resetBtn').style.display = (!locked && !isFuture && log.length > 0) ? 'block' : 'none';
    updateStickyProgress();
  }

  function deleteEntry(i) {
    currentDayLog.splice(i, 1);
    saveLog(selectedDate, currentDayLog);
    updateDayUI(); renderDayNav();
  }

  function resetDay() {
    if (confirm('Clear the entire log for ' + formatDateNice(selectedDate) + '?')) {
      currentDayLog = []; saveLog(selectedDate, currentDayLog);
      updateDayUI(); renderDayNav(); closeLogView();
    }
  }

  // ---- PHOTO ----
  function compressImage(dataURL, callback) {
    const img = new Image();
    img.onload = () => {
      const MAX = 1024;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.8);
      callback(compressed.split(',')[1], 'image/jpeg');
    };
    img.src = dataURL;
  }



  // ---- SCROLL LOCK (iOS-safe) ----
  let _scrollLockY = 0;
  function lockScroll() {
    _scrollLockY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + _scrollLockY + 'px';
    document.body.style.width = '100%';
  }
  function unlockScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, _scrollLockY);
  }

  // ---- LOG VIEW ----

  function openLogView(meal) {
    sheetMeal = meal || 'breakfast';
    sheetImages = [];
    sheetParsedItems = [];
    sheetClaudeResponse = '';
    sheetAnalyzed = false;
    editModalIndex = -1;
    sheetViewMode = 'describe';
    updateLvMealChip();
    const inp = document.getElementById('sheetInput');
    if (inp) inp.value = '';
    const descView = document.getElementById('sheetDescribeView');
    const sfView = document.getElementById('sheetMyFoodsView');
    const tabD = document.getElementById('sheetTabDescribe');
    const tabS = document.getElementById('sheetTabMyFoods');
    if (descView) descView.style.display = 'flex';
    if (sfView) sfView.style.display = 'none';
    if (tabD) tabD.classList.add('sel');
    if (tabS) tabS.classList.remove('sel');
    const cb = document.getElementById('sheetClaudeBlock');
    if (cb) cb.style.display = 'none';
    const ctx0 = document.getElementById('lvContextLine');
    if (ctx0) ctx0.style.display = '';
    const ra = document.getElementById('sheetResultsArea');
    if (ra) ra.style.display = 'none';
    const rl = document.getElementById('lvReanalyzeLabel');
    if (rl) rl.style.display = 'none';
    renderSheetPhotoGrid();
    updateLvPinned();
    const aBtn = document.getElementById('sheetAnalyzeBtn');
    if (aBtn) { aBtn.className = 'lv-primary-btn'; aBtn.style.marginTop = '8px'; aBtn.textContent = 'Analyze'; }
    document.getElementById('logView').classList.add('open');
    lockScroll();
    // no auto-focus on open — user taps to open keyboard
  }

  function closeLogView() {
    document.getElementById('logView').classList.remove('open');
    unlockScroll();
    sheetImages = [];
    sheetParsedItems = [];
    sheetClaudeResponse = '';
    sheetAnalyzed = false;
    const inp = document.getElementById('sheetInput');
    if (inp) inp.value = '';
    renderSheetPhotoGrid();
  }

  function updateLvMealChip() {
    const m = MEALS.find(x => x.key === sheetMeal) || MEALS[0];
    const icon = document.getElementById('sheetMealIcon');
    const label = document.getElementById('sheetMealLabel');
    const ctx = document.getElementById('lvContextLine');
    if (icon) { icon.className = 'ti ' + m.tiIcon; icon.style.color = m.iconColor; }
    if (label) label.textContent = m.label;
    if (ctx) ctx.textContent = 'What did you have for ' + m.label.toLowerCase() + '?';
    document.querySelectorAll('.lv-meal-opt').forEach(btn => {
      btn.classList.toggle('sel', btn.dataset.meal === sheetMeal);
    });
  }

  function toggleMealDropdown(e) {
    if (e) e.stopPropagation();
    const dd = document.getElementById('lvMealDropdown');
    if (!dd) return;
    const opening = !dd.classList.contains('open');
    dd.classList.toggle('open');
    const chev = document.getElementById('lvMealChevron');
    if (chev) chev.style.transform = opening ? 'rotate(180deg)' : '';
    if (opening) {
      setTimeout(function() {
        document.addEventListener('click', function _ddClose() {
          closeMealDropdown();
          document.removeEventListener('click', _ddClose);
        });
      }, 10);
    }
  }

  function closeMealDropdown() {
    const dd = document.getElementById('lvMealDropdown');
    if (dd) dd.classList.remove('open');
    const chev = document.getElementById('lvMealChevron');
    if (chev) chev.style.transform = '';
  }

  function setLogMeal(key) {
    sheetMeal = key;
    updateLvMealChip();
    closeMealDropdown();
  }

  function selectLogTab(view) {
    sheetViewMode = view;
    const descView = document.getElementById('sheetDescribeView');
    const sfView = document.getElementById('sheetMyFoodsView');
    const tabD = document.getElementById('sheetTabDescribe');
    const tabS = document.getElementById('sheetTabMyFoods');
    if (view === 'describe') {
      if (descView) descView.style.display = 'flex';
      if (sfView) sfView.style.display = 'none';
      if (tabD) tabD.classList.add('sel');
      if (tabS) tabS.classList.remove('sel');
      // no auto-focus when switching tabs
    } else {
      if (descView) descView.style.display = 'none';
      if (sfView) sfView.style.display = 'block';
      if (tabD) tabD.classList.remove('sel');
      if (tabS) tabS.classList.add('sel');
      renderSheetFoods();
    }
    updateLvPinned();
  }

  function updateLvPinned() {
    const pinned = document.getElementById('lvPinned');
    if (!pinned) return;
    if (sheetParsedItems.length > 0) {
      const totalCal = sheetParsedItems.reduce((s, x) => s + x.calories, 0);
      const n = sheetParsedItems.length;
      pinned.innerHTML = '<button class="lv-primary-btn" onclick="commitSheet()">Add ' + n + ' item' + (n !== 1 ? 's' : '') + ' · ' + totalCal + ' cal</button>';
    } else {
      pinned.innerHTML = '';
    }
  }

  function renderSheetFoods() {
    const allFoods = loadSavedFoods();
    const listEl = document.getElementById('sheetFoodList');
    if (!listEl) return;
    if (!allFoods.length) {
      listEl.innerHTML = `<div class="sheet-empty">
        <i class="ti ti-bookmark" aria-hidden="true" style="font-size:28px;color:var(--border);display:block;margin-bottom:8px"></i>
        <div class="sheet-empty-text">No saved foods yet</div>
        <button class="sheet-empty-cta" onclick="closeLogView();switchTab('myfoods')">Go to My Foods to add items</button>
      </div>`;
      return;
    }
    listEl.innerHTML = allFoods.map(f => {
      const mealObj = MEALS.find(m => m.key === f.meal);
      const tag = mealObj ? `<span class="sheet-food-meal-tag">${mealObj.label}</span>` : '';
      const qty = getSavedFoodCount(f.id);
      const ctrl = qty > 0
        ? `<div class="sf-qty-ctrl">
            <button class="sf-qty-btn" onclick="removeSavedFoodFromStaging('${f.id}')">−</button>
            <span class="sf-qty-num">${qty}</span>
            <button class="sf-qty-btn sf-qty-add" onclick="addSavedFoodToStaging('${f.id}')">+</button>
           </div>`
        : `<button class="sheet-food-add-btn" onclick="addSavedFoodToStaging('${f.id}')" aria-label="Add ${escHtml(f.name)}">+</button>`;
      return `<div class="sheet-food-row">
        <div style="flex:1">
          <div class="sheet-food-name">${escHtml(f.name)}${tag}</div>
          <div class="sheet-food-meta">${escHtml(f.serving_size || '1 serving')} · ${f.calories} cal · ${f.protein_g}g protein</div>
        </div>
        ${ctrl}
      </div>`;
    }).join('');
  }

  function addSavedFoodToStaging(id) {
    const food = loadSavedFoods().find(f => f.id === id);
    if (!food) return;
    sheetParsedItems.push({
      name: food.name, calories: food.calories, protein_g: food.protein_g,
      note: food.serving_size || '', meal: sheetMeal,
      quantity: 1, quantity_unit: food.serving_size || 'serving',
      cal_per_unit: food.calories, protein_per_unit: food.protein_g,
      _savedFoodId: id
    });
    renderResultsList();
    renderSheetFoods();
  }

  function removeSavedFoodFromStaging(id) {
    const idx = sheetParsedItems.map(x => x._savedFoodId).lastIndexOf(id);
    if (idx !== -1) {
      sheetParsedItems.splice(idx, 1);
      renderResultsList();
      renderSheetFoods();
    }
  }

  function getSavedFoodCount(id) {
    return sheetParsedItems.filter(x => x._savedFoodId === id).length;
  }

  // ---- SHEET PHOTO ----

  function renderSheetPhotoGrid() {
    const grid = document.getElementById('sheetPhotoGrid');
    const hint = document.getElementById('sheetPhotoHint');
    const area = document.getElementById('sheetPhotoArea');
    const btn = document.getElementById('sheetPhotoBtn');
    if (!grid) return;
    if (sheetImages.length === 0) {
      if (area) area.style.display = 'none';
      if (btn) btn.classList.remove('has-photo');
      return;
    }
    if (area) area.style.display = 'block';
    if (hint) hint.innerHTML =
      '<i class="ti ti-camera" style="font-size:13px;vertical-align:-1px;margin-right:4px"></i>' +
      (sheetImages.length === 1 ? '1 photo ready — add a note or hit Analyze' : sheetImages.length + ' photos ready');
    if (btn) btn.classList.add('has-photo');
    grid.style.display = 'flex';
    grid.innerHTML = sheetImages.map((img, i) =>
      `<div class="photo-thumb">
        <img src="${img.previewURL}" alt="Photo ${i+1}" />
        <button class="photo-thumb-clear" onclick="clearSingleSheetPhoto(${i})">&#215;</button>
      </div>`).join('');
  }

  function handleSheetPhoto(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    const MAX_PHOTOS = 5;
    const remaining = MAX_PHOTOS - sheetImages.length;
    if (remaining <= 0) { showToast('Max 5 photos per entry'); event.target.value = ''; return; }
    const toAdd = files.slice(0, remaining);
    if (files.length > remaining) showToast('Max 5 photos — added ' + remaining);
    toAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        compressImage(e.target.result, (data, mediaType) => {
          sheetImages.push({ data, mediaType, previewURL: e.target.result });
          renderSheetPhotoGrid();
        });
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  }

  function clearSingleSheetPhoto(i) { sheetImages.splice(i, 1); renderSheetPhotoGrid(); }

  // ---- ANALYZE SHEET ----



  async function analyzeSheet() {
    const s = loadSettings();
    const input = document.getElementById('sheetInput');
    const btn = document.getElementById('sheetAnalyzeBtn');
    const text = input ? input.value.trim() : '';
    if (!text && sheetImages.length === 0) return;
    if (!getApiKey()) { showToast('Add your API key in Settings first'); return; }
    btn.disabled = true;
    // results rendered in shared staging area via renderResultsList()
    if (input) input.value = '';
    const claudeBlock = document.getElementById('sheetClaudeBlock');
    claudeBlock.style.display = 'block';
    document.getElementById('sheetClaudeText').innerHTML = '<span class="loading" style="padding:0;margin:0">Analyzing' + (sheetImages.length > 0 ? (sheetImages.length > 1 ? ' ' + sheetImages.length + ' photos' : ' photo') : '') + '…</span>';
    document.getElementById('sheetResultsArea').style.display = 'none';

    const prevDate = (() => {
      const d = new Date(selectedDate + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();
    const prevLog = loadLog(prevDate);
    let mealContext = '';
    if (prevLog.length > 0) {
      MEALS.forEach(m => {
        const items = prevLog.filter(e => (e.meal || 'snack') === m.key);
        if (items.length > 0)
          mealContext += '\n- ' + m.label + ': ' + items.map(e => `${e.name} (${e.calories} cal, ${e.protein_g}g protein)`).join('; ');
      });
    }
    const mealLabel = (MEALS.find(m => m.key === sheetMeal) || {}).label || 'meal';
    const systemPrompt = `You are a nutrition logging assistant. The user is logging food for ${mealLabel}.${mealContext ? '\n\nYesterday\'s meals for context:\n' + mealContext : ''}\n\nBreak the food into its individual components (e.g. for a quesadilla: tortilla, cheese, chicken). Each ingredient or add-in should be its own item. This helps the user see and edit each part.\n\nRespond with JSON ONLY. No markdown, no backticks.\nFormat: {"items":[{"name":"...","calories":number,"protein_g":number,"note":"...","quantity":number,"quantity_unit":"...","cal_per_unit":number,"protein_per_unit":number}],"response":"1–2 sentence comment"}\nEach item must have all fields. quantity_unit describes the portion (e.g. \"serving\", \"oz\", \"cup\"). cal_per_unit and protein_per_unit equal calories/protein_g when quantity is 1.`;

    const userContent = sheetImages.length > 0
      ? [...sheetImages.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })),
         { type: 'text', text: text || 'What food is shown? Estimate calories and protein.' }]
      : text;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': getApiKey(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }]
        })
      });
      const data = await res.json();
      if (!res.ok) {
        const claudeBlock2 = document.getElementById('sheetClaudeBlock');
        claudeBlock2.style.display = 'block';
        claudeBlock2.style.borderLeftColor = 'var(--danger)';
        document.getElementById('sheetClaudeText').textContent = (data.error && data.error.message) || 'API error ' + res.status;
        document.getElementById('sheetClaudeBlock').querySelector('.ai-label').style.color = 'var(--danger)';
        btn.disabled = false; return;
      }
      const raw = data.content[0].text.trim();
      let parsed;
      try { parsed = JSON.parse(raw); } catch(e) {
        const match = raw.match(/\{[\s\S]*\}/);
        try { parsed = match ? JSON.parse(match[0]) : null; } catch(e2) { parsed = null; }
      }
      if (parsed && parsed.items && parsed.items.length > 0) {
        sheetParsedItems = parsed.items.map(item => ({
          name: item.name, calories: item.calories, protein_g: item.protein_g,
          note: item.note || '', meal: sheetMeal,
          quantity: item.quantity || 1,
          quantity_unit: item.quantity_unit || 'serving',
          cal_per_unit: item.cal_per_unit || item.calories,
          protein_per_unit: item.protein_per_unit || item.protein_g
        }));
        sheetClaudeResponse = parsed.response || '';
        sheetAnalyzed = true;
        const cb = document.getElementById('sheetClaudeBlock');
        cb.style.borderLeftColor = 'var(--accent)';
        cb.querySelector('.ai-label').style.color = '';
        document.getElementById('sheetClaudeText').textContent = sheetClaudeResponse;
        renderResultsList();
      } else {
        const cb3 = document.getElementById('sheetClaudeBlock');
        cb3.style.display = 'block';
        document.getElementById('sheetClaudeText').textContent = 'Could not read that — try a clearer photo or describe the food.';
      }
    } catch(err) {
      const cb4 = document.getElementById('sheetClaudeBlock');
      cb4.style.display = 'block';
      cb4.style.borderLeftColor = 'var(--danger)';
      cb4.querySelector('.ai-label').style.color = 'var(--danger)';
      document.getElementById('sheetClaudeText').textContent = err && err.message ? err.message : 'Unknown error';
    }
    btn.disabled = false;
  }

  function renderResultsList() {
    const claudeBlock = document.getElementById('sheetClaudeBlock');
    const resultsArea = document.getElementById('sheetResultsArea');
    const reanalyzeLabel = document.getElementById('lvReanalyzeLabel');
    const resultsList = document.getElementById('sheetResultsList');
    if (!resultsArea || !resultsList) return;
    if (sheetParsedItems.length === 0) {
      resultsArea.style.display = 'none';
      if (reanalyzeLabel) reanalyzeLabel.style.display = 'none';
      if (!sheetClaudeResponse && claudeBlock) claudeBlock.style.display = 'none';
      const ctxLine2 = document.getElementById('lvContextLine');
      if (ctxLine2) ctxLine2.style.display = '';
      updateLvPinned();
      return;
    }
    resultsList.innerHTML = sheetParsedItems.map((item, i) =>
      `<div class="sheet-result-row" onclick="editSheetItem(${i})">
        <div class="sheet-result-info">
          <div class="sheet-result-name">${escHtml(item.name)}</div>
          <div class="sheet-result-meta">${item.quantity} ${escHtml(item.quantity_unit)} · ${item.calories} cal · ${item.protein_g}g protein</div>
        </div>
        <button class="sheet-result-del" onclick="event.stopPropagation();deleteSheetItem(${i})" aria-label="Remove item">&#215;</button>
      </div>`
    ).join('');
    resultsArea.style.display = 'block';
    if (reanalyzeLabel) reanalyzeLabel.style.display = 'block';
    const ctxLine = document.getElementById('lvContextLine');
    if (ctxLine) ctxLine.style.display = 'none';
    updateLvPinned();
    const aBtn = document.getElementById('sheetAnalyzeBtn');
    if (aBtn) {
      if (sheetParsedItems.length > 0) {
        aBtn.className = 'lv-secondary-btn';
        aBtn.textContent = 'Re-analyze';
      } else {
        aBtn.className = 'lv-primary-btn';
        aBtn.style.marginTop = '8px';
        aBtn.textContent = 'Analyze';
      }
    }
  }

  let stagingEditCalPer = 0, stagingEditProPer = 0;

  function editSheetItem(i) {
    const item = sheetParsedItems[i];
    if (!item) return;
    editModalSource = 'sheet';
    editModalIndex = i;
    const qty = item.quantity || 1;
    stagingEditCalPer = item.cal_per_unit != null ? item.cal_per_unit : item.calories / qty;
    stagingEditProPer = item.protein_per_unit != null ? item.protein_per_unit : item.protein_g / qty;
    document.getElementById('emName').value = item.name;
    document.getElementById('emQty').value  = qty;
    document.getElementById('emQtyUnit').textContent = item.quantity_unit || 'serving';
    document.getElementById('emCal').value  = item.calories;
    document.getElementById('emPro').value  = item.protein_g;
    document.getElementById('editItemOverlay').style.display = 'block';
    document.getElementById('editItemModal').style.display  = 'block';
    setTimeout(function() { document.getElementById('emName').focus(); }, 80);
  }

  function stepStagingQty(dir) {
    const input = document.getElementById('emQty');
    const val = parseFloat(input.value) || 1;
    input.value = Math.max(0.5, Math.round((val + dir) * 2) / 2);
    recalcStagingEdit();
  }

  function recalcStagingEdit() {
    const qty = parseFloat(document.getElementById('emQty').value) || 1;
    document.getElementById('emCal').value = Math.round(qty * stagingEditCalPer);
    document.getElementById('emPro').value = Math.round(qty * stagingEditProPer * 10) / 10;
  }

  function closeEditModal() {
    document.getElementById('editItemOverlay').style.display = 'none';
    document.getElementById('editItemModal').style.display  = 'none';
    editModalIndex = -1;
  }

  function saveEditModal() {
    const name = document.getElementById('emName').value.trim();
    const qty  = parseFloat(document.getElementById('emQty').value) || 1;
    const cal  = parseInt(document.getElementById('emCal').value)   || 0;
    const pro  = parseFloat(document.getElementById('emPro').value) || 0;
    const arr  = editModalSource === 'sf' ? sfParsedItems : sheetParsedItems;
    if (editModalIndex < 0 || editModalIndex >= arr.length) { closeEditModal(); return; }
    const item = arr[editModalIndex];
    if (name) item.name = name;
    item.quantity         = qty;
    item.calories         = Math.max(0, cal);
    item.protein_g        = Math.max(0, pro);
    item.cal_per_unit     = Math.round((cal / qty) * 10) / 10;
    item.protein_per_unit = Math.round((pro / qty) * 10) / 10;
    closeEditModal();
    if (editModalSource === 'sf') {
      renderSfResultsList();
    } else {
      renderResultsList();
    }
  }

  function deleteSheetItem(i) {
    sheetParsedItems.splice(i, 1);
    if (sheetParsedItems.length === 0) {
      sheetAnalyzed = false;
      sheetClaudeResponse = '';
    }
    renderResultsList();
    renderSheetFoods();
  }

  function commitSheet() {
    if (!sheetParsedItems.length) return;
    sheetParsedItems.forEach(item => {
      currentDayLog.push({ ...item, meal: sheetMeal });
    });
    saveLog(selectedDate, currentDayLog);
    updateDayUI(); renderDayNav();
    const targetMeal = sheetMeal;
    closeLogView();
    setTimeout(() => {
      const el = document.querySelector(`[data-meal="${targetMeal}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
  }

  // ---- EDIT OVERLAY ----
  let editingIndex = null;
  let editCalPerUnit = null;
  let editProPerUnit = null;
  let editingMeal = null;

  function openEditOverlay(i) {
    editingIndex = i;
    const e = currentDayLog[i];
    document.getElementById('editItemName').textContent = e.name;
    const qty = e.quantity || 1;
    editCalPerUnit = (e.cal_per_unit != null) ? e.cal_per_unit : (e.calories / qty);
    editProPerUnit = (e.protein_per_unit != null) ? e.protein_per_unit : (e.protein_g / qty);
    document.getElementById('editQty').value = qty;
    document.getElementById('editQtyUnit').textContent = e.quantity_unit || 'serving';
    document.getElementById('editCal').value = e.calories;
    document.getElementById('editPro').value = e.protein_g;
    renderEditMealPills(e.meal || 'snack');
    document.getElementById('editOverlay').classList.add('open');
  }

  function renderEditMealPills(selectedKey) {
    editingMeal = selectedKey;
    document.getElementById('editMealPills').innerHTML = MEALS.map(m =>
      `<button class="mpill${m.key === selectedKey ? ' sel' : ''}" onclick="selectEditMeal('${m.key}')">${m.label}</button>`
    ).join('');
  }

  function selectEditMeal(key) { renderEditMealPills(key); }

  function stepEditQty(dir) {
    const input = document.getElementById('editQty');
    const val = parseFloat(input.value) || 1;
    const next = Math.max(0.5, Math.round((val + dir) * 2) / 2);
    input.value = next;
    recalcEdit();
  }

  function recalcEdit() {
    const qty = parseFloat(document.getElementById('editQty').value) || 1;
    document.getElementById('editCal').value = Math.round(qty * editCalPerUnit);
    document.getElementById('editPro').value = Math.round(qty * editProPerUnit * 10) / 10;
  }

  function saveEditOverlay() {
    if (editingIndex === null) return;
    const qty = parseFloat(document.getElementById('editQty').value) || 1;
    const cal = parseInt(document.getElementById('editCal').value) || 0;
    const pro = parseFloat(document.getElementById('editPro').value) || 0;
    currentDayLog[editingIndex] = Object.assign({}, currentDayLog[editingIndex], {
      calories: cal,
      protein_g: pro,
      quantity: qty,
      cal_per_unit: Math.round((cal / qty) * 10) / 10,
      protein_per_unit: Math.round((pro / qty) * 10) / 10,
      meal: editingMeal || currentDayLog[editingIndex].meal,
    });
    saveLog(selectedDate, currentDayLog);
    updateDayUI(); renderDayNav();
    closeEditOverlay();
    showToast('Entry updated');
  }

  function closeEditOverlay() {
    document.getElementById('editOverlay').classList.remove('open');
    editingIndex = null; editCalPerUnit = null; editProPerUnit = null; editingMeal = null;
  }

  function handleOverlayClick(e) {
    if (e.target === document.getElementById('editOverlay')) closeEditOverlay();
  }


  // ---- STICKY SUB-HEADER ----
  function updateStickyTop() {
    const headerH = document.querySelector('header').offsetHeight;
    document.getElementById('stickySubHeader').style.top = headerH + 'px';
  }

  function renderStickyDayTabs() {
    const dates = getWeekDatesForOffset(currentWeekOffset);
    const todayStr = today();
    const dayNames = ['M','T','W','T','F','S','S'];
    document.getElementById('stickyDayTabs').innerHTML = dates.map((date, i) => {
      const isFuture = date > todayStr;
      const isToday = date === todayStr;
      const locked = isDayLocked(date);
      const hasData = loadLog(date).length > 0;
      const isSelected = date === selectedDate;
      const isPast = !isToday && !isFuture;
      const unlocked_past = isPast && hasData && !locked;
      let cls = 'day-tab';
      if (isSelected) cls += ' active';
      if (isToday) cls += ' is-today';
      if (locked) cls += ' locked';
      else if (unlocked_past) cls += ' unlocked-past';
      else if (hasData) cls += ' has-data';
      const dot = locked ? '✓' : (unlocked_past ? '⚠' : (hasData ? '●' : ''));
      return `<button class="${cls}" onclick="selectDay('${date}')" ${isFuture ? 'disabled' : ''}>
        <span class="day-tab-name">${dayNames[i]}</span>
        <span class="day-tab-dot">${dot}</span>
      </button>`;
    }).join('');
  }

  function updateStickyProgress() {
    const s = loadSettings();
    const log = currentDayLog;
    const totalCal = log.reduce((a, e) => a + e.calories, 0);
    const totalPro = log.reduce((a, e) => a + e.protein_g, 0);
    const calLeft = s.calGoal - totalCal;
    const over = totalCal > s.calGoal;
    const calColor = over ? 'var(--danger)' : 'var(--accent)';
    // Store target percentages for scroll-driven bar widths
    _stickyCalPct = Math.min((totalCal / s.calGoal) * 100, 100);
    _stickyProPct = Math.min((totalPro / s.proGoal) * 100, 100);
    // Update labels and colours (widths are set by _applyStickyScroll)
    document.getElementById('stickyCalVal').textContent = totalCal.toLocaleString() + ' cal';
    document.getElementById('stickyCalVal').style.color = calColor;
    document.getElementById('stickyCalLeft').textContent = calLeft >= 0
      ? calLeft.toLocaleString() + ' left' : Math.abs(calLeft).toLocaleString() + ' over';
    document.getElementById('stickyCalFill').style.background = calColor;
    document.getElementById('stickyProVal').textContent = totalPro + 'g protein';
    const proLeft = s.proGoal - totalPro;
    document.getElementById('stickyProLeft').textContent = proLeft >= 0
      ? proLeft + 'g left' : Math.abs(proLeft) + 'g over';
    // Re-apply scroll position so bar widths stay in sync after data changes
    _applyStickyScroll();
  }

  // ---- SCROLL-DRIVEN STICKY HEADER ----
  let _stickyCalPct = 0, _stickyProPct = 0;
  let _scrollRAF = null;
  let _stickyShown = false;   // true once fully past threshold (for progress animation)
  let _stickyInited = false;  // true once sticky tabs have been rendered this visit
  let _stickyProgH = 0;       // natural height of progress section, pre-measured at setup
  let _stickyTriggerY = 0;    // scrollY at the moment sticky became fully locked in
  // Keep stubs so old call-sites don't throw
  let _weekNavObs = null, _ringObs = null;

  function _easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  function _applyStickyScroll() {
    if (!document.getElementById('page-today').classList.contains('active')) return;
    const headerH = document.querySelector('header').offsetHeight;
    const weekNavEl = document.getElementById('weekNav');
    const dayTabsEl = document.getElementById('dayTabs');
    if (!weekNavEl || !dayTabsEl) return;

    const hdr = document.getElementById('stickySubHeader');
    const progEl = document.getElementById('stickyProgress');

    // Show sticky when day tabs align with sticky sub-header's internal tab position.
    // Sticky sub-header has 5px top padding before its day tabs, so offset by that
    // so both sets of tabs land at the same pixel when the swap happens.
    // HYST only on the HIDE direction (prevents flicker on scroll-up) — not show.
    // visibility:hidden on originals preserves layout (no content jump), just hides them.
    const dayTabsTop = dayTabsEl.getBoundingClientRect().top;
    const THRESHOLD = headerH + 5;
    const HYST = 8;

    if (!_stickyShown && dayTabsTop <= THRESHOLD) {
      _stickyShown = true;
      _stickyInited = true;
      _stickyTriggerY = window.scrollY;
      const _neededOffset = getWeekOffsetForDate(selectedDate);
      if (currentWeekOffset !== _neededOffset) {
        currentWeekOffset = _neededOffset;
        renderDayNav();
      }
      renderStickyDayTabs();
      updateStickyTop();
      hdr.classList.add('visible');
      hdr.style.opacity = '1';
      hdr.style.pointerEvents = 'auto';
      weekNavEl.style.visibility = 'hidden';
      dayTabsEl.style.visibility = 'hidden';
    } else if (_stickyShown && dayTabsTop > THRESHOLD + HYST) {
      _stickyShown = false;
      _stickyInited = false;
      hdr.classList.remove('visible');
      hdr.style.opacity = '0';
      hdr.style.pointerEvents = 'none';
      weekNavEl.style.visibility = '';
      dayTabsEl.style.visibility = '';
      progEl.style.height = '0px';
      document.getElementById('stickyCalFill').style.width = '0%';
      document.getElementById('stickyProFill').style.width = '0%';
    }

    if (!_stickyShown) return;

    // Progress animation: scroll-offset-based — completes after ANIM_RANGE px
    // regardless of page height (works even when all meals are collapsed)
    const ANIM_RANGE = 100;
    const raw      = Math.min(Math.max((window.scrollY - _stickyTriggerY) / ANIM_RANGE, 0), 1);
    const progress = _easeInOut(raw);

    progEl.style.height = (progress * _stickyProgH) + 'px';
    document.getElementById('stickyCalFill').style.width = (_stickyCalPct * progress) + '%';
    document.getElementById('stickyProFill').style.width = (_stickyProPct * progress) + '%';
  }

  function _handleKeyboardResize() {
    // no-op: log view is full-screen, keyboard handling not needed
  }

  function setupStickyObservers() {
    // Disconnect any leftover observers (belt-and-suspenders)
    if (_weekNavObs) { _weekNavObs.disconnect(); _weekNavObs = null; }
    if (_ringObs)    { _ringObs.disconnect();    _ringObs = null;    }

    // Pre-measure sticky progress natural height while display:block + opacity:0
    const _progSetup = document.getElementById('stickyProgress');
    _progSetup.style.height = 'auto';
    _stickyProgH = _progSetup.scrollHeight || 54; // fallback 54px
    _progSetup.style.height = '0px';

    window.addEventListener('scroll', function() {
      if (_scrollRAF) return;
      _scrollRAF = requestAnimationFrame(function() {
        _scrollRAF = null;
        _applyStickyScroll();
      });
    }, { passive: true });
    // Seed values and run an immediate check
    updateStickyProgress();
    _applyStickyScroll();
  }

  // ---- WEEK TAB ----
  function changeWeekTab(dir) {
    const newOffset = weekTabOffset + dir;
    if (newOffset > 0) return;
    weekTabOffset = newOffset; renderWeek();
  }

  function renderWeek() {
    const s = loadSettings();
    const dates = getWeekDatesForOffset(weekTabOffset);
    const weekLabel = weekTabOffset === 0 ? 'This Week' : formatDateShort(dates[0]) + ' – ' + formatDateShort(dates[6]);
    document.getElementById('weekTabNav').innerHTML = `
      <button class="week-nav-btn" onclick="changeWeekTab(-1)">&#8249;</button>
      <span class="week-nav-label">${weekLabel}</span>
      <button class="week-nav-btn" onclick="changeWeekTab(1)" ${weekTabOffset >= 0 ? 'disabled' : ''}>&#8250;</button>`;
    const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const todayStr = today();
    let totalCal = 0, totalDays = 0, totalDeficit = 0;
    const gridHTML = dates.map((date, i) => {
      const log = loadLog(date);
      const cal = log.reduce((a, e) => a + e.calories, 0);
      const hasData = log.length > 0;
      const locked = isDayLocked(date);
      if (hasData) { totalCal += cal; totalDays++; }
      if (hasData && locked) { totalDeficit += s.maintenance - cal; }
      const pct = hasData ? Math.min((cal / s.calGoal) * 100, 100) : 0;
      const isToday = date === todayStr;
      const isPast = date < todayStr;
      const showWarn = isPast && hasData && !locked;
      let calClass = 'empty';
      if (hasData) calClass = cal > s.calGoal ? 'over' : 'good';
      const dayDeficit = hasData ? s.maintenance - cal : null;
      const defClass = dayDeficit !== null ? (dayDeficit >= 0 ? 'deficit-positive' : 'deficit-negative') : '';
      const defText = dayDeficit !== null ? (dayDeficit >= 0 ? '+' + dayDeficit.toLocaleString() : dayDeficit.toLocaleString()) : '';
      return `<div class="week-day${isToday ? ' today' : ''}">
        <div class="week-day-name">${dayNames[i]}${showWarn ? '<span class="week-day-warn"></span>' : ''}</div>
        <div class="week-day-cal ${calClass}">${hasData ? cal : '&mdash;'}</div>
        <div class="week-day-bar"><div class="week-day-fill${cal > s.calGoal ? ' over' : ''}" style="width:${pct}%"></div></div>
        ${hasData ? `<div class="week-day-deficit ${defClass}">${defText}</div>` : ''}
      </div>`;
    }).join('');
    document.getElementById('weekGrid').innerHTML = gridHTML;
    const avgCal = totalDays > 0 ? Math.round(totalCal / totalDays) : 0;
    const lbsLost = (totalDeficit / 3500).toFixed(2);
    const deficitClass = totalDeficit >= 0 ? 'deficit-positive' : 'deficit-negative';
    const dailyDeficit = s.maintenance - s.calGoal;
    const explainer = document.getElementById('deficitExplainerText');
    if (explainer) explainer.textContent = `Your maintenance is ~${s.maintenance.toLocaleString()} cal/day. Eating at your ${s.calGoal.toLocaleString()} cal goal creates a ${dailyDeficit > 0 ? dailyDeficit.toLocaleString() + ' cal daily deficit' : 'daily surplus of ' + Math.abs(dailyDeficit).toLocaleString() + ' cal'}. Over 7 days, 3,500 cal deficit = ~1 lb of fat. The weekly total above shows your actual progress based on what you've logged.`;
    document.getElementById('weekSummary').innerHTML = `
      <div class="week-stat-row">
        <span class="week-stat-label">Weekly deficit</span>
        <span class="week-stat-val ${deficitClass}">${totalDeficit >= 0 ? '+' : ''}${totalDeficit.toLocaleString()} cal</span>
      </div>
      <div class="progress-bar" style="margin-bottom:12px">
        <div class="progress-fill cal-fill" style="width:${Math.min(Math.abs(totalDeficit)/3500*100,100)}%;${totalDeficit < 0 ? 'background:var(--danger)' : ''}"></div>
      </div>
      <div class="week-stat-row">
        <span class="week-stat-label">Est. fat loss</span>
        <span class="week-stat-val" style="color:var(--accent3)">${lbsLost} lbs</span>
      </div>
      <div class="week-stat-row" style="margin-top:4px;margin-bottom:0">
        <span class="week-stat-label">Avg daily cal</span>
        <span class="week-stat-val" style="font-size:18px;color:var(--muted)">${totalDays > 0 ? avgCal.toLocaleString() : '—'}</span>
      </div>`;
  }

  // ---- WEIGHT ----
  function logWeight() {
    const input = document.getElementById('weightInput');
    const val = parseFloat(input.value);
    if (isNaN(val) || val < 50 || val > 600) return;
    const weights = loadWeights();
    const todayStr = today();
    const existing = weights.findIndex(w => w.date === todayStr);
    if (existing >= 0) weights[existing].weight = val;
    else weights.push({ date: todayStr, weight: val });
    weights.sort((a, b) => a.date.localeCompare(b.date));
    saveWeights(weights); input.value = ''; renderWeight();
  }
  function deleteWeight(i) { const w = loadWeights(); w.splice(i, 1); saveWeights(w); renderWeight(); }

  function rollingWeightAvg(weights) {
    if (weights.length === 0) return null;
    const slice = weights.slice(-7);
    const avg = slice.reduce((a, w) => a + w.weight, 0) / slice.length;
    return { avg: Math.round(avg * 10) / 10, count: slice.length };
  }

  function renderWeight() {
    const s = loadSettings();
    const weights = loadWeights();
    const latest = weights.length > 0 ? weights[weights.length - 1].weight : s.startWeight;
    const lost = s.startWeight - latest;
    const remaining = latest - s.goalWeight;
    const range = s.startWeight - s.goalWeight;
    const pct = range > 0 ? Math.min(Math.max((lost / range) * 100, 0), 100) : 0;
    const rolling = rollingWeightAvg(weights);
    const rollingLabel = rolling ? (rolling.count >= 7 ? '7-entry avg' : `avg (${rolling.count} of 7)`) : '';
    document.getElementById('goalProgressCard').innerHTML = `
      <div class="goal-progress-card">
        <div><div class="gp-label">Current</div><div class="gp-val" style="color:var(--accent3)">${latest} lbs</div><div class="gp-sub">${lost > 0 ? lost.toFixed(1) + ' lbs lost' : 'Starting weight'}</div></div>
        <div class="gp-divider"></div>
        <div><div class="gp-label">To goal</div><div class="gp-val" style="color:var(--accent)">${Math.max(remaining,0).toFixed(1)} lbs</div><div class="gp-sub">Goal: ${s.goalWeight} lbs</div></div>
        <div class="gp-divider"></div>
        <div><div class="gp-label">Progress</div><div class="gp-val" style="color:var(--text)">${pct.toFixed(0)}%</div><div class="gp-sub">${pct >= 100 ? 'Goal reached!' : 'Keep going'}</div></div>
      </div>
      <div class="progress-bar" style="margin-bottom:16px"><div class="progress-fill" style="width:${pct}%;background:var(--accent3)"></div></div>
      ${rolling ? `<div class="weight-avg-row"><span class="weight-avg-label">${rollingLabel}</span><span class="weight-avg-val">${rolling.avg} lbs</span></div>` : ''}`;
    renderChart(weights, s);
    const listEl = document.getElementById('weightList');
    if (weights.length === 0) { listEl.innerHTML = '<div class="empty-state">No weight entries yet.</div>'; return; }
    const reversed = [...weights].reverse();
    listEl.innerHTML = reversed.map((w, ri) => {
      const i = weights.length - 1 - ri;
      const prev = weights[i - 1];
      let deltaHTML = '';
      if (prev) { const delta = w.weight - prev.weight; deltaHTML = `<span class="weight-entry-delta ${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '+' : ''}${delta.toFixed(1)}</span>`; }
      const dateStr = new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' });
      return `<div class="weight-entry">
        <span class="weight-entry-date">${dateStr}</span>
        <span class="weight-entry-val">${w.weight} lbs</span>
        ${deltaHTML}
        <button class="weight-del-btn" onclick="deleteWeight(${i})">&#215;</button>
      </div>`;
    }).join('');
  }

  function renderChart(weights, s) {
    const svg = document.getElementById('weightChart');
    const W = 300, H = 120, pad = { top: 12, right: 20, bottom: 20, left: 32 };
    if (weights.length === 0) {
      svg.innerHTML = `<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#6B7280" font-family="Inter,system-ui,sans-serif" font-size="11">No data yet</text>`; return;
    }
    const all = [s.startWeight, s.goalWeight, ...weights.map(w => w.weight)];
    const minW = Math.min(...all) - 1, maxW = Math.max(...all) + 1;
    const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;
    const xPos = (i, total) => total === 1 ? pad.left + cW / 2 : pad.left + (i / (total - 1)) * cW;
    const yPos = w => pad.top + cH - ((w - minW) / (maxW - minW)) * cH;
    const goalY = yPos(s.goalWeight);
    const points = weights.map((w, i) => ({ x: xPos(i, weights.length), y: yPos(w.weight) }));
    const pathD = points.map((p, i) => `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    let html = '';
    [0, 0.5, 1].forEach(t => { const y = pad.top + t * cH; html += `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${W-pad.right}" y2="${y.toFixed(1)}" stroke="#202026" stroke-width="1"/>`; });
    html += `<line x1="${pad.left}" y1="${goalY.toFixed(1)}" x2="${W-pad.right}" y2="${goalY.toFixed(1)}" stroke="#34D399" stroke-width="1" stroke-dasharray="3,3" opacity="0.45"/>`;
    html += `<text x="${W-pad.right+2}" y="${goalY+3}" fill="#34D399" font-size="7" font-family="Inter,system-ui,sans-serif" opacity="0.7">${s.goalWeight}</text>`;
    if (points.length > 1) {
      const avgPoints = weights.map((w, i) => {
        const slice = weights.slice(Math.max(0, i - 6), i + 1);
        const avg = slice.reduce((a, w) => a + w.weight, 0) / slice.length;
        return { x: xPos(i, weights.length), y: yPos(avg) };
      });
      const avgPathD = avgPoints.map((p, i) => `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      html += `<path d="${avgPathD}" fill="none" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>`;
    }
    if (points.length > 1) html += `<path d="${pathD}" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    points.forEach(p => { html += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#FBBF24"/>`; });
    [maxW, (maxW+minW)/2, minW].forEach((v, i) => { const y = pad.top + (i * cH / 2); html += `<text x="${pad.left-4}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="#6B7280" font-size="7" font-family="Inter,system-ui,sans-serif">${Math.round(v)}</text>`; });
    if (weights.length >= 1) {
      const fmt = d => new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
      html += `<text x="${pad.left}" y="${H-4}" fill="#6B7280" font-size="7" font-family="Inter,system-ui,sans-serif">${fmt(weights[0].date)}</text>`;
      if (weights.length > 1) html += `<text x="${W-pad.right}" y="${H-4}" text-anchor="end" fill="#6B7280" font-size="7" font-family="Inter,system-ui,sans-serif">${fmt(weights[weights.length-1].date)}</text>`;
    }
    svg.innerHTML = html;
  }

  // ---- DATA ----
  function collectAllData() {
    const logs = {}, locked = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('fuelLog_')) logs[key.replace('fuelLog_', '')] = JSON.parse(localStorage.getItem(key));
      if (key.startsWith('fuelDayLocked_')) locked.push(key.replace('fuelDayLocked_', ''));
    }
    return { exportedAt: new Date().toISOString(), version: APP_VERSION, settings: loadSettings(), logs, weights: loadWeights(), lockedDays: locked.sort() };
  }
  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }
  function exportData() { downloadJSON(collectAllData(), 'fuel-log-' + new Date().toISOString().split('T')[0] + '.json'); }
  function clearAllData() {
    if (!confirm('Delete ALL data?\n\nThis wipes every food log, weight entry, and setting from this device. Downloaded backups are not affected.\n\nThis cannot be undone.')) return;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key.startsWith('fuel')) keysToRemove.push(key); }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    window.location.reload();
  }

  // ---- TOAST / UPDATE ----
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }
  function updateApp() {
    const key = getApiKey();
    if (key) sessionStorage.setItem('fuelApiKeyTemp', key);
    sessionStorage.setItem('fuelUpdateFromVersion', APP_VERSION);
    window.location.href = window.location.pathname + '?v=' + Date.now();
  }
  (function() {
    const temp = sessionStorage.getItem('fuelApiKeyTemp');
    if (temp) { localStorage.setItem('fuelApiKey', temp); sessionStorage.removeItem('fuelApiKeyTemp'); }
    if (window.location.search.startsWith('?v=')) history.replaceState(null, '', window.location.pathname);
    const fromVersion = sessionStorage.getItem('fuelUpdateFromVersion');
    if (fromVersion) {
      sessionStorage.removeItem('fuelUpdateFromVersion');
      setTimeout(function() {
        if (fromVersion === APP_VERSION) showToast('Already up to date (' + APP_VERSION + ')');
        else showToast('Updated to ' + APP_VERSION + ' ✓');
      }, 400);
    }
  })();

  // ---- INIT ----
  setupPWA();
  document.getElementById('versionBadge').textContent = APP_VERSION;
  applySettings(loadSettings());
  renderDayNav();
  updateDayUI();
  setupStickyObservers();
  updateStickyTop();
