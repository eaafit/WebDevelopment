import { create } from '@bufbuild/protobuf';
import { Injectable } from '@nestjs/common';
import {
  AskSupportAiResponseSchema,
  type AskSupportAiRequest,
  type AskSupportAiResponse,
} from '@notary-portal/api-contracts';
import { SupportAiService } from './support-ai.service';

@Injectable()
export class SupportRpcService {
  constructor(private readonly supportAi: SupportAiService) {}

  readonly askSupportAi = async (r: AskSupportAiRequest): Promise<AskSupportAiResponse> => {
    try {
      if (!this.supportAi.isConfigured()) {
        return create(AskSupportAiResponseSchema, {
          answer: '',
          success: false,
          errorMessage:
            'ИИ-помощник не настроен: для OpenAI задайте OPENAI_API_KEY, для GigaChat — SUPPORT_AI_PROVIDER=gigachat и GIGACHAT_CREDENTIALS (или см. .env.example).',
        });
      }
      const answer = await this.supportAi.ask(r.text);
      return create(AskSupportAiResponseSchema, {
        answer,
        success: true,
        errorMessage: '',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Сервис временно недоступен';
      return create(AskSupportAiResponseSchema, {
        answer: '',
        success: false,
        errorMessage: message,
      });
    }
  };
}
