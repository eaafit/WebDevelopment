// Состояние чата
let chatHistory = [];
let isConnectedToOperator = false;

// Загрузка истории при старте
document.addEventListener('DOMContentLoaded', function() {
    loadChatHistory();
});

function toggleAnswer(id) {
    const answer = document.getElementById('answer' + id);
    const question = answer.previousElementSibling;
    
    answer.classList.toggle('show');
    question.classList.toggle('active');
}

function toggleChat() {
    const chatWindow = document.getElementById('chatWindow');
    chatWindow.classList.toggle('show');
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (message) {
        addMessage(message, 'user');
        
        setTimeout(() => {
            if (!isConnectedToOperator) {
                const botResponse = getBotResponse(message);
                addMessage(botResponse, 'bot');
            }
        }, 1000);
        
        input.value = '';
    }
}

function addMessage(text, sender) {
    const messagesDiv = document.getElementById('chatMessages');
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    let messageClass = 'bot-message';
    if (sender === 'user') messageClass = 'user-message';
    if (sender === 'operator') messageClass = 'operator-message';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${messageClass}`;
    messageDiv.innerHTML = `
        ${text}
        <div class="timestamp">${time}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    saveToHistory(text, sender, time);
}

function saveToHistory(text, sender, time) {
    chatHistory.push({
        text: text,
        sender: sender,
        time: time
    });
}

function loadChatHistory() {
    // Просто показываем приветственное сообщение
    addMessage('Здравствуйте! Я бот-помощник. Задайте свой вопрос.', 'bot');
}

function getBotResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('привет') || lowerMessage.includes('здравствуйте')) {
        return '👋 Здравствуйте! Чем я могу помочь?';
    } else if (lowerMessage.includes('пароль')) {
        return '🔑 Для восстановления пароля нажмите "Забыли пароль?" на странице входа.';
    } else if (lowerMessage.includes('регистрац')) {
        return '📝 Чтобы зарегистрироваться, нажмите кнопку "Войти" и выберите "Создать аккаунт".';
    } else if (lowerMessage.includes('тариф')) {
        return '💰 Информацию о тарифах вы найдете в личном кабинете.';
    } else if (lowerMessage.includes('пока') || lowerMessage.includes('до свидания')) {
        return '👋 Всего доброго! Обращайтесь ещё.';
    } else if (lowerMessage.includes('спасибо')) {
        return '😊 Пожалуйста! Рад был помочь.';
    } else {
        return '❓ Извините, я не совсем понял. Попробуйте перефразировать вопрос или свяжитесь с оператором.';
    }
}

function connectToOperator() {
    if (isConnectedToOperator) {
        addMessage('Вы уже на связи с оператором', 'bot');
        return;
    }
    
    isConnectedToOperator = true;
    addMessage('⏳ Соединяю с оператором поддержки...', 'bot');
    
    setTimeout(() => {
        addMessage('👨‍💼 Здравствуйте! Меня зовут Анна, я оператор поддержки. Чем могу помочь?', 'operator');
    }, 2000);
}