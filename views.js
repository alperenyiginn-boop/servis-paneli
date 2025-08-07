// views.js
import { supabase } from './config.js';
import { showToast, createModal, showConfirmModal } from './ui.js';
import { loadAllDataFromSupabase, generateId, generateServiceNumber } from './api.js';

// Bu dosya, her sayfanın HTML içeriğini oluşturan render fonksiyonlarını içerir.

// --- Müşteriler (Customers) ---
export function renderCustomers(DB, content) {
    function render(searchTerm = '') {
        const filteredCustomers = (DB.customers || []).filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone && c.phone.includes(searchTerm)));
        content.innerHTML = `<div class="flex justify-between items-center mb-6"><h1 class="text-3xl font-bold">Müşteriler</h1><button id="addCustomerBtn" class="bg-orange-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-700 flex items-center"><i class="fas fa-plus mr-2"></i> Yeni Müşteri Ekle</button></div><input type="text" id="customerSearch" placeholder="Müşteri adı veya telefon ile ara..." class="w-full p-3 border rounded-lg mb-4" value="${searchTerm}"><div class="bg-white rounded-lg shadow-md overflow-x-auto"><table class="w-full"><thead class="bg-gray-100"><tr><th class="p-4 text-left">Ad Soyad</th><th class="p-4 text-left">Telefon</th><th class="p-4 text-left">Motosikletler</th><th class="p-4 text-left min-w-[150px]">İşlemler</th></tr></thead><tbody>${filteredCustomers.length > 0 ? filteredCustomers.map(c => `<tr class="border-b hover:bg-gray-50" data-id="${c.id}"><td class="p-4">${c.name}</td><td class="p-4">${c.phone || '-'}</td><td class="p-4">${(c.motorcycles || []).map(m => `<div class="mb-1"><span class="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">${m.plate}</span></div>`).join('') || '-'}</td><td class="p-4"><button class="view-customer-history-btn text-green-600 hover:text-green-800 mr-3" title="Geçmiş"><i class="fas fa-history"></i></button><button class="edit-customer-btn text-orange-600 hover:text-orange-800 mr-3" title="Düzenle"><i class="fas fa-edit"></i></button><button class="add-motorcycle-btn text-purple-600 hover:text-purple-800 mr-3" title="Motor Ekle"><i class="fas fa-motorcycle"></i></button><button class="delete-customer-btn text-red-600 hover:text-red-800" title="Sil"><i class="fas fa-trash"></i></button></td></tr>`).join('') : `<tr><td colspan="4" class="text-center p-8 text-gray-500">Müşteri bulunamadı.</td></tr>`}</tbody></table></div>`;
        document.getElementById('customerSearch').addEventListener('input', (e) => render(e.target.value));
        document.getElementById('addCustomerBtn').onclick = () => showCustomerModal();
        content.querySelectorAll('.edit-customer-btn').forEach(btn => btn.onclick = (e) => showCustomerModal(e.currentTarget.closest('tr').dataset.id));
        content.querySelectorAll('.delete-customer-btn').forEach(btn => btn.onclick = (e) => deleteCustomer(e.currentTarget.closest('tr').dataset.id));
        content.querySelectorAll('.add-motorcycle-btn').forEach(btn => btn.onclick = (e) => showMotorcycleModal(e.currentTarget.closest('tr').dataset.id));
        content.querySelectorAll('.view-customer-history-btn').forEach(btn => btn.onclick = (e) => showCustomerHistory(e.currentTarget.closest('tr').dataset.id));
    }
    render();
}

async function showCustomerModal(customerId = null) {
    // Bu fonksiyon renderCustomers içinde çağrıldığı için DB ve content'e erişimi var.
    const customer = customerId ? DB.customers.find(c => c.id.toString() === customerId) : null;
    const title = customer ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle';
    const modalContent = `<form id="customerForm" class="space-y-4"><div><label for="customerName" class="block font-bold">Ad Soyad:</label><input type="text" id="customerName" class="w-full p-2 border rounded" required value="${customer ? customer.name : ''}"></div><div><label for="customerPhone" class="block font-bold">Telefon:</label><input type="tel" id="customerPhone" class="w-full p-2 border rounded" value="${customer ? customer.phone : ''}"></div><div><label for="customerAddress" class="block font-bold">Adres:</label><textarea id="customerAddress" class="w-full p-2 border rounded">${customer ? (customer.address || '') : ''}</textarea></div></form>`;
    createModal('customerModal', title, modalContent, async (modalId) => {
        const form = document.getElementById('customerForm'); if (!form.checkValidity()) { form.reportValidity(); return; }
        const customerData = { name: form.customerName.value, phone: form.customerPhone.value, address: form.customerAddress.value };
        let error;
        if (customer) { const { error: updateError } = await supabase.from('customers').update(customerData).eq('id', customerId); error = updateError; }
        else { const { error: insertError } = await supabase.from('customers').insert([{ ...customerData, motorcycles: [] }]); error = insertError; }
        if (error) { showToast('Hata: ' + error.message, true); } else { showToast('Müşteri kaydedildi!'); document.getElementById(modalId)?.querySelector('.close-modal-btn').click(); await loadAllDataFromSupabase(DB); renderCustomers(DB, document.getElementById('content')); }
    });
}

