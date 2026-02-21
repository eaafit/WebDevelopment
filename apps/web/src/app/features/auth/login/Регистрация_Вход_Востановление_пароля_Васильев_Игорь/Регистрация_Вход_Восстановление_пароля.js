document.addEventListener('DOMContentLoaded', () => {
    const contactInputs = document.querySelectorAll('#login-contact, #reg-contact, #rec-contact');

    contactInputs.forEach(input => {
        input.addEventListener('input', formatContactInput);
    });
});

// --- МАСКА ---
function formatContactInput(e) {
    const input = e.target;
    let val = input.value;

    if (!val) return;
    if (/[a-zA-Zа-яА-Я@]/.test(val)) return;

    let numbers = val.replace(/\D/g, '');

    if (!numbers) {
        if (val === '+') return;
        input.value = '';
        return;
    }

    if (e.inputType === 'deleteContentBackward') return;

    if (['7', '8', '9'].includes(numbers[0])) {
        if (numbers[0] === '9') numbers = '7' + numbers;
        let formatted = (numbers[0] === '8') ? '8' : '+7';
        if (numbers.length > 1) formatted += ' (' + numbers.substring(1, 4);
        if (numbers.length >= 5) formatted += ') ' + numbers.substring(4, 7);
        if (numbers.length >= 8) formatted += '-' + numbers.substring(7, 9);
        if (numbers.length >= 10) formatted += '-' + numbers.substring(9, 11);
        input.value = formatted;
    } else {
        input.value = '+' + numbers.substring(0, 15);
    }
}

// --- НАВИГАЦИЯ ---
function switchView(viewId) {
    document.querySelectorAll('.form-view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    const tabsBlock = document.getElementById('main-tabs');
    if (viewId === 'login' || viewId === 'register') {
        tabsBlock.style.display = 'flex';
        document.querySelectorAll('.auth-tab').forEach(btn => btn.classList.remove('active'));
        if (viewId === 'login') tabsBlock.children[0].classList.add('active');
        if (viewId === 'register') tabsBlock.children[1].classList.add('active');
    } else {
        tabsBlock.style.display = 'none';
    }
}

// --- ДЕЙСТВИЯ ---
function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = 'Вход...';
    btn.disabled = true;
    setTimeout(() => {
        btn.innerText = originalText;
        btn.disabled = false;
        alert('Успешная авторизация!');
    }, 1000);
}

function handleGuestAccess() {
    alert('Переход в режим Гостя (ограниченные права).');
}

function handleRegister(e) {
    e.preventDefault();
    switchView('confirm');
}

function handleRecovery(e) {
    e.preventDefault();
    alert('Инструкции отправлены!');
    switchView('login');
}

function handleConfirm(e) {
    e.preventDefault();
    alert('Аккаунт подтвержден!');
    switchView('login');
}