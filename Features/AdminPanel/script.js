// ========== ДАННЫЕ ==========

// Функция для генерации UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Получение полного имени пользователя
function getFullName(user) {
    return `${user.lastName} ${user.firstName} ${user.middleName}`;
}

// Инициализация тестовых данных
function initializeData() {
    // Миграция: если данные в старом формате (fullName), сбрасываем
    const existing = localStorage.getItem('users');
    if (existing) {
        const parsed = JSON.parse(existing);
        if (parsed.length > 0 && parsed[0].fullName !== undefined) {
            localStorage.removeItem('users');
        }
    }

    if (!localStorage.getItem('users')) {
        const testUsers = [
            {
                id: generateUUID(),
                firstName: 'Иван',
                lastName: 'Иванов',
                middleName: 'Иванович',
                email: 'ivanov@example.com',
                phoneNumber: '+7 (999) 123-45-67',
                role: 'Applicant',
                subscriptionPlan: 'Basic',
                isActive: true,
                createdAt: '2024-01-15T10:30:00',
                updatedAt: '2024-01-15T10:30:00'
            },
            {
                id: generateUUID(),
                firstName: 'Мария',
                lastName: 'Петрова',
                middleName: 'Сергеевна',
                email: 'petrova@example.com',
                phoneNumber: '+7 (999) 234-56-78',
                role: 'Notary',
                subscriptionPlan: 'Premium',
                isActive: true,
                createdAt: '2024-01-20T14:20:00',
                updatedAt: '2024-02-01T09:15:00'
            },
            {
                id: generateUUID(),
                firstName: 'Алексей',
                lastName: 'Сидоров',
                middleName: 'Петрович',
                email: 'sidorov@example.com',
                phoneNumber: '+7 (999) 345-67-89',
                role: 'Admin',
                subscriptionPlan: 'Enterprise',
                isActive: true,
                createdAt: '2024-02-01T11:45:00',
                updatedAt: '2024-02-01T11:45:00'
            },
            {
                id: generateUUID(),
                firstName: 'Елена',
                lastName: 'Козлова',
                middleName: 'Викторовна',
                email: 'kozlova@example.com',
                phoneNumber: '+7 (999) 456-78-90',
                role: 'Applicant',
                subscriptionPlan: 'Basic',
                isActive: false,
                createdAt: '2024-02-05T16:00:00',
                updatedAt: '2024-02-10T12:30:00'
            },
            {
                id: generateUUID(),
                firstName: 'Дмитрий',
                lastName: 'Новиков',
                middleName: 'Александрович',
                email: 'novikov@example.com',
                phoneNumber: '+7 (999) 567-89-01',
                role: 'Notary',
                subscriptionPlan: 'Premium',
                isActive: true,
                createdAt: '2024-02-08T09:15:00',
                updatedAt: '2024-02-08T09:15:00'
            },
            {
                id: generateUUID(),
                firstName: 'Ольга',
                lastName: 'Васильева',
                middleName: 'Михайловна',
                email: 'vasilieva@example.com',
                phoneNumber: '+7 (999) 678-90-12',
                role: 'Applicant',
                subscriptionPlan: 'Enterprise',
                isActive: true,
                createdAt: '2024-02-12T13:45:00',
                updatedAt: '2024-02-12T13:45:00'
            },
            {
                id: generateUUID(),
                firstName: 'Сергей',
                lastName: 'Морозов',
                middleName: 'Владимирович',
                email: 'morozov@example.com',
                phoneNumber: '+7 (999) 789-01-23',
                role: 'Notary',
                subscriptionPlan: 'Basic',
                isActive: false,
                createdAt: '2024-02-15T10:00:00',
                updatedAt: '2024-02-20T15:20:00'
            }
        ];
        localStorage.setItem('users', JSON.stringify(testUsers));
    }
}

// Получение всех пользователей
function getUsers() {
    const users = localStorage.getItem('users');
    return users ? JSON.parse(users) : [];
}

