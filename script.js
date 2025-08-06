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
    customers: [], stock: [], services: [], orders: [], plugins: [], settings: {}
};

// --- KULLANICI GİRİŞ (AUTHENTICATION) FONKSİYONLARI ---
async function handleAuthStateChange() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        authScreen.classList.add('hidden');
        app.classList.remove('hidden');
        app.classList.add('flex');
        const userInfoDiv = document.getElementById('user-info');
        if (userInfoDiv) { userInfoDiv.innerHTML = `<p class="truncate" title="${session.user.email}">${session.user.email}</p>`; }
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
    const authForm = document.getElementById('auth-form');
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
        if (error) messageDiv.textContent = 'Hata: ' + error.message; else { messageDiv.textContent = 'Kayıt başarılı! Email adresinize gelen doğrulama linkine tıklayın.'; authForm.reset(); }
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
        supabase.from('customers').select('*').order('name', { ascending: true }),
        supabase.from('stock').select('*').order('name', { ascending: true }),
        supabase.from('services').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
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

    DB.settings = settingsResult.data || { id: 1, last_service_number: 0 }; // Varsayılan ayar
    if (settingsResult.error && settingsResult.error.code !== 'PGRST116') { // 'PGRST116' = row not found
        console.error('Ayarlar Yükleme Hatası:', settingsResult.error); 
        showToast('Ayarlar yüklenemedi!', true); 
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
function generateServiceNumber() {
    const currentNumber = (DB.settings.last_service_number || 0) + 1;
    const prefix = DB.settings.service_prefix || 'SRV';
    return `${prefix}-${currentNumber.toString().padStart(5, '0')}`;
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
    content.innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-3xl text-orange-500"></i></div>'; // Yükleniyor...
    renderFunction();
}
function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); modalContainer.innerHTML = ''; } // Modalı DOM'dan kaldır
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

// Müşteriler (Customers) - SUPABASE
async function renderCustomers(searchTerm = '') {
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
    const customer = customerId ? DB.customers.find(c => c.id == customerId) : null;
    const title = customer ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle';
    const modalContent = `<form id="customerForm" class="space-y-4"><div><label for="customerName" class="block font-bold">Ad Soyad:</label><input type="text" id="customerName" class="w-full p-2 border rounded" required value="${customer ? customer.name : ''}"></div><div><label for="customerPhone" class="block font-bold">Telefon:</label><input type="tel" id="customerPhone" class="w-full p-2 border rounded" value="${customer ? (customer.phone || '') : ''}"></div><div><label for="customerAddress" class="block font-bold">Adres:</label><textarea id="customerAddress" class="w-full p-2 border rounded">${customer ? (customer.address || '') : ''}</textarea></div></form>`;
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
    const customer = DB.customers.find(c => c.id == customerId);
    const title = `${customer.name} için Yeni Motor Ekle`;
    const modalContent = `<form id="motorcycleForm" class="space-y-4"><div><label class="block font-bold">Plaka:</label><input type="text" id="motorcyclePlate" class="w-full p-2 border rounded" required></div><div><label class="block font-bold">Şasi No:</label><input type="text" id="motorcycleChassis" class="w-full p-2 border rounded"></div><div><label class="block font-bold">Marka / Model:</label><input type="text" id="motorcycleModel" class="w-full p-2 border rounded"></div></form>`;
    createModal('motorcycleModal', title, modalContent, async (modalId) => {
        const form = document.getElementById('motorcycleForm'); if (!form.checkValidity()) { form.reportValidity(); return; }
        const newMotorcycle = { id: generateId(), plate: form.motorcyclePlate.value.toUpperCase(), chassis: form.motorcycleChassis.value, model: form.motorcycleModel.value };
        const updatedMotorcycles = [...(customer.motorcycles || []), newMotorcycle];
        const { error } = await supabase.from('customers').update({ motorcycles: updatedMotorcycles }).eq('id', customerId);
        if (error) { showToast('Hata: ' + error.message, true); } else { showToast('Motosiklet eklendi!'); closeModal(modalId); await loadAllDataFromSupabase(); renderCustomers(); }
    });
}
function showCustomerHistory(customerId) {
    const customer = DB.customers.find(c => c.id == customerId);
    const customerServices = DB.services.filter(s => s.customer_id == customerId);
    let historyContent = `<h2 class="text-xl font-bold mb-4">Servis Geçmişi</h2>`;
    if (customerServices.length > 0) {
        historyContent += customerServices.map(s => {
            const motorcycle = (customer.motorcycles || []).find(m => m.id === s.motorcycle_id);
            return `<div class="border p-3 rounded-lg mb-2 bg-gray-50"><p><strong>Servis No:</strong> <a href="#services/${s.id}" class="text-blue-600 hover:underline">${s.service_number}</a></p><p><strong>Tarih:</strong> ${new Date(s.created_at).toLocaleDateString('tr-TR')}</p><p><strong>Plaka:</strong> ${motorcycle?.plate || 'Bilinmiyor'}</p><p><strong>Durum:</strong> ${s.status}</p><p><strong>Tutar:</strong> ${(s.total_price || 0).toFixed(2)} ₺</p></div>`
        }).join('');
    } else { historyContent += '<p>Müşteriye ait servis kaydı bulunamadı.</p>'; }
    createModal('historyModal', `${customer.name} - Geçmiş İşlemler`, historyContent, null, true);
}

