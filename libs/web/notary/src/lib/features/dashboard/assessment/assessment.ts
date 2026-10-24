import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TokenStore, UserRole } from '@notary-portal/ui';
import { EVALUATION_MODEL_LABELS, EVALUATION_URGENCY_LABELS } from '@notary-portal/api-contracts';
import type {
  AssessmentDraft,
  WorkspaceAssessment,
  WorkspaceCatalogs,
  WorkspaceStatus,
} from '@notary-portal/api-contracts';
import { AssessmentReadApiService } from './assessment-read-api.service';
import { AssessmentRequest } from './assessment-request';

export const STATUS_LABELS: Record<WorkspaceStatus, string> = {
  New: 'Новая',
  Verified: 'В очереди',
  InProgress: 'В работе',
  Completed: 'Завершена',
  Cancelled: 'Отменена',
};
export const OBJECT_TYPES: Record<string, string> = {
  Apartment: 'Квартира',
  House: 'Дом',
  Room: 'Комната',
  Apartments: 'Апартаменты',
  LandPlot: 'Участок',
  CommercialProperty: 'Коммерческая недвижимость',
  Other: 'Другое',
};
type Dialog = 'view' | 'edit' | 'create' | 'request' | 'delete' | 'status' | null;
const emptyDraft = (): AssessmentDraft => ({
  userId: '',
  address: '',
  description: '',
  property: {
    cityId: '',
    address: '',
    area: null,
    objectType: 'Apartment',
    cadastralNumber: '',
    roomsCount: null,
    floor: null,
    floorsTotal: null,
    yearBuilt: null,
  },
});
const CUSTOM_CITY = '__custom_city__';

@Component({
  selector: 'lib-request-price',
  standalone: true,
  imports: [CommonModule, FormsModule, AssessmentRequest],
  templateUrl: './assessment.html',
  styleUrl: './assessment.scss',
})
export class RequestPrice implements OnInit, OnDestroy {
  private readonly api = inject(AssessmentReadApiService);
  private readonly tokens = inject(TokenStore);
  private readonly route = inject(ActivatedRoute, { optional: true });
  readonly isNotary = this.tokens.role() === UserRole.Notary;
  readonly labels = STATUS_LABELS;
  readonly statuses = Object.entries(STATUS_LABELS);
  readonly types = Object.entries(OBJECT_TYPES);
  readonly objectTypes = OBJECT_TYPES;
  readonly items = signal<WorkspaceAssessment[]>([]);
  readonly selected = signal<WorkspaceAssessment | null>(null);
  readonly dialog = signal<Dialog>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly dialogError = signal('');
  readonly notice = signal('');
  readonly catalogs = signal<WorkspaceCatalogs>({ cities: [], applicants: [] });
  readonly catalogsReady = signal(false);
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly total = signal(0);
  readonly pollingError = signal('');
  readonly maxYear = new Date().getFullYear() + 5;
  search = '';
  status = '';
  cityId = '';
  type = '';
  draft = emptyDraft();
  customCityName = '';
  targetStatus: WorkspaceStatus = 'InProgress';
  reason = '';
  estimatedValue: number | null = null;
  private listVersion = 0;
  private viewVersion = 0;
  private destroyed = false;
  private lastFocus: HTMLElement | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;

