import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AssessmentStatus as RpcAssessmentStatus } from '@notary-portal/api-contracts';
import { AssessmentApiService } from '../estimation-form/assessment-api.service';
import { EstimationFormLocalDraftService } from '../estimation-form/estimation-form-local-draft.service';
import { EstimationFormSessionService } from '../estimation-form/estimation-form-session.service';

const ASSESSMENT_ID_QUERY_PARAM = 'assessmentId';
const READONLY_QUERY_PARAM = 'readonly';

@Component({
  selector: 'lib-assessment-status',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './assessment-status.html',
  styleUrl: './assessment-status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssessmentStatus {
  readonly assessmentId = signal<string | null>(null);
  readonly currentStatus = signal<RpcAssessmentStatus>(RpcAssessmentStatus.NEW);
  readonly loadError = signal<string | null>(null);
  readonly createNewError = signal<string | null>(null);
  readonly isDraftStatus = computed(() => this.currentStatus() === RpcAssessmentStatus.NEW);
  readonly returnButtonLabel = computed(() =>
    this.isDraftStatus() ? 'Вернуться к параметрам' : 'Просмотреть параметры',
  );
  readonly returnQueryParams = computed(() => {
    const assessmentId = this.assessmentId();
    if (!assessmentId) {
      return {};
    }

    return {
      [ASSESSMENT_ID_QUERY_PARAM]: assessmentId,
      ...(!this.isDraftStatus() && { [READONLY_QUERY_PARAM]: '1' }),
    };
  });

  readonly statusSteps = [
    { status: RpcAssessmentStatus.NEW, label: 'Создана' },
    { status: RpcAssessmentStatus.VERIFIED, label: 'Принята' },
    { status: RpcAssessmentStatus.IN_PROGRESS, label: 'На рассмотрении' },
    { status: RpcAssessmentStatus.COMPLETED, label: 'Завершена' },
    { status: RpcAssessmentStatus.CANCELLED, label: 'Отклонена' },
  ] as const;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly assessmentApi = inject(AssessmentApiService);
  private readonly sessionService = inject(EstimationFormSessionService);
  private readonly localDraftService = inject(EstimationFormLocalDraftService);

  constructor() {
    void this.loadAssessmentStatus();
  }

  get currentStatusLabel(): string {
    return this.getStatusLabel(this.currentStatus());
  }

  isStepDone(status: RpcAssessmentStatus): boolean {
    return getStatusOrder(status) < getStatusOrder(this.currentStatus());
  }

  isStepCurrent(status: RpcAssessmentStatus): boolean {
    return status === this.currentStatus();
  }

  async createNewAssessment(): Promise<void> {
    this.createNewError.set(null);

    try {
      const userId = await this.sessionService.ensureUserId();
      this.localDraftService.clear(userId);
    } catch (error) {
      console.error('Failed to clear assessment draft before creating new assessment', error);
      this.createNewError.set(
        'Не удалось очистить локальный черновик. Обновите страницу и попробуйте ещё раз.',
      );
      return;
    }

    await this.router.navigate(['/applicant/assessment/new/params'], {
      queryParams: {},
      replaceUrl: false,
    });
  }

  private async loadAssessmentStatus(): Promise<void> {
    const assessmentId =
      this.route.snapshot.queryParamMap.get(ASSESSMENT_ID_QUERY_PARAM)?.trim() ?? '';
    if (!assessmentId) {
      return;
    }

    this.assessmentId.set(assessmentId);
    this.loadError.set(null);

    try {
      const assessment = await this.assessmentApi.getAssessment(assessmentId);
      this.currentStatus.set(assessment.status);
    } catch (error) {
      console.error('Failed to load assessment status', error);
      this.loadError.set('Не удалось загрузить актуальный статус заявки.');
    }
  }

  private getStatusLabel(status: RpcAssessmentStatus): string {
    switch (status) {
      case RpcAssessmentStatus.NEW:
        return 'Создана';
      case RpcAssessmentStatus.VERIFIED:
        return 'Принята';
      case RpcAssessmentStatus.IN_PROGRESS:
        return 'На рассмотрении';
      case RpcAssessmentStatus.COMPLETED:
        return 'Завершена';
      case RpcAssessmentStatus.CANCELLED:
        return 'Отклонена';
      default:
        return 'Не указан';
    }
  }
}

function getStatusOrder(status: RpcAssessmentStatus): number {
  switch (status) {
    case RpcAssessmentStatus.NEW:
      return 1;
    case RpcAssessmentStatus.VERIFIED:
      return 2;
    case RpcAssessmentStatus.IN_PROGRESS:
      return 3;
    case RpcAssessmentStatus.COMPLETED:
      return 4;
    case RpcAssessmentStatus.CANCELLED:
      return 5;
    default:
      return 0;
  }
}
