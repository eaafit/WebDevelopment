import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { AuditService } from '@internal/audit';
import { Role, getCurrentUser } from '@internal/auth-shared';
import { BitrixLeadPublisherService } from '@internal/bitrix-leads';
import { NotificationService } from '@internal/notification';
import {
  BusinessOperations,
  NotarySpanAttributes,
  markSpanFailure,
  normalizeSpanActorRole,
  runInSpan,
  setSpanAttributes,
} from '@internal/tracing';
import {
  AssessmentStatus,
  CancelAssessmentResponseSchema,
  CompleteAssessmentResponseSchema,
  CreateAssessmentResponseSchema,
  ElevatorType,
  GetFiasAddressDetailsResponseSchema,
  GetFiasAddressHintsResponseSchema,
  GetFiasAddressItemByGuidResponseSchema,
  GetFiasAddressItemByIdResponseSchema,
  LogApplicantAssessmentActionResponseSchema,
  RealEstateCondition,
  RealEstateObjectType,
  SearchFiasAddressItemsResponseSchema,
  SearchFiasAddressByPartsResponseSchema,
  type CancelAssessmentRequest,
  type CancelAssessmentResponse,
  type CompleteAssessmentRequest,
  type CompleteAssessmentResponse,
  type CreateAssessmentRequest,
  type CreateAssessmentResponse,
  type GetFiasAddressDetailsRequest,
  type GetFiasAddressDetailsResponse,
  type GetFiasAddressHintsRequest,
  type GetFiasAddressHintsResponse,
  type FiasAddressItem,
  type GetFiasAddressItemByGuidRequest,
  type GetFiasAddressItemByGuidResponse,
  type GetFiasAddressItemByIdRequest,
  type GetFiasAddressItemByIdResponse,
  type GetAssessmentRequest,
  type GetAssessmentResponse,
  type ListAssessmentsRequest,
  type ListAssessmentsResponse,
  type ListCitiesRequest,
  type ListCitiesResponse,
  type ListDistrictsRequest,
  type ListDistrictsResponse,
  type LogApplicantAssessmentActionRequest,
  type LogApplicantAssessmentActionResponse,
  type RealEstateObjectInput,
  type SearchFiasAddressByPartsRequest,
  type SearchFiasAddressByPartsResponse,
  type SearchFiasAddressItemsRequest,
  type SearchFiasAddressItemsResponse,
  type UpdateAssessmentRequest,
  type UpdateAssessmentResponse,
  type VerifyAssessmentRequest,
  type VerifyAssessmentResponse,
  NotificationCategory as RpcNotificationCategory,
  NotificationType as RpcNotificationType,
  UpdateAssessmentResponseSchema,
  VerifyAssessmentResponseSchema,
  WallMaterial,
} from '@notary-portal/api-contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '@internal/metrics';
import {
  AssessmentStatus as PrismaAssessmentStatus,
  Role as PrismaRole,
} from '@internal/prisma-client';
import {
  AssessmentRepository,
  type AssessmentAuditSnapshot,
  type AssessmentRealEstateObjectData,
} from './assessment.repository';
import type { AssessmentQuery } from './assessment.query';
import { FIAS_PROVIDER, type FiasProvider } from '../fias/fias-provider';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;
const CADASTRAL_NUMBER_PATTERN = /^\d{12}$/;
const AREA_LIMITS = { minimum: 1, maximum: 10_000 } as const;
const ROOMS_LIMITS = { minimum: 1, compactMaximum: 20, commonMaximum: 50 } as const;
const FLOOR_LIMITS = { minimum: 1, maximum: 100 } as const;
const FIAS_QUERY_MIN_LENGTH = 3;
const FIAS_LIMITS = { default: 5, maximum: 10 } as const;
const APPLICANT_ASSESSMENT_ACTIONS = new Set([
  'status_loaded',
  'status_load_failed',
  'return_to_params',
  'create_new_assessment',
  'open_history',
]);
const YEAR_BUILT_LIMITS = {
  minimum: 1700,
  maximum: new Date().getFullYear() + 1,
} as const;

