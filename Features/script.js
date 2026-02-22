const takeButtons = document.querySelectorAll('.take-btn');
takeButtons.forEach(button => {
    button.onclick = function() {
        this.textContent = 'В работе ✓';
        this.disabled = true;
        this.style.background = '#95a5a6';
        alert('Заказ взят в работу!');
    };
});

const docsButtons = document.querySelectorAll('.docs-btn');
const modal = document.getElementById('docModal');

docsButtons.forEach(button => {
    button.onclick = function() {
        modal.style.display = 'flex';
    };
});

const closeBtn = document.querySelector('.close-btn');
closeBtn.onclick = function() {
    modal.style.display = 'none';
};

const logoutBtn = document.querySelector('.logout-btn');
logoutBtn.onclick = function() {
    if (confirm('Выйти из системы?')) {
        alert('Вы вышли');
    }
};

const payBtn = document.querySelector('.pay-btn');
payBtn.onclick = function() {
    alert('Переход на страницу оплаты...');
};