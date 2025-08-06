// Supabase Client kütüphanesini import et
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- SUPABASE BAĞLANTISI ---
// BURAYA KENDİ SUPABASE BİLGİLERİNİZİ GİRİN!
const SUPABASE_URL = 'https://vhhfhgazzwvblhlqlgcz.supabase.co'; // Supabase'den aldığınız URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoaGZoZ2F6end2YmxobHFsZ2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MjIwODUsImV4cCI6MjA2OTk5ODA4NX0.lStbUsPIpD7T3s5CmaKNPUTfDFO2HyHXnSE9bzsuwhU'; // Supabase'den aldığınız anon key

// Supabase client'ını oluştur
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- GLOBAL DEĞİŞKENLER ---
const app = document.getElementById('app');
const authScreen = document.getElementById('auth-screen');
const content = document.getElementById('content');
const modalContainer = document.getElementById('modal-container');
const toast = document.getElementById('toast');
const { jsPDF } = window.jspdf;
let charts = {};
let DB = {
    customers: [], stock: [], services: [], orders: [], plugins: [], 
    settings: { technicians: [], motorcycle_data: [], order_statuses: [] }
};

// --- KULLANICI GİRİŞ (AUTHENTICATION) FONKSİYONLARI ---
async function handleAuthStateChange() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        authScreen.classList.add('hidden');
        app.classList.remove('hidden');
        app.classList.add('flex');
        const userInfoDiv = document.getElementById('user-info');
        if (userInfoDiv) { userInfoDiv.innerHTML = `<p>${session.user.email}</p>`; }
        document.getElementById('logoutBtn').onclick = async () => {
            await supabase.auth.signOut();
            location.reload();
        };
        await startApp();
    } else {
        app.classList.add('hidden');
        app.classList.remove('flex');
        authScreen.classList.remove('hidden');
        renderLoginScreen();
    }
}

function renderLoginScreen() {
    authScreen.innerHTML = `
        <div class="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
            <div class="text-center mb-6"><i class="fas fa-motorcycle text-4xl text-orange-500"></i><h2 class="text-2xl font-bold text-gray-800 mt-2">Servis Paneli</h2></div>
            <form id="auth-form" class="space-y-4">
                <div><label for="email" class="block text-sm font-medium text-gray-700">Email</label><input type="email" id="email" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"></div>
                <div><label for="password" class="block text-sm font-medium text-gray-700">Parola</label><input type="password" id="password" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"></div>
                <div id="auth-message" class="text-center text-sm text-red-600 h-5"></div>
                <div class="flex gap-4">
                    <button type="submit" id="login-btn" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700">Giriş Yap</button>
                    <button type="submit" id="signup-btn" class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Kayıt Ol</button>
                </div>
            </form>
        </div>`;
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const messageDiv = document.getElementById('auth-message');
    document.getElementById('login-btn').addEventListener('click', async (e) => {
        e.preventDefault(); messageDiv.textContent = 'Giriş yapılıyor...';
        const { error } = await supabase.auth.signInWithPassword({ email: emailInput.value, password: passwordInput.value });
        if (error) messageDiv.textContent = 'Hata: ' + error.message; else messageDiv.textContent = '';
    });
    document.getElementById('signup-btn').addEventListener('click', async (e) => {
        e.preventDefault(); messageDiv.textContent = 'Kayıt oluşturuluyor...';
        const { error } = await supabase.auth.signUp({ email: emailInput.value, password: passwordInput.value });
        if (error) messageDiv.textContent = 'Hata: ' + error.message; else { messageDiv.textContent = 'Kayıt başarılı! Email adresinize gelen doğrulama linkine tıklayın.'; }
    });
}

// --- ANA UYGULAMA MANTIĞI ---
async function startApp() {
    await loadAllDataFromSupabase();
    loadPlugins();
    PluginHost.trigger('app_init', { navigate, DB, showToast, createModal, showConfirmModal });
    const path = window.location.hash.replace('#', '') || 'dashboard';
    navigate(path);
    window.addEventListener('hashchange', () => {
        const newPath = window.location.hash.replace('#', '') || 'dashboard';
        navigate(newPath);
    });
}

// --- VERİ YÖNETİMİ ---
async function loadAllDataFromSupabase() {
    showToast('Veriler yükleniyor...');
    const [customersResult, stockResult, servicesResult, ordersResult, settingsResult] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('stock').select('*'),
        supabase.from('services').select('*'),
        supabase.from('orders').select('*'),
        supabase.from('settings').select('*').eq('id', 1).single()
    ]);

    DB.customers = customersResult.data || [];
    if (customersResult.error) { console.error('Müşteri Yükleme Hatası:', customersResult.error); showToast('Müşteriler yüklenemedi!', true); }
    
    DB.stock = stockResult.data || [];
    if (stockResult.error) { console.error('Stok Yükleme Hatası:', stockResult.error); showToast('Stoklar yüklenemedi!', true); }

    DB.services = servicesResult.data || [];
    if (servicesResult.error) { console.error('Servis Yükleme Hatası:', servicesResult.error); showToast('Servisler yüklenemedi!', true); }

    DB.orders = ordersResult.data || [];
    if (ordersResult.error) { console.error('Sipariş Yükleme Hatası:', ordersResult.error); showToast('Siparişler yüklenemedi!', true); }

    DB.settings = settingsResult.data || {};
    if (settingsResult.error && settingsResult.error.code !== 'PGRST116') { 
        console.error('Ayarlar Yükleme Hatası:', settingsResult.error); 
        showToast('Ayarlar yüklenemedi!', true); 
    }
    
    // JSON olarak saklanan ayarları parse et
    try {
        DB.settings.technicians = typeof DB.settings.technicians === 'string' ? JSON.parse(DB.settings.technicians) : (DB.settings.technicians || []);
    } catch (e) {
        console.error("Teknisyen verisi ayrıştırılamadı:", e);
        DB.settings.technicians = [];
    }
     try {
        DB.settings.motorcycle_data = typeof DB.settings.motorcycle_data === 'string' ? JSON.parse(DB.settings.motorcycle_data) : (DB.settings.motorcycle_data || []);
    } catch (e) {
        console.error("Motosiklet verisi ayrıştırılamadı:", e);
        DB.settings.motorcycle_data = [];
    }
    // order_statuses zaten bir array olarak gelmeli, değilse varsayılan ata
    if (!Array.isArray(DB.settings.order_statuses)) {
        DB.settings.order_statuses = ['Sipariş Verildi', 'Teslim Alındı', 'İptal Edildi'];
    }


    loadLegacyData();
    document.getElementById('sidebar-company-name').textContent = DB.settings.company_name || 'Servis Paneli';
    showToast('Veriler yüklendi!');
}

function loadLegacyData() {
    const data = localStorage.getItem('motorcycleServiceDB');
    const defaultData = { plugins: [] };
    if (data) {
        const savedDB = JSON.parse(data);
        DB.plugins = savedDB.plugins || [];
    } else {
        DB.plugins = defaultData.plugins;
    }
}

function saveLegacyDB() {
    const legacyData = { plugins: DB.plugins };
    localStorage.setItem('motorcycleServiceDB', JSON.stringify(legacyData));
}

// --- PLUGIN SYSTEM & HELPERS ---
const PluginHost = {
    hooks: {},
    register(hookName, callback) { if (!this.hooks[hookName]) { this.hooks[hookName] = []; } this.hooks[hookName].push(callback); },
    trigger(hookName, ...args) { if (this.hooks[hookName]) { this.hooks[hookName].forEach(callback => { try { callback(...args); } catch (e) { console.error(e); } }); } },
    applyFilters(filterName, value, ...args) { let f = value; if (this.hooks[filterName]) { this.hooks[filterName].forEach(c => { try { f = c(f, ...args); } catch (e) { console.error(e); } }); } return f; }
};
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substring(2); }
async function generateServiceNumber() {
    const { data, error } = await supabase.rpc('increment_service_number', { row_id: 1, increment_by: 1 });
    if (error) { console.error('Servis numarası alınamadı:', error); return "HATA-000"; }
    const prefix = DB.settings.service_prefix || 'SRV';
    return `${prefix}-${data.toString().padStart(4, '0')}`;
}
function showToast(message, isError = false) { toast.textContent = message; toast.className = `fixed bottom-5 right-5 text-white py-2 px-4 rounded-lg shadow-lg transition-all duration-300 ease-out z-50 transform ${isError ? 'bg-red-500' : 'bg-green-500'}`; requestAnimationFrame(() => { toast.classList.remove('translate-y-20', 'opacity-0'); }); setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 3000); }