@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  constructor(
    private readonly assessmentRepository: AssessmentRepository,
    private readonly auditService: AuditService,
    private readonly metrics: MetricsService,
    @Inject(FIAS_PROVIDER) private readonly fiasProvider: FiasProvider,
    private readonly notificationService: NotificationService,
    private readonly bitrixLeadPublisher: BitrixLeadPublisherService,
  ) {}

  listCities(request: ListCitiesRequest): Promise<ListCitiesResponse> {
    void request;
    return this.assessmentRepository.listCities();
  }

  listDistricts(request: ListDistrictsRequest): Promise<ListDistrictsResponse> {
    return this.assessmentRepository.listDistricts(
      normalizeOptionalUuid(request.cityId, 'city_id'),
    );
  }

  async getFiasAddressHints(
    request: GetFiasAddressHintsRequest,
  ): Promise<GetFiasAddressHintsResponse> {
    const query = normalizeFiasQuery(request.query);
    const limit = normalizeFiasLimit(request.limit);
    return runInSpan(
      'AssessmentService.getFiasAddressHints',
      {
        'notary.operation': 'assessment.fias.hints',
        'notary.entity': 'FiasAddress',
        'fias.query_length': query.length,
        'fias.limit': limit,
      },
      async () => {
        const startedAt = Date.now();
        this.logger.log(
          `Starting FIAS address hints request queryLength=${query.length} limit=${limit}`,
        );

        try {
          if (query.length < FIAS_QUERY_MIN_LENGTH) {
            this.logger.log(
              `Completed FIAS address hints request hintsCount=0 durationMs=${Date.now() - startedAt}`,
            );
            return create(GetFiasAddressHintsResponseSchema, { hints: [] });
          }

          const hints = await this.fiasProvider.getAddressHint({
            query,
            limit,
            addressType: normalizeFiasAddressType(request.addressType),
          });

          this.logger.log(
            `Completed FIAS address hints request hintsCount=${hints.length} durationMs=${Date.now() - startedAt}`,
          );
          return create(GetFiasAddressHintsResponseSchema, { hints });
        } catch (error) {
          this.logFiasOperationFailure('address hints request', error, {
            queryLength: query.length,
          });
          throw error;
        }
      },
    );
  }

  async searchFiasAddressItems(
    request: SearchFiasAddressItemsRequest,
  ): Promise<SearchFiasAddressItemsResponse> {
    return runInSpan(
      'AssessmentService.searchFiasAddressItems',
      {
        'notary.operation': 'assessment.fias.search',
        'notary.entity': 'FiasAddress',
      },
      async (span) => {
        const query = normalizeFiasQuery(request.query);
        const limit = normalizeFiasLimit(request.limit);
        setSpanAttributes(span, {
          'fias.query_length': query.length,
          'fias.limit': limit,
        });
        if (query.length < FIAS_QUERY_MIN_LENGTH) {
          return create(SearchFiasAddressItemsResponseSchema, { items: [] });
        }

        const items = await this.fiasProvider.searchAddressItems({
          query,
          limit,
          addressType: normalizeFiasAddressType(request.addressType),
        });

        return create(SearchFiasAddressItemsResponseSchema, { items });
      },
    );
  }

  async getFiasAddressItemById(
    request: GetFiasAddressItemByIdRequest,
  ): Promise<GetFiasAddressItemByIdResponse> {
    return runInSpan(
      'AssessmentService.getFiasAddressItemById',
      {
        'notary.operation': 'assessment.fias.lookup_by_id',
        'notary.entity': 'FiasAddress',
      },
      async () => {
        const objectId = normalizeRequiredText(request.objectId, 'object_id');
        const startedAt = Date.now();
        this.logger.log('Starting FIAS address item lookup; operation=assessment.fias.lookup_by_id');

        try {
          const item = await this.resolveFiasItemGeography(
            await this.fiasProvider.getAddressItemById(objectId),
          );
          this.logger.log(
            `Completed FIAS address item lookup; operation=assessment.fias.lookup_by_id; result=success; durationMs=${Date.now() - startedAt}`,
          );
          return create(GetFiasAddressItemByIdResponseSchema, { item });
        } catch (error) {
          this.logFiasOperationFailure('address item lookup', error, { objectId });
          throw error;
        }
      },
    );
  }

  async getFiasAddressItemByGuid(
    request: GetFiasAddressItemByGuidRequest,
  ): Promise<GetFiasAddressItemByGuidResponse> {
    return runInSpan(
      'AssessmentService.getFiasAddressItemByGuid',
      {
        'notary.operation': 'assessment.fias.lookup_by_guid',
        'notary.entity': 'FiasAddress',
      },
      async () => {
        const item = await this.resolveFiasItemGeography(
          await this.fiasProvider.getAddressItemByGuid(
            normalizeRequiredText(request.objectGuid, 'object_guid'),
          ),
        );
        return create(GetFiasAddressItemByGuidResponseSchema, { item });
      },
    );
  }

  async getFiasAddressDetails(
    request: GetFiasAddressDetailsRequest,
  ): Promise<GetFiasAddressDetailsResponse> {
    return runInSpan(
      'AssessmentService.getFiasAddressDetails',
      {
        'notary.operation': 'assessment.fias.details',
        'notary.entity': 'FiasAddress',
      },
      async () => {
        const details = await this.fiasProvider.getDetails(
          normalizeRequiredText(request.objectId, 'object_id'),
        );
        return create(GetFiasAddressDetailsResponseSchema, { details });
      },
    );
  }

  async searchFiasAddressByParts(
    request: SearchFiasAddressByPartsRequest,
  ): Promise<SearchFiasAddressByPartsResponse> {
    return runInSpan(
      'AssessmentService.searchFiasAddressByParts',
      {
        'notary.operation': 'assessment.fias.search_by_parts',
        'notary.entity': 'FiasAddress',
      },
      async (span) => {
        const region = normalizeOptionalText(request.region);
        const city = normalizeOptionalText(request.city);
        const street = normalizeOptionalText(request.street);
        const house = normalizeOptionalText(request.house);
        const limit = normalizeFiasLimit(request.limit);
        setSpanAttributes(span, {
          'fias.has_region': Boolean(region),
          'fias.has_city': Boolean(city),
          'fias.has_street': Boolean(street),
          'fias.has_house': Boolean(house),
          'fias.limit': limit,
        });

        if (!region && !city && !street && !house) {
          return create(SearchFiasAddressByPartsResponseSchema, { items: [] });
        }

        const items = await this.fiasProvider.searchByParts({
          region,
          city,
          street,
          house,
          limit,
          addressType: normalizeFiasAddressType(request.addressType),
        });

        return create(SearchFiasAddressByPartsResponseSchema, { items });
      },
    );
  }

  async logApplicantAssessmentAction(
    request: LogApplicantAssessmentActionRequest,
  ): Promise<LogApplicantAssessmentActionResponse> {
    return runInSpan(
      'AssessmentService.logApplicantAssessmentAction',
      {
        'notary.operation': 'assessment.applicant_action',
        'notary.entity': 'Assessment',
        'notary.actor.role': normalizeSpanActorRole(getCurrentUser()?.role),
      },
      async (span) => {
        const action = normalizeRequiredText(request.action, 'action');
        if (!APPLICANT_ASSESSMENT_ACTIONS.has(action)) {
          setSpanAttributes(span, { 'assessment.ui_action': 'unsupported' });
          this.logger.warn(
            'Unsupported applicant assessment UI action; operation=assessment.applicant_action; result=invalid_action',
          );
          throw new ConnectError(
            'action must be a supported applicant assessment UI action',
            Code.InvalidArgument,
          );
        }

        setSpanAttributes(span, { 'assessment.ui_action': action });
        this.logger.log(
          `Applicant assessment UI action; operation=assessment.applicant_action; result=success; action=${action}; status=${normalizeOptionalText(request.status) ?? 'unknown'}`,
        );

        return create(LogApplicantAssessmentActionResponseSchema, { ok: true });
      },
    );
  }

  async listAssessments(request: ListAssessmentsRequest): Promise<ListAssessmentsResponse> {
    const query = this.normalizeListRequest(request);
    this.logger.log(
      `Starting assessment list request; operation=assessment.list; page=${query.page}; limit=${query.limit}; hasStatusFilter=${Boolean(query.status)}`,
    );

    try {
      const response = await this.assessmentRepository.listAssessments(query);
      this.logger.log(
        `Completed assessment list request page=${response.meta?.currentPage ?? query.page}` +
          ` totalItems=${response.meta?.totalItems ?? response.assessments.length}`,
      );
      return response;
    } catch (error) {
      this.logOperationFailure('listAssessments', error, {
        userId: query.userId,
        status: query.status,
      });
      throw error;
    }
  }

  async getAssessment(request: GetAssessmentRequest): Promise<GetAssessmentResponse> {
    this.logger.log('Starting assessment lookup; operation=assessment.get');

    try {
      validateUuid(request.id, 'id');
      const response = await this.assessmentRepository.getAssessment(request.id);
      this.logger.log('Completed assessment lookup; operation=assessment.get; result=success');
      return response;
    } catch (error) {
      this.logOperationFailure('getAssessment', error, { assessmentId: request.id });
      throw error;
    }
  }

  async createAssessment(request: CreateAssessmentRequest): Promise<CreateAssessmentResponse> {
    return runInSpan(
      'AssessmentService.createAssessment',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.assessmentCreate,
        [NotarySpanAttributes.entity]: 'Assessment',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(getCurrentUser()?.role),
        'assessment.has_real_estate_object': hasRealEstateObjectInputData(request.realEstateObject),
      },
      async () => {
        this.logger.log(
          `Starting assessment creation; operation=assessment.create; hasRealEstateObject=${hasRealEstateObjectInputData(request.realEstateObject)}`,
        );

        try {
          const normalized = await runInSpan(
            'AssessmentService.createAssessment.normalizeAndValidate',
            {
              'notary.operation': 'assessment.create.normalize_and_validate',
              'notary.entity': 'Assessment',
              'assessment.has_real_estate_object': hasRealEstateObjectInputData(
                request.realEstateObject,
              ),
            },
            async () => {
              validateUuid(request.userId, 'user_id');

              const realEstateObject = await this.normalizeRealEstateObjectGeography(
                normalizeRealEstateObjectInput(request.realEstateObject, 'create'),
              );
              const address =
                realEstateObject?.address ?? normalizeRequiredText(request.address, 'address');

              return {
                address,
                description: normalizeOptionalText(request.description),
                realEstateObject,
              };
            },
          );

          const assessment = await runInSpan(
            'AssessmentRepository.createAssessment',
            {
              'notary.operation': 'assessment.repository.create',
              'notary.entity': 'Assessment',
              'db.operation': 'insert',
            },
            () =>
              this.assessmentRepository.createAssessment({
                userId: request.userId,
                address: normalized.address,
                description: normalized.description,
                realEstateObject: normalized.realEstateObject,
              }),
          );
          await runInSpan(
            'AssessmentRepository.createLeadFromAssessment side effect',
            {
              'notary.operation': 'assessment.lead.create_side_effect',
              'notary.entity': 'Lead',
            },
            async (leadSpan) => {
              try {
                await this.assessmentRepository.createLeadFromAssessment(
                  assessment.id,
                  assessment.userId,
                );
              } catch (error) {
                markSpanFailure(leadSpan, error);
                this.logger.warn(
                  `Assessment lead creation failed; operation=assessment.lead.create_side_effect; result=error; error=${safeErrorName(error)}`,
                );
              }
            },
          );

          const snapshot = await runInSpan(
            'AssessmentRepository.getAssessmentSnapshot',
            {
              'notary.operation': 'assessment.repository.snapshot',
              'notary.entity': 'Assessment',
              'db.operation': 'select',
            },
            () => this.assessmentRepository.getAssessmentSnapshot(assessment.id),
          );

          this.metrics.recordAssessmentCreated('new');
          await this.auditService.record({
            actorUserId: getCurrentUser()?.sub ?? request.userId,
            eventType: 'assessment.created',
            targetType: 'Assessment',
            targetId: assessment.id,
            actionTitle: 'Создана заявка',
            actionContext: 'Создание новой заявки на оценку',
            targetTitle: `Заявка ${shortId(assessment.id)}`,
            targetContext: snapshot.address,
            after: toAuditSnapshot(snapshot),
          });
          await this.createAdminAssessmentNotificationBestEffort({
            title: 'Создана новая заявка на оценку',
            message: `${await this.getActorDisplayName(getCurrentUser()?.sub ?? request.userId, 'Заявитель')} создал заявку ${shortId(
              assessment.id,
            )}: ${formatAssessmentAddress(snapshot.address)}.`,
          });

          // Публикация заявки как лида в Bitrix24 — fire-and-forget,
          // не блокирует ответ заявителю; ошибки логируются и не пробрасываются.
          this.bitrixLeadPublisher.publishLead(assessment.id).catch((error: unknown) => {
            this.logger.warn(
              `Bitrix lead publish failed; operation=bitrix.lead.publish; result=error; error=${safeErrorName(error)}`,
            );
          });

          this.logger.log(
            `Created assessment; operation=assessment.create; result=success; status=${assessment.status}`,
          );

          return create(CreateAssessmentResponseSchema, { assessment });
        } catch (error) {
          this.logOperationFailure('createAssessment', error, {
            userId: request.userId,
            cityId: request.realEstateObject?.cityId,
            districtId: request.realEstateObject?.districtId,
          });
          throw error;
        }
      },
    );
  }

  async updateAssessment(request: UpdateAssessmentRequest): Promise<UpdateAssessmentResponse> {
    return runInSpan(
      'AssessmentService.updateAssessment',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.assessmentUpdate,
        [NotarySpanAttributes.entity]: 'Assessment',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(getCurrentUser()?.role),
        'assessment.has_real_estate_object': hasRealEstateObjectInputData(request.realEstateObject),
      },
      async (span) => {
        this.logger.log(
          `Starting assessment update; operation=assessment.update; hasRealEstateObject=${hasRealEstateObjectInputData(request.realEstateObject)}`,
        );

        try {
          validateUuid(request.id, 'id');
          const before = await runInSpan(
            'AssessmentRepository.getAssessmentSnapshot before update',
            {
              'notary.operation': 'assessment.repository.snapshot',
              'notary.entity': 'Assessment',
              'db.operation': 'select',
            },
            () => this.assessmentRepository.getAssessmentSnapshot(request.id),
          );

          const realEstateObject = await runInSpan(
            'AssessmentService.updateAssessment.normalizeAndValidate',
            {
              'notary.operation': 'assessment.update.normalize_and_validate',
              'notary.entity': 'Assessment',
              'assessment.has_real_estate_object': hasRealEstateObjectInputData(
                request.realEstateObject,
              ),
            },
            () =>
              this.normalizeRealEstateObjectGeography(
                normalizeRealEstateObjectInput(request.realEstateObject, 'update'),
              ),
          );
          const assessment = await runInSpan(
            'AssessmentRepository.updateAssessment',
            {
              'notary.operation': 'assessment.repository.update',
              'notary.entity': 'Assessment',
              'db.operation': 'update',
            },
            () =>
              this.assessmentRepository.updateAssessment(request.id, {
                address: realEstateObject?.address ?? normalizeOptionalText(request.address),
                description: request.description.trim(),
                realEstateObject,
              }),
          );
          const after = await runInSpan(
            'AssessmentRepository.getAssessmentSnapshot after update',
            {
              'notary.operation': 'assessment.repository.snapshot',
              'notary.entity': 'Assessment',
              'db.operation': 'select',
            },
            () => this.assessmentRepository.getAssessmentSnapshot(assessment.id),
          );
          setSpanAttributes(span, {
            'assessment.status.from': before.status,
            'assessment.status.to': after.status,
          });

          await this.auditService.record({
            actorUserId: getCurrentUser()?.sub,
            eventType: 'assessment.updated',
            targetType: 'Assessment',
            targetId: assessment.id,
            actionTitle: 'Обновлена заявка',
            actionContext: 'Изменены данные заявки на оценку',
            targetTitle: `Заявка ${shortId(assessment.id)}`,
            targetContext: after.address,
            before: toAuditSnapshot(before),
            after: toAuditSnapshot(after),
          });
          await this.createAdminAssessmentNotificationBestEffort({
            title: 'Обновлена заявка на оценку',
            message: `${await this.getActorDisplayName(
              getCurrentUser()?.sub ?? before.userId,
              'Исполнитель',
            )} изменил данные заявки ${shortId(assessment.id)}: ${formatAssessmentAddress(
              after.address,
            )}.`,
          });

          this.logger.log(
            `Updated assessment; operation=assessment.update; result=success; status=${assessment.status}`,
          );

          return create(UpdateAssessmentResponseSchema, { assessment });
        } catch (error) {
          this.logOperationFailure('updateAssessment', error, {
            assessmentId: request.id,
            cityId: request.realEstateObject?.cityId,
            districtId: request.realEstateObject?.districtId,
          });
          throw error;
        }
      },
    );
  }

  async verifyAssessment(request: VerifyAssessmentRequest): Promise<VerifyAssessmentResponse> {
    return runInSpan(
      'AssessmentService.verifyAssessment',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.assessmentVerify,
        [NotarySpanAttributes.entity]: 'Assessment',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(getCurrentUser()?.role),
      },
      async (span) => {
        this.logger.log('Starting assessment verification; operation=assessment.verify');

        try {
          validateUuid(request.id, 'id');
          const actor = getCurrentUser();
          const before = await runInSpan(
            'AssessmentRepository.getAssessmentSnapshot before verify',
            {
              'notary.operation': 'assessment.repository.snapshot',
              'notary.entity': 'Assessment',
              'db.operation': 'select',
            },
            () => this.assessmentRepository.getAssessmentSnapshot(request.id),
          );

          const assessment = await runInSpan(
            'AssessmentRepository.verifyAssessment',
            {
              'notary.operation': 'assessment.repository.verify',
              'notary.entity': 'Assessment',
              'db.operation': 'update',
            },
            () =>
              this.assessmentRepository.verifyAssessment(
                request.id,
                isNotaryRole(actor?.role) ? actor?.sub : undefined,
              ),
          );
          const after = await runInSpan(
            'AssessmentRepository.getAssessmentSnapshot after verify',
            {
              'notary.operation': 'assessment.repository.snapshot',
              'notary.entity': 'Assessment',
              'db.operation': 'select',
            },
            () => this.assessmentRepository.getAssessmentSnapshot(assessment.id),
          );
          const assignedNotaryId = after.notaryId ?? undefined;
          const assignsNotary = before.notaryId !== assignedNotaryId && Boolean(assignedNotaryId);
          setSpanAttributes(span, {
            'assessment.status.from': before.status,
            'assessment.status.to': after.status,
            'assessment.assigns_notary': assignsNotary,
          });

          if (assignsNotary && assignedNotaryId) {
            await this.auditService.record({
              actorUserId: actor?.sub,
              eventType: 'assessment.assigned_to_notary',
              targetType: 'Assessment',
              targetId: assessment.id,
              actionTitle: 'Заявка назначена нотариусу',
              actionContext: `Нотариус: ${formatOptionalId(before.notaryId)} -> ${shortId(assignedNotaryId)}`,
              targetTitle: `Заявка ${shortId(assessment.id)}`,
              targetContext: after.address,
              before: toAuditSnapshot(before),
              after: toAuditSnapshot(after),
            });
            await this.createAdminAssessmentNotificationBestEffort({
              title: 'Заявка назначена нотариусу',
              message: buildAssignedToNotaryMessage(
                assessment.id,
                await this.assessmentRepository.getUserDisplayName(assignedNotaryId),
              ),
            });
          }

          await this.auditService.record({
            actorUserId: actor?.sub,
            eventType: 'assessment.status_in_progress',
            targetType: 'Assessment',
            targetId: assessment.id,
            actionTitle: 'Заявка переведена в работу',
            actionContext: `Статус: ${statusLabel(before.status)} -> ${statusLabel(after.status)}`,
            targetTitle: `Заявка ${shortId(assessment.id)}`,
            targetContext: after.address,
            before: toAuditSnapshot(before),
            after: toAuditSnapshot(after),
          });
          await this.createAdminAssessmentNotificationBestEffort({
            title: 'Заявка взята в работу',
            message: buildInProgressMessage(
              assessment.id,
              await this.getActorDisplayName(actor?.sub ?? after.notaryId ?? undefined),
            ),
          });
          await this.createApplicantAssessmentNotificationBestEffort({
            userId: after.userId,
            title: 'Заявка принята в работу',
            message: 'Ваша заявка принята нотариусом в работу.',
          });

          this.logger.log(
            `Verified assessment; operation=assessment.verify; result=success; status=${assessment.status}`,
          );

          return create(VerifyAssessmentResponseSchema, { assessment });
        } catch (error) {
          this.logOperationFailure('verifyAssessment', error, { assessmentId: request.id });
          throw error;
        }
      },
    );
  }

  async completeAssessment(
    request: CompleteAssessmentRequest,
  ): Promise<CompleteAssessmentResponse> {
    return runInSpan(
      'AssessmentService.completeAssessment',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.assessmentComplete,
        [NotarySpanAttributes.entity]: 'Assessment',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(getCurrentUser()?.role),
        'assessment.has_final_estimated_value': Boolean(request.finalEstimatedValue?.trim()),
      },
      async (span) => {
        this.logger.log('Starting assessment completion; operation=assessment.complete');

        try {
          validateUuid(request.id, 'id');
          const actor = getCurrentUser();
          const before = await runInSpan(
            'AssessmentRepository.getAssessmentSnapshot before complete',
            {
              'notary.operation': 'assessment.repository.snapshot',
              'notary.entity': 'Assessment',
              'db.operation': 'select',
            },
            () => this.assessmentRepository.getAssessmentSnapshot(request.id),
          );

          if (!DECIMAL_PATTERN.test(request.finalEstimatedValue)) {
            this.logger.warn(
              'Invalid final estimated value; operation=assessment.complete; result=invalid_input',
            );
            throw new ConnectError(
              'final_estimated_value must be a valid decimal number',
              Code.InvalidArgument,
            );
          }

          const assessment = await runInSpan(
            'AssessmentRepository.completeAssessment',
            {
              'notary.operation': 'assessment.repository.complete',
              'notary.entity': 'Assessment',
              'db.operation': 'update',
            },
            () =>
              this.assessmentRepository.completeAssessment(request.id, request.finalEstimatedValue),
          );
          const after = await runInSpan(
            'AssessmentRepository.getAssessmentSnapshot after complete',
            {
              'notary.operation': 'assessment.repository.snapshot',
              'notary.entity': 'Assessment',
              'db.operation': 'select',
            },
            () => this.assessmentRepository.getAssessmentSnapshot(assessment.id),
          );
          setSpanAttributes(span, {
            'assessment.status.from': before.status,
            'assessment.status.to': after.status,
            'assessment.has_final_estimated_value': Boolean(after.estimatedValue),
          });

          await this.auditService.record({
            actorUserId: actor?.sub,
            eventType: 'assessment.completed',
            targetType: 'Assessment',
            targetId: assessment.id,
            actionTitle: 'Заявка завершена',
            actionContext: `Статус: ${statusLabel(before.status)} -> ${statusLabel(after.status)}`,
            targetTitle: `Заявка ${shortId(assessment.id)}`,
            targetContext: after.address,
            before: toAuditSnapshot(before),
            after: toAuditSnapshot(after),
          });
          await this.createAdminAssessmentNotificationBestEffort({
            title: 'Оценка заявки завершена',
            message: buildCompletedMessage(assessment.id, after.estimatedValue),
          });
          await this.createApplicantAssessmentNotificationBestEffort({
            userId: after.userId,
            title: 'Заявка завершена',
            message: 'Ваша заявка успешно завершена. Отчёт готов к скачиванию.',
          });

          this.logger.log(
            `Completed assessment; operation=assessment.complete; result=success; status=${assessment.status}`,
          );

          return create(CompleteAssessmentResponseSchema, { assessment });
        } catch (error) {
          this.logOperationFailure('completeAssessment', error, { assessmentId: request.id });
          throw error;
        }
      },
    );
  }

  async cancelAssessment(request: CancelAssessmentRequest): Promise<CancelAssessmentResponse> {
    return runInSpan(
      'AssessmentService.cancelAssessment',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.assessmentCancel,
        [NotarySpanAttributes.entity]: 'Assessment',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(getCurrentUser()?.role),
        'assessment.has_cancel_reason': Boolean(request.reason?.trim()),
      },
      async (span) => {
        this.logger.log('Starting assessment cancellation; operation=assessment.cancel');

        try {
          validateUuid(request.id, 'id');
          const actor = getCurrentUser();
          const before = await runInSpan(
            'AssessmentRepository.getAssessmentSnapshot before cancel',
            {
              'notary.operation': 'assessment.repository.snapshot',
              'notary.entity': 'Assessment',
              'db.operation': 'select',
            },
            () => this.assessmentRepository.getAssessmentSnapshot(request.id),
          );

          const assessment = await runInSpan(
            'AssessmentRepository.cancelAssessment',
            {
              'notary.operation': 'assessment.repository.cancel',
              'notary.entity': 'Assessment',
              'db.operation': 'update',
            },
            () =>
              this.assessmentRepository.cancelAssessment(
                request.id,
                request.reason?.trim() || undefined,
              ),
          );
          const after = await runInSpan(
            'AssessmentRepository.getAssessmentSnapshot after cancel',
            {
              'notary.operation': 'assessment.repository.snapshot',
              'notary.entity': 'Assessment',
              'db.operation': 'select',
            },
            () => this.assessmentRepository.getAssessmentSnapshot(assessment.id),
          );
          setSpanAttributes(span, {
            'assessment.status.from': before.status,
            'assessment.status.to': after.status,
            'assessment.has_cancel_reason': Boolean(after.cancelReason?.trim()),
          });

          await this.auditService.record({
            actorUserId: actor?.sub,
            eventType: 'assessment.cancelled',
            targetType: 'Assessment',
            targetId: assessment.id,
            actionTitle: 'Заявка отменена',
            actionContext: `Статус: ${statusLabel(before.status)} -> ${statusLabel(after.status)}`,
            targetTitle: `Заявка ${shortId(assessment.id)}`,
            targetContext: after.address,
            before: toAuditSnapshot(before),
            after: toAuditSnapshot(after),
          });
          await this.createAdminAssessmentNotificationBestEffort({
            title: 'Заявка на оценку отменена',
            message: buildCancelledMessage(assessment.id, after.cancelReason),
          });
          await this.createApplicantAssessmentNotificationBestEffort({
            userId: after.userId,
            title: 'Заявка отменена',
            message: after.cancelReason?.trim()
              ? `Ваша заявка отменена. Причина: ${after.cancelReason.trim()}.`
              : 'Ваша заявка отменена.',
          });

          this.logger.log(
            `Cancelled assessment; operation=assessment.cancel; result=success; status=${assessment.status}`,
          );

          return create(CancelAssessmentResponseSchema, { assessment });
        } catch (error) {
          this.logOperationFailure('cancelAssessment', error, { assessmentId: request.id });
          throw error;
        }
      },
    );
  }

  private normalizeListRequest(request: ListAssessmentsRequest): AssessmentQuery {
    const pagination = request.pagination;

    return {
      page: normalizePositiveInt(pagination?.page, DEFAULT_PAGE),
      limit: normalizePositiveInt(pagination?.limit, DEFAULT_LIMIT),
      userId: request.userId || undefined,
      status:
        request.statusFilter === AssessmentStatus.UNSPECIFIED ? undefined : request.statusFilter,
    };
  }

  private logOperationFailure(
    operation: string,
    error: unknown,
    context: Record<string, unknown>,
  ): void {
    void context;
    if (isExpectedOperationError(error)) {
      this.logger.warn(
        `Assessment operation failed; operation=${operation}; result=expected_error; error=${safeErrorName(error)}`,
      );
      return;
    }

    this.logger.error(
      `Assessment operation failed; operation=${operation}; result=error; error=${safeErrorName(error)}`,
    );
  }

  private logFiasOperationFailure(
    operation: string,
    error: unknown,
    context: Record<string, unknown>,
  ): void {
    void context;
    if (isExpectedOperationError(error)) {
      this.logger.warn(
        `FIAS operation failed; operation=${operation}; result=expected_error; error=${safeErrorName(error)}`,
      );
      return;
    }

    this.logger.error(
      `FIAS operation failed; operation=${operation}; result=error; error=${safeErrorName(error)}`,
    );
  }

  private async getActorDisplayName(
    userId: string | undefined,
    fallback?: string,
  ): Promise<string | undefined> {
    if (!userId) return fallback;
    return (await this.assessmentRepository.getUserDisplayName(userId)) ?? fallback;
  }

  private async createAdminAssessmentNotificationBestEffort(input: {
    title: string;
    message: string;
  }): Promise<void> {
    try {
      await this.notificationService.createInternalNotificationsForRole(PrismaRole.Admin, {
        title: input.title,
        message: input.message,
        category: RpcNotificationCategory.ASSESSMENT,
        type: RpcNotificationType.IN_APP,
      });
    } catch (error) {
      this.logger.warn(
        `Assessment notification failed; operation=notification.create_internal_for_role; result=error; error=${safeErrorName(error)}`,
      );
    }
  }

  private async createApplicantAssessmentNotificationBestEffort(input: {
    userId: string;
    message: string;
    title?: string;
  }): Promise<void> {
    try {
      await this.notificationService.createInternalNotification({
        userId: input.userId,
        title: input.title,
        message: input.message,
        category: RpcNotificationCategory.ASSESSMENT,
        type: RpcNotificationType.IN_APP,
      });
    } catch (error) {
      this.logger.warn(
        `Assessment notification failed; operation=notification.create_internal; result=error; error=${safeErrorName(error)}`,
      );
    }
  }

  private async resolveFiasItemGeography(item: FiasAddressItem): Promise<FiasAddressItem> {
    const resolvedIds = await this.assessmentRepository.resolveGeographyIds({
      cityId: item.cityId,
      districtId: item.districtId,
      cityName: item.addressDetails?.city,
      districtName: item.addressDetails?.district,
    });

    return {
      ...item,
      cityId: resolvedIds.cityId,
      districtId: resolvedIds.districtId,
    };
  }

  private async normalizeRealEstateObjectGeography(
    realEstateObject: AssessmentRealEstateObjectData | undefined,
  ): Promise<AssessmentRealEstateObjectData | undefined> {
    if (!realEstateObject) {
      return undefined;
    }

    const existingIds = await this.assessmentRepository.resolveGeographyIds({
      cityId: realEstateObject.cityId,
      districtId: realEstateObject.districtId ?? undefined,
    });
    const fallbackItem = existingIds.cityId
      ? undefined
      : await this.findExactFiasAddressItem(realEstateObject.address);
    const resolvedIds = existingIds.cityId
      ? existingIds
      : await this.assessmentRepository.resolveGeographyIds({
          cityId: realEstateObject.cityId,
          districtId: realEstateObject.districtId ?? undefined,
          cityName: fallbackItem?.addressDetails?.city,
          districtName: fallbackItem?.addressDetails?.district,
        });

    if (!resolvedIds.cityId) {
      throw new ConnectError(
        'real_estate_object.city_id does not match a known city',
        Code.InvalidArgument,
      );
    }

    return {
      ...realEstateObject,
      cityId: resolvedIds.cityId,
      ...(resolvedIds.districtId !== undefined && { districtId: resolvedIds.districtId }),
      ...(resolvedIds.districtId === undefined &&
        realEstateObject.districtId !== undefined && { districtId: null }),
    };
  }

  private async findExactFiasAddressItem(
    address: string | undefined,
  ): Promise<FiasAddressItem | undefined> {
    if (!address) {
      return undefined;
    }

    const items = await this.fiasProvider.searchAddressItems({
      query: address,
      limit: FIAS_LIMITS.maximum,
    });
    const normalizedAddress = normalizeAddressMatchKey(address);

    return items.find((item) => normalizeAddressMatchKey(item.fullName) === normalizedAddress);
  }
}

