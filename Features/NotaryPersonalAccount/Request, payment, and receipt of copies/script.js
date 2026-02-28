// Функция работы с "базой данных" в браузере
const getDB = () => JSON.parse(localStorage.getItem('notaryRequests')) || [];
const saveDB = (db) => localStorage.setItem('notaryRequests', JSON.stringify(db));

document.addEventListener('DOMContentLoaded', () => {
    const requestForm = document.getElementById('requestForm');
    const myRequestsList = document.getElementById('myRequestsList');
    const notaryInbox = document.getElementById('notaryInbox');

    // --- ЛОГИКА ЗАЯВИТЕЛЯ ---
    if (requestForm) {
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('fileInput');
        const fileNameDisplay = document.getElementById('fileNameDisplay');
        const docType = document.getElementById('docType');
        const totalPrice = document.getElementById('totalPrice');

        // Выбор файлов
        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            const names = Array.from(fileInput.files).map(f => f.name).join(', ');
            fileNameDisplay.innerText = names ? "Выбрано: " + names : "";
        });

        // Расчет цены
        docType.addEventListener('change', () => {
            totalPrice.innerText = docType.value + " ₽";
        });

        // Отправка формы
        requestForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const db = getDB();
            const newRequest = {
                id: Date.now(),
                author: document.getElementById('userName').value,
                type: docType.options[docType.selectedIndex].text,
                date: new Date().toLocaleDateString(),
                status: 'new',
                statusText: 'Новый'
            };
            db.unshift(newRequest);
            saveDB(db);
            
            requestForm.reset();
            fileNameDisplay.innerText = "";
            totalPrice.innerText = "500 ₽";
            renderApplicant();
            alert('Запрос отправлен нотариусу!');
        });

        renderApplicant();
    }

    // --- ЛОГИКА НОТАРИУСА ---
    if (notaryInbox) {
        renderNotary();
        // Обновляем список каждые 3 секунды, если открыты две вкладки
        setInterval(renderNotary, 3000);
    }
});

// Рендер списка для Заявителя
function renderApplicant() {
    const list = document.getElementById('myRequestsList');
    if (!list) return;
    const db = getDB();
    list.innerHTML = db.map(req => `
        <div class="request-item">
            <div class="req-info">
                <strong>${req.type}</strong><br><small>${req.date}</small>
            </div>
            <div class="req-status">
                <span class="status-badge status-${req.status}">${req.statusText}</span>
            </div>
            <div class="req-action">
                ${req.status === 'pay' ? `<button class="btn btn-accent" onclick="payRequest(${req.id})">Оплатить</button>` : ''}
                ${req.status === 'ready' ? `<button class="btn btn-success" onclick="alert('Скачивание...')">Скачать</button>` : ''}
            </div>
        </div>
    `).join('');
}

// Рендер списка для Нотариуса
function renderNotary() {
    const inbox = document.getElementById('notaryInbox');
    if (!inbox) return;
    const db = getDB();
    if (db.length === 0) { inbox.innerHTML = "Запросов пока нет"; return; }
    
    inbox.innerHTML = db.map(req => `
        <div class="request-item">
            <div class="req-info">
                <strong>${req.author}</strong><br><small>${req.type}</small>
            </div>
            <div class="req-status">
                <span class="status-badge status-${req.status}">${req.statusText}</span>
            </div>
            <div class="req-action">
                ${req.status === 'new' ? `<button class="btn btn-primary" onclick="approveRequest(${req.id})">Счет</button>` : 'Обработано'}
            </div>
        </div>
    `).join('');
}

// Глобальные функции (для onclick)
window.approveRequest = (id) => {
    let db = getDB();
    const req = db.find(r => r.id === id);
    if (req) {
        req.status = 'pay';
        req.statusText = 'Ждет оплаты';
        saveDB(db);
        renderNotary();
    }
};

window.payRequest = (id) => {
    let db = getDB();
    const req = db.find(r => r.id === id);
    if (req && confirm('Подтвердить оплату?')) {
        req.status = 'ready';
        req.statusText = 'Готово';
        saveDB(db);
        renderApplicant();
    }
};