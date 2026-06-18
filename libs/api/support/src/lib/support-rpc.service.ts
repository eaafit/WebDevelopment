import { Injectable } from '@nestjs/common';
import { SupportService } from './support.service';
import type {
  AddMessageRequest,
  AddMessageResponse,
  AskSupportAiRequest,
  AskSupportAiResponse,
  CloseTicketRequest,
  CloseTicketResponse,
  CreateTicketRequest,
  CreateTicketResponse,
  EscalateToOperatorRequest,
  EscalateToOperatorResponse,
  GetTicketRequest,
  GetTicketResponse,
  ListMessagesRequest,
  ListMessagesResponse,
  ListTicketsRequest,
  ListTicketsResponse,
  UpdateTicketStatusRequest,
  UpdateTicketStatusResponse,
} from '@notary-portal/api-contracts';

@Injectable()
export class SupportRpcService {
  constructor(private readonly supportService: SupportService) {}

  readonly askSupportAi = (r: AskSupportAiRequest): Promise<AskSupportAiResponse> =>
    this.supportService.askSupportAi(r);

  readonly escalateToOperator = (r: EscalateToOperatorRequest): Promise<EscalateToOperatorResponse> =>
    this.supportService.escalateToOperator(r);

  readonly createTicket = (r: CreateTicketRequest): Promise<CreateTicketResponse> =>
    this.supportService.createTicket(r);

  readonly getTicket = (r: GetTicketRequest): Promise<GetTicketResponse> =>
    this.supportService.getTicket(r);

  readonly listTickets = (r: ListTicketsRequest): Promise<ListTicketsResponse> =>
    this.supportService.listTickets(r);

  readonly addMessage = (r: AddMessageRequest): Promise<AddMessageResponse> =>
    this.supportService.addMessage(r);

  readonly listMessages = (r: ListMessagesRequest): Promise<ListMessagesResponse> =>
    this.supportService.listMessages(r);

  readonly updateTicketStatus = (r: UpdateTicketStatusRequest): Promise<UpdateTicketStatusResponse> =>
    this.supportService.updateTicketStatus(r);

  readonly closeTicket = (r: CloseTicketRequest): Promise<CloseTicketResponse> =>
    this.supportService.closeTicket(r);
}