function validateUuid(value: string | undefined, fieldName: string): void {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new ConnectError(`${fieldName} must be a valid UUID`, Code.InvalidArgument);
  }
}

function normalizeOptionalUuid(value: string | undefined, fieldName: string): string | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!normalized || !UUID_PATTERN.test(normalized)) {
    throw new ConnectError(`${fieldName} must be a valid UUID`, Code.InvalidArgument);
  }

  return normalized;
}

function normalizeNullableUuid(
  value: string | undefined,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!normalized) return null;
  if (!UUID_PATTERN.test(normalized)) {
    throw new ConnectError(`${fieldName} must be a valid UUID`, Code.InvalidArgument);
  }

  return normalized;
}

function normalizeRequiredText(value: string | undefined, fieldName: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new ConnectError(`${fieldName} is required`, Code.InvalidArgument);
  }
  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeFiasQuery(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

function normalizeFiasLimit(value: number | undefined): number {
  if (value === undefined || value === 0) return FIAS_LIMITS.default;
  if (!Number.isInteger(value) || value < 1 || value > FIAS_LIMITS.maximum) {
    throw new ConnectError(
      `limit must be an integer from 1 to ${FIAS_LIMITS.maximum}`,
      Code.InvalidArgument,
    );
  }
  return value;
}

function normalizeFiasAddressType(value: number | undefined): number | undefined {
  if (value === undefined || value === 0) return undefined;
  if (!Number.isInteger(value) || value < 1) {
    throw new ConnectError('address_type must be a positive integer', Code.InvalidArgument);
  }
  return value;
}

function normalizeAddressMatchKey(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

function normalizeOptionalRequiredText(
  value: string | undefined,
  fieldName: string,
): string | undefined {
  if (value === undefined) return undefined;
  return normalizeRequiredText(value, fieldName);
}

function normalizeNullableText(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalDecimal(
  value: string | undefined,
  fieldName: string,
  minimum: number,
  maximum: number,
): string | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!normalized) {
    throw new ConnectError(`${fieldName} is required`, Code.InvalidArgument);
  }

  const numericValue = Number(normalized);
  if (!DECIMAL_PATTERN.test(normalized) || numericValue < minimum || numericValue > maximum) {
    throw new ConnectError(
      `${fieldName} must be a valid decimal number from ${minimum} to ${maximum}`,
      Code.InvalidArgument,
    );
  }

  return normalized;
}

function normalizeOptionalInteger(
  value: number | undefined,
  fieldName: string,
  minimum: number,
  maximum: number,
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ConnectError(
      `${fieldName} must be an integer from ${minimum} to ${maximum}`,
      Code.InvalidArgument,
    );
  }
  return value;
}

