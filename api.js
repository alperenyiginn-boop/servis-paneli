// api.js
import { supabase } from './config.js';
import { showToast } from './ui.js';

/**
 * Supabase'den tüm uygulama verilerini yükler ve global DB nesnesine atar.
 * @param {object} DB - Verilerin saklanacağı global nesne.
 */
export async function loadAllDataFromSupabase(DB) {
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
    if (!Array.isArray(DB.settings.order_statuses)) {
        DB.settings.order_statuses = ['Sipariş Verildi', 'Teslim Alındı', 'İptal Edildi'];
    }

    document.getElementById('sidebar-company-name').textContent = DB.settings.company_name || 'Servis Paneli';
    showToast('Veriler yüklendi!');
}

/**
 * Benzersiz bir ID oluşturur.
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Veritabanından artan bir servis numarası alır.
 * @param {object} DB - Global veritabanı nesnesi.
 */
export async function generateServiceNumber(DB) {
    const { data, error } = await supabase.rpc('increment_service_number', { row_id: 1, increment_by: 1 });
    if (error) {
        console.error('Servis numarası alınamadı:', error);
        return "HATA-000";
    }
    const prefix = DB.settings.service_prefix || 'SRV';
    return `${prefix}-${data.toString().padStart(4, '0')}`;
}
