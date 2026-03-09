// ============================================================
// Inventory Manager - Main Application JS
// ============================================================

// ---- API HELPERS ----
async function api(path, options = {}) {
  const url = API_BASE + path;
  const defaults = { headers: { 'Content-Type': 'application/json' } };
  const res = await fetch(url, { ...defaults, ...options });
  if (!res.ok && res.status === 401) { window.location.reload(); return; }
  return res.json();
}
const get  = (p, q='')       => api(p + (q ? '&' + q : ''));
const post = (p, d)           => api(p, { method: 'POST',   body: JSON.stringify(d) });
const put  = (p, d)           => api(p, { method: 'PUT',    body: JSON.stringify(d) });
const del  = (p)              => api(p, { method: 'DELETE' });

// ---- TOAST ----
function toast(msg, type = 'success', duration = 3500) {
  const c   = document.getElementById('toast-container');
  const el  = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), duration);
}
const toastOk  = (m) => toast(m, 'success');
const toastErr = (m) => toast(m, 'danger');

// ---- LOGIN ----
async function doLogin() {
  const email = document.getElementById('login-email').value;
  const pass  = document.getElementById('login-password').value;
  const btn   = document.getElementById('login-btn-text');
  const err   = document.getElementById('login-error');
  btn.textContent = 'Signing in…';
  try {
    const r = await post('auth/login', { email, password: pass });
    if (r.success) window.location.reload();
    else { err.style.display = 'block'; err.textContent = r.message || 'Login failed'; btn.textContent = 'Sign In'; }
  } catch (e) { err.style.display = 'block'; err.textContent = 'Server error'; btn.textContent = 'Sign In'; }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-page')) doLogin();
});

// ---- MODAL ----
function showModal(title, bodyHTML, footerHTML = '', large = false) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML    = bodyHTML;
  document.getElementById('modal-footer').innerHTML  = footerHTML;
  const box = document.getElementById('modal-box');
  box.className = large ? 'modal modal-lg' : 'modal';
  document.getElementById('modal-overlay').style.display = 'flex';
}
function hideModal() { document.getElementById('modal-overlay').style.display = 'none'; }
function closeModal(e) { if (e.target === document.getElementById('modal-overlay')) hideModal(); }

// ---- SIDEBAR ----
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ---- ROUTER ----
let currentPage = 'dashboard';
const pageCache = {};

const pageRenderers = {
  dashboard:      renderDashboard,
  products:       renderProducts,
  categories:     renderCategories,
  warehouses:     renderWarehouses,
  suppliers:      renderSuppliers,
  'purchase-orders': renderPurchaseOrders,
  transactions:   renderTransactions,
  warranties:     renderWarranties,
  adjustments:    renderAdjustments,
  reports:        renderReports,
  'import-export': renderImportExport,
  'activity-logs': renderActivityLogs,
  users:          renderUsers,
  settings:       renderSettings,
};

const pageTitles = {
  dashboard: 'Dashboard', products: 'Products', categories: 'Categories',
  warehouses: 'Warehouses', suppliers: 'Suppliers', 'purchase-orders': 'Purchase Orders',
  transactions: 'Transactions', warranties: 'Warranties', adjustments: 'Stock Adjustments',
  reports: 'Reports', 'import-export': 'Import / Export', 'activity-logs': 'Activity Logs',
  users: 'Users', settings: 'Settings',
};

function navigate(page) {
  currentPage = page;
  document.getElementById('page-title').textContent = pageTitles[page] || page;
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  if (pageRenderers[page]) pageRenderers[page]();
  // Close sidebar on mobile
  if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('app')) return; // login page
  document.querySelectorAll('.nav-link').forEach(l => {
    l.addEventListener('click', e => { e.preventDefault(); navigate(l.dataset.page); });
  });
  navigate('dashboard');
});

// ---- UTILITIES ----
const fmt = {
  currency: (v, c='USD') => new Intl.NumberFormat('en-US', { style:'currency', currency: c }).format(v||0),
  number:   (v)          => new Intl.NumberFormat('en-US').format(v||0),
  date:     (d)          => d ? new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '—',
  datetime: (d)          => d ? new Date(d).toLocaleString() : '—',
  percent:  (v)          => (v||0).toFixed(1) + '%',
};

function esc(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }

function statusBadge(status) {
  const map = {
    active:'success', inactive:'muted', blocked:'danger', discontinued:'danger',
    pending:'warning', approved:'info', completed:'success', cancelled:'danger',
    draft:'muted', ordered:'primary', received:'success',
    'expiring_soon':'warning', expired:'danger', claimed:'info', void:'muted',
    inward:'success', outward:'danger', transfer:'info', adjustment:'warning', return:'primary',
  };
  const cls = map[status] || 'muted';
  return `<span class="badge badge-${cls}">${esc(status)}</span>`;
}