async function deleteCustomer(customerId) {
    showConfirmModal('Müşteriyi Sil', 'Bu müşteriyi silmek istediğinize emin misiniz?', async () => {
        const { error } = await supabase.from('customers').delete().eq('id', customerId);
        if (error) { showToast('Hata: ' + error.message, true); } else { showToast('Müşteri silindi.', true); await loadAllDataFromSupabase(DB); renderCustomers(DB, document.getElementById('content')); }
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
            <div><label class="block font-bold">Plaka:</label><input type="text" id="motorcyclePlate" class="w-full p-2 border rounded" required></div>
            <div><label class="block font-bold">Şasi No:</label><input type="text" id="motorcycleChassis" class="w-full p-2 border rounded"></div>
            <div><label class="block font-bold">Marka / Model:</label><input type="text" id="motorcycleModel" class="w-full p-2 border rounded" list="motorcycle-models-list"><datalist id="motorcycle-models-list">${(DB.settings.motorcycle_data || []).map(m => `<option value="${m}"></option>`).join('')}</datalist></div>
        </form>`;
    createModal('motorcycleModal', title, modalContent, async (modalId) => {
        const form = document.getElementById('motorcycleForm'); if (!form.checkValidity()) { form.reportValidity(); return; }
        const newMotorcycle = { id: generateId(), plate: form.motorcyclePlate.value.toUpperCase(), chassis: form.motorcycleChassis.value, model: form.motorcycleModel.value };
        const updatedMotorcycles = [...(customer.motorcycles || []), newMotorcycle];
        const { error } = await supabase.from('customers').update({ motorcycles: updatedMotorcycles }).eq('id', customerId);
        if (error) { showToast('Hata: ' + error.message, true); } else { showToast('Motosiklet eklendi!'); document.getElementById(modalId)?.querySelector('.close-modal-btn').click(); await loadAllDataFromSupabase(DB); renderCustomers(DB, document.getElementById('content')); }
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


// --- Diğer Render Fonksiyonları (Stok, Servis, vb.) buraya eklenebilir ---
// Örnek:
export function renderDashboard(DB, content) {
    const openServices = DB.services.filter(s => s.status === 'İşlemde' || s.status === 'Yeni').length;
    const completedToday = DB.services.filter(s => s.status === 'Tamamlandı' && new Date(s.updated_at).toDateString() === new Date().toDateString()).length;
    const lowStockItems = DB.stock.filter(i => i.quantity <= (i.criticalStock || 5)).length;
    const totalCustomers = DB.customers.length;

    content.innerHTML = `
        <h1 class="text-3xl font-bold mb-6">Gösterge Paneli</h1>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div class="bg-white p-6 rounded-lg shadow-md flex items-center"><i class="fas fa-tools text-4xl text-blue-500 mr-4"></i><div><p class="text-gray-500">Açık Servisler</p><p class="text-3xl font-bold">${openServices}</p></div></div>
            <div class="bg-white p-6 rounded-lg shadow-md flex items-center"><i class="fas fa-check-circle text-4xl text-green-500 mr-4"></i><div><p class="text-gray-500">Bugün Tamamlanan</p><p class="text-3xl font-bold">${completedToday}</p></div></div>
            <div class="bg-white p-6 rounded-lg shadow-md flex items-center"><i class="fas fa-exclamation-triangle text-4xl text-red-500 mr-4"></i><div><p class="text-gray-500">Kritik Stok</p><p class="text-3xl font-bold">${lowStockItems}</p></div></div>
            <div class="bg-white p-6 rounded-lg shadow-md flex items-center"><i class="fas fa-users text-4xl text-purple-500 mr-4"></i><div><p class="text-gray-500">Toplam Müşteri</p><p class="text-3xl font-bold">${totalCustomers}</p></div></div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div class="bg-white p-6 rounded-lg shadow-md"><h2 class="text-xl font-bold mb-4">Servis Durumları</h2><canvas id="serviceStatusChart"></canvas></div>
            <div class="bg-white p-6 rounded-lg shadow-md"><h2 class="text-xl font-bold mb-4">Son 5 Servis Kaydı</h2><ul>${[...DB.services].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5).map(s => { const customer = DB.customers.find(c => c.id === s.customer_id); return `<li class="border-b py-2 flex justify-between"><span>${s.service_number} - ${customer?.name || ''}</span><span class="font-semibold">${s.status}</span></li>` }).join('')}</ul></div>
        </div>
    `;

    const statusCounts = DB.services.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
    }, {});

    const ctx = document.getElementById('serviceStatusChart').getContext('2d');
    new Chart(ctx, {
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

// ... Kalan render fonksiyonları (renderStock, renderServices, etc.) buraya aynı mantıkla eklenebilir.
// Şimdilik bu kadarını ekleyerek modüler yapıyı gösteriyorum.