// --- ROUTING & MODALS ---
function navigate(path) {
    Object.values(charts).forEach(c => c.destroy()); charts = {};
    const cleanPath = path.startsWith('#') ? path.substring(1) : path;
    window.location.hash = cleanPath;
    document.querySelectorAll('.nav-link').forEach(l => { const p = (l.getAttribute('href') || '').replace('#', ''); l.classList.toggle('bg-slate-700', p === cleanPath.split('/')[0]); l.classList.toggle('text-orange-400', p === cleanPath.split('/')[0]); });
    const routes = { dashboard: renderDashboard, customers: renderCustomers, stock: renderStock, 'inventory-count': renderInventoryCount, services: renderServices, orders: renderOrders, reports: renderReports, plugins: renderPlugins, settings: renderSettings };
    const pageKey = cleanPath.split('/')[0];
    const renderFunction = routes[pageKey] || renderDashboard;
    content.innerHTML = '';
    renderFunction();
}
function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }
function createModal(id, title, contentHtml, onSave, large = false, saveText = 'Kaydet') {
    const modalSize = large ? 'max-w-6xl' : 'max-w-2xl';
    modalContainer.innerHTML = `<div id="${id}" class="modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center p-4 z-50"><div class="bg-white rounded-lg shadow-2xl w-full ${modalSize} flex flex-col max-h-[90vh]"><div class="flex justify-between items-center p-5 border-b"><h3 class="text-2xl font-bold">${title}</h3><button class="close-modal-btn text-gray-500 hover:text-gray-800 text-2xl">&times;</button></div><div class="p-6 overflow-y-auto">${contentHtml}</div><div class="flex justify-end p-5 border-t bg-gray-50 rounded-b-lg mt-auto"><button class="close-modal-btn bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded-lg mr-3">İptal</button><button class="save-modal-btn bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-6 rounded-lg">${saveText}</button></div></div></div>`;
    const modal = document.getElementById(id); const saveButton = modal.querySelector('.save-modal-btn');
    if (onSave) { saveButton.onclick = () => onSave(id); } else { saveButton.style.display = 'none'; }
    modal.querySelectorAll('.close-modal-btn').forEach(btn => btn.onclick = () => closeModal(id));
    openModal(id);
}
function showConfirmModal(title, message, onConfirm) {
    const modalId = 'confirmModal';
    modalContainer.innerHTML = `<div id="${modalId}" class="modal active fixed inset-0 bg-black bg-opacity-60 items-center justify-center p-4 z-50"><div class="bg-white rounded-lg shadow-2xl w-full max-w-sm flex flex-col"><div class="p-6 text-center"><i class="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-4"></i><h3 class="text-xl font-bold mb-2">${title}</h3><div>${message}</div></div><div class="flex justify-center p-4 border-t bg-gray-50 rounded-b-lg"><button id="confirmCancel" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded-lg mr-3">İptal</button><button id="confirmOk" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">Onayla</button></div></div></div>`;
    document.getElementById('confirmOk').onclick = () => { onConfirm(); closeModal(modalId); };
    document.getElementById('confirmCancel').onclick = () => closeModal(modalId);
}

// --- SAYFA RENDER FONKSİYONLARI ---

// Müşteriler (Customers)
function renderCustomers(searchTerm = '') {
    const filteredCustomers = (DB.customers || []).filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone && c.phone.includes(searchTerm)));
    content.innerHTML = `<div class="flex justify-between items-center mb-6"><h1 class="text-3xl font-bold">Müşteriler</h1><button id="addCustomerBtn" class="bg-orange-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-700 flex items-center"><i class="fas fa-plus mr-2"></i> Yeni Müşteri Ekle</button></div><input type="text" id="customerSearch" placeholder="Müşteri adı veya telefon ile ara..." class="w-full p-3 border rounded-lg mb-4" value="${searchTerm}"><div class="bg-white rounded-lg shadow-md overflow-x-auto"><table class="w-full"><thead class="bg-gray-100"><tr><th class="p-4 text-left">Ad Soyad</th><th class="p-4 text-left">Telefon</th><th class="p-4 text-left">Motosikletler</th><th class="p-4 text-left min-w-[150px]">İşlemler</th></tr></thead><tbody>${filteredCustomers.length > 0 ? filteredCustomers.map(c => `<tr class="border-b hover:bg-gray-50" data-id="${c.id}"><td class="p-4">${c.name}</td><td class="p-4">${c.phone || '-'}</td><td class="p-4">${(c.motorcycles || []).map(m => `<div class="mb-1"><span class="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">${m.plate}</span></div>`).join('') || '-'}</td><td class="p-4"><button class="view-customer-history-btn text-green-600 hover:text-green-800 mr-3" title="Geçmiş"><i class="fas fa-history"></i></button><button class="edit-customer-btn text-orange-600 hover:text-orange-800 mr-3" title="Düzenle"><i class="fas fa-edit"></i></button><button class="add-motorcycle-btn text-purple-600 hover:text-purple-800 mr-3" title="Motor Ekle"><i class="fas fa-motorcycle"></i></button><button class="delete-customer-btn text-red-600 hover:text-red-800" title="Sil"><i class="fas fa-trash"></i></button></td></tr>`).join('') : `<tr><td colspan="4" class="text-center p-8 text-gray-500">Müşteri bulunamadı.</td></tr>`}</tbody></table></div>`;
    document.getElementById('customerSearch').addEventListener('input', (e) => renderCustomers(e.target.value));
    document.getElementById('addCustomerBtn').onclick = () => showCustomerModal();
    document.querySelectorAll('.edit-customer-btn').forEach(btn => btn.onclick = (e) => showCustomerModal(e.currentTarget.closest('tr').dataset.id));
    document.querySelectorAll('.delete-customer-btn').forEach(btn => btn.onclick = (e) => deleteCustomer(e.currentTarget.closest('tr').dataset.id));
    document.querySelectorAll('.add-motorcycle-btn').forEach(btn => btn.onclick = (e) => showMotorcycleModal(e.currentTarget.closest('tr').dataset.id));
    document.querySelectorAll('.view-customer-history-btn').forEach(btn => btn.onclick = (e) => showCustomerHistory(e.currentTarget.closest('tr').dataset.id));
}
async function showCustomerModal(customerId = null) {
    const customer = customerId ? DB.customers.find(c => c.id.toString() === customerId) : null;
    const title = customer ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle';
    const modalContent = `<form id="customerForm" class="space-y-4"><div><label for="customerName" class="block font-bold">Ad Soyad:</label><input type="text" id="customerName" class="w-full p-2 border rounded" required value="${customer ? customer.name : ''}"></div><div><label for="customerPhone" class="block font-bold">Telefon:</label><input type="tel" id="customerPhone" class="w-full p-2 border rounded" value="${customer ? customer.phone : ''}"></div><div><label for="customerAddress" class="block font-bold">Adres:</label><textarea id="customerAddress" class="w-full p-2 border rounded">${customer ? (customer.address || '') : ''}</textarea></div></form>`;
    createModal('customerModal', title, modalContent, async (modalId) => {
        const form = document.getElementById('customerForm'); if (!form.checkValidity()) { form.reportValidity(); return; }
        const customerData = { name: form.customerName.value, phone: form.customerPhone.value, address: form.customerAddress.value };
        let error;
        if (customer) { const { error: updateError } = await supabase.from('customers').update(customerData).eq('id', customerId); error = updateError; }
        else { const { error: insertError } = await supabase.from('customers').insert([{ ...customerData, motorcycles: [] }]); error = insertError; }
        if (error) { showToast('Hata: ' + error.message, true); } else { showToast('Müşteri kaydedildi!'); closeModal(modalId); await loadAllDataFromSupabase(); renderCustomers(); }
    });
}
async function deleteCustomer(customerId) {
    showConfirmModal('Müşteriyi Sil', 'Bu müşteriyi silmek istediğinize emin misiniz?', async () => {
        const { error } = await supabase.from('customers').delete().eq('id', customerId);
        if (error) { showToast('Hata: ' + error.message, true); } else { showToast('Müşteri silindi.', true); await loadAllDataFromSupabase(); renderCustomers(); }
    });
}
async function showMotorcycleModal(customerId) {
    const customer = DB.customers.find(c => c.id.toString() === customerId);
    if (!customer) {
        showToast('Müşteri bulunamadı!', true);
        return;
    }
    const title = `${customer.name} için Yeni Motor Ekle`;
    const modalContent = `
        <form id="motorcycleForm" class="space-y-4">
            <div>
                <label class="block font-bold">Plaka:</label>
                <input type="text" id="motorcyclePlate" class="w-full p-2 border rounded" required>
            </div>
            <div>
                <label class="block font-bold">Şasi No:</label>
                <input type="text" id="motorcycleChassis" class="w-full p-2 border rounded">
            </div>
            <div>
                <label class="block font-bold">Marka / Model:</label>
                <input type="text" id="motorcycleModel" class="w-full p-2 border rounded" list="motorcycle-models-list">
                <datalist id="motorcycle-models-list">
                    ${(DB.settings.motorcycle_data || []).map(m => `<option value="${m}"></option>`).join('')}
                </datalist>
            </div>
        </form>`;
    createModal('motorcycleModal', title, modalContent, async (modalId) => {
        const form = document.getElementById('motorcycleForm'); if (!form.checkValidity()) { form.reportValidity(); return; }
        const newMotorcycle = { id: generateId(), plate: form.motorcyclePlate.value.toUpperCase(), chassis: form.motorcycleChassis.value, model: form.motorcycleModel.value };
        const updatedMotorcycles = [...(customer.motorcycles || []), newMotorcycle];
        const { error } = await supabase.from('customers').update({ motorcycles: updatedMotorcycles }).eq('id', customerId);
        if (error) { showToast('Hata: ' + error.message, true); } else { showToast('Motosiklet eklendi!'); closeModal(modalId); await loadAllDataFromSupabase(); renderCustomers(); }
    });
}
function showCustomerHistory(customerId) {
    const customer = DB.customers.find(c => c.id.toString() === customerId);
    if (!customer) {
        showToast('Müşteri bulunamadı!', true);
        return;
    }
    const customerServices = DB.services.filter(s => s.customer_id.toString() === customerId);
    let historyContent = `<h2 class="text-xl font-bold mb-4">Servis Geçmişi</h2>`;
    if (customerServices.length > 0) {
        historyContent += customerServices.map(s => {
            const motorcycle = (customer.motorcycles || []).find(m => m.id === s.motorcycle_id);
            return `<div class="border p-3 rounded-lg mb-2 bg-gray-50"><p><strong>Servis No:</strong> ${s.service_number}</p><p><strong>Tarih:</strong> ${new Date(s.created_at).toLocaleDateString('tr-TR')}</p><p><strong>Plaka:</strong> ${motorcycle?.plate || 'Bilinmiyor'}</p><p><strong>Durum:</strong> ${s.status}</p><p><strong>Tutar:</strong> ${(s.total_price || 0).toFixed(2)} ₺</p></div>`
        }).join('');
    } else { historyContent += '<p>Müşteriye ait servis kaydı bulunamadı.</p>'; }
    createModal('historyModal', `${customer.name} - Geçmiş İşlemler`, historyContent, null, true);
}