  ngOnInit() {
    const id = this.route?.snapshot.paramMap.get('assessmentId');
    if (id) void this.openId(id, 'request');
    void this.load();
    void this.loadCatalogs();
    this.timer = setInterval(() => {
      void this.poll();
    }, 15000);
  }
  async loadCatalogs() {
    try {
      this.catalogs.set(await this.api.catalogs());
      this.catalogsReady.set(true);
    } catch (error) {
      this.error.set(this.message(error));
    }
  }
  async load(page = this.page()) {
    const version = ++this.listVersion;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.api.list(page, {
        search: this.search.trim(),
        status: this.status,
        cityId: this.cityId,
        type: this.type,
      });
      if (version !== this.listVersion || this.destroyed) return;
      this.items.set(result.items);
      this.page.set(result.page);
      this.totalPages.set(result.totalPages);
      this.total.set(result.total);
    } catch (error) {
      if (version === this.listVersion) this.error.set(this.message(error));
    } finally {
      if (version === this.listVersion) this.loading.set(false);
    }
  }
  resetFilters() {
    this.search = '';
    this.status = '';
    this.cityId = '';
    this.type = '';
    void this.load(1);
  }
  editable(item: WorkspaceAssessment) {
    return item.status === 'New' || item.status === 'Verified';
  }
  canRequest(item: WorkspaceAssessment) {
    return this.editable(item) && !item.order && !!item.property;
  }
  async open(item: WorkspaceAssessment, dialog: Dialog = 'view') {
    return this.openId(item.id, dialog);
  }
  private async openId(id: string, dialog: Dialog) {
    if (this.busy()) return;
    const version = ++this.viewVersion;
    this.busy.set(true);
    this.error.set('');
    try {
      const fresh = await this.api.get(id);
      if (version !== this.viewVersion || this.destroyed) return;
      this.selected.set(fresh);
      this.draft = this.toDraft(fresh);
      this.showDialog(dialog === 'request' && !this.canRequest(fresh) ? 'view' : dialog);
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }
  create() {
    this.selected.set(null);
    this.draft = emptyDraft();
    this.customCityName = '';
    if (!this.isNotary) this.draft.userId = this.tokens.user()?.id ?? '';
    this.showDialog('create');
  }
  showDialog(dialog: Dialog) {
    this.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.dialogError.set('');
    this.pollingError.set('');
    this.dialog.set(dialog);
    setTimeout(() =>
      document
        .querySelector<HTMLElement>('.dialog [data-autofocus], .dialog input, .dialog button')
        ?.focus(),
    );
  }
  close() {
    if (this.busy()) return;
    ++this.viewVersion;
    this.dialog.set(null);
    this.dialogError.set('');
    this.lastFocus?.focus();
  }
  onOverlayClick(event: MouseEvent) {
    if (event.target !== event.currentTarget || window.getSelection()?.toString().trim()) return;
    this.close();
  }
  syncCityFromAddress(address: string) {
    const parts = address
      .toLocaleLowerCase('ru')
      .split(',')
      .map((part) => part.trim().replace(/^(?:г\.?|город)\s+/, ''));
    const match = [...this.catalogs().cities]
      .sort((a, b) => b.name.length - a.name.length)
      .find((city) => {
        const name = city.name.toLocaleLowerCase('ru');
        return parts.some((part) => part === name || part.startsWith(`${name} `));
      });
    if (!match) return;
    this.draft.property.cityId = match.id;
    this.customCityName = '';
  }
  get addingCustomCity() {
    return this.draft.property.cityId === CUSTOM_CITY;
  }
  @HostListener('document:keydown', ['$event']) onKey(event: KeyboardEvent) {
    if (!this.dialog()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
    if (event.key !== 'Tab') return;
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.dialog button:not(:disabled), .dialog input:not(:disabled), .dialog select:not(:disabled), .dialog textarea:not(:disabled), .dialog [tabindex="0"]',
      ),
    );
    if (!elements.length) return;
    const first = elements[0],
      last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  private toDraft(item: WorkspaceAssessment): AssessmentDraft {
    return {
      userId: item.userId,
      address: item.address,
      description: item.description,
      property: { ...emptyDraft().property, ...item.property },
    };
  }
  editSelected() {
    const item = this.selected();
    if (item) {
      this.draft = this.toDraft(item);
      this.customCityName = '';
      this.showDialog('edit');
    }
  }
  async save() {
    if (this.busy()) return;
    if (
      this.draft.property.floor &&
      this.draft.property.floorsTotal &&
      this.draft.property.floor > this.draft.property.floorsTotal
    ) {
      this.dialogError.set('Этаж не может быть выше этажности дома');
      return;
    }
    const editing = this.dialog() === 'edit';
    const id = this.selected()?.id;
    if (this.addingCustomCity && this.customCityName.trim().length < 2) {
      this.dialogError.set('Введите название города');
      return;
    }
    await this.mutate(
      async () => {
        let draft = this.draft;
        if (this.addingCustomCity) {
          const city = await this.api.addCity(this.customCityName);
          draft = { ...draft, property: { ...draft.property, cityId: city.id } };
          this.draft = draft;
          this.catalogs.update((catalogs) => ({
            ...catalogs,
            cities: [...catalogs.cities.filter((entry) => entry.id !== city.id), city].sort(
              (a, b) => a.name.localeCompare(b.name, 'ru'),
            ),
          }));
        }
        return editing && id ? this.api.update(id, draft) : this.api.create(draft);
      },
      editing ? 'Изменения сохранены' : 'Заявка создана',
    );
  }
  async mutate(action: () => Promise<WorkspaceAssessment>, notice: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.dialogError.set('');
    try {
      const item = await action();
      this.selected.set(item);
      this.dialog.set('view');
      this.notice.set(notice);
      await this.load();
    } catch (error) {
      this.dialogError.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }
  requested(item: WorkspaceAssessment) {
    this.selected.set(item);
    this.dialog.set('view');
    this.notice.set('Заказ создан и связан с заявкой');
    void this.load();
  }
  deleteSelected() {
    this.showDialog('delete');
  }
  async remove() {
    const item = this.selected();
    if (!item || this.busy()) return;
    this.busy.set(true);
    this.dialogError.set('');
    try {
      await this.api.remove(item.id);
      this.dialog.set(null);
      this.selected.set(null);
      this.notice.set('Заявка удалена');
      await this.load();
    } catch (error) {
      this.dialogError.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }
  statusOptions(item: WorkspaceAssessment): WorkspaceStatus[] {
    if (item.status === 'Completed' || item.status === 'Cancelled') return [];
    const values: WorkspaceStatus[] = [];
    if (this.isNotary && item.order && item.status === 'Verified') values.push('InProgress');
    if (this.isNotary && item.order && item.status === 'InProgress') values.push('Completed');
    values.push('Cancelled');
    return values;
  }
  statusDialog() {
    const item = this.selected();
    if (!item) return;
    this.targetStatus = this.statusOptions(item)[0];
    this.reason = '';
    this.estimatedValue = null;
    this.showDialog('status');
  }
  async saveStatus() {
    const item = this.selected();
    if (!item) return;
    await this.mutate(
      () =>
        this.api.status(item.id, this.targetStatus, this.reason, this.estimatedValue ?? undefined),
      'Статус обновлён',
    );
  }
  city(item: WorkspaceAssessment) {
    const known = item.property?.cityName?.trim();
    if (known) return known;
    const address = item.address.toLocaleLowerCase('ru');
    const match = this.catalogs().cities.find((city) =>
      address
        .split(',')
        .some(
          (part) =>
            part.trim().replace(/^(г\.?|город)\s+/, '') === city.name.toLocaleLowerCase('ru'),
        ),
    );
    return match ? match.name + ' (из адреса)' : 'Уточните город в карточке';
  }
  stages(item: WorkspaceAssessment) {
    const history = item.order?.history ?? [];
    const statusOrder = ['New', 'Verified', 'InProgress', 'Completed'];
    const rank =
      item.status === 'Cancelled'
        ? Math.max(0, ...history.map((event) => statusOrder.indexOf(event.status)))
        : statusOrder.indexOf(item.status);
    return [
      { label: 'Получена', date: item.createdAt },
      {
        label: 'В очереди',
        date: history.find((event) => event.status === 'Verified')?.date ?? item.order?.submittedAt,
      },
      {
        label: 'Обрабатывается',
        date: history.find((event) => event.status === 'InProgress')?.date,
      },
      {
        label: 'Завершена',
        date:
          history.find((event) => event.status === 'Completed')?.date ??
          (item.status === 'Completed' ? item.order?.actualCompletionDate : undefined),
      },
    ].map((stage, index) => ({ ...stage, reached: !!stage.date || index <= rank }));
  }
  money(value: number | null | undefined) {
    return value == null
      ? '—'
      : new Intl.NumberFormat('ru-RU', {
          style: 'currency',
          currency: 'RUB',
          maximumFractionDigits: 0,
        }).format(value);
  }
  modelLabel(value: keyof typeof EVALUATION_MODEL_LABELS) {
    return EVALUATION_MODEL_LABELS[value] ?? 'Модель не указана';
  }
  urgencyLabel(value: keyof typeof EVALUATION_URGENCY_LABELS) {
    return EVALUATION_URGENCY_LABELS[value] ?? 'Срок не указан';
  }
  async poll() {
    const old = this.selected();
    if (
      this.polling ||
      this.busy() ||
      this.dialog() !== 'view' ||
      !old?.order ||
      ['Completed', 'Cancelled'].includes(old.status)
    )
      return;
    const version = this.viewVersion;
    this.polling = true;
    try {
      const fresh = await this.api.get(old.id);
      if (
        this.destroyed ||
        this.busy() ||
        this.dialog() !== 'view' ||
        version !== this.viewVersion ||
        this.selected()?.id !== old.id
      )
        return;
      this.selected.set(fresh);
      this.pollingError.set('');
      this.items.update((items) => items.map((item) => (item.id === fresh.id ? fresh : item)));
      if (fresh.status !== old.status) {
        this.notice.set('Статус заявки: ' + this.labels[fresh.status]);
        await this.load();
      }
    } catch (error) {
      if (this.dialog() === 'view' && this.selected()?.id === old.id)
        this.pollingError.set(this.message(error));
    } finally {
      this.polling = false;
    }
  }
  message(error: unknown) {
    return error instanceof Error ? error.message : 'Не удалось выполнить действие';
  }
  ngOnDestroy() {
    this.destroyed = true;
    ++this.listVersion;
    ++this.viewVersion;
    if (this.timer) clearInterval(this.timer);
  }
}