function normalizeRequiredEnum<T extends number>(
  value: T | undefined,
  unspecifiedValue: T,
  fieldName: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (value === unspecifiedValue) {
    throw new ConnectError(`${fieldName} must be specified`, Code.InvalidArgument);
  }
  return value;
}

function normalizeNullableEnum<T extends number>(
  value: T | undefined,
  unspecifiedValue: T,
): T | null | undefined {
  if (value === undefined) return undefined;
  return value === unspecifiedValue ? null : value;
}

function normalizeRealEstateObjectInput(
  input: RealEstateObjectInput | undefined,
  mode: 'create' | 'update',
): AssessmentRealEstateObjectData | undefined {
  if (!input || !hasRealEstateObjectInputData(input)) {
    return undefined;
  }

  const realEstateObject: AssessmentRealEstateObjectData = {};

  const cityId = normalizeOptionalUuid(input.cityId, 'real_estate_object.city_id');
  if (cityId !== undefined) realEstateObject.cityId = cityId;

  const districtId = normalizeNullableUuid(input.districtId, 'real_estate_object.district_id');
  if (districtId !== undefined) realEstateObject.districtId = districtId;

  const address = normalizeOptionalRequiredText(input.address, 'real_estate_object.address');
  if (address !== undefined) realEstateObject.address = address;

  const cadastralNumber = normalizeNullableText(input.cadastralNumber);
  if (cadastralNumber !== undefined) {
    if (cadastralNumber !== null && !CADASTRAL_NUMBER_PATTERN.test(cadastralNumber)) {
      throw new ConnectError(
        'real_estate_object.cadastral_number must contain exactly 12 digits',
        Code.InvalidArgument,
      );
    }

    realEstateObject.cadastralNumber = cadastralNumber;
  }

  const area = normalizeOptionalDecimal(
    input.area,
    'real_estate_object.area',
    AREA_LIMITS.minimum,
    AREA_LIMITS.maximum,
  );
  if (area !== undefined) realEstateObject.area = area;

  const objectType = normalizeRequiredEnum(
    input.objectType,
    RealEstateObjectType.UNSPECIFIED,
    'real_estate_object.object_type',
  );
  if (objectType !== undefined) realEstateObject.objectType = objectType;

  const roomsCount = normalizeOptionalInteger(
    input.roomsCount,
    'real_estate_object.rooms_count',
    ROOMS_LIMITS.minimum,
    getRoomsMaximum(objectType),
  );
  if (roomsCount !== undefined) realEstateObject.roomsCount = roomsCount;

  const floorsTotal = normalizeOptionalInteger(
    input.floorsTotal,
    'real_estate_object.floors_total',
    FLOOR_LIMITS.minimum,
    FLOOR_LIMITS.maximum,
  );
  if (floorsTotal !== undefined) realEstateObject.floorsTotal = floorsTotal;

  const floor = normalizeOptionalInteger(
    input.floor,
    'real_estate_object.floor',
    FLOOR_LIMITS.minimum,
    FLOOR_LIMITS.maximum,
  );
  if (floor !== undefined && floorsTotal !== undefined && floor > floorsTotal) {
    throw new ConnectError(
      'real_estate_object.floor must be less than or equal to real_estate_object.floors_total',
      Code.InvalidArgument,
    );
  }
  if (floor !== undefined) realEstateObject.floor = floor;

  const condition = normalizeNullableEnum(input.condition, RealEstateCondition.UNSPECIFIED);
  if (condition !== undefined) realEstateObject.condition = condition;

  const yearBuilt = normalizeOptionalInteger(
    input.yearBuilt,
    'real_estate_object.year_built',
    YEAR_BUILT_LIMITS.minimum,
    YEAR_BUILT_LIMITS.maximum,
  );
  if (yearBuilt !== undefined) realEstateObject.yearBuilt = yearBuilt;

  const wallMaterial = normalizeNullableEnum(input.wallMaterial, WallMaterial.UNSPECIFIED);
  if (wallMaterial !== undefined) realEstateObject.wallMaterial = wallMaterial;

  const elevatorType = normalizeNullableEnum(input.elevatorType, ElevatorType.UNSPECIFIED);
  if (elevatorType !== undefined) realEstateObject.elevatorType = elevatorType;

  if (input.hasBalconyOrLoggia !== undefined) {
    realEstateObject.hasBalconyOrLoggia = input.hasBalconyOrLoggia;
  }

  const landCategory = normalizeNullableText(input.landCategory);
  if (landCategory !== undefined) realEstateObject.landCategory = landCategory;

  const permittedUse = normalizeNullableText(input.permittedUse);
  if (permittedUse !== undefined) realEstateObject.permittedUse = permittedUse;

  const utilities = normalizeNullableText(input.utilities);
  if (utilities !== undefined) realEstateObject.utilities = utilities;

  const description = normalizeNullableText(input.description);
  if (description !== undefined) realEstateObject.description = description;

  if (mode === 'create') {
    assertDefined(realEstateObject.cityId, 'real_estate_object.city_id');
    assertDefined(realEstateObject.address, 'real_estate_object.address');
    assertDefined(realEstateObject.area, 'real_estate_object.area');
    assertDefined(realEstateObject.objectType, 'real_estate_object.object_type');
  }

  return realEstateObject;
}

