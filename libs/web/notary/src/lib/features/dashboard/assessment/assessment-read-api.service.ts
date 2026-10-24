import { inject, Injectable } from '@angular/core';
import { TokenStore, buildRpcBaseUrl } from '@notary-portal/ui';
import type {
  AssessmentDraft,
  EvaluationParameters,
  WorkspaceAssessment,
  WorkspaceCatalogs,
  WorkspacePage,
  WorkspaceStatus,
} from '@notary-portal/api-contracts';

@Injectable({ providedIn: 'root' })
export class AssessmentReadApiService {
  private readonly tokens = inject(TokenStore);
  private readonly base = buildRpcBaseUrl() + '/api/assessment-workspace';
  async request<T>(path = '', method = 'GET', body?: unknown): Promise<T> {
    const token = this.tokens.getAccessToken();
    if (!token) throw new Error('Сессия истекла. Войдите в систему повторно.');
    const response = await fetch(this.base + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        typeof result.message === 'string'
          ? result.message
          : 'Не удалось выполнить действие. Попробуйте ещё раз.',
      );
    return result as T;
  }
  list(page = 1, filters: Record<string, string> = {}) {
    return this.request<WorkspacePage>(
      '?' + new URLSearchParams({ ...filters, page: String(page) }),
    );
  }
  get(id: string) {
    return this.request<WorkspaceAssessment>('/' + encodeURIComponent(id));
  }
  catalogs() {
    return this.request<WorkspaceCatalogs>('/catalogs');
  }
  addCity(name: string) {
    return this.request<{ id: string; name: string }>('/catalogs/cities', 'POST', { name });
  }
  create(draft: AssessmentDraft) {
    return this.request<WorkspaceAssessment>('', 'PUT', draft);
  }
  update(id: string, draft: AssessmentDraft) {
    return this.request<WorkspaceAssessment>('/' + encodeURIComponent(id), 'PUT', draft);
  }
  remove(id: string) {
    return this.request<{ deleted: boolean }>('/' + encodeURIComponent(id), 'DELETE');
  }
  submit(id: string, parameters: EvaluationParameters) {
    return this.request<WorkspaceAssessment>(
      '/' + encodeURIComponent(id) + '/request',
      'POST',
      parameters,
    );
  }
  status(id: string, status: WorkspaceStatus, reason?: string, estimatedValue?: number) {
    return this.request<WorkspaceAssessment>('/' + encodeURIComponent(id) + '/status', 'PUT', {
      status,
      reason,
      estimatedValue,
    });
  }
}