// Сохранение пользователей
function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

// ========== ПЕРЕМЕННЫЕ СОСТОЯНИЯ ==========

let currentPage = 1;
const usersPerPage = 10;
let currentUserId = null;
let userToDelete = null;

// ========== ОТОБРАЖЕНИЕ ДАННЫХ ==========

// Форматирование даты
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Получение русского названия роли
function getRoleLabel(role) {
    const roles = {
        'Applicant': 'Заявитель',
        'Notary': 'Нотариус',
        'Admin': 'Администратор'
    };
    return roles[role] || role;
}

// Получение класса badge для роли
function getRoleBadgeClass(role) {
    const classes = {
        'Applicant': 'badge-primary',
        'Notary': 'badge-warning',
        'Admin': 'badge-info'
    };
    return classes[role] || 'badge-primary';
}

// Отображение таблицы пользователей
function renderUsers(users = null) {
    if (users === null) {
        users = getFilteredUsers();
    }

    const tbody = document.getElementById('usersTableBody');

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>Пользователи не найдены</p>
                    </div>
                </td>
            </tr>
        `;
        renderPagination(0);
        return;
    }

    // Пагинация
    const startIndex = (currentPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const paginatedUsers = users.slice(startIndex, endIndex);

    tbody.innerHTML = paginatedUsers.map(user => `
        <tr>
            <td>${getFullName(user)}</td>
            <td>${user.email}</td>
            <td>${user.phoneNumber}</td>
            <td><span class="badge ${getRoleBadgeClass(user.role)}">${getRoleLabel(user.role)}</span></td>
            <td><span class="badge ${user.isActive ? 'badge-success' : 'badge-danger'}">${user.isActive ? 'Активен' : 'Заблокирован'}</span></td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
                <div class="actions">
                    <button class="icon-btn icon-btn-view" onclick="viewUser('${user.id}')" title="Просмотр">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="icon-btn icon-btn-edit" onclick="editUser('${user.id}')" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="icon-btn icon-btn-delete" onclick="deleteUser('${user.id}')" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    renderPagination(users.length);
}

// Отображение пагинации
function renderPagination(totalUsers) {
    const totalPages = Math.ceil(totalUsers / usersPerPage);
    const pagination = document.getElementById('pagination');

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = `
        <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button class="${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += '<button disabled>...</button>';
        }
    }

    html += `
        <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    pagination.innerHTML = html;
}

// Изменение страницы
function changePage(page) {
    const users = getFilteredUsers();
    const totalPages = Math.ceil(users.length / usersPerPage);

    if (page < 1 || page > totalPages) return;

    currentPage = page;
    renderUsers(users);
}

// ========== ФИЛЬТРАЦИЯ И ПОИСК ==========

// Получение отфильтрованных пользователей
function getFilteredUsers() {
    let users = getUsers();
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const roleFilter = document.getElementById('roleFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    if (searchTerm) {
        users = users.filter(user =>
            getFullName(user).toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm)
        );
    }

    if (roleFilter) {
        users = users.filter(user => user.role === roleFilter);
    }

    if (statusFilter) {
        const isActive = statusFilter === 'true';
        users = users.filter(user => user.isActive === isActive);
    }

    return users;
}

// Фильтрация пользователей
function filterUsers() {
    currentPage = 1;
    renderUsers();
}

// ========== НАВИГАЦИЯ ==========

// Показать список пользователей
function showList() {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById('listPage').classList.add('active');
}

// Показать страницу просмотра
function showView() {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById('viewPage').classList.add('active');
}

// ========== CRUD ОПЕРАЦИИ ==========

