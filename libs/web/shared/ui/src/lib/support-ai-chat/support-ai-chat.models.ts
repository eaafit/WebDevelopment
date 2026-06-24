// Роль сообщения в ленте: пользователь, ИИ или оператор поддержки.
export type SupportChatRole = 'user' | 'assistant' | 'support';

// Режим виджета: диалог с ИИ или переписка с оператором по тикету в БД.
export type SupportChatMode = 'ai' | 'operator';

// Одно сообщение в transcript виджета.
export interface SupportChatMessage {
  id: string;
  role: SupportChatRole;
  text: string;
  createdAt: string;
  authorName?: string;
  label?: string;
}

// Режим вёрстки: плавающий FAB или встроенная панель без кнопки.
export type SupportAiChatLayout = 'floating' | 'inline';