// Stok Yönetimi (Stock) - SUPABASE
function renderStock(searchTerm = '') {
    const filteredStock = (DB.stock || []).filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (item.stockCode && item.stockCode.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    content.innerHTML = `<div class="flex justify-between items-center mb-6"><h1 class="text-3xl font-bold">Stok Yönetimi</h1><button id="addStockBtn" class="bg-orange-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-700 flex items-center"><i class="fas fa-plus mr-2"></i> Yeni Ürün Ekle</button></div><input type="text" id="stockSearch" placeholder="Ürün adı veya stok kodu ile ara..." class="w-full p-3 border rounded-lg mb-4" value="${searchTerm}"><div class="bg-white rounded-lg shadow-md overflow-x-auto"><table class="w-full"><thead class="bg-gray-100"><tr><th class="p-4 text-left">Parça Adı</th><th class="p-4 text-left">Stok Kodu</th><th class="p-4 text-left">Miktar</th><th class="p-4 text-left">Satış Fiyatı</th><th class="p-4 text-left min-w-[150px]">İşlemler</th></tr></thead><tbody>${filteredStock.length > 0 ? filteredStock.map(item => `<tr class="border-b hover:bg-gray-50" data-id="${item.id}"><td class="p-4 font-semibold">${item.name}</td><td class="p-4">${item.stockCode || '-'}</td><td class="p-4 font-bold ${item.quantity <= (item.critical_stock || 5) ? 'text-red-600' : ''}">${item.quantity}</td><td class="p-4">${parseFloat(item.sale_price || 0).toFixed(2)} ₺</td><td class="p-4"><button class="edit-stock-btn text-orange-600 hover:text-orange-800 mr-3" title="Düzenle"><i class="fas fa-edit"></i></button><button class="delete-stock-btn text-red-600 hover:text-red-800" title="Sil"><i class="fas fa-trash"></i></button></td></tr>`).join('') : `<tr><td colspan="5" class="text-center p-8 text-gray-500">Stok ürünü bulunamadı.</td></tr>`}</tbody></table></div>`;
    document.getElementById('stockSearch').addEventListener('input', (e) => renderStock(e.target.value));
    document.getElementById('addStockBtn').onclick = () => showStockModal();
    document.querySelectorAll('.edit-stock-btn').forEach(btn => btn.onclick = e => showStockModal(e.currentTarget.closest('tr').dataset.id));
    document.querySelectorAll('.delete-stock-btn').forEach(btn => btn.onclick = e => deleteStockItem(e.currentTarget.closest('tr').dataset.id));
}
async function showStockModal(itemId = null) {
    const item = itemId ? DB.stock.find(i => i.id == itemId) : null;
    const title = item ? 'Ürün Düzenle' : 'Yeni Ürün Ekle';
    const modalContent = `<form id="stockForm" class="space-y-4"><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label class="block font-bold">Parça Adı:</label><input type="text" id="itemName" class="w-full p-2 border rounded" required value="${item ? item.name : ''}"></div><div><label class="block font-bold">Stok Kodu:</label><input type="text" id="itemStockCode" class="w-full p-2 border rounded" value="${item ? (item.stockCode || '') : ''}"></div><div><label class="block font-bold">Miktar:</label><input type="number" id="itemQuantity" class="w-full p-2 border rounded" required min="0" value="${item ? item.quantity : '0'}"></div><div><label class="block font-bold">Satış Fiyatı (₺):</label><input type="number" id="itemSalePrice" class="w-full p-2 border rounded" required min="0" step="0.01" value="${item ? (item.sale_price || '') : ''}"></div><div><label class="block font-bold">Alış Fiyatı (₺):</label><input type="number" id="itemPurchasePrice" class="w-full p-2 border rounded" min="0" step="0.01" value="${item ? (item.purchase_price || '') : ''}"></div><div><label class="block font-bold">Kritik Stok Seviyesi:</label><input type="number" id="itemCriticalStock" class="w-full p-2 border rounded" min="0" value="${item ? (item.critical_stock || '5') : '5'}"></div></div></form>`;
    createModal('stockModal', title, modalContent, async (modalId) => {
        const form = document.getElementById('stockForm'); if (!form.checkValidity()) { form.reportValidity(); return; }
        const stockData = { name: form.itemName.value, stockCode: form.itemStockCode.value, quantity: parseInt(form.itemQuantity.value), sale_price: parseFloat(form.itemSalePrice.value), purchase_price: parseFloat(form.itemPurchasePrice.value), critical_stock: parseInt(form.itemCriticalStock.value) };
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

// Servis Yönetimi (Services) - SUPABASE
function renderServices(searchTerm = '') {
    const filteredServices = (DB.services || []).filter(s => {
        const customer = DB.customers.find(c => c.id === s.customer_id);
        const customerName = customer ? customer.name.toLowerCase() : '';
        return s.service_number.toLowerCase().includes(searchTerm.toLowerCase()) || customerName.includes(searchTerm.toLowerCase());
    });

    const statusClasses = { 'Yeni': 'bg-blue-200 text-blue-800', 'İşlemde': 'bg-yellow-200 text-yellow-800', 'Tamamlandı': 'bg-green-200 text-green-800', 'Teslim Edildi': 'bg-purple-200 text-purple-800', 'İptal': 'bg-red-200 text-red-800' };
    
    content.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Servis Kayıtları</h1>
            <button id="addServiceBtn" class="bg-orange-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-700 flex items-center">
                <i class="fas fa-plus mr-2"></i> Yeni Servis Kaydı
            </button>
        </div>
        <input type="text" id="serviceSearch" placeholder="Servis no veya müşteri adı ile ara..." class="w-full p-3 border rounded-lg mb-4" value="${searchTerm}">
        <div class="bg-white rounded-lg shadow-md overflow-x-auto">
            <table class="w-full">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-4 text-left">Servis No</th>
                        <th class="p-4 text-left">Müşteri</th>
                        <th class="p-4 text-left">Tarih</th>
                        <th class="p-4 text-left">Durum</th>
                        <th class="p-4 text-left">Tutar</th>
                        <th class="p-4 text-left min-w-[150px]">İşlemler</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredServices.length > 0 ? filteredServices.map(s => {
                        const customer = DB.customers.find(c => c.id === s.customer_id);
                        return `
                            <tr class="border-b hover:bg-gray-50" data-id="${s.id}">
                                <td class="p-4 font-bold">${s.service_number}</td>
                                <td class="p-4">${customer ? customer.name : 'Bilinmiyor'}</td>
                                <td class="p-4">${new Date(s.created_at).toLocaleDateString('tr-TR')}</td>
                                <td class="p-4"><span class="px-2 py-1 rounded-full text-xs font-semibold ${statusClasses[s.status] || 'bg-gray-200 text-gray-800'}">${s.status}</span></td>
                                <td class="p-4">${(s.total_price || 0).toFixed(2)} ₺</td>
                                <td class="p-4">
                                    <button class="edit-service-btn text-orange-600 hover:text-orange-800 mr-3" title="Düzenle"><i class="fas fa-edit"></i></button>
                                    <button class="delete-service-btn text-red-600 hover:text-red-800" title="Sil"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>`;
                    }).join('') : `<tr><td colspan="6" class="text-center p-8 text-gray-500">Servis kaydı bulunamadı.</td></tr>`}
                </tbody>
            </table>
        </div>`;

    document.getElementById('serviceSearch').addEventListener('input', (e) => renderServices(e.target.value));
    document.getElementById('addServiceBtn').onclick = () => showServiceModal();
    document.querySelectorAll('.edit-service-btn').forEach(btn => btn.onclick = (e) => showServiceModal(e.currentTarget.closest('tr').dataset.id));
    document.querySelectorAll('.delete-service-btn').forEach(btn => btn.onclick = (e) => deleteService(e.currentTarget.closest('tr').dataset.id));
}
async function showServiceModal(serviceId = null) {
    const service = serviceId ? DB.services.find(s => s.id == serviceId) : null;
    const title = service ? `Servis Düzenle: ${service.service_number}` : 'Yeni Servis Kaydı';

    // Bu modal oldukça karmaşık olacağı için içeriği dinamik olarak oluşturacağız.
    const modalContent = `
        <form id="serviceForm" class="space-y-6">
            <!-- Müşteri ve Motor Seçimi -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                <div>
                    <label class="block font-bold">Müşteri:</label>
                    <select id="serviceCustomer" class="w-full p-2 border rounded" required>
                        <option value="">Müşteri Seçin...</option>
                        ${DB.customers.map(c => `<option value="${c.id}" ${service && service.customer_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block font-bold">Motosiklet:</label>
                    <select id="serviceMotorcycle" class="w-full p-2 border rounded" required>
                        <option value="">Önce Müşteri Seçin...</option>
                    </select>
                </div>
            </div>

            <!-- Parçalar ve İşçilik -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- Kullanılan Parçalar -->
                <div>
                    <h4 class="font-bold text-lg mb-2">Kullanılan Parçalar</h4>
                    <div class="flex gap-2 mb-2">
                        <select id="partSelector" class="flex-grow p-2 border rounded">
                            <option value="">Parça Seçin...</option>
                            ${DB.stock.map(p => `<option value="${p.id}">${p.name} (${p.quantity} adet) - ${p.sale_price.toFixed(2)} ₺</option>`).join('')}
                        </select>
                        <input type="number" id="partQuantity" value="1" min="1" class="w-20 p-2 border rounded">
                        <button type="button" id="addPartBtn" class="bg-blue-500 text-white px-4 rounded hover:bg-blue-600">Ekle</button>
                    </div>
                    <div id="partsList" class="border rounded p-2 min-h-[100px] bg-gray-50"></div>
                </div>
                <!-- Yapılan İşlemler (İşçilik) -->
                <div>
                    <h4 class="font-bold text-lg mb-2">Yapılan İşlemler (İşçilik)</h4>
                    <div class="flex gap-2 mb-2">
                        <input type="text" id="laborDescription" placeholder="İşlem açıklaması" class="flex-grow p-2 border rounded">
                        <input type="number" id="laborPrice" placeholder="Fiyat" step="0.01" class="w-28 p-2 border rounded">
                        <button type="button" id="addLaborBtn" class="bg-blue-500 text-white px-4 rounded hover:bg-blue-600">Ekle</button>
                    </div>
                    <div id="laborsList" class="border rounded p-2 min-h-[100px] bg-gray-50"></div>
                </div>
            </div>

            <!-- Toplam Fiyat ve Durum -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                 <div>
                    <label class="block font-bold">Durum:</label>
                    <select id="serviceStatus" class="w-full p-2 border rounded">
                        <option>Yeni</option>
                        <option>İşlemde</option>
                        <option>Tamamlandı</option>
                        <option>Teslim Edildi</option>
                        <option>İptal</option>
                    </select>
                </div>
                <div>
                    <label class="block font-bold">KM:</label>
                    <input type="number" id="serviceKm" class="w-full p-2 border rounded" value="${service?.km || ''}">
                </div>
                <div class="text-right">
                    <h4 class="font-bold text-lg">TOPLAM TUTAR</h4>
                    <p id="totalPrice" class="text-3xl font-bold text-green-600">0.00 ₺</p>
                </div>
            </div>
        </form>
    `;

    createModal('serviceModal', title, modalContent, async (modalId) => {
        // Kaydetme mantığı burada olacak
        const form = document.getElementById('serviceForm');
        if (!form.checkValidity()) { form.reportValidity(); return; }

        const serviceData = {
            customer_id: form.serviceCustomer.value,
            motorcycle_id: form.serviceMotorcycle.value,
            status: form.serviceStatus.value,
            km: form.serviceKm.value,
            parts: currentParts,
            labors: currentLabors,
            total_price: parseFloat(document.getElementById('totalPrice').textContent),
            service_number: service ? service.service_number : generateServiceNumber()
        };

        let error;
        if (service) {
            const { error: updateError } = await supabase.from('services').update(serviceData).eq('id', serviceId);
            error = updateError;
        } else {
            const { data, error: insertError } = await supabase.from('services').insert([serviceData]).select().single();
            error = insertError;
            // Yeni servis eklendiğinde servis numarasını güncelle
            if (!error) {
                await supabase.from('settings').update({ last_service_number: DB.settings.last_service_number + 1 }).eq('id', 1);
            }
        }

        if (error) {
            showToast('Hata: ' + error.message, true);
        } else {
            showToast('Servis kaydı başarılı!');
            closeModal(modalId);
            await loadAllDataFromSupabase();
            renderServices();
        }

    }, true);

    // --- Modal içi mantık ---
    const customerSelect = document.getElementById('serviceCustomer');
    const motorcycleSelect = document.getElementById('serviceMotorcycle');
    const statusSelect = document.getElementById('serviceStatus');
    const totalPriceEl = document.getElementById('totalPrice');

    let currentParts = service ? service.parts || [] : [];
    let currentLabors = service ? service.labors || [] : [];

    function updateMotorcycleOptions() {
        const customerId = customerSelect.value;
        const customer = DB.customers.find(c => c.id == customerId);
        motorcycleSelect.innerHTML = '<option value="">Motosiklet Seçin...</option>';
        if (customer && customer.motorcycles) {
            motorcycleSelect.innerHTML += customer.motorcycles.map(m => `<option value="${m.id}">${m.plate} - ${m.model}</option>`).join('');
        }
    }

    function renderLists() {
        const partsList = document.getElementById('partsList');
        const laborsList = document.getElementById('laborsList');
        partsList.innerHTML = currentParts.map((p, i) => `<div class="flex justify-between items-center p-1 bg-white border-b"><span>${p.quantity}x ${p.name}</span><span>${(p.quantity * p.sale_price).toFixed(2)} ₺ <button data-index="${i}" class="remove-part-btn text-red-500 ml-2">&times;</button></span></div>`).join('');
        laborsList.innerHTML = currentLabors.map((l, i) => `<div class="flex justify-between items-center p-1 bg-white border-b"><span>${l.description}</span><span>${l.price.toFixed(2)} ₺ <button data-index="${i}" class="remove-labor-btn text-red-500 ml-2">&times;</button></span></div>`).join('');
        
        document.querySelectorAll('.remove-part-btn').forEach(btn => btn.onclick = (e) => {
            currentParts.splice(e.target.dataset.index, 1);
            renderLists();
        });
        document.querySelectorAll('.remove-labor-btn').forEach(btn => btn.onclick = (e) => {
            currentLabors.splice(e.target.dataset.index, 1);
            renderLists();
        });
        
        updateTotalPrice();
    }

    function updateTotalPrice() {
        const partsTotal = currentParts.reduce((sum, p) => sum + (p.quantity * p.sale_price), 0);
        const laborsTotal = currentLabors.reduce((sum, l) => sum + l.price, 0);
        totalPriceEl.textContent = `${(partsTotal + laborsTotal).toFixed(2)} ₺`;
    }

    document.getElementById('addPartBtn').onclick = () => {
        const partSelector = document.getElementById('partSelector');
        const quantity = parseInt(document.getElementById('partQuantity').value);
        const selectedPart = DB.stock.find(p => p.id == partSelector.value);
        if (selectedPart && quantity > 0) {
            currentParts.push({ ...selectedPart, quantity: quantity });
            renderLists();
        }
    };

    document.getElementById('addLaborBtn').onclick = () => {
        const description = document.getElementById('laborDescription').value;
        const price = parseFloat(document.getElementById('laborPrice').value);
        if (description && price > 0) {
            currentLabors.push({ description, price });
            document.getElementById('laborDescription').value = '';
            document.getElementById('laborPrice').value = '';
            renderLists();
        }
    };

    customerSelect.onchange = updateMotorcycleOptions;

    // Eğer düzenleme modundaysak, mevcut verileri yükle
    if (service) {
        customerSelect.value = service.customer_id;
        updateMotorcycleOptions();
        setTimeout(() => { // DOM'un güncellenmesi için kısa bir bekleme
             motorcycleSelect.value = service.motorcycle_id;
        }, 100);
        statusSelect.value = service.status;
    }

    renderLists();
}
async function deleteService(serviceId) {
    showConfirmModal('Servisi Sil', 'Bu servis kaydını kalıcı olarak silmek istediğinize emin misiniz?', async () => {
        const { error } = await supabase.from('services').delete().eq('id', serviceId);
        if (error) { showToast('Hata: ' + error.message, true); }
        else { showToast('Servis kaydı silindi.', true); await loadAllDataFromSupabase(); renderServices(); }
    });
}

// Sipariş Yönetimi (Orders) - SUPABASE
function renderOrders(searchTerm = '') {
    const filteredOrders = (DB.orders || []).filter(o => 
        (o.supplier && o.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.order_number && o.order_number.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const statusClasses = { 'Bekleniyor': 'bg-blue-200 text-blue-800', 'Tamamlandı': 'bg-green-200 text-green-800', 'İptal': 'bg-red-200 text-red-800' };

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
                        <th class="p-4 text-left">Tutar</th>
                        <th class="p-4 text-left min-w-[150px]">İşlemler</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredOrders.length > 0 ? filteredOrders.map(o => `
                        <tr class="border-b hover:bg-gray-50" data-id="${o.id}">
                            <td class="p-4 font-bold">${o.order_number || '-'}</td>
                            <td class="p-4">${o.supplier || 'Bilinmiyor'}</td>
                            <td class="p-4">${new Date(o.created_at).toLocaleDateString('tr-TR')}</td>
                            <td class="p-4"><span class="px-2 py-1 rounded-full text-xs font-semibold ${statusClasses[o.status] || 'bg-gray-200 text-gray-800'}">${o.status}</span></td>
                            <td class="p-4">${(o.total_price || 0).toFixed(2)} ₺</td>
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
    const order = orderId ? DB.orders.find(o => o.id == orderId) : null;
    const title = order ? 'Sipariş Düzenle' : 'Yeni Sipariş Oluştur';

    const modalContent = `
        <form id="orderForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="block font-bold">Sipariş No:</label><input type="text" id="orderNumber" class="w-full p-2 border rounded bg-gray-100" value="${order ? order.order_number : 'Otomatik'}" readonly></div>
                <div><label class="block font-bold">Tedarikçi:</label><input type="text" id="orderSupplier" class="w-full p-2 border rounded" value="${order ? order.supplier : ''}" required></div>
            </div>
            <div>
                <h4 class="font-bold text-lg mb-2">Sipariş Edilecek Ürünler</h4>
                <div class="flex gap-2 mb-2">
                    <select id="orderItemSelector" class="flex-grow p-2 border rounded">
                        <option value="">Ürün Seçin...</option>
                        ${DB.stock.map(p => `<option value="${p.id}">${p.name} - ${p.purchase_price?.toFixed(2) || '0.00'} ₺</option>`).join('')}
                    </select>
                    <input type="number" id="orderItemQuantity" value="1" min="1" class="w-20 p-2 border rounded">
                    <button type="button" id="addOrderItemBtn" class="bg-blue-500 text-white px-4 rounded hover:bg-blue-600">Ekle</button>
                </div>
                <div id="orderItemsList" class="border rounded p-2 min-h-[150px] bg-gray-50"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                    <label class="block font-bold">Durum:</label>
                    <select id="orderStatus" class="w-full p-2 border rounded">
                        <option>Bekleniyor</option>
                        <option>Tamamlandı</option>
                        <option>İptal</option>
                    </select>
                </div>
                <div class="text-right">
                    <h4 class="font-bold text-lg">TOPLAM TUTAR</h4>
                    <p id="orderTotalPrice" class="text-3xl font-bold text-green-600">0.00 ₺</p>
                </div>
            </div>
        </form>
    `;
    createModal('orderModal', title, modalContent, async (modalId) => {
        const form = document.getElementById('orderForm');
        if (!form.checkValidity()) { form.reportValidity(); return; }

        const orderData = {
            supplier: form.orderSupplier.value,
            status: form.orderStatus.value,
            items: currentItems,
            total_price: parseFloat(document.getElementById('orderTotalPrice').textContent)
        };

        let error;
        if (order) {
            const { error: updateError } = await supabase.from('orders').update(orderData).eq('id', orderId);
            error = updateError;
        } else {
            orderData.order_number = `ORD-${Date.now()}`;
            const { error: insertError } = await supabase.from('orders').insert([orderData]);
            error = insertError;
        }
        
        if (error) { showToast('Hata: ' + error.message, true); } 
        else { 
            showToast('Sipariş kaydedildi!'); 
            closeModal(modalId); 
            await loadAllDataFromSupabase(); 
            renderOrders(); 
        }
    }, true);

    // Modal içi mantık
    let currentItems = order ? order.items || [] : [];
    const statusSelect = document.getElementById('orderStatus');

    function renderOrderItems() {
        const listEl = document.getElementById('orderItemsList');
        const totalEl = document.getElementById('orderTotalPrice');
        listEl.innerHTML = currentItems.map((item, i) => `
            <div class="flex justify-between items-center p-1 bg-white border-b">
                <span>${item.quantity}x ${item.name}</span>
                <span>${(item.quantity * (item.purchase_price || 0)).toFixed(2)} ₺ 
                <button data-index="${i}" class="remove-order-item-btn text-red-500 ml-2">&times;</button></span>
            </div>`).join('');
        
        const total = currentItems.reduce((sum, item) => sum + (item.quantity * (item.purchase_price || 0)), 0);
        totalEl.textContent = `${total.toFixed(2)} ₺`;

        document.querySelectorAll('.remove-order-item-btn').forEach(btn => btn.onclick = (e) => {
            currentItems.splice(e.target.dataset.index, 1);
            renderOrderItems();
        });
    }

    document.getElementById('addOrderItemBtn').onclick = () => {
        const selector = document.getElementById('orderItemSelector');
        const quantity = parseInt(document.getElementById('orderItemQuantity').value);
        const selectedItem = DB.stock.find(p => p.id == selector.value);
        if (selectedItem && quantity > 0) {
            currentItems.push({ ...selectedItem, quantity: quantity });
            renderOrderItems();
        }
    };
    
    if (order) {
        statusSelect.value = order.status;
    }

    renderOrderItems();
}
async function deleteOrder(orderId) {
    showConfirmModal('Siparişi Sil', 'Bu siparişi kalıcı olarak silmek istediğinize emin misiniz?', async () => {
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) { showToast('Hata: ' + error.message, true); }
        else { showToast('Sipariş silindi.', true); await loadAllDataFromSupabase(); renderOrders(); }
    });
}

// Ayarlar (Settings) - SUPABASE
async function renderSettings() {
    const settings = DB.settings || {};
    content.innerHTML = `
        <h1 class="text-3xl font-bold mb-6">Ayarlar</h1>
        <div class="bg-white p-8 rounded-lg shadow-md max-w-4xl mx-auto">
            <form id="settingsForm" class="space-y-6">
                <h2 class="text-xl font-semibold border-b pb-2">Firma Bilgileri</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label class="block font-bold">Firma Adı:</label><input type="text" id="company_name" class="w-full p-2 border rounded" value="${settings.company_name || ''}"></div>
                    <div><label class="block font-bold">Telefon:</label><input type="text" id="company_phone" class="w-full p-2 border rounded" value="${settings.company_phone || ''}"></div>
                </div>
                <div><label class="block font-bold">Adres:</label><textarea id="company_address" class="w-full p-2 border rounded">${settings.company_address || ''}</textarea></div>
                
                <h2 class="text-xl font-semibold border-b pb-2 pt-4">Servis Ayarları</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label class="block font-bold">Servis Numarası Ön Eki:</label><input type="text" id="service_prefix" class="w-full p-2 border rounded" value="${settings.service_prefix || 'SRV'}"></div>
                    <div><label class="block font-bold">Son Servis Numarası:</label><input type="number" id="last_service_number" class="w-full p-2 border rounded" value="${settings.last_service_number || 0}"></div>
                </div>
                
                <div class="text-right pt-6">
                    <button type="submit" class="bg-orange-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-orange-700">Ayarları Kaydet</button>
                </div>
            </form>
        </div>`;

    document.getElementById('settingsForm').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const updatedSettings = {
            id: 1, // Ayarlar her zaman tek satır
            company_name: form.company_name.value,
            company_phone: form.company_phone.value,
            company_address: form.company_address.value,
            service_prefix: form.service_prefix.value,
            last_service_number: parseInt(form.last_service_number.value)
        };

        const { error } = await supabase.from('settings').upsert(updatedSettings);

        if (error) {
            showToast('Ayarlar kaydedilemedi: ' + error.message, true);
        } else {
            showToast('Ayarlar başarıyla kaydedildi!');
            await loadAllDataFromSupabase(); // Verileri yeniden yükle
            renderSettings(); // Sayfayı yenile
        }
    };
}

// Diğer Modüller
function renderDashboard() {
    const openServices = DB.services.filter(s => s.status !== 'Teslim Edildi' && s.status !== 'İptal').length;
    const lowStockItems = DB.stock.filter(i => i.quantity <= (i.critical_stock || 5)).length;
    const totalCustomers = DB.customers.length;
    
    const lastMonthServices = DB.services.filter(s => {
        const serviceDate = new Date(s.created_at);
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return serviceDate > lastMonth;
    });
    const monthlyRevenue = lastMonthServices.reduce((sum, s) => sum + (s.total_price || 0), 0);

    content.innerHTML = `
        <h1 class="text-3xl font-bold mb-6">Gösterge Paneli</h1>
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div class="bg-white p-6 rounded-lg shadow-md flex items-center"><i class="fas fa-users text-4xl text-blue-500 mr-4"></i><div><p class="text-gray-600">Toplam Müşteri</p><p class="text-3xl font-bold">${totalCustomers}</p></div></div>
            <div class="bg-white p-6 rounded-lg shadow-md flex items-center"><i class="fas fa-tools text-4xl text-yellow-500 mr-4"></i><div><p class="text-gray-600">Açık Servis Kaydı</p><p class="text-3xl font-bold">${openServices}</p></div></div>
            <div class="bg-white p-6 rounded-lg shadow-md flex items-center"><i class="fas fa-box-open text-4xl text-red-500 mr-4"></i><div><p class="text-gray-600">Kritik Stok</p><p class="text-3xl font-bold">${lowStockItems}</p></div></div>
            <div class="bg-white p-6 rounded-lg shadow-md flex items-center"><i class="fas fa-lira-sign text-4xl text-green-500 mr-4"></i><div><p class="text-gray-600">Son 30 Gün Hasılat</p><p class="text-3xl font-bold">${monthlyRevenue.toFixed(2)}</p></div></div>
        </div>
        
        <!-- Charts and Recent Activity -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-bold mb-4">Son 7 Günlük Servis Aktivitesi</h2>
                <canvas id="activityChart"></canvas>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-bold mb-4">Son Servis Kayıtları</h2>
                <div class="space-y-3">
                    ${DB.services.slice(0, 5).map(s => {
                        const customer = DB.customers.find(c => c.id === s.customer_id);
                        return `<div class="border-b pb-2"><p class="font-semibold">${s.service_number} - ${customer ? customer.name : '...'}</p><p class="text-sm text-gray-500">${s.status} - ${s.total_price.toFixed(2)} ₺</p></div>`
                    }).join('')}
                </div>
            </div>
        </div>
    `;
    
    // Activity Chart
    const ctx = document.getElementById('activityChart').getContext('2d');
    const labels = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toLocaleDateString('tr-TR', { weekday: 'short' });
    }).reverse();
    
    const data = labels.map(label => {
        return DB.services.filter(s => {
            const serviceDate = new Date(s.created_at).toLocaleDateString('tr-TR', { weekday: 'short' });
            return serviceDate === label;
        }).length;
    });

    charts.activity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Servis Sayısı',
                data: data,
                backgroundColor: 'rgba(249, 115, 22, 0.6)',
                borderColor: 'rgba(249, 115, 22, 1)',
                borderWidth: 1
            }]
        },
        options: { scales: { y: { beginAtZero: true } } }
    });
}
function renderInventoryCount() {
    content.innerHTML = `
        <h1 class="text-3xl font-bold mb-6">Stok Sayımı</h1>
        <div class="bg-white p-8 rounded-lg shadow-md">
            <p class="mb-4 text-gray-600">Mevcut stok miktarlarını fiziksel sayım sonuçları ile güncelleyin. Farklı olanları girip "Değişiklikleri Kaydet" butonuna tıklayın.</p>
            <div class="overflow-x-auto">
                <table class="w-full" id="inventoryCountTable">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="p-4 text-left">Ürün Adı</th>
                            <th class="p-4 text-left">Stok Kodu</th>
                            <th class="p-4 text-center">Mevcut Miktar</th>
                            <th class="p-4 text-center">Sayılan Miktar</th>
                            <th class="p-4 text-center">Fark</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${DB.stock.map(item => `
                            <tr class="border-b" data-id="${item.id}" data-current-quantity="${item.quantity}">
                                <td class="p-4">${item.name}</td>
                                <td class="p-4">${item.stockCode || '-'}</td>
                                <td class="p-4 text-center font-bold">${item.quantity}</td>
                                <td class="p-4 text-center"><input type="number" class="counted-quantity w-24 p-2 border rounded text-center" min="0"></td>
                                <td class="p-4 text-center font-bold difference"></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="text-right mt-6">
                <button id="saveInventoryCount" class="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700">Değişiklikleri Kaydet</button>
            </div>
        </div>`;

    const table = document.getElementById('inventoryCountTable');
    table.addEventListener('input', (e) => {
        if (e.target.classList.contains('counted-quantity')) {
            const row = e.target.closest('tr');
            const currentQty = parseInt(row.dataset.currentQuantity);
            const countedQty = e.target.value === '' ? null : parseInt(e.target.value);
            const diffEl = row.querySelector('.difference');
            if (countedQty !== null) {
                const diff = countedQty - currentQty;
                diffEl.textContent = diff;
                diffEl.className = 'p-4 text-center font-bold difference ';
                if (diff > 0) diffEl.classList.add('text-green-600');
                else if (diff < 0) diffEl.classList.add('text-red-600');
            } else {
                diffEl.textContent = '';
            }
        }
    });

    document.getElementById('saveInventoryCount').onclick = async () => {
        const updates = [];
        table.querySelectorAll('tbody tr').forEach(row => {
            const countedInput = row.querySelector('.counted-quantity');
            if (countedInput.value !== '') {
                updates.push({
                    id: row.dataset.id,
                    quantity: parseInt(countedInput.value)
                });
            }
        });

        if (updates.length === 0) {
            showToast('Güncellenecek ürün bulunamadı.', true);
            return;
        }
        
        showConfirmModal('Stok Güncelle', `${updates.length} adet ürünün stok miktarı güncellenecektir. Onaylıyor musunuz?`, async () => {
            const { error } = await supabase.from('stock').upsert(updates);
            if (error) {
                showToast('Stok güncellenemedi: ' + error.message, true);
            } else {
                showToast('Stok başarıyla güncellendi!');
                await loadAllDataFromSupabase();
                renderInventoryCount();
            }
        });
    };
}
function renderReports() {
    content.innerHTML = `
        <h1 class="text-3xl font-bold mb-6">Raporlar</h1>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-bold mb-4">Aylık Hasılat</h2>
                <canvas id="revenueChart"></canvas>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-bold mb-4">Servis Durum Dağılımı</h2>
                <canvas id="statusPieChart"></canvas>
            </div>
            <div class="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-bold mb-4">En Çok Kullanılan 10 Parça</h2>
                <canvas id="topPartsChart"></canvas>
            </div>
        </div>`;

    // Revenue Chart
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const monthlyRevenueData = Array(12).fill(0);
    DB.services.forEach(s => {
        const month = new Date(s.created_at).getMonth();
        monthlyRevenueData[month] += s.total_price || 0;
    });
    charts.revenue = new Chart(revenueCtx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{ label: 'Hasılat (₺)', data: monthlyRevenueData, borderColor: 'rgb(75, 192, 192)', tension: 0.1 }]
        }
    });

    // Status Pie Chart
    const statusCtx = document.getElementById('statusPieChart').getContext('2d');
    const statusCounts = DB.services.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
    }, {});
    charts.statusPie = new Chart(statusCtx, {
        type: 'pie',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444'] }]
        }
    });

    // Top Parts Chart
    const topPartsCtx = document.getElementById('topPartsChart').getContext('2d');
    const partCounts = DB.services.flatMap(s => s.parts || []).reduce((acc, part) => {
        acc[part.name] = (acc[part.name] || 0) + part.quantity;
        return acc;
    }, {});
    const sortedParts = Object.entries(partCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    charts.topParts = new Chart(topPartsCtx, {
        type: 'bar',
        data: {
            labels: sortedParts.map(p => p[0]),
            datasets: [{ label: 'Kullanım Miktarı', data: sortedParts.map(p => p[1]), backgroundColor: 'rgba(139, 92, 246, 0.6)' }]
        },
        options: { indexAxis: 'y' }
    });
}
function renderPlugins() {
    content.innerHTML = `
        <h1 class="text-3xl font-bold mb-6">Eklentiler</h1>
        <div class="bg-white p-8 rounded-lg shadow-md mb-6">
            <h2 class="text-xl font-semibold mb-2">Yeni Eklenti Ekle</h2>
            <p class="text-sm text-gray-600 mb-4">Eklenti kodunu (JavaScript) aşağıdaki alana yapıştırın.</p>
            <textarea id="pluginCode" class="w-full p-2 border rounded font-mono h-48" placeholder="/* Eklenti kodu buraya */"></textarea>
            <input type="text" id="pluginName" class="w-full p-2 border rounded mt-2" placeholder="Eklenti Adı (Örn: Fatura Yazdırma)">
            <button id="addPluginBtn" class="bg-orange-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-700 mt-4">Eklentiyi Ekle</button>
        </div>
        <div class="bg-white p-8 rounded-lg shadow-md">
            <h2 class="text-xl font-semibold mb-4">Yüklü Eklentiler</h2>
            <div id="pluginList" class="space-y-3">
                ${DB.plugins.length > 0 ? DB.plugins.map((p, i) => `
                    <div class="flex justify-between items-center p-3 border rounded">
                        <span>${p.name}</span>
                        <button data-index="${i}" class="delete-plugin-btn text-red-500 hover:text-red-700">Kaldır</button>
                    </div>
                `).join('') : '<p class="text-gray-500">Yüklü eklenti bulunmuyor.</p>'}
            </div>
        </div>`;

    document.getElementById('addPluginBtn').onclick = () => {
        const name = document.getElementById('pluginName').value;
        const code = document.getElementById('pluginCode').value;
        if (name && code) {
            DB.plugins.push({ name, code });
            saveLegacyDB();
            showToast('Eklenti eklendi! Değişikliklerin etkili olması için sayfayı yenileyin.');
            renderPlugins();
        } else {
            showToast('Eklenti adı ve kodu boş olamaz.', true);
        }
    };

    document.querySelectorAll('.delete-plugin-btn').forEach(btn => {
        btn.onclick = (e) => {
            const index = e.target.dataset.index;
            showConfirmModal('Eklentiyi Kaldır', 'Bu eklentiyi kaldırmak istediğinize emin misiniz?', () => {
                DB.plugins.splice(index, 1);
                saveLegacyDB();
                showToast('Eklenti kaldırıldı. Değişikliklerin etkili olması için sayfayı yenileyin.', true);
                renderPlugins();
            });
        };
    });
}
function loadPlugins() {
    DB.plugins.forEach((plugin, index) => {
        try {
            // Eklenti kodunu bir fonksiyon içine sararak global scope'u kirletmesini engelle
            const pluginWrapper = new Function('PluginHost', 'DB', 'helpers', plugin.code);
            pluginWrapper(PluginHost, DB, { generateId, showToast, createModal, showConfirmModal, jsPDF });
        } catch (e) {
            console.error(`Eklenti yüklenirken hata oluştu (${plugin.name}):`, e);
            showToast(`Eklenti yüklenemedi: ${plugin.name}`, true);
        }
    });
}


// --- UYGULAMAYI BAŞLAT ---
handleAuthStateChange();
supabase.auth.onAuthStateChange((_event, session) => {
    // Oturum durumu değiştiğinde tekrar handle et, bu sayede login/logout sonrası sayfa yenilenir.
    handleAuthStateChange();
});
