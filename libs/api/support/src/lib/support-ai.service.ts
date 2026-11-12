import { Injectable } from '@nestjs/common';
import GigaChat from 'gigachat';
import https from 'node:https';
import OpenAI from 'openai';

// Фиксированный system prompt: роль, стиль и границы тематики для ИИ-помощника портала.
const SYSTEM_PROMPT = [
  'Ты — помощник портала нотариальной оценки имущества.',
  'Отвечай кратко и по делу на русском языке.',
  'Темы: нотариат, оценка имущества, документы, работа портала.',
  'На вопросы вне этих тем вежливо откажись и предложи задать вопрос по порталу или обратиться в поддержку.',
].join(' ');

// Тип провайдера LLM: GigaChat по умолчанию, OpenAI — при явном SUPPORT_AI_PROVIDER=openai.
type AiProvider = 'gigachat' | 'openai';

@Injectable()
export class SupportAiService {
  // Читает переменную окружения; пустая строка трактуется как отсутствие значения.
  private env(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
  }

  // Возвращает активный провайдер: openai только при явной настройке, иначе gigachat.
  private provider(): AiProvider {
    const configured = (this.env('SUPPORT_AI_PROVIDER') ?? 'gigachat').toLowerCase();
    return configured === 'openai' ? 'openai' : 'gigachat';
  }

  // Лимит токенов ответа: сначала GIGACHAT_MAX_TOKENS, затем OPENAI_MAX_TOKENS, иначе 500.
  private maxTokens(): number {
    const raw = this.env('GIGACHAT_MAX_TOKENS') ?? this.env('OPENAI_MAX_TOKENS') ?? '500';
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 500;
  }

  // Проверяет, заданы ли учётные данные GigaChat (credentials, access token или user+password).
  private isGigaChatConfigured(): boolean {
    if (this.env('GIGACHAT_CREDENTIALS') || this.env('GIGACHAT_ACCESS_TOKEN')) {
      return true;
    }
    return Boolean(this.env('GIGACHAT_USER') && this.env('GIGACHAT_PASSWORD'));
  }

  // Проверяет наличие OPENAI_API_KEY для режима OpenAI.
  private isOpenAiConfigured(): boolean {
    return Boolean(this.env('OPENAI_API_KEY'));
  }

  // Локальная отладка без ключей: SUPPORT_AI_STUB=true (только development).
  private isStubMode(): boolean {
    if (this.env('SUPPORT_AI_STUB') !== 'true') {
      return false;
    }
    return process.env.NODE_ENV !== 'production';
  }

  // Публичная проверка: можно ли вызывать LLM с текущими env (используется в RPC до ask).
  isConfigured(): boolean {
    if (this.isStubMode()) {
      return true;
    }
    return this.provider() === 'openai' ? this.isOpenAiConfigured() : this.isGigaChatConfigured();
  }

  // Единая точка вызова LLM: маршрутизирует на GigaChat или OpenAI по SUPPORT_AI_PROVIDER.
  async ask(text: string): Promise<string> {
    const question = text.trim();
    if (!question) {
      throw new Error('Текст вопроса не может быть пустым');
    }

    if (this.isStubMode()) {
      return this.stubAnswer(question);
    }

    if (this.provider() === 'openai') {
      return this.askOpenAi(question);
    }

    return this.askGigaChat(question);
  }

  // Демо-ответы для локальной разработки без GigaChat/OpenAI ключей.
  private stubAnswer(question: string): string {
    const lower = question.toLowerCase();
    if (/(оценк|наследств|имуществ)/.test(lower)) {
      return (
        '[Демо-режим] Для оценки имущества оформите заявку в личном кабинете после входа: ' +
        'укажите объект, приложите документы и фото. Статус заявки можно отслеживать в разделе «Мои заявки».'
      );
    }
    if (/(документ|справк|копи)/.test(lower)) {
      return (
        '[Демо-режим] Список необходимых документов зависит от типа объекта оценки. ' +
        'Подробности — в разделе «Справочник» на портале или в карточке заявки.'
      );
    }
    if (/(вход|регистрац|парол|авториз)/.test(lower)) {
      return (
        '[Демо-режим] Войдите через кнопку «Войти» в шапке сайта. ' +
        'При утере пароля используйте восстановление на странице авторизации.'
      );
    }
    if (/(оплат|тариф|подписк)/.test(lower)) {
      return (
        '[Демо-режим] Оплата тарифов доступна после авторизации в разделе подписки. ' +
        'История платежей отображается в личном кабинете.'
      );
    }
    return (
      '[Демо-режим] Я помощник портала нотариальной оценки. ' +
      'Задайте вопрос по оценке, документам или работе портала. ' +
      'Для реальных ответов ИИ укажите GIGACHAT_CREDENTIALS или OPENAI_API_KEY в .env и отключите SUPPORT_AI_STUB.'
    );
  }

  // Вызов OpenAI Chat Completions API; ключ только из env процесса API.
  private async askOpenAi(text: string): Promise<string> {
    const apiKey = this.env('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY не задан');
    }

    const client = new OpenAI({ apiKey });
    const model = this.env('OPENAI_MODEL') ?? 'gpt-4o-mini';

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      max_tokens: this.maxTokens(),
      temperature: 0.7,
    });

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) {
      throw new Error('Пустой ответ от OpenAI');
    }

    return answer;
  }

  // HTTPS-агент для GigaChat: GIGACHAT_INSECURE_TLS=true отключает проверку TLS (только для локальной отладки).
  private gigaChatHttpsAgent(): https.Agent | undefined {
    if (this.env('GIGACHAT_INSECURE_TLS') !== 'true') {
      return undefined;
    }
    return new https.Agent({ rejectUnauthorized: false });
  }

  // Вызов GigaChat SDK: credentials / token / user+password из env.
  private async askGigaChat(text: string): Promise<string> {
    const credentials = this.env('GIGACHAT_CREDENTIALS');
    const accessToken = this.env('GIGACHAT_ACCESS_TOKEN');
    const user = this.env('GIGACHAT_USER');
    const password = this.env('GIGACHAT_PASSWORD');

    if (!credentials && !accessToken && !(user && password)) {
      throw new Error('Учётные данные GigaChat не заданы');
    }

    const timeoutSec = Number.parseInt(this.env('GIGACHAT_TIMEOUT_SEC') ?? '60', 10);
    const httpsAgent = this.gigaChatHttpsAgent();

    const client = new GigaChat({
      credentials: credentials ?? accessToken,
      user,
      password,
      scope: this.env('GIGACHAT_SCOPE') ?? 'GIGACHAT_API_PERS',
      model: this.env('GIGACHAT_MODEL'),
      timeout: Number.isFinite(timeoutSec) ? timeoutSec : 60,
      ...(httpsAgent ? { httpsAgent } : {}),
    });

    const response = await client.chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.7,
      max_tokens: this.maxTokens(),
    });

    const answer = response.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new Error('Пустой ответ от GigaChat');
    }

    return answer;
  }
}
