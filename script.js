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
    customers: [], stock: [], services: [], sales: [], orders: [], plugins: [], settings: {}
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
    const [customersResult, stockResult] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('stock').select('*')
    ]);
    const { data: customersData, error: customersError } = customersResult;
    const { data: stockData, error: stockError } = stockResult;

    if (customersError) { console.error('Müşteri Yükleme Hatası:', customersError); showToast('Müşteriler yüklenemedi!', true); }
    else { DB.customers = customersData || []; }

    if (stockError) { console.error('Stok Yükleme Hatası:', stockError); showToast('Stoklar yüklenemedi!', true); }
    else { DB.stock = stockData || []; }

    loadLegacyData();
    showToast('Veriler yüklendi!');
}

function loadLegacyData() { /* ... Bu fonksiyonun içeriği aynı kalacak ... */ }
function saveLegacyDB() { /* ... Bu fonksiyonun içeriği aynı kalacak ... */ }

// --- PLUGIN SYSTEM & HELPERS ---
const PluginHost = { /* ... Bu bölümün içeriği aynı kalacak ... */ };
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substring(2); }
function generateServiceNumber() { /* ... Bu fonksiyonun içeriği aynı kalacak ... */ }
function showToast(message, isError = false) { /* ... Bu fonksiyonun içeriği aynı kalacak ... */ }

// --- ROUTING ---
function navigate(path) { /* ... Bu fonksiyonun içeriği aynı kalacak ... */ }

// --- MODALS ---
function openModal(id) { /* ... Bu fonksiyonun içeriği aynı kalacak ... */ }
function closeModal(id) { /* ... Bu fonksiyonun içeriği aynı kalacak ... */ }
function createModal(id, title, contentHtml, onSave, large = false, saveText = 'Kaydet') { /* ... Bu fonksiyonun içeriği aynı kalacak ... */ }
function showConfirmModal(title, message, onConfirm) { /* ... Bu fonksiyonun içeriği aynı kalacak ... */ }

// --- SAYFA RENDER FONKSİYONLARI ---

// Müşteriler (Customers) - SUPABASE'E UYARLANDI
async function renderCustomers(searchTerm = '') { /* ... Bu bölümün içeriği aynı kalacak ... */ }
async function showCustomerModal(customerId = null) { /* ... Bu bölümün içeriği aynı kalacak ... */ }
async function deleteCustomer(customerId) { /* ... Bu bölümün içeriği aynı kalacak ... */ }
async function showMotorcycleModal(customerId) { /* ... Bu bölümün içeriği aynı kalacak ... */ }
function showCustomerHistory(customerId) { /* ... Bu bölümün içeriği aynı kalacak ... */ }

