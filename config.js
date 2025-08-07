// config.js

// Supabase Client kütüphanesini import et
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- SUPABASE BAĞLANTISI ---
// BURAYA KENDİ SUPABASE BİLGİLERİNİZİ GİRİN!
const SUPABASE_URL = 'https://PROJE_ADINIZ.supabase.co'; // Supabase'den aldığınız URL
const SUPABASE_ANON_KEY = 'SUPABASE_ANON_KEY_BURAYA'; // Supabase'den aldığınız anon key

// Supabase client'ını oluştur ve dışa aktar
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