function hasRealEstateObjectInputData(input: RealEstateObjectInput | undefined): boolean {
  if (!input) return false;

  return (
    input.cityId !== undefined ||
    input.districtId !== undefined ||
    input.address !== undefined ||
    input.cadastralNumber !== undefined ||
    input.area !== undefined ||
    input.objectType !== undefined ||
    input.roomsCount !== undefined ||
    input.floorsTotal !== undefined ||
    input.floor !== undefined ||
    input.condition !== undefined ||
    input.yearBuilt !== undefined ||
    input.wallMaterial !== undefined ||
    input.elevatorType !== undefined ||
    input.hasBalconyOrLoggia !== undefined ||
    input.landCategory !== undefined ||
    input.permittedUse !== undefined ||
    input.utilities !== undefined ||
    input.description !== undefined
  );
}

function getRoomsMaximum(objectType: RealEstateObjectType | undefined): number {
  if (
    objectType === RealEstateObjectType.APARTMENT ||
    objectType === RealEstateObjectType.APARTMENTS ||
    objectType === RealEstateObjectType.ROOM
  ) {
    return ROOMS_LIMITS.compactMaximum;
  }

  return ROOMS_LIMITS.commonMaximum;
}

function assertDefined<T>(value: T | undefined, fieldName: string): asserts value is T {
  if (value === undefined) {
    throw new ConnectError(`${fieldName} is required`, Code.InvalidArgument);
  }
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (value === undefined || value === 0) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new ConnectError(
      'pagination page and limit must be positive integers',
      Code.InvalidArgument,
    );
  }
  return value;
}

