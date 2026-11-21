import { Injectable, Logger } from '@nestjs/common';
import { Code, ConnectError } from '@connectrpc/connect';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '@internal/prisma';
import { AuditService } from '@internal/audit';
import { MetricsService } from '@internal/metrics';
import { NotificationService } from '@internal/notification';
import { AssessmentRepository } from './assessment.repository';
import { PdfService } from './pdf.service';
import type {
  ListCitiesRequest, ListCitiesResponse,
  ListDistrictsRequest, ListDistrictsResponse,
  GetFiasAddressHintsRequest, GetFiasAddressHintsResponse,
  SearchFiasAddressItemsRequest, SearchFiasAddressItemsResponse,
  GetFiasAddressItemByIdRequest, GetFiasAddressItemByIdResponse,
  GetFiasAddressItemByGuidRequest, GetFiasAddressItemByGuidResponse,
  GetFiasAddressDetailsRequest, GetFiasAddressDetailsResponse,
  SearchFiasAddressByPartsRequest, SearchFiasAddressByPartsResponse,
  LogApplicantAssessmentActionRequest, LogApplicantAssessmentActionResponse,
  ListAssessmentsRequest, ListAssessmentsResponse,
  GetAssessmentRequest, GetAssessmentResponse,
  CreateAssessmentRequest, CreateAssessmentResponse,
  UpdateAssessmentRequest, UpdateAssessmentResponse,
  VerifyAssessmentRequest, VerifyAssessmentResponse,
  CompleteAssessmentRequest, CompleteAssessmentResponse,
  CancelAssessmentRequest, CancelAssessmentResponse,
} from '@notary-portal/api-contracts';

@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);
  private readonly s3Client: S3Client;

  constructor(
    private readonly assessmentRepository: AssessmentRepository,
    private readonly auditService: AuditService,
    private readonly metrics: MetricsService,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {
    this.s3Client = new S3Client({
      region: process.env['S3_REGION'] ?? 'us-east-1',
      endpoint: process.env['S3_ENDPOINT'] ?? 'http://127.0.0.1:9000',
      credentials: {
        accessKeyId: process.env['S3_ACCESS_KEY'] ?? 'minioadmin',
        secretAccessKey: process.env['S3_SECRET_KEY'] ?? 'minioadmin',
      },
      forcePathStyle: true,
    });
  }

  // --- ЛР4: результат оценки и комментарий ---
  async getAppraisalResult(assessmentId: string) {
    const result = await this.prisma.realEstateAppraisalResult.findUnique({
      where: { assessmentId },
    });
    if (!result) return null;

    return {
      id: result.id,
      assessmentId: result.assessmentId,
      marketValue: Number(result.marketValue),
      valueMin: result.valueMin ? Number(result.valueMin) : 0,
      valueMax: result.valueMax ? Number(result.valueMax) : 0,
      confidenceLevel: result.confidenceLevel || '',
      valuationMethod: result.valuationMethod || '',
      comment: result.comment || '',
    };
  }

  async addComment(assessmentId: string, commentText: string) {
    return this.prisma.realEstateAppraisalResult.update({
      where: { assessmentId },
      data: { comment: commentText },
    });
  }

  // --- ЛР5: PDF -> MinIO -> ссылка (и сохранение в БД) ---
  async generateAndUploadPdf(assessmentId: string) {
    const data = await this.getAppraisalResult(assessmentId);
    if (!data) {
      throw new ConnectError('Результат оценки не найден', Code.NotFound);
    }

    const pdf = await this.pdfService.generateReport(data);
    const bucket = process.env['S3_BUCKET_ASSESSMENT_FILES'] || 'assessment-files';
    const key = `reports/report-${assessmentId}.pdf`;

    // 1. Загружаем в MinIO
    await this.s3Client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: pdf, ContentType: 'application/pdf' }),
    );

    // 2. Сохраняем ключ в БД (то, что просил препод)
    await this.prisma.realEstateAppraisalResult.update({
      where: { assessmentId },
      data: { reportKey: key },
    });

    // 3. Генерируем временную ссылку
    const url = await getSignedUrl(
      this.s3Client as never,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="report-${assessmentId}.pdf"`,
      }),
      { expiresIn: 3600 },
    );

    return { url, key };
  }

  // --- Заглушки старых методов (чтобы контроллер не ругался) ---
  async listCities(r: ListCitiesRequest): Promise<ListCitiesResponse> { return { cities: [] } as unknown as ListCitiesResponse; }
  async listDistricts(r: ListDistrictsRequest): Promise<ListDistrictsResponse> { return { districts: [] } as unknown as ListDistrictsResponse; }
  async getFiasAddressHints(r: GetFiasAddressHintsRequest): Promise<GetFiasAddressHintsResponse> { return { hints: [] } as unknown as GetFiasAddressHintsResponse; }
  async searchFiasAddressItems(r: SearchFiasAddressItemsRequest): Promise<SearchFiasAddressItemsResponse> { return { items: [] } as unknown as SearchFiasAddressItemsResponse; }
  async getFiasAddressItemById(r: GetFiasAddressItemByIdRequest): Promise<GetFiasAddressItemByIdResponse> { return {} as unknown as GetFiasAddressItemByIdResponse; }
  async getFiasAddressItemByGuid(r: GetFiasAddressItemByGuidRequest): Promise<GetFiasAddressItemByGuidResponse> { return {} as unknown as GetFiasAddressItemByGuidResponse; }
  async getFiasAddressDetails(r: GetFiasAddressDetailsRequest): Promise<GetFiasAddressDetailsResponse> { return {} as unknown as GetFiasAddressDetailsResponse; }
  async searchFiasAddressByParts(r: SearchFiasAddressByPartsRequest): Promise<SearchFiasAddressByPartsResponse> { return { items: [] } as unknown as SearchFiasAddressByPartsResponse; }
  async logApplicantAssessmentAction(r: LogApplicantAssessmentActionRequest): Promise<LogApplicantAssessmentActionResponse> { return { ok: true } as unknown as LogApplicantAssessmentActionResponse; }
  async listAssessments(r: ListAssessmentsRequest): Promise<ListAssessmentsResponse> { return { assessments: [] } as unknown as ListAssessmentsResponse; }
  async getAssessment(r: GetAssessmentRequest): Promise<GetAssessmentResponse> { return {} as unknown as GetAssessmentResponse; }
  async createAssessment(r: CreateAssessmentRequest): Promise<CreateAssessmentResponse> { return {} as unknown as CreateAssessmentResponse; }
  async updateAssessment(r: UpdateAssessmentRequest): Promise<UpdateAssessmentResponse> { return {} as unknown as UpdateAssessmentResponse; }
  async verifyAssessment(r: VerifyAssessmentRequest): Promise<VerifyAssessmentResponse> { return {} as unknown as VerifyAssessmentResponse; }
  async completeAssessment(r: CompleteAssessmentRequest): Promise<CompleteAssessmentResponse> { return {} as unknown as CompleteAssessmentResponse; }
  async cancelAssessment(r: CancelAssessmentRequest): Promise<CancelAssessmentResponse> { return {} as unknown as CancelAssessmentResponse; }
}
