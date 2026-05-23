import { create } from '@bufbuild/protobuf';
import {
  LogApplicantAssessmentActionRequestSchema,
  LogApplicantAssessmentActionResponseSchema,
} from '@notary-portal/api-contracts';
import { AssessmentRpcService } from './assessment-rpc.service';

describe('AssessmentRpcService', () => {
  it('delegates applicant assessment action logging to the service layer', async () => {
    const response = create(LogApplicantAssessmentActionResponseSchema, { ok: true });
    const assessmentService = {
      logApplicantAssessmentAction: jest.fn().mockReturnValue(response),
    };
    const rpcService = new AssessmentRpcService(assessmentService as never);
    const request = create(LogApplicantAssessmentActionRequestSchema, {
      action: 'status_loaded',
      assessmentId: '11111111-1111-4111-8111-111111111111',
      status: 'NEW',
      targetRoute: '/applicant/assessment/status',
    });

    await expect(rpcService.logApplicantAssessmentAction(request)).resolves.toBe(response);
    expect(assessmentService.logApplicantAssessmentAction).toHaveBeenCalledWith(request);
  });
});
