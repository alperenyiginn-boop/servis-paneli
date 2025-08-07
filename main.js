// main.js - Uygulamanın Ana Giriş Noktası

import { supabase } from './config.js';
import { renderLoginScreen } from './auth.js';
import { loadAllDataFromSupabase } from './api.js';
import { showToast, createModal, showConfirmModal } from './ui.js';
import * as views from './views.js'; // Tüm render fonksiyonlarını import et

// --- GLOBAL DEĞİŞKENLER ---
const app = document.getElementById('app');
const authScreen = document.getElementById('auth-screen');
const content = document.getElementById('content');

// Global state (veritabanı) nesnesi
let DB = {
    customers: [], stock: [], services: [], orders: [], plugins: [], 
    settings: { technicians: [], motorcycle_data: [], order_statuses: [] }
};

// --- Eklenti Sistemi (Basit) ---
const PluginHost = {
    hooks: {},
    register(hookName, callback) { if (!this.hooks[hookName]) { this.hooks[hookName] = []; } this.hooks[hookName].push(callback); },
    trigger(hookName, ...args) { if (this.hooks[hookName]) { this.hooks[hookName].forEach(callback => { try { callback(...args); } catch (e) { console.error(e); } }); } },
    applyFilters(filterName, value, ...args) { let f = value; if (this.hooks[filterName]) { this.hooks[filterName].forEach(c => { try { f = c(f, ...args); } catch (e) { console.error(e); } }); } return f; }
};

function loadLegacyData() {
    const data = localStorage.getItem('motorcycleServiceDB');
    if (data) {
        const savedDB = JSON.parse(data);
        DB.plugins = savedDB.plugins || [];
    }
}

function loadPlugins() {
    (DB.plugins || []).forEach(plugin => {
        if (plugin.enabled && plugin.code) {
            try {
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

// --- YÖNLENDİRME (ROUTING) ---
function navigate(path) {
    // Önceki sayfanın grafiklerini temizle
    // Not: Chart.js nesnelerini global bir yerde saklamak gerekir. Şimdilik bu kısmı basitleştiriyoruz.
    
    const cleanPath = path.startsWith('#') ? path.substring(1) : path;
    window.location.hash = cleanPath;

    document.querySelectorAll('.nav-link').forEach(l => {
        const p = (l.getAttribute('href') || '').replace('#', '');
        l.classList.toggle('bg-slate-700', p === cleanPath.split('/')[0]);
        l.classList.toggle('text-orange-400', p === cleanPath.split('/')[0]);
    });

    const routes = {
        dashboard: views.renderDashboard,
        customers: views.renderCustomers,
        // Diğer view'lar buraya eklenecek
        // stock: views.renderStock,
        // services: views.renderServices,
        // orders: views.renderOrders,
        // settings: views.renderSettings,
        // reports: views.renderReports,
        // plugins: views.renderPlugins,
        // 'inventory-count': views.renderInventoryCount,
    };

    const pageKey = cleanPath.split('/')[0];
    const renderFunction = routes[pageKey] || views.renderDashboard;
    
    content.innerHTML = '';
    // Render fonksiyonunu DB ve content elementi ile çağır
    renderFunction(DB, content);
}

// --- UYGULAMA BAŞLANGICI ---
async function startApp() {
    await loadAllDataFromSupabase(DB);
    loadLegacyData();
    loadPlugins();
    
    // Eklentiler için başlangıç hook'u
    PluginHost.trigger('app_init', { navigate, DB, showToast, createModal, showConfirmModal });
    
    // Mevcut hash'e göre sayfayı yükle
    const path = window.location.hash.replace('#', '') || 'dashboard';
    navigate(path);

    // Hash değişikliklerini dinle
    window.addEventListener('hashchange', () => {
        const newPath = window.location.hash.replace('#', '') || 'dashboard';
        navigate(newPath);
    });
}

// --- KİMLİK DOĞRULAMA YÖNETİMİ ---
async function handleAuthStateChange() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        // Kullanıcı giriş yapmış
        authScreen.classList.add('hidden');
        app.classList.remove('hidden');
        app.classList.add('flex');
        const userInfoDiv = document.getElementById('user-info');
        if (userInfoDiv) {
            userInfoDiv.innerHTML = `<p>${session.user.email}</p>`;
        }
        document.getElementById('logoutBtn').onclick = async () => {
            await supabase.auth.signOut();
            location.reload(); // Sayfayı yeniden yükleyerek state'i temizle
        };
        await startApp();
    } else {
        // Kullanıcı giriş yapmamış
        app.classList.add('hidden');
        app.classList.remove('flex');
        authScreen.classList.remove('hidden');
        renderLoginScreen(authScreen);
    }
}

// Uygulamayı ilk yüklemede ve auth state değiştiğinde çalıştır
handleAuthStateChange();
supabase.auth.onAuthStateChange((_event, session) => {
    handleAuthStateChange();
});
