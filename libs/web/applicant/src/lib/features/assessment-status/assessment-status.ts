import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AssessmentStatus as RpcAssessmentStatus } from '@notary-portal/api-contracts';
import { AssessmentApiService } from '../estimation-form/assessment-api.service';
import { EstimationFormLocalDraftService } from '../estimation-form/estimation-form-local-draft.service';
import { EstimationFormSessionService } from '../estimation-form/estimation-form-session.service';

const ASSESSMENT_ID_QUERY_PARAM = 'assessmentId';
const READONLY_QUERY_PARAM = 'readonly';

@Component({
  selector: 'lib-assessment-status',
  standalone: true,
  imports: [],
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
    const targetRoute = '/applicant/assessment/new/params';
    console.info('[ApplicantAssessmentStatus] create_new_assessment:click', {
      previousAssessmentId: this.assessmentId() ?? undefined,
      currentStatus: this.currentStatusLabel,
      targetRoute,
    });
    await this.logApplicantAssessmentAction('create_new_assessment', targetRoute);

    try {
      const userId = await this.sessionService.ensureUserId();
      this.localDraftService.clear(userId);
    } catch (error) {
      console.error('[ApplicantAssessmentStatus] create_new_assessment:error', error);
      this.createNewError.set(
        'Не удалось очистить локальный черновик. Обновите страницу и попробуйте ещё раз.',
      );
      return;
    }

    const navigated = await this.router.navigate([targetRoute], {
      queryParams: {},
      replaceUrl: false,
    });
    if (navigated) {
      console.info('[ApplicantAssessmentStatus] create_new_assessment:success', {
        targetRoute,
      });
    }
  }

  async returnToParams(): Promise<void> {
    const targetRoute = '/applicant/assessment';
    console.info('[ApplicantAssessmentStatus] return_to_params:click', {
      assessmentId: this.assessmentId() ?? undefined,
      currentStatus: this.currentStatusLabel,
      targetRoute,
      readonly: !this.isDraftStatus(),
    });
    await this.logApplicantAssessmentAction('return_to_params', targetRoute);
    await this.router.navigate([targetRoute], {
      queryParams: this.returnQueryParams(),
    });
  }

  async openAssessmentHistory(): Promise<void> {
    const targetRoute = '/applicant/assessment/history';
    console.info('[ApplicantAssessmentStatus] open_history:click', {
      assessmentId: this.assessmentId() ?? undefined,
      currentStatus: this.currentStatusLabel,
      targetRoute,
    });
    await this.logApplicantAssessmentAction('open_history', targetRoute);
    await this.router.navigate([targetRoute]);
  }

  private async loadAssessmentStatus(): Promise<void> {
    const assessmentId =
      this.route.snapshot.queryParamMap.get(ASSESSMENT_ID_QUERY_PARAM)?.trim() ?? '';
    if (!assessmentId) {
      return;
    }

    this.assessmentId.set(assessmentId);
    this.loadError.set(null);
    const startedAt = Date.now();
    console.info('[ApplicantAssessmentStatus] status.load:start', {
      assessmentId,
    });

    try {
      const assessment = await this.assessmentApi.getAssessment(assessmentId);
      this.currentStatus.set(assessment.status);
      console.info('[ApplicantAssessmentStatus] status.load:success', {
        assessmentId,
        status: this.currentStatusLabel,
        durationMs: Date.now() - startedAt,
      });
      await this.logApplicantAssessmentAction('status_loaded', '/applicant/assessment/status');
    } catch (error) {
      console.error('[ApplicantAssessmentStatus] status.load:error', error);
      await this.logApplicantAssessmentAction(
        'status_load_failed',
        '/applicant/assessment/status',
        undefined,
      );
      this.loadError.set('Не удалось загрузить актуальный статус заявки.');
    }
  }

  private async logApplicantAssessmentAction(
    action:
      | 'status_loaded'
      | 'status_load_failed'
      | 'return_to_params'
      | 'create_new_assessment'
      | 'open_history',
    targetRoute: string,
    status = toBackendStatus(this.currentStatus()),
  ): Promise<void> {
    try {
      await this.assessmentApi.logApplicantAssessmentAction({
        action,
        assessmentId: this.assessmentId() ?? undefined,
        status,
        targetRoute,
      });
    } catch (error) {
      console.warn('[ApplicantAssessmentStatus] backend_log:warn', error);
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

function toBackendStatus(status: RpcAssessmentStatus): string | undefined {
  switch (status) {
    case RpcAssessmentStatus.NEW:
      return 'NEW';
    case RpcAssessmentStatus.VERIFIED:
      return 'VERIFIED';
    case RpcAssessmentStatus.IN_PROGRESS:
      return 'IN_PROGRESS';
    case RpcAssessmentStatus.COMPLETED:
      return 'COMPLETED';
    case RpcAssessmentStatus.CANCELLED:
      return 'CANCELLED';
    default:
      return undefined;
  }
}
