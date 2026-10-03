import { TokenService } from '@internal/auth';
import { PaymentAttachmentService } from '@internal/billing';
import {
  Controller,
  Get,
  Headers,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

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

  @Get(':paymentId/receipt')
  async downloadReceipt(
    @Param('paymentId') paymentId: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
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

    const receipt = await this.attachments.getReceiptFile({
      paymentId,
      userId: payload.sub,
      role: payload.role,
    });

    res.setHeader('Content-Type', receipt.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${receipt.fileName}"`);
    res.send(receipt.body);
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}