// Stok Yönetimi (Stock)
function renderStock(filters = {}) {
    let filteredStock = [...DB.stock];
    if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        filteredStock = filteredStock.filter(item => item.name.toLowerCase().includes(term) || item.stockCode.toLowerCase().includes(term) || (item.supplierCode && item.supplierCode.toLowerCase().includes(term)));
    }
    content.innerHTML = `<div class="flex justify-between items-center mb-6"><h1 class="text-3xl font-bold">Stok Yönetimi</h1><button id="addStockBtn" class="bg-orange-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-700 flex items-center"><i class="fas fa-plus mr-2"></i> Yeni Ürün Ekle</button></div><div class="bg-white rounded-lg shadow-md overflow-x-auto"><table class="w-full"><thead class="bg-gray-100"><tr><th class="p-4 text-left">Parça Adı</th><th class="p-4 text-left">Stok Kodu</th><th class="p-4 text-left">Miktar</th><th class="p-4 text-left">Satış Fiyatı</th><th class="p-4 text-left min-w-[150px]">İşlemler</th></tr></thead><tbody>${filteredStock.length > 0 ? filteredStock.map(item => `<tr class="border-b hover:bg-gray-50" data-id="${item.id}"><td class="p-4 font-semibold">${item.name}</td><td class="p-4">${item.stockCode}</td><td class="p-4 font-bold ${item.quantity <= (item.criticalStock || 5) ? 'text-red-600' : ''}">${item.quantity}</td><td class="p-4">${parseFloat(item.salePrice || 0).toFixed(2)} ₺</td><td class="p-4"><button class="edit-stock-btn text-orange-600 hover:text-orange-800 mr-3" title="Düzenle"><i class="fas fa-edit"></i></button><button class="delete-stock-btn text-red-600 hover:text-red-800" title="Sil"><i class="fas fa-trash"></i></button></td></tr>`).join('') : `<tr><td colspan="5" class="text-center p-8 text-gray-500">Stok ürünü bulunamadı.</td></tr>`}</tbody></table></div>`;
    document.getElementById('addStockBtn').onclick = () => showStockModal();
    document.querySelectorAll('.edit-stock-btn').forEach(btn => btn.onclick = e => showStockModal(e.currentTarget.closest('tr').dataset.id));
    document.querySelectorAll('.delete-stock-btn').forEach(btn => btn.onclick = e => deleteStockItem(e.currentTarget.closest('tr').dataset.id));
}
async function showStockModal(itemId = null) {
    const item = itemId ? DB.stock.find(i => i.id.toString() === itemId) : null;
    const title = item ? 'Ürün Düzenle' : 'Yeni Ürün Ekle';
    const modalContent = `<form id="stockForm" class="space-y-4"><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label class="block font-bold">Parça Adı:</label><input type="text" id="itemName" class="w-full p-2 border rounded" required value="${item ? item.name : ''}"></div><div><label class="block font-bold">Stok Kodu:</label><input type="text" id="itemStockCode" class="w-full p-2 border rounded" required value="${item ? item.stockCode : ''}"></div><div><label class="block font-bold">Miktar:</label><input type="number" id="itemQuantity" class="w-full p-2 border rounded" required min="0" value="${item ? item.quantity : '0'}"></div><div><label class="block font-bold">Satış Fiyatı (₺):</label><input type="number" id="itemSalePrice" class="w-full p-2 border rounded" required min="0" step="0.01" value="${item ? (item.salePrice || '') : ''}"></div></div></form>`;
    createModal('stockModal', title, modalContent, async (modalId) => {
        const form = document.getElementById('stockForm'); if (!form.checkValidity()) { form.reportValidity(); return; }
        const stockData = { name: form.itemName.value, stockCode: form.itemStockCode.value, quantity: parseInt(form.itemQuantity.value), salePrice: parseFloat(form.itemSalePrice.value) };
        let error;
        if (item) { const { error: updateError } = await supabase.from('stock').update(stockData).eq('id', itemId); error = updateError; }
        else { const { error: insertError } = await supabase.from('stock').insert([stockData]); error = insertError; }
        if (error) { showToast('Hata: ' + error.message, true); } else { showToast('Stok ürünü kaydedildi!'); closeModal(modalId); await loadAllDataFromSupabase(); renderStock(); }
    }, true);
}
async function deleteStockItem(itemId) {
    showConfirmModal('Ürünü Sil', 'Bu ürünü stoktan silmek istediğinize emin misiniz?', async () => {
        const { error } = await supabase.from('stock').delete().eq('id', itemId);
        if (error) { showToast('Hata: ' + error.message, true); } else { showToast('Ürün silindi.', true); await loadAllDataFromSupabase(); renderStock(); }
    });
}

