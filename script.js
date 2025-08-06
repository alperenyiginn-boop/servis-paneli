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
        supabase.from('customers').select('*'),
        supabase.from('stock').select('*'),
        supabase.from('services').select('*'),
        supabase.from('orders').select('*'),
        supabase.from('settings').select('*').eq('id', 1).single() // Ayarlar tek satır olduğu için .single() kullanıyoruz
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
    if (settingsResult.error) { console.error('Ayarlar Yükleme Hatası:', settingsResult.error); showToast('Ayarlar yüklenemedi!', true); }

    loadLegacyData(); // Sadece eklentiler gibi kalan verileri yükler
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
function generateServiceNumber() { DB.settings.last_service_number++; const p = DB.settings.service_prefix || 'SRV'; return `${p}-${DB.settings.last_service_number.toString().padStart(4, '0')}`; }
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
    const customer = customerId ? DB.customers.find(c => c.id === customerId) : null;
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
    const customer = DB.customers.find(c => c.id === customerId);
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
    const customer = DB.customers.find(c => c.id === customerId);
    const customerServices = DB.services.filter(s => s.customer_id === customerId);
    let historyContent = `<h2 class="text-xl font-bold mb-4">Servis Geçmişi</h2>`;
    if (customerServices.length > 0) {
        historyContent += customerServices.map(s => {
            const motorcycle = (customer.motorcycles || []).find(m => m.id === s.motorcycle_id);
            return `<div class="border p-3 rounded-lg mb-2 bg-gray-50"><p><strong>Servis No:</strong> ${s.service_number}</p><p><strong>Tarih:</strong> ${new Date(s.created_at).toLocaleDateString('tr-TR')}</p><p><strong>Plaka:</strong> ${motorcycle?.plate || 'Bilinmiyor'}</p><p><strong>Durum:</strong> ${s.status}</p><p><strong>Tutar:</strong> ${(s.total_price || 0).toFixed(2)} ₺</p></div>`
        }).join('');
    } else { historyContent += '<p>Müşteriye ait servis kaydı bulunamadı.</p>'; }
    createModal('historyModal', `${customer.name} - Geçmiş İşlemler`, historyContent, null, true);
}

// Stok Yönetimi (Stock) - SUPABASE
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
    const item = itemId ? DB.stock.find(i => i.id === itemId) : null;
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

// Servis Yönetimi (Services) - SUPABASE
function renderServices(searchTerm = '') { /* ... Önceki koddan ... */ }
async function showServiceModal(serviceId = null) { /* ... Önceki koddan ... */ }
async function deleteService(serviceId) { /* ... Önceki koddan ... */ }

// Sipariş Yönetimi (Orders) - SUPABASE
function renderOrders(searchTerm = '') { /* ... Önceki koddan ... */ }
async function showOrderModal(orderId = null) { /* ... Önceki koddan ... */ }
async function deleteOrder(orderId) { /* ... Önceki koddan ... */ }

// Ayarlar (Settings) - SUPABASE
async function renderSettings() { /* ... Önceki koddan ... */ }

// Diğer Modüller
function renderDashboard() { /* ... Önceki koddan ... */ }
function renderInventoryCount() { /* ... Önceki koddan ... */ }
function renderReports() { /* ... Önceki koddan ... */ }
function renderPlugins() { /* ... Önceki koddan ... */ }
function loadPlugins() { /* ... Önceki koddan ... */ }


// --- UYGULAMAYI BAŞLAT ---
handleAuthStateChange();
supabase.auth.onAuthStateChange((_event, session) => { handleAuthStateChange(); });