function isNotaryRole(role: string | undefined): boolean {
  return role === '2' || role === Role.Notary;
}

function statusLabel(status: PrismaAssessmentStatus): string {
  switch (status) {
    case PrismaAssessmentStatus.New:
      return 'new';
    case PrismaAssessmentStatus.Verified:
      return 'accepted';
    case PrismaAssessmentStatus.InProgress:
      return 'under_review';
    case PrismaAssessmentStatus.Completed:
      return 'completed';
    case PrismaAssessmentStatus.Cancelled:
      return 'rejected';
  }
}

function toAuditSnapshot(snapshot: AssessmentAuditSnapshot) {
  return {
    status: statusLabel(snapshot.status),
    address: snapshot.address,
    description: snapshot.description,
    estimatedValue: snapshot.estimatedValue,
    notaryId: snapshot.notaryId,
    cancelReason: snapshot.cancelReason,
  };
}

function shortId(value: string): string {
  return value.length > 8 ? `#${value.slice(0, 8)}` : `#${value}`;
}

function formatAssessmentAddress(address: string | null | undefined): string {
  const normalized = address?.trim();
  return normalized || 'адрес объекта не указан';
}

function buildAssignedToNotaryMessage(assessmentId: string, notaryName: string | null): string {
  return notaryName
    ? `Заявка ${shortId(assessmentId)} передана нотариусу ${notaryName}.`
    : `Заявка ${shortId(assessmentId)} передана нотариусу.`;
}

