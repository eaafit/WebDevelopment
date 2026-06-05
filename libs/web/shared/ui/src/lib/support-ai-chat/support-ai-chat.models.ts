// Роль сообщения в ленте чата: пользователь или ассистент (ИИ / ошибка).
export type SupportChatRole = 'user' | 'assistant';

// Одно сообщение в transcript виджета.
export interface SupportChatMessage {
  // Уникальный id для track в @for (crypto.randomUUID или fallback).
  id: string;
  // Кто отправил сообщение.
  role: SupportChatRole;
  // Текст вопроса или ответа.
  text: string;
  // ISO-время для возможной аналитики (MVP — только хранение в памяти).
  createdAt: string;
}

// Режим вёрстки: плавающий FAB или встроенная панель без кнопки.
export type SupportAiChatLayout = 'floating' | 'inline';