// Просмотр пользователя
function viewUser(id) {
    const users = getUsers();
    const user = users.find(u => u.id === id);

    if (!user) return;

    currentUserId = id;

    const detailsContent = document.getElementById('userDetailsContent');
    detailsContent.innerHTML = `
        <div class="detail-row">
            <div class="detail-label">ID:</div>
            <div class="detail-value">${user.id}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Фамилия:</div>
            <div class="detail-value">${user.lastName}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Имя:</div>
            <div class="detail-value">${user.firstName}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Отчество:</div>
            <div class="detail-value">${user.middleName}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Подписка:</div>
            <div class="detail-value">${user.subscriptionPlan}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Email:</div>
            <div class="detail-value">${user.email}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Телефон:</div>
            <div class="detail-value">${user.phoneNumber}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Роль:</div>
            <div class="detail-value">
                <span class="badge ${getRoleBadgeClass(user.role)}">${getRoleLabel(user.role)}</span>
            </div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Статус:</div>
            <div class="detail-value">
                <span class="badge ${user.isActive ? 'badge-success' : 'badge-danger'}">
                    ${user.isActive ? 'Активен' : 'Заблокирован'}
                </span>
            </div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Дата регистрации:</div>
            <div class="detail-value">${formatDate(user.createdAt)}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Последнее обновление:</div>
            <div class="detail-value">${formatDate(user.updatedAt)}</div>
        </div>
    `;

    showView();
}

// Показать форму создания
function showCreateForm() {
    currentUserId = null;
    document.getElementById('modalTitle').textContent = 'Добавить пользователя';
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-check"></i> Создать';
    document.getElementById('userForm').reset();
    document.getElementById('isActive').checked = true;
    document.getElementById('statusLabel').textContent = 'Активен';
    clearFormErrors();
    openModal();
}

// Редактировать пользователя
function editUser(id) {
    const users = getUsers();
    const user = users.find(u => u.id === id);

    if (!user) return;

    currentUserId = id;
    document.getElementById('modalTitle').textContent = 'Редактировать пользователя';
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Сохранить';

    // Заполнение формы
    document.getElementById('userId').value = user.id;
    document.getElementById('lastName').value = user.lastName;
    document.getElementById('firstName').value = user.firstName;
    document.getElementById('middleName').value = user.middleName;
    document.getElementById('subscriptionPlan').value = user.subscriptionPlan;
    document.getElementById('email').value = user.email;
    document.getElementById('phoneNumber').value = user.phoneNumber;
    document.getElementById('role').value = user.role;
    document.getElementById('isActive').checked = user.isActive;
    document.getElementById('statusLabel').textContent = user.isActive ? 'Активен' : 'Заблокирован';

    clearFormErrors();
    openModal();
}

// Редактировать из просмотра
function editFromView() {
    if (currentUserId) {
        editUser(currentUserId);
    }
}

