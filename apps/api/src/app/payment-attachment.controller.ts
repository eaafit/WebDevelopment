import { TokenService } from '@internal/auth';
import { PaymentAttachmentService } from '@internal/billing';
import {
  Controller,
  Headers,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

const maxPdfBytes = 15 * 1024 * 1024;

@Controller('api/payments')
export class PaymentAttachmentController {
  constructor(
    private readonly attachments: PaymentAttachmentService,
    private readonly tokens: TokenService,
  ) {}

  @Post(':paymentId/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxPdfBytes } }))
  async uploadAttachment(
    @Param('paymentId') paymentId: string,
    @Headers('authorization') authorization: string | undefined,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [new MaxFileSizeValidator({ maxSize: maxPdfBytes })],
      }),
    )
    file: Express.Multer.File,
  ) {
    const token = extractBearer(authorization);
    if (!token) {
      throw new UnauthorizedException();
    }

    let payload;
    try {
      payload = this.tokens.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException();
    }

    return this.attachments.attachPdf({
      paymentId,
      userId: payload.sub,
      role: payload.role,
      file,
    });
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}
