// ui.js

const modalContainer = document.getElementById('modal-container');
const toast = document.getElementById('toast');

/**
 * Ekranda bilgilendirme mesajı gösterir.
 * @param {string} message Gösterilecek mesaj.
 * @param {boolean} isError Hata mesajı mı?
 */
export function showToast(message, isError = false) {
    toast.textContent = message;
    toast.className = `fixed bottom-5 right-5 text-white py-2 px-4 rounded-lg shadow-lg transition-all duration-300 ease-out z-50 transform ${isError ? 'bg-red-500' : 'bg-green-500'}`;
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-20', 'opacity-0');
    });
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

function openModal(id) {
    document.getElementById(id)?.classList.add('active');
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
}

/**
 * Dinamik bir modal (pencere) oluşturur ve gösterir.
 * @param {string} id Modal için benzersiz ID.
 * @param {string} title Modal başlığı.
 * @param {string} contentHtml Modal içeriği (HTML formatında).
 * @param {Function | null} onSave Kaydet butonuna basıldığında çalışacak fonksiyon.
 * @param {boolean} large Büyük modal mı?
 * @param {string} saveText Kaydet butonu metni.
 */
export function createModal(id, title, contentHtml, onSave, large = false, saveText = 'Kaydet') {
    const modalSize = large ? 'max-w-6xl' : 'max-w-2xl';
    modalContainer.innerHTML = `
        <div id="${id}" class="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white rounded-lg shadow-2xl w-full ${modalSize} flex flex-col max-h-[90vh]">
                <div class="flex justify-between items-center p-5 border-b">
                    <h3 class="text-2xl font-bold">${title}</h3>
                    <button class="close-modal-btn text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                <div class="p-6 overflow-y-auto">${contentHtml}</div>
                <div class="flex justify-end p-5 border-t bg-gray-50 rounded-b-lg mt-auto">
                    <button class="close-modal-btn bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded-lg mr-3">İptal</button>
                    <button class="save-modal-btn bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-6 rounded-lg">${saveText}</button>
                </div>
            </div>
        </div>`;
    const modal = document.getElementById(id);
    const saveButton = modal.querySelector('.save-modal-btn');
    if (onSave) {
        saveButton.onclick = () => onSave(id);
    } else {
        saveButton.style.display = 'none';
    }
    modal.querySelectorAll('.close-modal-btn').forEach(btn => btn.onclick = () => closeModal(id));
    openModal(id);
}

/**
 * Bir işlemi onaylamak için bir onay penceresi gösterir.
 * @param {string} title Onay penceresi başlığı.
 * @param {string} message Onay mesajı.
 * @param {Function} onConfirm Onaylandığında çalışacak fonksiyon.
 */
export function showConfirmModal(title, message, onConfirm) {
    const modalId = 'confirmModal';
    modalContainer.innerHTML = `
        <div id="${modalId}" class="modal active fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div class="bg-white rounded-lg shadow-2xl w-full max-w-sm flex flex-col">
                <div class="p-6 text-center">
                    <i class="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
                    <h3 class="text-xl font-bold mb-2">${title}</h3>
                    <div>${message}</div>
                </div>
                <div class="flex justify-center p-4 border-t bg-gray-50 rounded-b-lg">
                    <button id="confirmCancel" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded-lg mr-3">İptal</button>
                    <button id="confirmOk" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">Onayla</button>
                </div>
            </div>
        </div>`;
    document.getElementById('confirmOk').onclick = () => {
        onConfirm();
        closeModal(modalId);
    };
    document.getElementById('confirmCancel').onclick = () => closeModal(modalId);
}
