// Хранилище чатов
let chats = [];
let currentChatId = null;
let currentFilter = 'all';

// Инициализация с тестовыми данными
document.addEventListener('DOMContentLoaded', function() {
    initTestChats();
    loadChats();
    startAutoResponses();
});

function initTestChats() {
    if (!localStorage.getItem('chats')) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        const testChats = [
            {
                id: 'chat_1',
                clientName: 'Иван Петров',
                clientEmail: 'ivan@example.com',
                topic: 'technical',
                topicText: '🔧 Техническая проблема',
                priority: 'high',
                status: 'active',
                statusText: 'Активный',
                unread: 2,
                created: '2024-01-15 10:30',
                lastMessage: 'Всё ещё не работает',
                lastMessageTime: '10:45',
                messages: [
                    {
                        id: 'msg1',
                        sender: 'client',
                        text: 'Здравствуйте! У меня не загружается сайт',
                        time: '10:30',
                        read: true
                    },
                    {
                        id: 'msg2',
                        sender: 'admin',
                        text: 'Здравствуйте! Попробуйте очистить кэш браузера',
                        time: '10:32',
                        read: true
                    },
                    {
                        id: 'msg3',
                        sender: 'client',
                        text: 'Попробовал, не помогает',
                        time: '10:35',
                        read: true
                    },
                    {
                        id: 'msg4',
                        sender: 'admin',
                        text: 'Понял, сейчас проверю на своей стороне',
                        time: '10:36',
                        read: true
                    },
                    {
                        id: 'msg5',
                        sender: 'client',
                        text: 'Всё ещё не работает',
                        time: '10:45',
                        read: false
                    }
                ]
            },
            {
                id: 'chat_2',
                clientName: 'Анна Смирнова',
                clientEmail: 'anna@example.com',
                topic: 'billing',
                topicText: '💰 Оплата',
                priority: 'urgent',
                status: 'waiting',
                statusText: 'Ожидает',
                unread: 1,
                created: '2024-01-15 11:45',
                lastMessage: 'Когда вернут деньги?',
                lastMessageTime: '11:50',
                messages: [
                    {
                        id: 'msg1',
                        sender: 'client',
                        text: 'Здравствуйте! У меня дважды списали оплату',
                        time: '11:45',
                        read: true
                    },
                    {
                        id: 'msg2',
                        sender: 'admin',
                        text: 'Здравствуйте! Проверяю информацию',
                        time: '11:47',
                        read: true
                    },
                    {
                        id: 'msg3',
                        sender: 'client',
                        text: 'Когда вернут деньги?',
                        time: '11:50',
                        read: false
                    },
					{
						id: 'msg4',
						sender: 'admin',
						text: 'Никогда',
						time: '12:50',
						read: true
					}
                ]
            },
            {
                id: 'chat_3',
                clientName: 'Павел Иванов',
                clientEmail: 'pavel@example.com',
                topic: 'account',
                topicText: '👤 Аккаунт',
                priority: 'medium',
                status: 'active',
                statusText: 'Активный',
                unread: 0,
                created: '2024-01-15 14:20',
                lastMessage: 'Спасибо за помощь!',
                lastMessageTime: '14:35',
                messages: [
                    {
                        id: 'msg1',
                        sender: 'client',
                        text: 'Не могу войти в аккаунт',
                        time: '14:20',
                        read: true
                    },
                    {
                        id: 'msg2',
                        sender: 'admin',
                        text: 'Попробуйте сбросить пароль',
                        time: '14:22',
                        read: true
                    },
                    {
                        id: 'msg3',
                        sender: 'client',
                        text: 'Сработало! Спасибо',
                        time: '14:30',
                        read: true
                    },
                    {
                        id: 'msg4',
                        sender: 'admin',
                        text: 'Отлично! Обращайтесь ещё',
                        time: '14:32',
                        read: true
                    },
                    {
                        id: 'msg5',
                        sender: 'client',
                        text: 'Спасибо за помощь!',
                        time: '14:35',
                        read: true
                    }
                ]
            },
            {
                id: 'chat_4',
                clientName: 'Елена Козлова',
                clientEmail: 'elena@example.com',
                topic: 'consultation',
                topicText: '📋 Консультация',
                priority: 'low',
                status: 'closed',
                statusText: 'Завершен',
                unread: 0,
                created: '2024-01-14 09:15',
                closedAt: '2024-01-14 16:30',
                lastMessage: 'Всего доброго!',
                lastMessageTime: '16:30',
                messages: [
                    {
                        id: 'msg1',
                        sender: 'client',
                        text: 'Хочу узнать о тарифах для бизнеса',
                        time: '09:15',
                        read: true
                    },
                    {
                        id: 'msg2',
                        sender: 'admin',
                        text: 'Здравствуйте! Подскажите, какой у вас бизнес?',
                        time: '09:20',
                        read: true
                    },
                    {
                        id: 'msg3',
                        sender: 'client',
                        text: 'Интернет-магазин',
                        time: '09:22',
                        read: true
                    },
                    {
                        id: 'msg4',
                        sender: 'admin',
                        text: 'Отлично! У нас есть специальные условия',
                        time: '09:25',
                        read: true
                    }
                ]
            }
        ];
        localStorage.setItem('chats', JSON.stringify(testChats));
    }
}