// Stok Yönetimi (Stock) - YENİ & SUPABASE'E UYARLANDI
function renderStock(filters = {}) {
    let filteredStock = [...DB.stock];
    if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        filteredStock = filteredStock.filter(item => item.name.toLowerCase().includes(term) || item.stockCode.toLowerCase().includes(term) || (item.supplierCode && item.supplierCode.toLowerCase().includes(term)));
    }
    // Diğer filtrelemeler (kategori, tedarikçi vb.) aynı kalabilir.
    
    content.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Stok Yönetimi</h1>
            <button id="addStockBtn" class="bg-orange-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-700 flex items-center"><i class="fas fa-plus mr-2"></i> Yeni Ürün Ekle</button>
        </div>
        <!-- Filtreleme HTML'i buraya gelecek (eski koddan alınabilir) -->
        <div class="bg-white rounded-lg shadow-md overflow-x-auto">
            <table class="w-full">
                <thead class="bg-gray-100"><tr><th class="p-4 text-left">Parça Adı</th><th class="p-4 text-left">Stok Kodu</th><th class="p-4 text-left">Miktar</th><th class="p-4 text-left">Satış Fiyatı</th><th class="p-4 text-left min-w-[150px]">İşlemler</th></tr></thead>
                <tbody>
                    ${filteredStock.length > 0 ? filteredStock.map(item => `
                        <tr class="border-b hover:bg-gray-50" data-id="${item.id}">
                            <td class="p-4 font-semibold">${item.name}</td><td class="p-4">${item.stockCode}</td>
                            <td class="p-4 font-bold ${item.quantity <= (item.criticalStock || 5) ? 'text-red-600' : ''}">${item.quantity}</td>
                            <td class="p-4">${parseFloat(item.salePrice || 0).toFixed(2)} ₺</td>
                            <td class="p-4">
                                <button class="edit-stock-btn text-orange-600 hover:text-orange-800 mr-3" title="Düzenle"><i class="fas fa-edit"></i></button>
                                <button class="delete-stock-btn text-red-600 hover:text-red-800" title="Sil"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>`).join('') : `<tr><td colspan="5" class="text-center p-8 text-gray-500">Stok ürünü bulunamadı.</td></tr>`}
                </tbody>
            </table>
        </div>`;

    document.getElementById('addStockBtn').onclick = () => showStockModal();
    document.querySelectorAll('.edit-stock-btn').forEach(btn => btn.onclick = e => showStockModal(e.currentTarget.closest('tr').dataset.id));
    document.querySelectorAll('.delete-stock-btn').forEach(btn => btn.onclick = e => deleteStockItem(e.currentTarget.closest('tr').dataset.id));
}

async function showStockModal(itemId = null) {
    const item = itemId ? DB.stock.find(i => i.id === itemId) : null;
    const title = item ? 'Ürün Düzenle' : 'Yeni Ürün Ekle';
    const modalContent = `
        <form id="stockForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="block font-bold">Parça Adı:</label><input type="text" id="itemName" class="w-full p-2 border rounded" required value="${item ? item.name : ''}"></div>
                <div><label class="block font-bold">Stok Kodu:</label><input type="text" id="itemStockCode" class="w-full p-2 border rounded" required value="${item ? item.stockCode : ''}"></div>
                <div><label class="block font-bold">Miktar:</label><input type="number" id="itemQuantity" class="w-full p-2 border rounded" required min="0" value="${item ? item.quantity : '0'}"></div>
                <div><label class="block font-bold">Satış Fiyatı (₺):</label><input type="number" id="itemSalePrice" class="w-full p-2 border rounded" required min="0" step="0.01" value="${item ? (item.salePrice || '') : ''}"></div>
                <!-- Diğer tüm input alanları buraya eklenebilir -->
            </div>
        </form>`;

    createModal('stockModal', title, modalContent, async (modalId) => {
        const form = document.getElementById('stockForm');
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const stockData = {
            name: form.itemName.value,
            stockCode: form.itemStockCode.value,
            quantity: parseInt(form.itemQuantity.value),
            salePrice: parseFloat(form.itemSalePrice.value),
            // Diğer alanlar da buradan alınacak
        };
        let error;
        if (item) {
            const { error: updateError } = await supabase.from('stock').update(stockData).eq('id', itemId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('stock').insert([stockData]);
            error = insertError;
        }
        if (error) { showToast('Hata: ' + error.message, true); }
        else { showToast('Stok ürünü kaydedildi!'); closeModal(modalId); await loadAllDataFromSupabase(); renderStock(); }
    }, true);
}

async function deleteStockItem(itemId) {
    showConfirmModal('Ürünü Sil', 'Bu ürünü stoktan silmek istediğinize emin misiniz?', async () => {
        const { error } = await supabase.from('stock').delete().eq('id', itemId);
        if (error) { showToast('Hata: ' + error.message, true); }
        else { showToast('Ürün silindi.', true); await loadAllDataFromSupabase(); renderStock(); }
    });
}

// --- ESKİ (LEGACY) FONKSİYONLAR ---
function renderDashboard() { /* ... Eski kod ... */ }
function renderPOS(lastSaleId = null) { /* ... Eski kod ... */ }
function renderInventoryCount() { /* ... Eski kod ... */ }
function renderServices(searchTerm = '') { /* ... Eski kod ... */ }
function renderOrders(searchTerm = '') { /* ... Eski kod ... */ }
function renderReports() { /* ... Eski kod ... */ }
function renderPlugins() { /* ... Eski kod ... */ }
function renderSettings() { /* ... Eski kod ... */ }
function loadPlugins() { /* ... Eski kod ... */ }

// --- UYGULAMAYI BAŞLAT ---
handleAuthStateChange();
supabase.auth.onAuthStateChange((_event, session) => { handleAuthStateChange(); });
