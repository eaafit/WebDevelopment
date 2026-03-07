import { Test } from '@nestjs/testing';
import { TransactionHistoryController } from './transaction-history.controller';
import { TransactionHistoryService } from './transaction-history.service';

describe('TransactionHistoryController', () => {
  let controller: TransactionHistoryController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TransactionHistoryController],
      providers: [
        {
          provide: TransactionHistoryService,
          useValue: {
            getTransactionHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(TransactionHistoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeTruthy();
  });
});