function buildInProgressMessage(assessmentId: string, actorName: string | undefined): string {
  return actorName
    ? `${actorName} начал работу по заявке ${shortId(assessmentId)}.`
    : `По заявке ${shortId(assessmentId)} начата работа.`;
}

function buildCompletedMessage(assessmentId: string, estimatedValue: string | null): string {
  return estimatedValue
    ? `По заявке ${shortId(assessmentId)} завершена оценка объекта. Итоговая стоимость: ${formatRubles(
        estimatedValue,
      )} ₽.`
    : `По заявке ${shortId(assessmentId)} завершена оценка объекта.`;
}

function buildCancelledMessage(assessmentId: string, cancelReason: string | null): string {
  const reason = cancelReason?.trim();
  return reason
    ? `Заявка ${shortId(assessmentId)} была отменена. Причина: ${reason}.`
    : `Заявка ${shortId(assessmentId)} была отменена.`;
}

function formatRubles(value: string): string {
  const [integerPart, fractionPart] = value.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fractionPart ? `${formattedInteger},${fractionPart}` : formattedInteger;
}

function formatOptionalId(value: string | null): string {
  return value ? shortId(value) : 'не назначен';
}

function isExpectedOperationError(error: unknown): boolean {
  return (
    (error instanceof ConnectError && error.code === Code.InvalidArgument) ||
    isPrismaNotFoundError(error)
  );
}

function isPrismaNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
}

function safeErrorName(error: unknown): string {
  return error instanceof Error && error.name.trim() ? error.name : 'UnknownError';
}
