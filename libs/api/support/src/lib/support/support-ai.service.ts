import { Injectable } from '@nestjs/common';
import { Agent } from 'node:https';
import GigaChat from 'gigachat';
import OpenAI from 'openai';

type SupportAiProvider = 'openai' | 'gigachat';

function resolveProvider(): SupportAiProvider {
  const raw = process.env['SUPPORT_AI_PROVIDER']?.trim().toLowerCase();
  return raw === 'gigachat' ? 'gigachat' : 'openai';
}

function gigachatAuthConfigured(): boolean {
  return (
    Boolean(process.env['GIGACHAT_CREDENTIALS']?.trim()) ||
    Boolean(process.env['GIGACHAT_ACCESS_TOKEN']?.trim()) ||
    (Boolean(process.env['GIGACHAT_USER']?.trim()) &&
      Boolean(process.env['GIGACHAT_PASSWORD']?.trim()))
  );
}

/** Цепочка сертификатов Сбера часто не входит в доверенные Node → «self-signed certificate in certificate chain». */
function gigachatHttpsAgent(): Agent | undefined {
  const flag = process.env['GIGACHAT_INSECURE_TLS']?.trim().toLowerCase();
  if (flag === 'false') {
    return undefined;
  }
  if (flag === 'true') {
    return new Agent({ rejectUnauthorized: false });
  }
  // По умолчанию вне production — как в примерах SDK, иначе OAuth/chat часто падают по TLS.
  return process.env['NODE_ENV'] === 'production'
    ? undefined
    : new Agent({ rejectUnauthorized: false });
}

@Injectable()
export class SupportAiService {
  private readonly provider: SupportAiProvider;
  private readonly openai: OpenAI | null;
  private readonly gigachat: GigaChat | null;

  constructor() {
    this.provider = resolveProvider();

    const openaiKey = process.env['OPENAI_API_KEY']?.trim();
    this.openai =
      this.provider === 'openai' && openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

    const scope = process.env['GIGACHAT_SCOPE']?.trim();
    const model = process.env['GIGACHAT_MODEL']?.trim();
    const timeoutSec =
      Number(process.env['GIGACHAT_TIMEOUT_SEC'] ?? process.env['GIGACHAT_TIMEOUT'] ?? '') ||
      undefined;

    this.gigachat =
      this.provider === 'gigachat' && gigachatAuthConfigured()
        ? new GigaChat({
            credentials: process.env['GIGACHAT_CREDENTIALS']?.trim(),
            accessToken: process.env['GIGACHAT_ACCESS_TOKEN']?.trim(),
            user: process.env['GIGACHAT_USER']?.trim(),
            password: process.env['GIGACHAT_PASSWORD']?.trim(),
            ...(scope ? { scope } : {}),
            ...(model ? { model } : {}),
            ...(timeoutSec !== undefined && !Number.isNaN(timeoutSec) ? { timeout: timeoutSec } : {}),
            ...(() => {
              const agent = gigachatHttpsAgent();
              return agent ? { httpsAgent: agent } : {};
            })(),
          })
        : null;
  }

  isConfigured(): boolean {
    return this.provider === 'openai' ? this.openai !== null : this.gigachat !== null;
  }

  async ask(question: string): Promise<string> {
    const systemPrompt = `Ты — помощник портала нотариальной оценки.
Отвечай кратко и по делу на вопросы о нотариальных услугах, оценке имущества, документах и работе портала.
Если вопрос явно не по теме портала или нотариата, вежливо откажись и предложи задать вопрос по оценке или обратиться в поддержку.`;

    if (this.provider === 'gigachat') {
      if (!this.gigachat) {
        throw new Error(
          'GigaChat не настроен: задайте GIGACHAT_CREDENTIALS или GIGACHAT_ACCESS_TOKEN (либо GIGACHAT_USER + GIGACHAT_PASSWORD).',
        );
      }
      const maxTokens =
        Number(process.env['GIGACHAT_MAX_TOKENS'] ?? process.env['OPENAI_MAX_TOKENS'] ?? '500') ||
        500;

      const completion = await this.gigachat.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('Пустой ответ модели');
      }
      return content;
    }

    if (!this.openai) {
      throw new Error('OPENAI_API_KEY не задан на сервере');
    }

    const model = process.env['OPENAI_MODEL']?.trim() || 'gpt-4o-mini';
    const maxTokens = Number(process.env['OPENAI_MAX_TOKENS'] ?? '500') || 500;

    const completion = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Пустой ответ модели');
    }
    return content;
  }
}