function loadChats() {
    const storedChats = localStorage.getItem('chats');
    chats = storedChats ? JSON.parse(storedChats) : [];
    displayChatsList();
    updateStats();
    
    if (currentChatId) {
        const chat = chats.find(c => c.id === currentChatId);
        if (chat) {
            displayChat(chat);
        } else {
            showPlaceholder();
        }
    }
}

function displayChatsList() {
    const chatsList = document.getElementById('chatsList');
    
    // Приоритет статуса: active=1, waiting=2, closed=3 (меньше = выше)
    const sortedChats = [...chats].sort((a, b) => {
        const statusWeight = { 'active': 1, 'waiting': 2, 'closed': 3 };
        const weightA = statusWeight[a.status] || 4;
        const weightB = statusWeight[b.status] || 4;
        
        if (weightA !== weightB) {
            return weightA - weightB; // сначала открытые
        }
        
        // Если статус одинаковый, сортируем по времени последнего сообщения (новые выше)
        const timeA = a.lastMessageTime || '00:00';
        const timeB = b.lastMessageTime || '00:00';
        return timeB.localeCompare(timeA);
    });
    
    chatsList.innerHTML = sortedChats.map(chat => {
        const isActive = chat.id === currentChatId;
        const priorityClass = `priority-${chat.priority}`;
        const statusClass = `status-${chat.status}`;
        
        return `
            <div class="chat-item ${isActive ? 'active' : ''}" onclick="selectChat('${chat.id}')">
                <div class="chat-item-header">
                    <span class="chat-client">
                        <span class="chat-priority ${priorityClass}"></span>
                        ${chat.clientName}
                    </span>
                    <span class="chat-time">${chat.lastMessageTime}</span>
                </div>
                <div class="chat-topic">${chat.topicText}</div>
                <div class="chat-meta">
                    <span class="chat-status ${statusClass}">${chat.statusText}</span>
                    ${chat.unread > 0 ? `<span class="chat-unread">${chat.unread}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function updateStats() {
    const activeChats = chats.filter(c => c.status === 'active').length;
    const waitingChats = chats.filter(c => c.status === 'waiting').length;
    const closedChats = chats.filter(c => c.status === 'closed').length;
    
    // Подсчет сообщений за сегодня
    const today = new Date().toDateString();
    let todayMessages = 0;
    chats.forEach(chat => {
        chat.messages.forEach(msg => {
            const msgDate = new Date(msg.time).toDateString();
            if (msgDate === today) todayMessages++;
        });
    });
    
    document.getElementById('activeChats').textContent = activeChats;
    document.getElementById('waitingChats').textContent = waitingChats;
    document.getElementById('closedChats').textContent = closedChats;
    document.getElementById('totalMessages').textContent = todayMessages;
}

function selectChat(chatId) {
    currentChatId = chatId;
    const chat = chats.find(c => c.id === chatId);
    
    // Сбрасываем счетчик непрочитанных
    if (chat.unread > 0) {
        chat.unread = 0;
        chat.messages.forEach(msg => {
            if (msg.sender === 'client') {
                msg.read = true;
            }
        });
        saveChats();
    }
    
    displayChat(chat);
    displayChatsList();
}

function displayChat(chat) {
    const chatArea = document.getElementById('chatArea');
    
    const messagesHtml = chat.messages.map(msg => {
        const messageClass = msg.sender === 'admin' ? 'admin' : 'client';
        const status = msg.read ? 'Прочитано' : 'Доставлено';
        
        return `
            <div class="message ${messageClass}">
                <div class="message-content">${msg.text}</div>
                <div class="message-time">
                    ${msg.time}
                    ${msg.sender === 'admin' ? `<span class="message-status"> · ${status}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    chatArea.innerHTML = `
        <div class="chat-header">
            <div class="chat-header-info">
                <h2>${chat.clientName} · ${chat.clientEmail}</h2>
                <div class="chat-header-meta">
                    <span>${chat.topicText}</span>
                    <span>·</span>
                    <span>Создан: ${chat.created}</span>
                </div>
            </div>
            <div class="chat-header-actions">
                ${chat.status !== 'closed' ? 
                    `<button class="close-chat-btn" onclick="closeChat('${chat.id}')">Завершить чат</button>` : 
                    ''}
            </div>
        </div>
        <div class="chat-messages" id="chatMessages">
            ${messagesHtml}
        </div>
        ${chat.status !== 'closed' ? `
            <div class="chat-input-area">
                <input type="text" class="chat-input" id="messageInput" placeholder="Введите сообщение..." onkeypress="handleKeyPress(event, '${chat.id}')">
                <button class="send-btn" onclick="sendMessage('${chat.id}')">➤</button>
            </div>
        ` : `
            <div class="chat-input-area" style="justify-content: center; color: #a0aec0;">
                Чат завершен
            </div>
        `}
    `;
    
    // Скролл к последнему сообщению
    setTimeout(() => {
        const messagesDiv = document.getElementById('chatMessages');
        if (messagesDiv) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    }, 100);
}

function showPlaceholder() {
    const chatArea = document.getElementById('chatArea');
    chatArea.innerHTML = `
        <div class="chat-placeholder">
            <div class="placeholder-icon">💬</div>
            <h3>Выберите чат</h3>
            <p>Нажмите на чат слева, чтобы начать общение</p>
            <button class="create-chat-btn" onclick="showCreateTicketModal()">+ Создать новый чат</button>
        </div>
    `;
}

function sendMessage(chatId) {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (message) {
        const chat = chats.find(c => c.id === chatId);
        if (chat) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            
            const newMessage = {
                id: 'msg_' + Date.now(),
                sender: 'admin',
                text: message,
                time: timeStr,
                read: true
            };
            
            chat.messages.push(newMessage);
            chat.lastMessage = message;
            chat.lastMessageTime = timeStr;
            
            saveChats();
            displayChat(chat);
            
            // Имитация ответа клиента
            simulateClientResponse(chat);
        }
    }
}

function simulateClientResponse(chat) {
    if (chat.status === 'closed') return;
    
    setTimeout(() => {
        const responses = [
            'Понял, спасибо!',
            'А что насчет...',
            'Хорошо, я попробую',
            'Спасибо за помощь!',
            'Ещё вопрос можно?'
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        const newMessage = {
            id: 'msg_' + Date.now(),
            sender: 'client',
            text: randomResponse,
            time: timeStr,
            read: false
        };
        
        chat.messages.push(newMessage);
        chat.lastMessage = randomResponse;
        chat.lastMessageTime = timeStr;
        chat.unread = (chat.unread || 0) + 1;
        
        saveChats();
        
        if (chat.id === currentChatId) {
            displayChat(chat);
        }
        displayChatsList();
    }, 5000);
}

function handleKeyPress(event, chatId) {
    if (event.key === 'Enter') {
        sendMessage(chatId);
    }
}

function closeChat(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
        chat.status = 'closed';
        chat.statusText = 'Завершен';
        chat.closedAt = new Date().toLocaleString('ru-RU');
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        chat.messages.push({
            id: 'msg_' + Date.now(),
            sender: 'system',
            text: 'Чат завершен администратором',
            time: timeStr,
            read: true
        });
        
        saveChats();
        
        if (chat.id === currentChatId) {
            displayChat(chat);
        }
        displayChatsList();
        updateStats();
    }
}

function searchChats() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        displayChatsList();
        return;
    }
    
    const filtered = chats.filter(chat => 
        chat.clientName.toLowerCase().includes(searchTerm) ||
        chat.clientEmail.toLowerCase().includes(searchTerm) ||
        chat.topicText.toLowerCase().includes(searchTerm)
    );
    
    const chatsList = document.getElementById('chatsList');
    chatsList.innerHTML = filtered.map(chat => {
        const priorityClass = `priority-${chat.priority}`;
        const statusClass = `status-${chat.status}`;
        
        return `
            <div class="chat-item" onclick="selectChat('${chat.id}')">
                <div class="chat-item-header">
                    <span class="chat-client">
                        <span class="chat-priority ${priorityClass}"></span>
                        ${chat.clientName}
                    </span>
                    <span class="chat-time">${chat.lastMessageTime}</span>
                </div>
                <div class="chat-topic">${chat.topicText}</div>
                <div class="chat-meta">
                    <span class="chat-status ${statusClass}">${chat.statusText}</span>
                    ${chat.unread > 0 ? `<span class="chat-unread">${chat.unread}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function showCreateTicketModal() {
    document.getElementById('createChatModal').classList.add('show');
}

function closeCreateChatModal() {
    document.getElementById('createChatModal').classList.remove('show');
}

function createNewChat() {
    const clientName = document.getElementById('clientName').value;
    const clientEmail = document.getElementById('clientEmail').value;
    const topic = document.getElementById('chatTopic');
    const priority = document.getElementById('chatPriority');
    const firstMessage = document.getElementById('firstMessage').value;
    
    const topicText = {
        'technical': '🔧 Техническая проблема',
        'billing': '💰 Оплата',
        'account': '👤 Аккаунт',
        'consultation': '📋 Консультация',
        'other': '❓ Другое'
    };
    
    const priorityText = {
        'low': 'low',
        'medium': 'medium',
        'high': 'high',
        'urgent': 'urgent'
    };
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU');
    const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    const newChat = {
        id: 'chat_' + Date.now(),
        clientName: clientName,
        clientEmail: clientEmail,
        topic: topic.value,
        topicText: topicText[topic.value],
        priority: priority.value,
        status: 'active',
        statusText: 'Активный',
        unread: 1,
        created: dateStr + ' ' + timeStr,
        lastMessage: firstMessage,
        lastMessageTime: timeStr,
        messages: [
            {
                id: 'msg_' + Date.now(),
                sender: 'client',
                text: firstMessage,
                time: timeStr,
                read: false
            }
        ]
    };
    
    chats.push(newChat);
    saveChats();
    
    closeCreateChatModal();
    loadChats();
    selectChat(newChat.id);
}

function saveChats() {
    localStorage.setItem('chats', JSON.stringify(chats));
}