function buildTable(cols, rows, emptyMsg = 'No data found') {
  if (!rows || !rows.length) return `<div class="empty-state"><div class="empty-icon">📭</div><p>${emptyMsg}</p></div>`;
  let html = '<div class="table-wrapper"><table><thead><tr>';
  cols.forEach(c => { html += `<th>${esc(c.header)}</th>`; });
  html += '</tr></thead><tbody>';
  rows.forEach(row => {
    html += '<tr>';
    cols.forEach(c => {
      const val = typeof c.cell === 'function' ? c.cell(row) : (row[c.key] ?? '—');
      html += `<td>${val}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function filterRows(rows, search, fields) {
  if (!search) return rows;
  const q = search.toLowerCase();
  return rows.filter(r => fields.some(f => String(r[f]||'').toLowerCase().includes(q)));
}

// ---- STATE ----
const state = {};

// ============================================================
// DASHBOARD
// ============================================================
async function renderDashboard() {
  const data = await get('dashboard');
  const s    = data.stats || {};

  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon">📦</div><div class="stat-label">Total Products</div><div class="stat-value">${fmt.number(s.total_products)}</div></div>
      <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-label">Total Stock Units</div><div class="stat-value">${fmt.number(s.total_stock)}</div></div>
      <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-label">Inventory Value</div><div class="stat-value">${fmt.currency(s.total_value)}</div></div>
      <div class="stat-card"><div class="stat-icon">🏭</div><div class="stat-label">Active Warehouses</div><div class="stat-value">${fmt.number(s.total_warehouses)}</div></div>
      <div class="stat-card"><div class="stat-icon">🏢</div><div class="stat-label">Active Suppliers</div><div class="stat-value">${fmt.number(s.total_suppliers)}</div></div>
      <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-label">Low Stock Items</div><div class="stat-value text-danger">${fmt.number(s.low_stock_count)}</div></div>
      <div class="stat-card"><div class="stat-icon">🛡</div><div class="stat-label">Expiring Warranties</div><div class="stat-value text-warning">${fmt.number(s.expiring_warranties)}</div></div>
    </div>

    <div class="charts-grid">
      <div class="card"><div class="card-header"><span class="card-title">Stock by Category</span></div><div class="card-body"><div class="chart-container"><canvas id="cat-chart"></canvas></div></div></div>
      <div class="card"><div class="card-header"><span class="card-title">Monthly Movement (6 mo)</span></div><div class="card-body"><div class="chart-container"><canvas id="move-chart"></canvas></div></div></div>
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Transactions</span></div>
        <div class="card-body" style="padding:0">
          ${buildTable([
            {header:'#',    cell:r=>`<span class="fs-sm text-muted">${esc(r.transaction_number)}</span>`},
            {header:'Product', key:'product_name'},
            {header:'Type',    cell:r=>statusBadge(r.type)},
            {header:'Qty',     key:'quantity'},
            {header:'Date',    cell:r=>fmt.date(r.transaction_date)},
            {header:'Status',  cell:r=>statusBadge(r.status)},
          ], data.recent_transactions, 'No recent transactions')}
        </div>
      </div>
      <div>
        <div class="card mb-2">
          <div class="card-header"><span class="card-title">⚠️ Low Stock</span></div>
          <div class="alerts-list">
            ${(data.low_stock||[]).slice(0,5).map(p=>`<div class="alert-item"><span>📦</span><div><div class="fw-bold">${esc(p.name)}</div><div class="fs-sm text-muted">Stock: ${p.quantity_in_stock} (min: ${p.reorder_level})</div></div></div>`).join('') || '<div class="alert-item">All stock levels OK</div>'}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">🛡 Warranty Alerts</span></div>
          <div class="alerts-list">
            ${(data.warranty_alerts||[]).slice(0,5).map(w=>`<div class="alert-item"><span>🛡</span><div><div class="fw-bold">${esc(w.product_name)}</div><div class="fs-sm text-muted">Expires: ${fmt.date(w.end_date)}</div></div></div>`).join('') || '<div class="alert-item">No expiring warranties</div>'}
          </div>
        </div>
      </div>
    </div>`;

  // Category pie chart
  const catData = data.category_data || [];
  if (catData.length) {
    new Chart(document.getElementById('cat-chart').getContext('2d'), {
      type: 'doughnut',
      data: { labels: catData.map(c=>c.name), datasets: [{ data: catData.map(c=>c.total_stock), backgroundColor:['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'] }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right'}} },
    });
  }

  // Monthly movement bar chart
  const mm = data.monthly_movement || [];
  if (mm.length) {
    new Chart(document.getElementById('move-chart').getContext('2d'), {
      type: 'bar',
      data: { labels: mm.map(m=>m.month), datasets: [
        { label:'Inward',  data: mm.map(m=>m.inward),  backgroundColor:'#3b82f6' },
        { label:'Outward', data: mm.map(m=>m.outward), backgroundColor:'#ef4444' },
      ]},
      options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } },
    });
  }
}

// ============================================================
// GENERIC LIST PAGE BUILDER
// ============================================================
function buildListPage({ title, subtitle, apiPath, cols, searchFields, modalFormFn, entityName, extraButtons='' }) {
  return async function() {
    state[apiPath] = await get(apiPath);
    renderListPage({ title, subtitle, apiPath, cols, searchFields, modalFormFn, entityName, extraButtons });
  };
}

function renderListPage({ title, subtitle, apiPath, cols, searchFields, modalFormFn, entityName, extraButtons }) {
  const rows = state[apiPath] || [];
  const search = state[`${apiPath}_search`] || '';
  const filtered = filterRows(rows, search, searchFields);

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div>
      <div class="d-flex gap-1">
        ${extraButtons}
        <button class="btn btn-primary" onclick="openCreate_${apiPath.replace('-','_')}()">+ Add ${esc(entityName)}</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="search-input"><input type="text" placeholder="Search ${esc(entityName)}s…" value="${esc(search)}" oninput="searchList_${apiPath.replace('-','_')}(this.value)"></div>
        <span class="text-muted fs-sm">${filtered.length} records</span>
      </div>
      <div class="card-body" style="padding:0" id="list-body">
        ${buildTable(cols, filtered, `No ${entityName.toLowerCase()}s found`)}
      </div>
    </div>`;
}

// ============================================================
// PRODUCTS
// ============================================================
async function renderProducts() {
  const [products, categories, warehouses, suppliers] = await Promise.all([
    get('products'), get('categories'), get('warehouses'), get('suppliers')
  ]);
  state.products = products; state.categories = categories;
  state.warehouses = warehouses; state.suppliers = suppliers;

  const catMap = Object.fromEntries((categories||[]).map(c=>[c.id, c.name]));
  const wMap   = Object.fromEntries((warehouses||[]).map(w=>[w.id, w.name]));

  const filtered = filterRows(products, state.products_search||'', ['sku','name','description']);

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h2>Products</h2><p>${products.length} products total</p></div>
      <button class="btn btn-primary" onclick="openProductModal()">+ Add Product</button>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="search-input"><input type="text" placeholder="Search by name or SKU…" value="${esc(state.products_search||'')}" oninput="state.products_search=this.value;renderProducts()"></div>
        <span class="text-muted fs-sm">${filtered.length} records</span>
      </div>
      <div class="card-body" style="padding:0">
        ${buildTable([
          {header:'SKU',      key:'sku'},
          {header:'Name',     key:'name'},
          {header:'Category', cell:r=>esc(catMap[r.category_id]||'—')},
          {header:'Warehouse',cell:r=>esc(wMap[r.warehouse_id]||'—')},
          {header:'Stock',    cell:r=>`<span class="${(r.quantity_in_stock||0)<=(r.reorder_level||10)?'text-danger fw-bold':''}">${fmt.number(r.quantity_in_stock)}</span>`},
          {header:'Reorder',  key:'reorder_level'},
          {header:'Cost',     cell:r=>fmt.currency(r.cost_price, r.currency)},
          {header:'Price',    cell:r=>fmt.currency(r.unit_price, r.currency)},
          {header:'Status',   cell:r=>statusBadge(r.status)},
          {header:'Actions',  cell:r=>`<div class="actions-cell"><button class="btn btn-sm btn-secondary" onclick="openProductModal(${r.id})">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteProduct(${r.id})">Del</button></div>`},
        ], filtered, 'No products found')}
      </div>
    </div>`;
}

function openProductModal(id) {
  const p    = id ? state.products.find(x=>x.id===id) : {};
  const cats = (state.categories||[]).filter(c=>c.status==='active');
  const whs  = (state.warehouses||[]).filter(w=>w.status==='active');
  const sups = (state.suppliers||[]).filter(s=>s.status==='active');
  const v    = (f,d='') => esc(id ? (p[f]??d) : d);

  showModal(id ? 'Edit Product' : 'Add Product', `
    <div class="form-row">
      <div class="form-group"><label>SKU *</label><input id="f_sku" value="${v('sku')}" placeholder="PROD-001"></div>
      <div class="form-group"><label>Name *</label><input id="f_name" value="${v('name')}" placeholder="Product name"></div>
    </div>
    <div class="form-group"><label>Description</label><textarea id="f_description">${v('description')}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Category</label><select id="f_category_id"><option value="">— Select —</option>${cats.map(c=>`<option value="${c.id}" ${p?.category_id==c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Warehouse</label><select id="f_warehouse_id"><option value="">— Select —</option>${whs.map(w=>`<option value="${w.id}" ${p?.warehouse_id==w.id?'selected':''}>${esc(w.name)}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Supplier</label><select id="f_supplier_id"><option value="">— Select —</option>${sups.map(s=>`<option value="${s.id}" ${p?.supplier_id==s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Unit of Measure</label><select id="f_unit_of_measure">${['piece','kg','lb','box','carton','pallet','liter','gallon','meter','foot'].map(u=>`<option value="${u}" ${(p?.unit_of_measure||'piece')===u?'selected':''}>${u}</option>`).join('')}</select></div>
    </div>
    <div class="form-row-3">
      <div class="form-group"><label>Cost Price</label><input type="number" step="0.01" id="f_cost_price" value="${v('cost_price','0')}"></div>
      <div class="form-group"><label>Unit Price</label><input type="number" step="0.01" id="f_unit_price" value="${v('unit_price','0')}"></div>
      <div class="form-group"><label>Currency</label><select id="f_currency">${['USD','EUR','GBP','INR','AUD','CAD','JPY','CNY'].map(c=>`<option value="${c}" ${(p?.currency||'USD')===c?'selected':''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="form-row-3">
      <div class="form-group"><label>Stock Qty</label><input type="number" step="0.01" id="f_quantity_in_stock" value="${v('quantity_in_stock','0')}"></div>
      <div class="form-group"><label>Reorder Level</label><input type="number" step="0.01" id="f_reorder_level" value="${v('reorder_level','10')}"></div>
      <div class="form-group"><label>Reorder Qty</label><input type="number" step="0.01" id="f_reorder_quantity" value="${v('reorder_quantity','50')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Tax Rate %</label><input type="number" step="0.01" id="f_tax_rate" value="${v('tax_rate','0')}"></div>
      <div class="form-group"><label>Status</label><select id="f_status">${['active','inactive','discontinued'].map(s=>`<option value="${s}" ${(p?.status||'active')===s?'selected':''}>${s}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label>Barcode</label><input id="f_barcode" value="${v('barcode')}"></div>
    <div class="form-group"><label>Notes</label><textarea id="f_notes">${v('notes')}</textarea></div>`,
    `<button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveProduct(${id||0})">Save Product</button>`
  );
}

async function saveProduct(id) {
  const d = {
    sku: g('f_sku'), name: g('f_name'), description: g('f_description'),
    category_id: gNum('f_category_id'), warehouse_id: gNum('f_warehouse_id'),
    supplier_id: gNum('f_supplier_id'), unit_of_measure: g('f_unit_of_measure'),
    cost_price: gFloat('f_cost_price'), unit_price: gFloat('f_unit_price'),
    currency: g('f_currency'), quantity_in_stock: gFloat('f_quantity_in_stock'),
    reorder_level: gFloat('f_reorder_level'), reorder_quantity: gFloat('f_reorder_quantity'),
    tax_rate: gFloat('f_tax_rate'), status: g('f_status'),
    barcode: g('f_barcode'), notes: g('f_notes'),
  };
  if (!d.sku || !d.name) { toastErr('SKU and Name are required'); return; }
  const r = id ? await put(`products&id=${id}`, d) : await post('products', d);
  if (r.error) { toastErr(r.error); return; }
  toastOk(id ? 'Product updated' : 'Product created');
  hideModal(); renderProducts();
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  const r = await del(`products&id=${id}`);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Product deleted'); renderProducts();
}

// helpers
function g(id)      { return document.getElementById(id)?.value || ''; }
function gNum(id)   { const v = parseInt(g(id)); return isNaN(v)||v===0 ? null : v; }
function gFloat(id) { return parseFloat(g(id)) || 0; }

// ============================================================
// CATEGORIES
// ============================================================
async function renderCategories() {
  state.categories = await get('categories');
  renderCatPage();
}
function renderCatPage() {
  const rows = filterRows(state.categories||[], state.cat_search||'', ['name','description']);
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h2>Categories</h2><p>${(state.categories||[]).length} categories</p></div>
      <button class="btn btn-primary" onclick="openCatModal()">+ Add Category</button>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="search-input"><input type="text" placeholder="Search…" value="${esc(state.cat_search||'')}" oninput="state.cat_search=this.value;renderCatPage()"></div>
      </div>
      <div class="card-body" style="padding:0">
        ${buildTable([
          {header:'Name',     key:'name'},
          {header:'Description', cell:r=>esc((r.description||'').substring(0,60))},
          {header:'Color',    cell:r=>`<span style="display:inline-block;width:16px;height:16px;background:${esc(r.color||'#888')};border-radius:4px;vertical-align:middle"></span> ${esc(r.color||'')}`},
          {header:'Status',   cell:r=>statusBadge(r.status)},
          {header:'Actions',  cell:r=>`<div class="actions-cell"><button class="btn btn-sm btn-secondary" onclick="openCatModal(${r.id})">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteCat(${r.id})">Del</button></div>`},
        ], rows, 'No categories found')}
      </div>
    </div>`;
}
function openCatModal(id) {
  const c = id ? (state.categories||[]).find(x=>x.id===id) : {};
  const v = (f,d='') => esc(id ? (c?.[f]??d) : d);
  showModal(id?'Edit Category':'Add Category', `
    <div class="form-group"><label>Name *</label><input id="fc_name" value="${v('name')}"></div>
    <div class="form-group"><label>Description</label><textarea id="fc_description">${v('description')}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Color</label><input type="color" id="fc_color" value="${c?.color||'#3b82f6'}" style="height:42px;padding:4px"></div>
      <div class="form-group"><label>Status</label><select id="fc_status">${['active','inactive'].map(s=>`<option value="${s}" ${(c?.status||'active')===s?'selected':''}>${s}</option>`).join('')}</select></div>
    </div>`,
    `<button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveCat(${id||0})">Save</button>`
  );
}
async function saveCat(id) {
  const d = { name: g('fc_name'), description: g('fc_description'), color: g('fc_color'), status: g('fc_status') };
  if (!d.name) { toastErr('Name required'); return; }
  const r = id ? await put(`categories&id=${id}`, d) : await post('categories', d);
  if (r.error) { toastErr(r.error); return; }
  toastOk(id ? 'Category updated' : 'Category created'); hideModal(); renderCategories();
}
async function deleteCat(id) {
  if (!confirm('Delete this category?')) return;
  const r = await del(`categories&id=${id}`);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Deleted'); renderCategories();
}

// ============================================================
// WAREHOUSES
// ============================================================
async function renderWarehouses() {
  state.warehouses = await get('warehouses');
  renderWhPage();
}
function renderWhPage() {
  const rows = filterRows(state.warehouses||[], state.wh_search||'', ['name','code','city','country']);
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h2>Warehouses</h2><p>${(state.warehouses||[]).length} warehouses</p></div>
      <button class="btn btn-primary" onclick="openWhModal()">+ Add Warehouse</button>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="search-input"><input type="text" placeholder="Search…" value="${esc(state.wh_search||'')}" oninput="state.wh_search=this.value;renderWhPage()"></div>
      </div>
      <div class="card-body" style="padding:0">
        ${buildTable([
          {header:'Name',    key:'name'},
          {header:'Code',    key:'code'},
          {header:'City',    key:'city'},
          {header:'Country', key:'country'},
          {header:'Manager', key:'manager_name'},
          {header:'Capacity',cell:r=>fmt.number(r.capacity)},
          {header:'Status',  cell:r=>statusBadge(r.status)},
          {header:'Actions', cell:r=>`<div class="actions-cell"><button class="btn btn-sm btn-secondary" onclick="openWhModal(${r.id})">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteWh(${r.id})">Del</button></div>`},
        ], rows, 'No warehouses')}
      </div>
    </div>`;
}
function openWhModal(id) {
  const w = id ? (state.warehouses||[]).find(x=>x.id===id) : {};
  const v = (f,d='') => esc(id ? (w?.[f]??d) : d);
  showModal(id?'Edit Warehouse':'Add Warehouse', `
    <div class="form-row"><div class="form-group"><label>Name *</label><input id="fw_name" value="${v('name')}"></div><div class="form-group"><label>Code *</label><input id="fw_code" value="${v('code')}"></div></div>
    <div class="form-group"><label>Address</label><input id="fw_address" value="${v('address')}"></div>
    <div class="form-row"><div class="form-group"><label>City</label><input id="fw_city" value="${v('city')}"></div><div class="form-group"><label>Country</label><input id="fw_country" value="${v('country')}"></div></div>
    <div class="form-row"><div class="form-group"><label>Manager Name</label><input id="fw_manager_name" value="${v('manager_name')}"></div><div class="form-group"><label>Manager Email</label><input id="fw_manager_email" value="${v('manager_email')}"></div></div>
    <div class="form-row"><div class="form-group"><label>Phone</label><input id="fw_phone" value="${v('phone')}"></div><div class="form-group"><label>Capacity</label><input type="number" id="fw_capacity" value="${v('capacity','0')}"></div></div>
    <div class="form-group"><label>Status</label><select id="fw_status">${['active','inactive'].map(s=>`<option value="${s}" ${(w?.status||'active')===s?'selected':''}>${s}</option>`).join('')}</select></div>`,
    `<button class="btn btn-secondary" onclick="hideModal()">Cancel</button><button class="btn btn-primary" onclick="saveWh(${id||0})">Save</button>`
  );
}
async function saveWh(id) {
  const d = { name:g('fw_name'), code:g('fw_code'), address:g('fw_address'), city:g('fw_city'), country:g('fw_country'), manager_name:g('fw_manager_name'), manager_email:g('fw_manager_email'), phone:g('fw_phone'), capacity:gFloat('fw_capacity'), status:g('fw_status') };
  if (!d.name||!d.code) { toastErr('Name and Code required'); return; }
  const r = id ? await put(`warehouses&id=${id}`, d) : await post('warehouses', d);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Saved'); hideModal(); renderWarehouses();
}
async function deleteWh(id) {
  if (!confirm('Delete this warehouse?')) return;
  const r = await del(`warehouses&id=${id}`);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Deleted'); renderWarehouses();
}

// ============================================================
// SUPPLIERS
// ============================================================
async function renderSuppliers() {
  state.suppliers = await get('suppliers');
  renderSupPage();
}
function renderSupPage() {
  const rows = filterRows(state.suppliers||[], state.sup_search||'', ['name','code','email','city','country']);
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h2>Suppliers</h2><p>${(state.suppliers||[]).length} suppliers</p></div>
      <button class="btn btn-primary" onclick="openSupModal()">+ Add Supplier</button>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="search-input"><input type="text" placeholder="Search…" value="${esc(state.sup_search||'')}" oninput="state.sup_search=this.value;renderSupPage()"></div>
      </div>
      <div class="card-body" style="padding:0">
        ${buildTable([
          {header:'Name',    key:'name'},
          {header:'Code',    key:'code'},
          {header:'Contact', key:'contact_person'},
          {header:'Email',   key:'email'},
          {header:'Country', key:'country'},
          {header:'Terms',   key:'payment_terms'},
          {header:'Rating',  cell:r=>'⭐'.repeat(r.rating||0)},
          {header:'Status',  cell:r=>statusBadge(r.status)},
          {header:'Actions', cell:r=>`<div class="actions-cell"><button class="btn btn-sm btn-secondary" onclick="openSupModal(${r.id})">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteSup(${r.id})">Del</button></div>`},
        ], rows, 'No suppliers')}
      </div>
    </div>`;
}
function openSupModal(id) {
  const s = id ? (state.suppliers||[]).find(x=>x.id===id) : {};
  const v = (f,d='') => esc(id ? (s?.[f]??d) : d);
  showModal(id?'Edit Supplier':'Add Supplier', `
    <div class="form-row"><div class="form-group"><label>Name *</label><input id="fs_name" value="${v('name')}"></div><div class="form-group"><label>Code</label><input id="fs_code" value="${v('code')}"></div></div>
    <div class="form-row"><div class="form-group"><label>Contact Person</label><input id="fs_contact_person" value="${v('contact_person')}"></div><div class="form-group"><label>Email</label><input type="email" id="fs_email" value="${v('email')}"></div></div>
    <div class="form-row"><div class="form-group"><label>Phone</label><input id="fs_phone" value="${v('phone')}"></div><div class="form-group"><label>Tax ID</label><input id="fs_tax_id" value="${v('tax_id')}"></div></div>
    <div class="form-group"><label>Address</label><input id="fs_address" value="${v('address')}"></div>
    <div class="form-row"><div class="form-group"><label>City</label><input id="fs_city" value="${v('city')}"></div><div class="form-group"><label>Country</label><input id="fs_country" value="${v('country')}"></div></div>
    <div class="form-row">
      <div class="form-group"><label>Payment Terms</label><select id="fs_payment_terms">${['net_30','net_60','net_90','immediate','cod'].map(t=>`<option value="${t}" ${(s?.payment_terms||'net_30')===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label>Currency</label><select id="fs_currency">${['USD','EUR','GBP','INR','AUD','CAD','JPY','CNY'].map(c=>`<option value="${c}" ${(s?.currency||'USD')===c?'selected':''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Rating (1–5)</label><input type="number" min="1" max="5" id="fs_rating" value="${v('rating','3')}"></div>
      <div class="form-group"><label>Status</label><select id="fs_status">${['active','inactive','blocked'].map(s2=>`<option value="${s2}" ${(s?.status||'active')===s2?'selected':''}>${s2}</option>`).join('')}</select></div>
    </div>`,
    `<button class="btn btn-secondary" onclick="hideModal()">Cancel</button><button class="btn btn-primary" onclick="saveSup(${id||0})">Save</button>`
  );
}
async function saveSup(id) {
  const d = { name:g('fs_name'), code:g('fs_code'), contact_person:g('fs_contact_person'), email:g('fs_email'), phone:g('fs_phone'), tax_id:g('fs_tax_id'), address:g('fs_address'), city:g('fs_city'), country:g('fs_country'), payment_terms:g('fs_payment_terms'), currency:g('fs_currency'), rating:parseInt(g('fs_rating'))||3, status:g('fs_status') };
  if (!d.name) { toastErr('Name required'); return; }
  const r = id ? await put(`suppliers&id=${id}`, d) : await post('suppliers', d);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Saved'); hideModal(); renderSuppliers();
}
async function deleteSup(id) {
  if (!confirm('Delete supplier?')) return;
  const r = await del(`suppliers&id=${id}`);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Deleted'); renderSuppliers();
}

// ============================================================
// TRANSACTIONS
// ============================================================
async function renderTransactions() {
  const [txns, products, warehouses, suppliers] = await Promise.all([
    get('transactions'), get('products'), get('warehouses'), get('suppliers')
  ]);
  state.transactions = txns; state.txn_products = products;
  state.txn_warehouses = warehouses; state.txn_suppliers = suppliers;
  renderTxnPage();
}
function renderTxnPage() {
  const rows = filterRows(state.transactions||[], state.txn_search||'', ['transaction_number','product_name','reference_number']);
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h2>Stock Transactions</h2><p>${(state.transactions||[]).length} transactions</p></div>
      <button class="btn btn-primary" onclick="openTxnModal()">+ New Transaction</button>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="search-input"><input type="text" placeholder="Search…" value="${esc(state.txn_search||'')}" oninput="state.txn_search=this.value;renderTxnPage()"></div>
      </div>
      <div class="card-body" style="padding:0">
        ${buildTable([
          {header:'TXN #',    key:'transaction_number'},
          {header:'Product',  key:'product_name'},
          {header:'Type',     cell:r=>statusBadge(r.type)},
          {header:'Qty',      key:'quantity'},
          {header:'Unit Cost',cell:r=>fmt.currency(r.unit_cost, r.currency)},
          {header:'Total',    cell:r=>fmt.currency(r.total_cost, r.currency)},
          {header:'Ref #',    key:'reference_number'},
          {header:'Date',     cell:r=>fmt.date(r.transaction_date)},
          {header:'Status',   cell:r=>statusBadge(r.status)},
          {header:'Actions',  cell:r=>`<div class="actions-cell">${r.status==='pending'?`<button class="btn btn-sm btn-success" onclick="approveTxn(${r.id})">Approve</button>`:''}
            <button class="btn btn-sm btn-danger" onclick="deleteTxn(${r.id})">Del</button></div>`},
        ], rows, 'No transactions')}
      </div>
    </div>`;
}
function openTxnModal() {
  const prods = (state.txn_products||[]).filter(p=>p.status==='active');
  const whs   = (state.txn_warehouses||[]).filter(w=>w.status==='active');
  const sups  = (state.txn_suppliers||[]).filter(s=>s.status==='active');
  showModal('New Stock Transaction', `
    <div class="form-row">
      <div class="form-group"><label>Product *</label><select id="ft_product_id"><option value="">— Select —</option>${prods.map(p=>`<option value="${p.id}">[${esc(p.sku)}] ${esc(p.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Type *</label><select id="ft_type">${['inward','outward','transfer','adjustment','return'].map(t=>`<option value="${t}">${t}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Quantity *</label><input type="number" step="0.01" id="ft_quantity" placeholder="0"></div>
      <div class="form-group"><label>Unit Cost</label><input type="number" step="0.01" id="ft_unit_cost" placeholder="0.00"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Warehouse</label><select id="ft_warehouse_id"><option value="">— Select —</option>${whs.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Supplier</label><select id="ft_supplier_id"><option value="">— Select —</option>${sups.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Reference # (PO/Invoice)</label><input id="ft_reference_number" placeholder="REF-001"></div>
      <div class="form-group"><label>Date</label><input type="date" id="ft_transaction_date" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Currency</label><select id="ft_currency">${['USD','EUR','GBP','INR','AUD','CAD','JPY','CNY'].map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
      <div class="form-group"><label>Status</label><select id="ft_status"><option value="pending">pending</option><option value="completed">completed</option></select></div>
    </div>
    <div class="form-group"><label>Notes</label><textarea id="ft_notes"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="hideModal()">Cancel</button><button class="btn btn-primary" onclick="saveTxn()">Save Transaction</button>`
  );
}
async function saveTxn() {
  const d = { product_id:gNum('ft_product_id'), type:g('ft_type'), quantity:gFloat('ft_quantity'), unit_cost:gFloat('ft_unit_cost'), warehouse_id:gNum('ft_warehouse_id'), supplier_id:gNum('ft_supplier_id'), reference_number:g('ft_reference_number'), transaction_date:g('ft_transaction_date'), currency:g('ft_currency'), status:g('ft_status'), notes:g('ft_notes') };
  if (!d.product_id || !d.quantity) { toastErr('Product and Quantity required'); return; }
  const r = await post('transactions', d);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Transaction saved'); hideModal(); renderTransactions();
}
async function approveTxn(id) {
  const r = await put(`transactions&id=${id}`, { status:'completed', approved_by: CURRENT_USER.email, approved_date: new Date().toISOString() });
  if (r.error) { toastErr(r.error); return; }
  toastOk('Transaction approved'); renderTransactions();
}
async function deleteTxn(id) {
  if (!confirm('Delete transaction?')) return;
  const r = await del(`transactions&id=${id}`);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Deleted'); renderTransactions();
}

// ============================================================
// PURCHASE ORDERS
// ============================================================
async function renderPurchaseOrders() {
  const [pos, suppliers, warehouses, products] = await Promise.all([
    get('purchase-orders'), get('suppliers'), get('warehouses'), get('products')
  ]);
  state.pos = pos; state.po_suppliers = suppliers;
  state.po_warehouses = warehouses; state.po_products = products;
  renderPoPage();
}
function renderPoPage() {
  const rows = filterRows(state.pos||[], state.po_search||'', ['po_number','supplier_name','status']);
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h2>Purchase Orders</h2><p>${(state.pos||[]).length} orders</p></div>
      <button class="btn btn-primary" onclick="openPoModal()">+ Create PO</button>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="search-input"><input type="text" placeholder="Search…" value="${esc(state.po_search||'')}" oninput="state.po_search=this.value;renderPoPage()"></div>
      </div>
      <div class="card-body" style="padding:0">
        ${buildTable([
          {header:'PO #',      key:'po_number'},
          {header:'Supplier',  key:'supplier_name'},
          {header:'Order Date',cell:r=>fmt.date(r.order_date)},
          {header:'Expected',  cell:r=>fmt.date(r.expected_delivery_date)},
          {header:'Total',     cell:r=>fmt.currency(r.total_amount, r.currency)},
          {header:'Status',    cell:r=>statusBadge(r.status)},
          {header:'Actions',   cell:r=>`<div class="actions-cell">
            <button class="btn btn-sm btn-secondary" onclick="viewPo(${r.id})">View</button>
            ${r.status==='ordered'?`<button class="btn btn-sm btn-success" onclick="receivePo(${r.id})">Receive</button>`:''}
            ${r.status==='draft'?`<button class="btn btn-sm btn-warning" onclick="orderPo(${r.id})">Order</button>`:''}
            <button class="btn btn-sm btn-danger" onclick="deletePo(${r.id})">Del</button>
          </div>`},
        ], rows, 'No purchase orders')}
      </div>
    </div>`;
}

let poItems = [];
function openPoModal(id) {
  poItems = [{ product_id:'', quantity_ordered:1, unit_cost:0, tax_rate:0, total_cost:0 }];
  const sups = (state.po_suppliers||[]).filter(s=>s.status==='active');
  const whs  = (state.po_warehouses||[]).filter(w=>w.status==='active');
  showModal('Create Purchase Order', `
    <div class="form-row">
      <div class="form-group"><label>Supplier *</label><select id="fpo_supplier_id"><option value="">— Select —</option>${sups.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Order Date *</label><input type="date" id="fpo_order_date" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Expected Delivery</label><input type="date" id="fpo_expected_delivery_date"></div>
      <div class="form-group"><label>Warehouse</label><select id="fpo_warehouse_id"><option value="">— Select —</option>${whs.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Currency</label><select id="fpo_currency">${['USD','EUR','GBP','INR','AUD','CAD','JPY','CNY'].map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
      <div class="form-group"><label>Payment Terms</label><select id="fpo_payment_terms">${['net_30','net_60','net_90','immediate','cod'].map(t=>`<option value="${t}">${t}</option>`).join('')}</select></div>
    </div>
    <hr style="margin:12px 0">
    <div class="d-flex justify-between align-center mb-1"><strong>Order Items</strong><button type="button" class="btn btn-sm btn-secondary" onclick="addPoItem()">+ Add Item</button></div>
    <div id="po-items-container">${renderPoItems()}</div>
    <div class="form-group mt-2"><label>Notes</label><textarea id="fpo_notes"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="hideModal()">Cancel</button><button class="btn btn-primary" onclick="savePo()">Save PO</button>`,
    true
  );
}

function renderPoItems() {
  const prods = (state.po_products||[]).filter(p=>p.status==='active');
  return poItems.map((item, i) => `
    <div class="form-row" style="align-items:flex-end;margin-bottom:8px">
      <div class="form-group" style="grid-column:span 2"><label>Product</label>
        <select onchange="poItemChange(${i},'product_id',this.value)">
          <option value="">— Select —</option>
          ${prods.map(p=>`<option value="${p.id}" ${item.product_id==p.id?'selected':''}>[${esc(p.sku)}] ${esc(p.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Qty</label><input type="number" step="0.01" value="${item.quantity_ordered}" onchange="poItemChange(${i},'quantity_ordered',this.value)"></div>
      <div class="form-group"><label>Unit Cost</label><input type="number" step="0.01" value="${item.unit_cost}" onchange="poItemChange(${i},'unit_cost',this.value)"></div>
      <div class="form-group"><label>Tax %</label><input type="number" step="0.01" value="${item.tax_rate||0}" onchange="poItemChange(${i},'tax_rate',this.value)"></div>
      <div><button type="button" class="btn btn-sm btn-danger" style="margin-top:20px" onclick="removePoItem(${i})">✕</button></div>
    </div>`).join('');
}
function addPoItem()         { poItems.push({product_id:'',quantity_ordered:1,unit_cost:0,tax_rate:0,total_cost:0}); refreshPoItems(); }
function removePoItem(i)     { poItems.splice(i,1); refreshPoItems(); }
function poItemChange(i,f,v) { poItems[i][f]=f==='product_id'?parseInt(v)||'':parseFloat(v)||0; if(f!=='product_id') poItems[i].total_cost=poItems[i].quantity_ordered*poItems[i].unit_cost; refreshPoItems(); }
function refreshPoItems()    { document.getElementById('po-items-container').innerHTML=renderPoItems(); }

async function savePo() {
  const items = poItems.filter(i=>i.product_id&&i.quantity_ordered>0);
  if (!gNum('fpo_supplier_id') || !g('fpo_order_date')) { toastErr('Supplier and date required'); return; }
  if (!items.length) { toastErr('Add at least one item'); return; }
  const subtotal = items.reduce((s,i)=>s+i.total_cost,0);
  const d = { supplier_id:gNum('fpo_supplier_id'), order_date:g('fpo_order_date'), expected_delivery_date:g('fpo_expected_delivery_date')||null, warehouse_id:gNum('fpo_warehouse_id'), currency:g('fpo_currency'), payment_terms:g('fpo_payment_terms'), notes:g('fpo_notes'), subtotal, total_amount:subtotal, status:'draft', items };
  const r = await post('purchase-orders', d);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Purchase Order created'); hideModal(); renderPurchaseOrders();
}

async function viewPo(id) {
  const po = await get(`purchase-orders&id=${id}`);
  const sup = (state.po_suppliers||[]).find(s=>s.id===po.supplier_id);
  showModal(`PO: ${po.po_number}`, `
    <div class="form-row">
      <div><strong>Supplier:</strong> ${esc(po.supplier_name||'')}</div>
      <div><strong>Warehouse:</strong> ${esc(po.warehouse_name||'')}</div>
    </div>
    <div class="form-row mt-1">
      <div><strong>Order Date:</strong> ${fmt.date(po.order_date)}</div>
      <div><strong>Expected:</strong> ${fmt.date(po.expected_delivery_date)}</div>
    </div>
    <div class="form-row mt-1">
      <div><strong>Status:</strong> ${statusBadge(po.status)}</div>
      <div><strong>Total:</strong> ${fmt.currency(po.total_amount, po.currency)}</div>
    </div>
    <hr style="margin:12px 0">
    <strong>Items:</strong>
    ${buildTable([
      {header:'Product', key:'product_name'},
      {header:'SKU',     key:'sku'},
      {header:'Qty Ordered', key:'quantity_ordered'},
      {header:'Qty Received',key:'quantity_received'},
      {header:'Unit Cost', cell:r=>fmt.currency(r.unit_cost)},
      {header:'Total',   cell:r=>fmt.currency(r.total_cost)},
    ], po.items||[], 'No items')}`,
    `<button class="btn btn-secondary" onclick="hideModal()">Close</button>
     ${po.status==='ordered'?`<button class="btn btn-success" onclick="receivePo(${id})">Mark Received</button>`:''}`,
    true
  );
}

async function orderPo(id) {
  if (!confirm('Mark this PO as Ordered?')) return;
  const r = await put(`purchase-orders&id=${id}`, { status:'ordered' });
  if (r.error) { toastErr(r.error); return; }
  toastOk('PO marked as ordered'); renderPurchaseOrders();
}
async function receivePo(id) {
  if (!confirm('Mark PO as received? This will update stock levels.')) return;
  const r = await post(`purchase-orders/${id}/receive`, {});
  if (r.error) { toastErr(r.error); return; }
  toastOk('PO received — stock updated'); hideModal(); renderPurchaseOrders();
}
async function deletePo(id) {
  if (!confirm('Delete this PO?')) return;
  const r = await del(`purchase-orders&id=${id}`);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Deleted'); renderPurchaseOrders();
}

// ============================================================
// WARRANTIES
// ============================================================
async function renderWarranties() {
  const [wrs, products, suppliers] = await Promise.all([get('warranties'), get('products'), get('suppliers')]);
  state.warranties = wrs; state.wr_products = products; state.wr_suppliers = suppliers;
  renderWrPage();
}
function renderWrPage() {
  const rows = filterRows(state.warranties||[], state.wr_search||'', ['warranty_number','serial_number','status']);
  const prodMap = Object.fromEntries((state.wr_products||[]).map(p=>[p.id,p.name]));
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h2>Warranties</h2><p>${(state.warranties||[]).length} warranties</p></div>
      <button class="btn btn-primary" onclick="openWrModal()">+ Add Warranty</button>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="search-input"><input type="text" placeholder="Search…" value="${esc(state.wr_search||'')}" oninput="state.wr_search=this.value;renderWrPage()"></div>
      </div>
      <div class="card-body" style="padding:0">
        ${buildTable([
          {header:'#',       key:'warranty_number'},
          {header:'Product', cell:r=>esc(prodMap[r.product_id]||r.product_name||'—')},
          {header:'Serial',  key:'serial_number'},
          {header:'Type',    key:'warranty_type'},
          {header:'Start',   cell:r=>fmt.date(r.start_date)},
          {header:'End',     cell:r=>fmt.date(r.end_date)},
          {header:'Status',  cell:r=>statusBadge(r.status)},
          {header:'Actions', cell:r=>`<div class="actions-cell"><button class="btn btn-sm btn-secondary" onclick="openWrModal(${r.id})">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteWr(${r.id})">Del</button></div>`},
        ], rows, 'No warranties')}
      </div>
    </div>`;
}
function openWrModal(id) {
  const w = id ? (state.warranties||[]).find(x=>x.id===id) : {};
  const v = (f,d='') => esc(id ? (w?.[f]??d) : d);
  const prods = (state.wr_products||[]).filter(p=>p.status==='active');
  const sups  = (state.wr_suppliers||[]).filter(s=>s.status==='active');
  showModal(id?'Edit Warranty':'Add Warranty', `
    <div class="form-row">
      <div class="form-group"><label>Product *</label><select id="fwr_product_id"><option value="">— Select —</option>${prods.map(p=>`<option value="${p.id}" ${w?.product_id==p.id?'selected':''}>[${esc(p.sku)}] ${esc(p.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Supplier</label><select id="fwr_supplier_id"><option value="">— Select —</option>${sups.map(s=>`<option value="${s.id}" ${w?.supplier_id==s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Warranty Number</label><input id="fwr_warranty_number" value="${v('warranty_number')}"></div>
      <div class="form-group"><label>Serial Number</label><input id="fwr_serial_number" value="${v('serial_number')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Start Date *</label><input type="date" id="fwr_start_date" value="${v('start_date')}"></div>
      <div class="form-group"><label>End Date *</label><input type="date" id="fwr_end_date" value="${v('end_date')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Type</label><select id="fwr_warranty_type">${['manufacturer','extended','third_party'].map(t=>`<option value="${t}" ${(w?.warranty_type||'manufacturer')===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label>Status</label><select id="fwr_status">${['active','expiring_soon','expired','claimed','void'].map(s=>`<option value="${s}" ${(w?.status||'active')===s?'selected':''}>${s}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label>Coverage</label><textarea id="fwr_coverage">${v('coverage')}</textarea></div>
    <div class="form-group"><label>Notes</label><textarea id="fwr_notes">${v('notes')}</textarea></div>`,
    `<button class="btn btn-secondary" onclick="hideModal()">Cancel</button><button class="btn btn-primary" onclick="saveWr(${id||0})">Save</button>`
  );
}
async function saveWr(id) {
  const d = { product_id:gNum('fwr_product_id'), supplier_id:gNum('fwr_supplier_id'), warranty_number:g('fwr_warranty_number'), serial_number:g('fwr_serial_number'), start_date:g('fwr_start_date'), end_date:g('fwr_end_date'), warranty_type:g('fwr_warranty_type'), status:g('fwr_status'), coverage:g('fwr_coverage'), notes:g('fwr_notes') };
  if (!d.product_id||!d.start_date||!d.end_date) { toastErr('Product, start and end date required'); return; }
  const r = id ? await put(`warranties&id=${id}`, d) : await post('warranties', d);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Saved'); hideModal(); renderWarranties();
}
async function deleteWr(id) {
  if (!confirm('Delete warranty?')) return;
  const r = await del(`warranties&id=${id}`);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Deleted'); renderWarranties();
}

// ============================================================
// ADJUSTMENTS
// ============================================================
async function renderAdjustments() {
  const [adjs, products, warehouses] = await Promise.all([get('adjustments'), get('products'), get('warehouses')]);
  state.adjustments = adjs; state.adj_products = products; state.adj_warehouses = warehouses;
  renderAdjPage();
}
function renderAdjPage() {
  const rows = filterRows(state.adjustments||[], state.adj_search||'', ['adjustment_number','product_name','adjustment_type']);
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h2>Stock Adjustments</h2><p>${(state.adjustments||[]).length} adjustments</p></div>
      <button class="btn btn-primary" onclick="openAdjModal()">+ New Adjustment</button>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="search-input"><input type="text" placeholder="Search…" value="${esc(state.adj_search||'')}" oninput="state.adj_search=this.value;renderAdjPage()"></div>
      </div>
      <div class="card-body" style="padding:0">
        ${buildTable([
          {header:'#',      key:'adjustment_number'},
          {header:'Product',key:'product_name'},
          {header:'Type',   key:'adjustment_type'},
          {header:'Prev Qty',key:'previous_quantity'},
          {header:'New Qty', key:'new_quantity'},
          {header:'Variance',cell:r=>`<span class="${(r.variance||0)<0?'text-danger':'text-success'}">${r.variance||0}</span>`},
          {header:'Date',   cell:r=>fmt.date(r.adjustment_date)},
          {header:'Status', cell:r=>statusBadge(r.status)},
          {header:'Actions',cell:r=>`<div class="actions-cell">
            ${r.status==='pending_approval'?`<button class="btn btn-sm btn-success" onclick="approveAdj(${r.id})">Approve</button>`:''}
            <button class="btn btn-sm btn-danger" onclick="deleteAdj(${r.id})">Del</button>
          </div>`},
        ], rows, 'No adjustments')}
      </div>
    </div>`;
}
function openAdjModal() {
  const prods = (state.adj_products||[]).filter(p=>p.status==='active');
  const whs   = (state.adj_warehouses||[]).filter(w=>w.status==='active');
  showModal('New Stock Adjustment', `
    <div class="form-row">
      <div class="form-group"><label>Product *</label><select id="fadj_product_id"><option value="">— Select —</option>${prods.map(p=>`<option value="${p.id}" data-qty="${p.quantity_in_stock}">[${esc(p.sku)}] ${esc(p.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Warehouse</label><select id="fadj_warehouse_id"><option value="">— Select —</option>${whs.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Adjustment Type</label><select id="fadj_type">${['stock_take','damage','loss','correction','opening_balance','closing_balance'].map(t=>`<option value="${t}">${t}</option>`).join('')}</select></div>
      <div class="form-group"><label>Date</label><input type="date" id="fadj_date" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>New Quantity *</label><input type="number" step="0.01" id="fadj_new_quantity" placeholder="Enter correct quantity"></div>
      <div class="form-group"><label>Status</label><select id="fadj_status"><option value="draft">draft</option><option value="pending_approval">pending approval</option><option value="approved">approved</option></select></div>
    </div>
    <div class="form-group"><label>Reason</label><textarea id="fadj_reason"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="hideModal()">Cancel</button><button class="btn btn-primary" onclick="saveAdj()">Save</button>`
  );
}
async function saveAdj() {
  const d = { product_id:gNum('fadj_product_id'), warehouse_id:gNum('fadj_warehouse_id'), adjustment_type:g('fadj_type'), new_quantity:gFloat('fadj_new_quantity'), status:g('fadj_status'), reason:g('fadj_reason'), adjustment_date:g('fadj_date') };
  if (!d.product_id) { toastErr('Product required'); return; }
  const r = await post('adjustments', d);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Adjustment saved'); hideModal(); renderAdjustments();
}
async function approveAdj(id) {
  const r = await put(`adjustments&id=${id}`, { status:'approved', approved_by:CURRENT_USER.email, approved_date:new Date().toISOString() });
  if (r.error) { toastErr(r.error); return; }
  toastOk('Adjustment approved'); renderAdjustments();
}
async function deleteAdj(id) {
  if (!confirm('Delete adjustment?')) return;
  const r = await del(`adjustments&id=${id}`);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Deleted'); renderAdjustments();
}

// ============================================================
// REPORTS
// ============================================================
async function renderReports() {
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><div class="page-header-left"><h2>Reports</h2><p>Analytics and reporting</p></div></div>
    <div class="tabs" id="report-tabs">
      ${['stock_levels','low_stock','valuation','transactions','warranty_expiry','supplier_performance'].map((t,i)=>`<button class="tab ${i===0?'active':''}" onclick="loadReport('${t}',this)">${t.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</button>`).join('')}
    </div>
    <div class="d-flex gap-1 mb-2" id="report-filters" style="display:none!important">
      <input type="date" id="rpt_from" placeholder="From date">
      <input type="date" id="rpt_to" placeholder="To date">
      <button class="btn btn-secondary" onclick="loadReport(currentReport)">Apply</button>
    </div>
    <div id="report-area"><div class="loading-spinner"><div class="spinner"></div></div></div>`;
  loadReport('stock_levels');
}

let currentReport = 'stock_levels';
async function loadReport(type, tabEl) {
  currentReport = type;
  if (tabEl) { document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); tabEl.classList.add('active'); }
  document.getElementById('report-area').innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  const from = document.getElementById('rpt_from')?.value || '';
  const to   = document.getElementById('rpt_to')?.value || '';
  const data = await get(`reports&type=${type}${from?'&from='+from:''}${to?'&to='+to:''}`);
  const rows = data.data || [];

  let html = `<div class="card">
    <div class="card-header">
      <span class="card-title">${type.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())} (${rows.length} records)</span>
      <button class="btn btn-secondary btn-sm" onclick="exportReport('${type}')">⬇ Export CSV</button>
    </div>
    <div class="card-body" style="padding:0">`;

  const colMap = {
    stock_levels: [{header:'SKU',key:'sku'},{header:'Name',key:'name'},{header:'Category',key:'category_name'},{header:'Warehouse',key:'warehouse_name'},{header:'Stock',key:'quantity_in_stock'},{header:'Reorder Level',key:'reorder_level'},{header:'Cost Price',cell:r=>fmt.currency(r.cost_price)},{header:'Status',cell:r=>statusBadge(r.status)}],
    low_stock: [{header:'SKU',key:'sku'},{header:'Name',key:'name'},{header:'Stock',cell:r=>`<span class="text-danger fw-bold">${r.quantity_in_stock}</span>`},{header:'Reorder Level',key:'reorder_level'},{header:'Reorder Qty',key:'reorder_quantity'},{header:'Category',key:'category_name'}],
    valuation: [{header:'SKU',key:'sku'},{header:'Name',key:'name'},{header:'Category',key:'category'},{header:'Stock',key:'quantity_in_stock'},{header:'Cost Price',cell:r=>fmt.currency(r.cost_price)},{header:'Total Cost Value',cell:r=>fmt.currency(r.total_cost_value)},{header:'Total Retail Value',cell:r=>fmt.currency(r.total_retail_value)}],
    transactions: [{header:'TXN #',key:'transaction_number'},{header:'Product',key:'product_name'},{header:'Type',cell:r=>statusBadge(r.type)},{header:'Qty',key:'quantity'},{header:'Total Cost',cell:r=>fmt.currency(r.total_cost)},{header:'Date',cell:r=>fmt.date(r.transaction_date)},{header:'Status',cell:r=>statusBadge(r.status)}],
    warranty_expiry: [{header:'Product',key:'product_name'},{header:'SKU',key:'sku'},{header:'Start',cell:r=>fmt.date(r.start_date)},{header:'End',cell:r=>fmt.date(r.end_date)},{header:'Days Left',cell:r=>`<span class="${(r.days_remaining||0)<0?'text-danger':(r.days_remaining||0)<30?'text-warning':'text-success'}">${r.days_remaining||0}</span>`},{header:'Status',cell:r=>statusBadge(r.status)}],
    supplier_performance: [{header:'Supplier',key:'supplier_name'},{header:'Rating',cell:r=>'⭐'.repeat(r.rating||0)},{header:'Total Orders',key:'total_orders'},{header:'Completed',key:'completed_orders'},{header:'Total Value',cell:r=>fmt.currency(r.total_value)}],
  };

  html += buildTable(colMap[type]||[{header:'Data',cell:r=>JSON.stringify(r)}], rows, 'No data for this report');
  html += '</div></div>';
  document.getElementById('report-area').innerHTML = html;
}

function exportReport(type) {
  get(`reports&type=${type}`).then(data => {
    const rows = data.data || [];
    if (!rows.length) { toastErr('No data to export'); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h]||'').replace(/"/g,'""')}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `${type}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toastOk('Report exported');
  });
}

// ============================================================
// IMPORT / EXPORT
// ============================================================
async function renderImportExport() {
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><div class="page-header-left"><h2>Import / Export</h2><p>Bulk data management</p></div></div>
    <div class="charts-grid">
      <div class="card">
        <div class="card-header"><span class="card-title">⬇ Export Data</span></div>
        <div class="card-body">
          <p class="text-muted mb-2">Download current data as JSON or CSV</p>
          <div class="form-group"><label>Entity</label>
            <select id="exp_entity">
              ${['products','categories','warehouses','suppliers','warranties'].map(e=>`<option value="${e}">${e}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" onclick="doExport()">Export JSON</button>
          <button class="btn btn-secondary" style="margin-left:8px" onclick="doExportCsv()">Export CSV</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">⬆ Import Data</span></div>
        <div class="card-body">
          <p class="text-muted mb-2">Upload a JSON file to import records</p>
          <div class="form-group"><label>Entity</label>
            <select id="imp_entity">
              ${['products','categories','warehouses','suppliers'].map(e=>`<option value="${e}">${e}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>JSON File</label>
            <input type="file" id="imp_file" accept=".json"></div>
          <button class="btn btn-primary" onclick="doImport()">Import</button>
          <div id="import-result" class="mt-2"></div>
        </div>
      </div>
    </div>`;
}
async function doExport() {
  const entity = g('exp_entity');
  const data = await get(`export&entity=${entity}`);
  const json = JSON.stringify(data, null, 2);
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  a.download = `${entity}-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click(); toastOk('Exported');
}
async function doExportCsv() {
  const entity = g('exp_entity');
  const data = await get(`export&entity=${entity}`);
  if (!data.length) { toastErr('No data'); return; }
  const headers = Object.keys(data[0]);
  const csv = [headers.join(','), ...data.map(r=>headers.map(h=>`"${String(r[h]||'').replace(/"/g,'""')}"`).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `${entity}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); toastOk('CSV exported');
}
async function doImport() {
  const file   = document.getElementById('imp_file').files?.[0];
  const entity = g('imp_entity');
  const resultEl = document.getElementById('import-result');
  if (!file) { toastErr('Select a file'); return; }
  const text = await file.text();
  let rows; try { rows = JSON.parse(text); } catch { toastErr('Invalid JSON'); return; }
  if (!Array.isArray(rows)) { toastErr('JSON must be an array'); return; }
  resultEl.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  const r = await post('import', { entity, data: rows });
  if (r.error) { resultEl.innerHTML = `<div class="alert alert-danger">${esc(r.error)}</div>`; return; }
  resultEl.innerHTML = `<div class="alert alert-success">✅ Imported ${r.imported} records${r.errors?.length?` (${r.errors.length} errors)`:''}</div>`;
  toastOk(`Imported ${r.imported} records`);
}

// ============================================================
// ACTIVITY LOGS
// ============================================================
async function renderActivityLogs() {
  const logs = await get('activity-logs&limit=200');
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><div class="page-header-left"><h2>Activity Logs</h2><p>Recent system activity</p></div></div>
    <div class="card">
      <div class="card-body" style="padding:0">
        ${buildTable([
          {header:'Time',    cell:r=>fmt.datetime(r.timestamp)},
          {header:'User',    key:'user_name'},
          {header:'Email',   key:'user_email'},
          {header:'Action',  cell:r=>statusBadge(r.action)},
          {header:'Entity',  key:'entity_type'},
          {header:'Name',    key:'entity_name'},
          {header:'Details', cell:r=>esc((r.details||'').substring(0,80))},
          {header:'IP',      key:'ip_address'},
        ], logs, 'No activity logs')}
      </div>
    </div>`;
}

// ============================================================
// USERS
// ============================================================
async function renderUsers() {
  state.users = await get('users');
  renderUsersPage();
}
function renderUsersPage() {
  const rows = state.users || [];
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h2>Users</h2><p>${rows.length} users</p></div>
      <button class="btn btn-primary" onclick="openUserModal()">+ Add User</button>
    </div>
    <div class="card">
      <div class="card-body" style="padding:0">
        ${buildTable([
          {header:'Name',  key:'full_name'},
          {header:'Email', key:'email'},
          {header:'Role',  cell:r=>statusBadge(r.role)},
          {header:'Status',cell:r=>statusBadge(r.status)},
          {header:'Last Login',cell:r=>fmt.datetime(r.last_login)},
          {header:'Actions',cell:r=>`<button class="btn btn-sm btn-secondary" onclick="openUserModal(${r.id})">Edit</button>`},
        ], rows, 'No users')}
      </div>
    </div>`;
}
function openUserModal(id) {
  const u = id ? (state.users||[]).find(x=>x.id===id) : {};
  const v = (f,d='') => esc(id ? (u?.[f]??d) : d);
  showModal(id?'Edit User':'Add User', `
    <div class="form-row">
      <div class="form-group"><label>Full Name</label><input id="fu_full_name" value="${v('full_name')}"></div>
      <div class="form-group"><label>Email *</label><input type="email" id="fu_email" value="${v('email')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Password ${id?'(leave blank to keep)':' *'}</label><input type="password" id="fu_password" placeholder="••••••••"></div>
      <div class="form-group"><label>Role</label><select id="fu_role">${['admin','manager','staff','viewer'].map(r=>`<option value="${r}" ${(u?.role||'staff')===r?'selected':''}>${r}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label>Status</label><select id="fu_status">${['active','inactive'].map(s=>`<option value="${s}" ${(u?.status||'active')===s?'selected':''}>${s}</option>`).join('')}</select></div>`,
    `<button class="btn btn-secondary" onclick="hideModal()">Cancel</button><button class="btn btn-primary" onclick="saveUser(${id||0})">Save</button>`
  );
}
async function saveUser(id) {
  const d = { full_name:g('fu_full_name'), email:g('fu_email'), role:g('fu_role'), status:g('fu_status') };
  const pass = g('fu_password');
  if (pass) d.password = pass;
  if (!d.email) { toastErr('Email required'); return; }
  if (!id && !pass) { toastErr('Password required for new user'); return; }
  const r = id ? await put(`users&id=${id}`, d) : await post('users', d);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Saved'); hideModal(); renderUsers();
}

// ============================================================
// SETTINGS
// ============================================================
async function renderSettings() {
  const settings = await get('settings');
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><div class="page-header-left"><h2>Settings</h2><p>Application configuration</p></div></div>
    <div class="card" style="max-width:600px">
      <div class="card-header"><span class="card-title">General Settings</span></div>
      <div class="card-body">
        <div class="form-group"><label>Application Name</label><input id="s_app_name" value="${esc(settings.app_name||'')}"></div>
        <div class="form-group"><label>Company Name</label><input id="s_company_name" value="${esc(settings.company_name||'')}"></div>
        <div class="form-group"><label>Default Currency</label>
          <select id="s_default_currency">${['USD','EUR','GBP','INR','AUD','CAD','JPY','CNY'].map(c=>`<option value="${c}" ${settings.default_currency===c?'selected':''}>${c}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Warranty Alert Days (before expiry)</label><input type="number" id="s_warranty_alert_days" value="${esc(settings.warranty_alert_days||'30')}"></div>
        <div class="form-group"><label>Items Per Page</label><input type="number" id="s_items_per_page" value="${esc(settings.items_per_page||'25')}"></div>
        <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
      </div>
    </div>`;
}
async function saveSettings() {
  const d = { app_name:g('s_app_name'), company_name:g('s_company_name'), default_currency:g('s_default_currency'), warranty_alert_days:g('s_warranty_alert_days'), items_per_page:g('s_items_per_page') };
  const r = await post('settings', d);
  if (r.error) { toastErr(r.error); return; }
  toastOk('Settings saved');
}