// Сохранить пользователя
function saveUser(event) {
    event.preventDefault();

    // Валидация
    if (!validateForm()) {
        return;
    }

    const users = getUsers();
    const formData = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        middleName: document.getElementById('middleName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phoneNumber: document.getElementById('phoneNumber').value.trim(),
        role: document.getElementById('role').value,
        subscriptionPlan: document.getElementById('subscriptionPlan').value,
        isActive: document.getElementById('isActive').checked
    };

    if (currentUserId) {
        // Редактирование
        const index = users.findIndex(u => u.id === currentUserId);
        if (index !== -1) {
            users[index] = {
                ...users[index],
                ...formData,
                updatedAt: new Date().toISOString()
            };
        }
    } else {
        // Создание
        const newUser = {
            id: generateUUID(),
            ...formData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        users.push(newUser);
    }

    saveUsers(users);
    closeModal();
    renderUsers();
    showList();
}

// Удалить пользователя
function deleteUser(id) {
    const users = getUsers();
    const user = users.find(u => u.id === id);

    if (!user) return;

    userToDelete = id;
    document.getElementById('deleteUserName').textContent = getFullName(user);
    openDeleteModal();
}

// Удалить из просмотра
function deleteFromView() {
    if (currentUserId) {
        deleteUser(currentUserId);
    }
}

// Подтвердить удаление
function confirmDelete() {
    if (!userToDelete) return;

    let users = getUsers();
    users = users.filter(u => u.id !== userToDelete);
    saveUsers(users);

    closeDeleteModal();
    renderUsers();
    showList();

    userToDelete = null;
    currentUserId = null;
}

// ========== ВАЛИДАЦИЯ ==========

// Валидация формы
function validateForm() {
    let isValid = true;
    clearFormErrors();

    // Валидация фамилии
    const lastName = document.getElementById('lastName');
    if (!lastName.value.trim()) {
        showError('lastName', 'Поле обязательно для заполнения');
        isValid = false;
    }

    // Валидация имени
    const firstName = document.getElementById('firstName');
    if (!firstName.value.trim()) {
        showError('firstName', 'Поле обязательно для заполнения');
        isValid = false;
    }

    // Валидация отчества
    const middleName = document.getElementById('middleName');
    if (!middleName.value.trim()) {
        showError('middleName', 'Поле обязательно для заполнения');
        isValid = false;
    }

    // Валидация email
    const email = document.getElementById('email');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.value.trim()) {
        showError('email', 'Поле обязательно для заполнения');
        isValid = false;
    } else if (!emailRegex.test(email.value)) {
        showError('email', 'Введите корректный email');
        isValid = false;
    } else {
        // Проверка уникальности email
        const users = getUsers();
        const existingUser = users.find(u => u.email === email.value && u.id !== currentUserId);
        if (existingUser) {
            showError('email', 'Пользователь с таким email уже существует');
            isValid = false;
        }
    }

    // Валидация телефона
    const phoneNumber = document.getElementById('phoneNumber');
    if (!phoneNumber.value.trim()) {
        showError('phoneNumber', 'Поле обязательно для заполнения');
        isValid = false;
    }

    // Валидация роли
    const role = document.getElementById('role');
    if (!role.value) {
        showError('role', 'Выберите роль');
        isValid = false;
    }

    return isValid;
}

// Показать ошибку
function showError(fieldName, message) {
    const field = document.getElementById(fieldName);
    const error = document.getElementById(fieldName + 'Error');

    field.classList.add('error');
    error.textContent = message;
    error.classList.add('active');
}

// Очистить ошибки
function clearFormErrors() {
    document.querySelectorAll('.form-input').forEach(input => {
        input.classList.remove('error');
    });
    document.querySelectorAll('.form-error').forEach(error => {
        error.classList.remove('active');
    });
}

// ========== МОДАЛЬНЫЕ ОКНА ==========

// Открыть модальное окно
function openModal() {
    document.getElementById('userModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('userModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    clearFormErrors();
}

// Открыть модальное окно удаления
function openDeleteModal() {
    document.getElementById('deleteModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Закрыть модальное окно удаления
function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    userToDelete = null;
}

// Закрыть модальное окно при клике вне его
window.onclick = function(event) {
    const userModal = document.getElementById('userModal');
    const deleteModal = document.getElementById('deleteModal');

    if (event.target === userModal) {
        closeModal();
    }
    if (event.target === deleteModal) {
        closeDeleteModal();
    }
}

// ========== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ==========

// Переключение статуса
document.addEventListener('DOMContentLoaded', function() {
    const isActiveToggle = document.getElementById('isActive');
    const statusLabel = document.getElementById('statusLabel');

    if (isActiveToggle) {
        isActiveToggle.addEventListener('change', function() {
            statusLabel.textContent = this.checked ? 'Активен' : 'Заблокирован';
        });
    }
});

// Переключение боковой панели для мобильных устройств
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('mobile-visible');
}

// Закрыть боковую панель при клике вне её на мобильных
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.querySelector('.mobile-menu-btn');

    if (window.innerWidth <= 768) {
        if (!sidebar.contains(event.target) && !menuBtn.contains(event.target)) {
            sidebar.classList.remove('mobile-visible');
        }
    }
});

// ========== ИНИЦИАЛИЗАЦИЯ ==========

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeData();
    renderUsers();
});
