import { type ConnectRouter } from '@connectrpc/connect';
import { PaymentRpcService } from '@internal/billing';
import { PaymentService } from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConnectRouterRegistry {
  constructor(private readonly paymentRpcService: PaymentRpcService) {}

  register(router: ConnectRouter): void {
    router.service(PaymentService, {
      getPaymentHistory: this.paymentRpcService.getPaymentHistory,
    });
  }
}
