// auth.js
import { supabase } from './config.js';

/**
 * Giriş ekranını render eder ve form olaylarını yönetir.
 * @param {HTMLElement} authScreen - Kimlik doğrulama ekranının DOM elementi.
 */
export function renderLoginScreen(authScreen) {
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
        e.preventDefault();
        messageDiv.textContent = 'Giriş yapılıyor...';
        const { error } = await supabase.auth.signInWithPassword({ email: emailInput.value, password: passwordInput.value });
        if (error) messageDiv.textContent = 'Hata: ' + error.message;
        else messageDiv.textContent = '';
    });

    document.getElementById('signup-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        messageDiv.textContent = 'Kayıt oluşturuluyor...';
        const { error } = await supabase.auth.signUp({ email: emailInput.value, password: passwordInput.value });
        if (error) messageDiv.textContent = 'Hata: ' + error.message;
        else { messageDiv.textContent = 'Kayıt başarılı! Email adresinize gelen doğrulama linkine tıklayın.'; }
    });
}