// Servis Yönetimi (Services)
function renderServices(searchTerm = '') {
    const filteredServices = (DB.services || []).filter(s => {
        const customer = DB.customers.find(c => c.id === s.customer_id);
        const term = searchTerm.toLowerCase();
        return s.service_number.toLowerCase().includes(term) ||
               (customer && customer.name.toLowerCase().includes(term)) ||
               s.status.toLowerCase().includes(term);
    });

    const statusColors = {
        'Yeni': 'bg-blue-200 text-blue-800',
        'İşlemde': 'bg-yellow-200 text-yellow-800',
        'Tamamlandı': 'bg-green-200 text-green-800',
        'Teslim Edildi': 'bg-gray-200 text-gray-800',
        'İptal Edildi': 'bg-red-200 text-red-800'
    };

    content.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Servis Kayıtları</h1>
            <button id="addServiceBtn" class="bg-orange-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-700 flex items-center">
                <i class="fas fa-plus mr-2"></i> Yeni Servis Kaydı
            </button>
        </div>
        <input type="text" id="serviceSearch" placeholder="Servis no, müşteri adı veya durum ile ara..." class="w-full p-3 border rounded-lg mb-4" value="${searchTerm}">
        <div class="bg-white rounded-lg shadow-md overflow-x-auto">
            <table class="w-full">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-4 text-left">Servis No</th>
                        <th class="p-4 text-left">Müşteri</th>
                        <th class="p-4 text-left">Plaka</th>
                        <th class="p-4 text-left">Durum</th>
                        <th class="p-4 text-left">Tutar</th>
                        <th class="p-4 text-left">Tarih</th>
                        <th class="p-4 text-left min-w-[150px]">İşlemler</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredServices.length > 0 ? filteredServices.map(s => {
                        const customer = DB.customers.find(c => c.id === s.customer_id);
                        const motorcycle = customer ? (customer.motorcycles || []).find(m => m.id === s.motorcycle_id) : null;
                        return `
                        <tr class="border-b hover:bg-gray-50" data-id="${s.id}">
                            <td class="p-4 font-bold text-orange-600">${s.service_number}</td>
                            <td class="p-4">${customer ? customer.name : 'Bilinmiyor'}</td>
                            <td class="p-4"><span class="bg-gray-200 px-2 py-1 rounded-full text-xs">${motorcycle ? motorcycle.plate : 'Bilinmiyor'}</span></td>
                            <td class="p-4"><span class="px-2 py-1 rounded-full text-xs font-semibold ${statusColors[s.status] || 'bg-gray-200'}">${s.status}</span></td>
                            <td class="p-4">${(s.total_price || 0).toFixed(2)} ₺</td>
                            <td class="p-4">${new Date(s.created_at).toLocaleDateString('tr-TR')}</td>
                            <td class="p-4">
                                <button class="edit-service-btn text-orange-600 hover:text-orange-800 mr-3" title="Düzenle"><i class="fas fa-edit"></i></button>
                                <button class="delete-service-btn text-red-600 hover:text-red-800" title="Sil"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>`;
                    }).join('') : `<tr><td colspan="7" class="text-center p-8 text-gray-500">Servis kaydı bulunamadı.</td></tr>`}
                </tbody>
            </table>
        </div>`;

    document.getElementById('serviceSearch').addEventListener('input', (e) => renderServices(e.target.value));
    document.getElementById('addServiceBtn').onclick = () => showServiceModal();
    document.querySelectorAll('.edit-service-btn').forEach(btn => btn.onclick = (e) => showServiceModal(e.currentTarget.closest('tr').dataset.id));
    document.querySelectorAll('.delete-service-btn').forEach(btn => btn.onclick = (e) => deleteService(e.currentTarget.closest('tr').dataset.id));
}

async function showServiceModal(serviceId = null) {
    const service = serviceId ? DB.services.find(s => s.id.toString() === serviceId) : null;
    const title = service ? `Servis Düzenle: ${service.service_number}` : 'Yeni Servis Kaydı';

    let currentParts = service ? service.parts_used || [] : [];
    let currentActions = service ? service.actions_performed || [] : [];

    const getModalContent = () => `
        <form id="serviceForm" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                    <label class="block font-bold">Müşteri:</label>
                    <select id="serviceCustomer" class="w-full p-2 border rounded" required>
                        <option value="">Müşteri Seçin...</option>
                        ${DB.customers.map(c => `<option value="${c.id}" ${service && service.customer_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block font-bold">Motosiklet:</label>
                    <select id="serviceMotorcycle" class="w-full p-2 border rounded" required ${!service ? 'disabled' : ''}>
                        <option value="">Önce Müşteri Seçin...</option>
                    </select>
                </div>
                 <div>
                    <label class="block font-bold">Durum:</label>
                    <select id="serviceStatus" class="w-full p-2 border rounded" required>
                        <option ${service?.status === 'Yeni' ? 'selected' : ''}>Yeni</option>
                        <option ${service?.status === 'İşlemde' ? 'selected' : ''}>İşlemde</option>
                        <option ${service?.status === 'Tamamlandı' ? 'selected' : ''}>Tamamlandı</option>
                        <option ${service?.status === 'Teslim Edildi' ? 'selected' : ''}>Teslim Edildi</option>
                        <option ${service?.status === 'İptal Edildi' ? 'selected' : ''}>İptal Edildi</option>
                    </select>
                </div>
                <div>
                    <label class="block font-bold">Teknisyen:</label>
                    <select id="serviceTechnician" class="w-full p-2 border rounded">
                        <option value="">Teknisyen Seçin...</option>
                        ${(DB.settings.technicians || []).map(t => `<option value="${t.name}" ${service && service.technician_name === t.name ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div>
                <label class="block font-bold">Müşteri Şikayeti / Talebi:</label>
                <textarea id="serviceComplaint" class="w-full p-2 border rounded" rows="3">${service ? service.complaint || '' : ''}</textarea>
            </div>

            <!-- Kullanılan Parçalar -->
            <div class="border p-4 rounded-lg">
                <h4 class="font-bold mb-2">Kullanılan Parçalar</h4>
                <div class="flex items-end gap-2 mb-2">
                    <div class="flex-grow">
                        <label class="text-sm">Parça Seç:</label>
                        <select id="partSelector" class="w-full p-2 border rounded">
                            <option value="">Stoktan Parça Seçin...</option>
                            ${DB.stock.map(p => `<option value="${p.id}" data-price="${p.salePrice}" data-name="${p.name}">${p.name} (${p.stockCode}) - Stok: ${p.quantity}</option>`).join('')}
                        </select>
                    </div>
                    <div><label class="text-sm">Adet:</label><input type="number" id="partQuantity" value="1" min="1" class="w-24 p-2 border rounded"></div>
                    <button type="button" id="addPartBtn" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Ekle</button>
                </div>
                <table class="w-full text-sm">
                    <thead class="bg-gray-100"><tr><th class="p-2 text-left">Parça</th><th class="p-2 text-left">Adet</th><th class="p-2 text-left">Birim Fiyat</th><th class="p-2 text-left">Toplam</th><th class="p-2"></th></tr></thead>
                    <tbody id="partsList">
                        ${currentParts.map(p => `
                            <tr data-part-id="${p.id}">
                                <td class="p-2">${p.name}</td>
                                <td class="p-2">${p.quantity}</td>
                                <td class="p-2">${p.price.toFixed(2)} ₺</td>
                                <td class="p-2">${(p.quantity * p.price).toFixed(2)} ₺</td>
                                <td class="p-2 text-center"><button type="button" class="remove-part-btn text-red-500"><i class="fas fa-times"></i></button></td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Yapılan İşlemler -->
            <div class="border p-4 rounded-lg">
                <h4 class="font-bold mb-2">Yapılan İşlemler / İşçilik</h4>
                <div class="flex items-end gap-2 mb-2">
                    <div class="flex-grow"><label class="text-sm">Açıklama:</label><input type="text" id="actionDescription" class="w-full p-2 border rounded"></div>
                    <div><label class="text-sm">Ücret (₺):</label><input type="number" id="actionPrice" value="0" min="0" step="10" class="w-32 p-2 border rounded"></div>
                    <button type="button" id="addActionBtn" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Ekle</button>
                </div>
                <table class="w-full text-sm">
                     <thead class="bg-gray-100"><tr><th class="p-2 text-left">Açıklama</th><th class="p-2 text-left">Ücret</th><th class="p-2"></th></tr></thead>
                    <tbody id="actionsList">
                        ${currentActions.map(a => `
                            <tr>
                                <td class="p-2">${a.description}</td>
                                <td class="p-2">${a.price.toFixed(2)} ₺</td>
                                <td class="p-2 text-center"><button type="button" class="remove-action-btn text-red-500"><i class="fas fa-times"></i></button></td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
             <div>
                <label class="block font-bold">Teknisyen Notları:</label>
                <textarea id="serviceNotes" class="w-full p-2 border rounded" rows="3">${service ? service.notes || '' : ''}</textarea>
            </div>
            <div class="text-right font-bold text-2xl" id="totalPriceDisplay">Toplam: 0.00 ₺</div>
        </form>
    `;

    createModal('serviceModal', title, getModalContent(), async (modalId) => {
        const form = document.getElementById('serviceForm');
        if (!form.checkValidity()) { form.reportValidity(); return; }

        const total_price = currentParts.reduce((sum, p) => sum + (p.quantity * p.price), 0) + currentActions.reduce((sum, a) => sum + a.price, 0);

        const serviceData = {
            customer_id: form.serviceCustomer.value,
            motorcycle_id: form.serviceMotorcycle.value,
            status: form.serviceStatus.value,
            complaint: form.serviceComplaint.value,
            notes: form.serviceNotes.value,
            parts_used: currentParts,
            actions_performed: currentActions,
            total_price: total_price,
            technician_name: form.serviceTechnician.value
        };

        let error;
        if (service) {
            const { error: updateError } = await supabase.from('services').update(serviceData).eq('id', serviceId);
            error = updateError;
        } else {
            serviceData.service_number = await generateServiceNumber();
            const { error: insertError } = await supabase.from('services').insert([serviceData]);
            error = insertError;
        }

        if (error) {
            showToast('Hata: ' + error.message, true);
        } else {
            // Stoktan düşme işlemi (sadece tamamlandı veya teslim edildi durumunda)
            if (['Tamamlandı', 'Teslim Edildi'].includes(serviceData.status)) {
                for (const part of currentParts) {
                    const stockItem = DB.stock.find(i => i.id === part.id);
                    if (stockItem) {
                        const newQuantity = stockItem.quantity - part.quantity;
                        await supabase.from('stock').update({ quantity: newQuantity }).eq('id', part.id);
                    }
                }
            }
            showToast('Servis kaydı başarıyla kaydedildi!');
            closeModal(modalId);
            await loadAllDataFromSupabase();
            renderServices();
        }
    }, true, 'Kaydet');

    // --- Modal içi event listener'lar ---
    const customerSelect = document.getElementById('serviceCustomer');
    const motorcycleSelect = document.getElementById('serviceMotorcycle');

    const updateMotorcycleOptions = () => {
        const customerId = customerSelect.value;
        const customer = DB.customers.find(c => c.id.toString() === customerId);
        motorcycleSelect.innerHTML = '<option value="">Motosiklet Seçin...</option>';
        if (customer && customer.motorcycles) {
            motorcycleSelect.disabled = false;
            motorcycleSelect.innerHTML += customer.motorcycles.map(m => `<option value="${m.id}">${m.plate} - ${m.model}</option>`).join('');
        } else {
            motorcycleSelect.disabled = true;
        }
    };

    const updateTotal = () => {
        const partsTotal = currentParts.reduce((sum, p) => sum + (p.quantity * p.price), 0);
        const actionsTotal = currentActions.reduce((sum, a) => sum + a.price, 0);
        document.getElementById('totalPriceDisplay').textContent = `Toplam: ${(partsTotal + actionsTotal).toFixed(2)} ₺`;
    };

    const updateLists = () => {
        const partsList = document.getElementById('partsList');
        partsList.innerHTML = currentParts.map(p => `
            <tr data-part-id="${p.id}">
                <td class="p-2">${p.name}</td>
                <td class="p-2">${p.quantity}</td>
                <td class="p-2">${p.price.toFixed(2)} ₺</td>
                <td class="p-2">${(p.quantity * p.price).toFixed(2)} ₺</td>
                <td class="p-2 text-center"><button type="button" class="remove-part-btn text-red-500"><i class="fas fa-times"></i></button></td>
            </tr>`).join('');
        
        const actionsList = document.getElementById('actionsList');
        actionsList.innerHTML = currentActions.map(a => `
            <tr>
                <td class="p-2">${a.description}</td>
                <td class="p-2">${a.price.toFixed(2)} ₺</td>
                <td class="p-2 text-center"><button type="button" class="remove-action-btn text-red-500"><i class="fas fa-times"></i></button></td>
            </tr>`).join('');

        document.querySelectorAll('.remove-part-btn').forEach(btn => btn.onclick = (e) => {
            const partId = e.currentTarget.closest('tr').dataset.partId;
            currentParts = currentParts.filter(p => p.id !== partId);
            updateLists();
        });
        document.querySelectorAll('.remove-action-btn').forEach(btn => btn.onclick = (e) => {
            const description = e.currentTarget.closest('tr').children[0].textContent;
            currentActions = currentActions.filter(a => a.description !== description);
            updateLists();
        });
        updateTotal();
    };
    
    document.getElementById('addPartBtn').onclick = () => {
        const selector = document.getElementById('partSelector');
        const selectedOption = selector.options[selector.selectedIndex];
        if (!selectedOption.value) return;

        const partId = selectedOption.value;
        const quantity = parseInt(document.getElementById('partQuantity').value);
        if (isNaN(quantity) || quantity <= 0) return;

        const existingPart = currentParts.find(p => p.id === partId);
        if (existingPart) {
            existingPart.quantity += quantity;
        } else {
            currentParts.push({
                id: partId,
                name: selectedOption.dataset.name,
                price: parseFloat(selectedOption.dataset.price),
                quantity: quantity
            });
        }
        updateLists();
    };
    
    document.getElementById('addActionBtn').onclick = () => {
        const description = document.getElementById('actionDescription').value;
        const price = parseFloat(document.getElementById('actionPrice').value);
        if (!description || isNaN(price)) return;
        currentActions.push({ description, price });
        document.getElementById('actionDescription').value = '';
        document.getElementById('actionPrice').value = 0;
        updateLists();
    };

    customerSelect.onchange = updateMotorcycleOptions;

    // Initial population if editing
    if (service) {
        updateMotorcycleOptions();
        motorcycleSelect.value = service.motorcycle_id;
    }
    updateLists();
}

async function deleteService(serviceId) {
    showConfirmModal('Servis Kaydını Sil', 'Bu servis kaydını kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.', async () => {
        const { error } = await supabase.from('services').delete().eq('id', serviceId);
        if (error) {
            showToast('Hata: ' + error.message, true);
        } else {
            showToast('Servis kaydı silindi.', true);
            await loadAllDataFromSupabase();
            renderServices();
        }
    });
}

// Sipariş Yönetimi (Orders)
function renderOrders(searchTerm = '') {
    const filteredOrders = (DB.orders || []).filter(o => 
        (o.supplier && o.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.order_number && o.order_number.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    content.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Malzeme Siparişleri</h1>
            <button id="addOrderBtn" class="bg-orange-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-700 flex items-center">
                <i class="fas fa-plus mr-2"></i> Yeni Sipariş Oluştur
            </button>
        </div>
        <input type="text" id="orderSearch" placeholder="Sipariş no veya tedarikçi ile ara..." class="w-full p-3 border rounded-lg mb-4" value="${searchTerm}">
        <div class="bg-white rounded-lg shadow-md overflow-x-auto">
            <table class="w-full">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-4 text-left">Sipariş No</th>
                        <th class="p-4 text-left">Tedarikçi</th>
                        <th class="p-4 text-left">Tarih</th>
                        <th class="p-4 text-left">Durum</th>
                        <th class="p-4 text-left">Toplam Tutar</th>
                        <th class="p-4 text-left min-w-[150px]">İşlemler</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredOrders.length > 0 ? filteredOrders.map(o => `
                        <tr class="border-b hover:bg-gray-50" data-id="${o.id}">
                            <td class="p-4 font-bold">${o.order_number || '-'}</td>
                            <td class="p-4">${o.supplier || '-'}</td>
                            <td class="p-4">${new Date(o.created_at).toLocaleDateString('tr-TR')}</td>
                            <td class="p-4">${o.status || 'Bilinmiyor'}</td>
                            <td class="p-4">${(o.total_cost || 0).toFixed(2)} ₺</td>
                            <td class="p-4">
                                <button class="edit-order-btn text-orange-600 hover:text-orange-800 mr-3" title="Düzenle"><i class="fas fa-edit"></i></button>
                                <button class="delete-order-btn text-red-600 hover:text-red-800" title="Sil"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('') : `<tr><td colspan="6" class="text-center p-8 text-gray-500">Sipariş bulunamadı.</td></tr>`}
                </tbody>
            </table>
        </div>`;

    document.getElementById('orderSearch').addEventListener('input', (e) => renderOrders(e.target.value));
    document.getElementById('addOrderBtn').onclick = () => showOrderModal();
    document.querySelectorAll('.edit-order-btn').forEach(btn => btn.onclick = (e) => showOrderModal(e.currentTarget.closest('tr').dataset.id));
    document.querySelectorAll('.delete-order-btn').forEach(btn => btn.onclick = (e) => deleteOrder(e.currentTarget.closest('tr').dataset.id));
}

async function showOrderModal(orderId = null) {
    const order = orderId ? DB.orders.find(o => o.id.toString() === orderId) : null;
    const title = order ? 'Sipariş Düzenle' : 'Yeni Sipariş Oluştur';
    let currentItems = order ? order.items || [] : [];

    const modalContent = `
        <form id="orderForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label class="block font-bold">Sipariş Numarası:</label><input type="text" id="orderNumber" class="w-full p-2 border rounded" value="${order ? order.order_number || '' : ''}"></div>
                <div><label class="block font-bold">Tedarikçi:</label><input type="text" id="orderSupplier" class="w-full p-2 border rounded" value="${order ? order.supplier || '' : ''}"></div>
                <div><label class="block font-bold">Durum:</label>
                     <select id="orderStatus" class="w-full p-2 border rounded">
                        ${(DB.settings.order_statuses || []).map(status => `<option ${order?.status === status ? 'selected' : ''}>${status}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="border p-4 rounded-lg">
                <h4 class="font-bold mb-2">Sipariş Edilen Ürünler</h4>
                <div id="orderItemsContainer"></div>
                <button type="button" id="addOrderItemBtn" class="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">Ürün Ekle</button>
            </div>
            <div class="text-right font-bold text-xl" id="orderTotalCost">Toplam: 0.00 ₺</div>
        </form>`;

    createModal('orderModal', title, modalContent, async (modalId) => {
        const form = document.getElementById('orderForm');
        const total_cost = currentItems.reduce((sum, item) => sum + (item.quantity * item.cost), 0);
        const orderData = {
            order_number: form.orderNumber.value,
            supplier: form.orderSupplier.value,
            status: form.orderStatus.value,
            items: currentItems,
            total_cost: total_cost
        };

        let error;
        if (order) {
            const { error: updateError } = await supabase.from('orders').update(orderData).eq('id', orderId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('orders').insert([orderData]);
            error = insertError;
        }

        if (error) {
            showToast('Hata: ' + error.message, true);
        } else {
            // Eğer sipariş teslim alındıysa, stokları güncelle
            if (orderData.status === 'Teslim Alındı' || orderData.status === 'Stoğa Ulaştı') {
                for (const item of currentItems) {
                    const stockItem = DB.stock.find(s => s.id.toString() === item.stock_id);
                    if (stockItem) {
                        const newQuantity = stockItem.quantity + item.quantity;
                        await supabase.from('stock').update({ quantity: newQuantity }).eq('id', item.stock_id);
                    }
                }
            }
            showToast('Sipariş kaydedildi!');
            closeModal(modalId);
            await loadAllDataFromSupabase();
            renderOrders();
        }
    }, true);

    const container = document.getElementById('orderItemsContainer');
    const updateTotal = () => {
        const total = currentItems.reduce((sum, item) => sum + (item.quantity * item.cost), 0);
        document.getElementById('orderTotalCost').textContent = `Toplam: ${total.toFixed(2)} ₺`;
    };

    const renderItems = () => {
        container.innerHTML = currentItems.map((item, index) => `
            <div class="grid grid-cols-12 gap-2 mb-2 items-center" data-index="${index}">
                <div class="col-span-5">
                    <select class="order-item-select w-full p-2 border rounded">
                        <option value="">Stok Ürünü Seç</option>
                        ${DB.stock.map(s => `<option value="${s.id}" ${s.id.toString() === item.stock_id ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="col-span-3"><input type="number" class="order-item-quantity w-full p-2 border rounded" value="${item.quantity}" min="1"></div>
                <div class="col-span-3"><input type="number" class="order-item-cost w-full p-2 border rounded" value="${item.cost}" min="0" step="0.01"></div>
                <div class="col-span-1 text-center"><button type="button" class="remove-order-item-btn text-red-500"><i class="fas fa-trash"></i></button></div>
            </div>
        `).join('');
        updateTotal();
        addEventListenersToItems();
    };

    const addEventListenersToItems = () => {
        document.querySelectorAll('[data-index]').forEach(row => {
            const index = parseInt(row.dataset.index);
            row.querySelector('.order-item-select').onchange = (e) => { currentItems[index].stock_id = e.target.value; };
            row.querySelector('.order-item-quantity').onchange = (e) => { currentItems[index].quantity = parseInt(e.target.value); updateTotal(); };
            row.querySelector('.order-item-cost').onchange = (e) => { currentItems[index].cost = parseFloat(e.target.value); updateTotal(); };
            row.querySelector('.remove-order-item-btn').onclick = () => { currentItems.splice(index, 1); renderItems(); };
        });
    };

    document.getElementById('addOrderItemBtn').onclick = () => {
        currentItems.push({ stock_id: '', quantity: 1, cost: 0 });
        renderItems();
    };

    renderItems();
}

async function deleteOrder(orderId) {
    showConfirmModal('Siparişi Sil', 'Bu siparişi silmek istediğinize emin misiniz?', async () => {
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) {
            showToast('Hata: ' + error.message, true);
        } else {
            showToast('Sipariş silindi.', true);
            await loadAllDataFromSupabase();
            renderOrders();
        }
    });
}

// Ayarlar (Settings)
async function renderSettings() {
    const settings = DB.settings || {};
    content.innerHTML = `
        <h1 class="text-3xl font-bold mb-6">Ayarlar</h1>
        <div class="bg-white p-8 rounded-lg shadow-md max-w-4xl mx-auto">
            <form id="settingsForm" class="space-y-8">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label for="company_name" class="block text-sm font-medium text-gray-700">Firma Adı</label>
                        <input type="text" id="company_name" value="${settings.company_name || ''}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500">
                    </div>
                    <div>
                        <label for="service_prefix" class="block text-sm font-medium text-gray-700">Servis Numarası Ön Eki</label>
                        <input type="text" id="service_prefix" value="${settings.service_prefix || 'SRV'}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500">
                    </div>
                    <div class="md:col-span-2">
                        <label for="company_address" class="block text-sm font-medium text-gray-700">Adres</label>
                        <textarea id="company_address" rows="3" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500">${settings.company_address || ''}</textarea>
                    </div>
                </div>

                <!-- Teknisyen Yönetimi -->
                <div id="technicians-manager"></div>

                <!-- Motosiklet Veri Yönetimi -->
                <div id="motorcycle-data-manager"></div>

                <div class="text-right pt-4 border-t">
                    <button type="submit" class="bg-orange-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-orange-700">
                        Ayarları Kaydet
                    </button>
                </div>
            </form>
        </div>`;
        
    // Dinamik liste yöneticisi fonksiyonu
    const createListManager = (containerId, title, placeholder, list) => {
        const container = document.getElementById(containerId);
        const render = () => {
            container.innerHTML = `
                <div class="border p-4 rounded-lg">
                    <h3 class="font-bold mb-2">${title}</h3>
                    <div class="flex gap-2 mb-3">
                        <input type="text" placeholder="${placeholder}" class="new-item-input flex-grow p-2 border rounded">
                        <button type="button" class="add-item-btn bg-blue-500 text-white px-4 rounded hover:bg-blue-600">Ekle</button>
                    </div>
                    <div class="item-list flex flex-wrap gap-2">
                        ${list.map((item, index) => `
                            <div class="bg-gray-200 text-gray-800 px-3 py-1 rounded-full flex items-center gap-2">
                                <span>${typeof item === 'object' ? item.name : item}</span>
                                <button type="button" class="remove-item-btn text-red-500 hover:text-red-700" data-index="${index}">&times;</button>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            
            container.querySelector('.add-item-btn').onclick = () => {
                const input = container.querySelector('.new-item-input');
                if (input.value.trim()) {
                    const newItem = title === 'Teknisyenler' ? { name: input.value.trim() } : input.value.trim();
                    list.push(newItem);
                    input.value = '';
                    render();
                }
            };
            
            container.querySelectorAll('.remove-item-btn').forEach(btn => {
                btn.onclick = () => {
                    list.splice(btn.dataset.index, 1);
                    render();
                };
            });
        };
        render();
    };

    createListManager('technicians-manager', 'Teknisyenler', 'Yeni teknisyen adı...', DB.settings.technicians || []);
    createListManager('motorcycle-data-manager', 'Motosiklet Marka/Modelleri', 'Yeni marka/model...', DB.settings.motorcycle_data || []);

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const updatedSettings = {
            id: 1, // Ayarlar her zaman tek bir satırda tutulur
            company_name: document.getElementById('company_name').value,
            company_address: document.getElementById('company_address').value,
            service_prefix: document.getElementById('service_prefix').value,
            technicians: JSON.stringify(DB.settings.technicians),
            motorcycle_data: JSON.stringify(DB.settings.motorcycle_data)
        };
        const { error } = await supabase.from('settings').upsert(updatedSettings);
        if (error) {
            showToast('Ayarlar kaydedilemedi: ' + error.message, true);
        } else {
            showToast('Ayarlar başarıyla kaydedildi!');
            await loadAllDataFromSupabase();
        }
    });
}

// Diğer Modüller
function renderDashboard() {
    const openServices = DB.services.filter(s => s.status === 'İşlemde' || s.status === 'Yeni').length;
    const completedToday = DB.services.filter(s => s.status === 'Tamamlandı' && new Date(s.updated_at).toDateString() === new Date().toDateString()).length;
    const lowStockItems = DB.stock.filter(i => i.quantity <= (i.criticalStock || 5)).length;
    const totalCustomers = DB.customers.length;

    content.innerHTML = `
        <h1 class="text-3xl font-bold mb-6">Gösterge Paneli</h1>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div class="bg-white p-6 rounded-lg shadow-md flex items-center">
                <i class="fas fa-tools text-4xl text-blue-500 mr-4"></i>
                <div>
                    <p class="text-gray-500">Açık Servisler</p>
                    <p class="text-3xl font-bold">${openServices}</p>
                </div>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md flex items-center">
                <i class="fas fa-check-circle text-4xl text-green-500 mr-4"></i>
                <div>
                    <p class="text-gray-500">Bugün Tamamlanan</p>
                    <p class="text-3xl font-bold">${completedToday}</p>
                </div>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md flex items-center">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mr-4"></i>
                <div>
                    <p class="text-gray-500">Kritik Stok</p>
                    <p class="text-3xl font-bold">${lowStockItems}</p>
                </div>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md flex items-center">
                <i class="fas fa-users text-4xl text-purple-500 mr-4"></i>
                <div>
                    <p class="text-gray-500">Toplam Müşteri</p>
                    <p class="text-3xl font-bold">${totalCustomers}</p>
                </div>
            </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-bold mb-4">Servis Durumları</h2>
                <canvas id="serviceStatusChart"></canvas>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-bold mb-4">Son 5 Servis Kaydı</h2>
                <ul>
                ${[...DB.services].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5).map(s => {
                    const customer = DB.customers.find(c => c.id === s.customer_id);
                    return `<li class="border-b py-2 flex justify-between"><span>${s.service_number} - ${customer?.name || ''}</span><span class="font-semibold">${s.status}</span></li>`
                }).join('')}
                </ul>
            </div>
        </div>
    `;

    // Chart.js ile grafik oluşturma
    const statusCounts = DB.services.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
    }, {});

    const ctx = document.getElementById('serviceStatusChart').getContext('2d');
    charts.serviceStatus = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['#3B82F6', '#F59E0B', '#10B981', '#6B7280', '#EF4444'],
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderInventoryCount() {
    content.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Stok Sayımı</h1>
            <button id="saveInventoryCount" class="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">
                <i class="fas fa-save mr-2"></i> Sayımı Kaydet
            </button>
        </div>
        <div class="bg-white rounded-lg shadow-md overflow-x-auto">
            <table class="w-full">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-4 text-left">Parça Adı</th>
                        <th class="p-4 text-left">Stok Kodu</th>
                        <th class="p-4 text-center">Mevcut Miktar</th>
                        <th class="p-4 text-center">Sayılan Miktar</th>
                    </tr>
                </thead>
                <tbody id="inventoryList">
                    ${DB.stock.map(item => `
                        <tr class="border-b" data-id="${item.id}">
                            <td class="p-4">${item.name}</td>
                            <td class="p-4">${item.stockCode}</td>
                            <td class="p-4 text-center">${item.quantity}</td>
                            <td class="p-4 text-center">
                                <input type="number" class="inventory-count-input w-24 p-2 border rounded text-center" value="${item.quantity}">
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;

    document.getElementById('saveInventoryCount').onclick = async () => {
        showConfirmModal('Stok Sayımını Kaydet', 'Mevcut stok miktarları, girdiğiniz yeni değerlerle güncellenecektir. Emin misiniz?', async () => {
            const updates = [];
            document.querySelectorAll('#inventoryList tr').forEach(row => {
                const id = row.dataset.id;
                const newQuantity = parseInt(row.querySelector('.inventory-count-input').value);
                if (!isNaN(newQuantity)) {
                    updates.push({ id: id, quantity: newQuantity });
                }
            });

            const { error } = await supabase.from('stock').upsert(updates);
            if (error) {
                showToast('Stok güncellenemedi: ' + error.message, true);
            } else {
                showToast('Stok sayımı başarıyla kaydedildi!');
                await loadAllDataFromSupabase();
                renderInventoryCount();
            }
        });
    };
}

function renderReports() {
    content.innerHTML = `
        <h1 class="text-3xl font-bold mb-6">Raporlar</h1>
        <div class="bg-white p-8 rounded-lg shadow-md">
            <h2 class="text-xl font-bold mb-4">Servis Gelir Raporu</h2>
            <div class="flex items-end gap-4 mb-4">
                <div><label>Başlangıç Tarihi:</label><input type="date" id="startDate" class="w-full p-2 border rounded"></div>
                <div><label>Bitiş Tarihi:</label><input type="date" id="endDate" class="w-full p-2 border rounded"></div>
                <button id="generateReportBtn" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">Rapor Oluştur</button>
            </div>
            <div id="reportResult" class="mt-6"></div>
        </div>`;

    document.getElementById('generateReportBtn').onclick = () => {
        const startDate = new Date(document.getElementById('startDate').value);
        const endDate = new Date(document.getElementById('endDate').value);
        endDate.setHours(23, 59, 59, 999); // Bitiş tarihini gün sonuna ayarla

        if (isNaN(startDate) || isNaN(endDate)) {
            showToast('Lütfen geçerli tarihler seçin.', true);
            return;
        }

        const filteredServices = DB.services.filter(s => {
            const serviceDate = new Date(s.created_at);
            return s.status === 'Tamamlandı' || s.status === 'Teslim Edildi' &&
                   serviceDate >= startDate && serviceDate <= endDate;
        });

        const totalRevenue = filteredServices.reduce((sum, s) => sum + (s.total_price || 0), 0);
        const reportResult = document.getElementById('reportResult');
        reportResult.innerHTML = `
            <h3 class="font-bold text-lg">Rapor Sonucu (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})</h3>
            <p>Toplam Tamamlanan Servis: <span class="font-bold">${filteredServices.length}</span></p>
            <p>Toplam Gelir: <span class="font-bold text-green-600">${totalRevenue.toFixed(2)} ₺</span></p>
            <button id="exportPdfBtn" class="mt-4 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700">PDF Olarak İndir</button>
            <table class="w-full mt-4 text-sm">
                <thead class="bg-gray-100"><tr><th class="p-2 text-left">Servis No</th><th class="p-2 text-left">Müşteri</th><th class="p-2 text-left">Tarih</th><th class="p-2 text-right">Tutar</th></tr></thead>
                <tbody>
                    ${filteredServices.map(s => {
                        const customer = DB.customers.find(c => c.id === s.customer_id);
                        return `<tr><td class="p-2 border-b">${s.service_number}</td><td class="p-2 border-b">${customer?.name}</td><td class="p-2 border-b">${new Date(s.created_at).toLocaleDateString()}</td><td class="p-2 border-b text-right">${(s.total_price || 0).toFixed(2)} ₺</td></tr>`
                    }).join('')}
                </tbody>
            </table>`;
        
        document.getElementById('exportPdfBtn').onclick = () => {
            const doc = new jsPDF();
            doc.text(`Servis Gelir Raporu (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`, 14, 16);
            doc.autoTable({
                startY: 22,
                head: [['Servis No', 'Musteri', 'Tarih', 'Tutar']],
                body: filteredServices.map(s => {
                    const customer = DB.customers.find(c => c.id === s.customer_id);
                    return [s.service_number, customer?.name, new Date(s.created_at).toLocaleDateString(), `${(s.total_price || 0).toFixed(2)} TL`];
                }),
            });
            doc.text(`Toplam Gelir: ${totalRevenue.toFixed(2)} TL`, 14, doc.autoTable.previous.finalY + 10);
            doc.save(`rapor-${Date.now()}.pdf`);
        };
    };
}

function renderPlugins() {
    content.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Eklentiler</h1>
            <button id="addPluginBtn" class="bg-orange-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-700">
                <i class="fas fa-plus mr-2"></i> Yeni Eklenti Ekle
            </button>
        </div>
        <div class="bg-white rounded-lg shadow-md p-6">
            <p class="text-gray-600 mb-4">Eklentiler, panele yeni özellikler eklemek için kullanılabilir. (Bu özellik localStorage kullanır.)</p>
            <div id="pluginList" class="space-y-4">
                ${DB.plugins.map((plugin, index) => `
                    <div class="border p-4 rounded-lg flex justify-between items-start" data-index="${index}">
                        <div>
                            <h3 class="font-bold">${plugin.name || 'İsimsiz Eklenti'}</h3>
                            <p class="text-sm text-gray-500">${plugin.description || 'Açıklama yok.'}</p>
                            <label class="mt-2 inline-flex items-center cursor-pointer">
                                <input type="checkbox" class="plugin-enabled-toggle sr-only peer" ${plugin.enabled ? 'checked' : ''}>
                                <div class="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                                <span class="ms-3 text-sm font-medium text-gray-900">Aktif</span>
                            </label>
                        </div>
                        <button class="delete-plugin-btn text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                    </div>
                `).join('') || '<p class="text-center text-gray-500">Yüklü eklenti bulunmuyor.</p>'}
            </div>
        </div>
    `;

    document.getElementById('addPluginBtn').onclick = () => {
        const modalContent = `
            <form id="pluginForm" class="space-y-4">
                <div><label class="block font-bold">Eklenti Adı:</label><input type="text" id="pluginName" class="w-full p-2 border rounded"></div>
                <div><label class="block font-bold">Açıklama:</label><input type="text" id="pluginDesc" class="w-full p-2 border rounded"></div>
                <div><label class="block font-bold">Eklenti Kodu (JavaScript):</label><textarea id="pluginCode" class="w-full p-2 border rounded font-mono" rows="10"></textarea></div>
            </form>`;
        createModal('pluginModal', 'Yeni Eklenti Ekle', modalContent, () => {
            const newPlugin = {
                id: generateId(),
                name: document.getElementById('pluginName').value,
                description: document.getElementById('pluginDesc').value,
                code: document.getElementById('pluginCode').value,
                enabled: true
            };
            DB.plugins.push(newPlugin);
            saveLegacyDB();
            showToast('Eklenti eklendi. Değişikliklerin etkili olması için sayfayı yenileyin.');
            closeModal('pluginModal');
            renderPlugins();
        }, true);
    };

    document.querySelectorAll('.delete-plugin-btn').forEach(btn => {
        btn.onclick = (e) => {
            const index = e.currentTarget.closest('[data-index]').dataset.index;
            showConfirmModal('Eklentiyi Sil', 'Bu eklentiyi silmek istediğinize emin misiniz?', () => {
                DB.plugins.splice(index, 1);
                saveLegacyDB();
                renderPlugins();
                showToast('Eklenti silindi.', true);
            });
        };
    });
    
    document.querySelectorAll('.plugin-enabled-toggle').forEach(toggle => {
        toggle.onchange = (e) => {
            const index = e.currentTarget.closest('[data-index]').dataset.index;
            DB.plugins[index].enabled = e.currentTarget.checked;
            saveLegacyDB();
            showToast('Eklenti durumu güncellendi. Değişikliklerin etkili olması için sayfayı yenileyin.');
        };
    });
}

function loadPlugins() {
    (DB.plugins || []).forEach(plugin => {
        if (plugin.enabled && plugin.code) {
            try {
                // Eklenti kodunu bir fonksiyon içinde çalıştırarak global scope'u kirletmesini önle
                const pluginFunction = new Function('PluginHost', 'DB', plugin.code);
                pluginFunction(PluginHost, DB);
                console.log(`Eklenti yüklendi: ${plugin.name}`);
            } catch (e) {
                console.error(`Eklenti yüklenirken hata oluştu: ${plugin.name}`, e);
                showToast(`'${plugin.name}' eklentisi yüklenemedi.`, true);
            }
        }
    });
}


// --- UYGULAMAYI BAŞLAT ---
handleAuthStateChange();
supabase.auth.onAuthStateChange((_event, session) => { handleAuthStateChange(); });
