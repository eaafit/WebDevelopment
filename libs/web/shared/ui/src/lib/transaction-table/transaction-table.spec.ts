import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TransactionTable } from './transaction-table';
import type { TransactionItem } from './transaction-table.models';

describe('TransactionTable', () => {
  let component: TransactionTable;
  let fixture: ComponentFixture<TransactionTable>;

  const refundedTransaction: TransactionItem = {
    id: 'payment-1',
    userId: 'user-1',
    type: 'assessment',
    status: 'refunded',
    paymentDate: '2026-03-06T08:45:00.000Z',
    transactionId: 'TXN-100',
    amount: '1500.00',
    currency: 'RUB',
    description: 'Возврат по оценке квартиры',
    paymentMethod: 'sbp',
    attachmentFileName: 'refund-check.pdf',
    attachmentFileUrl: 'https://example.local/refund-check.pdf',
    subscriptionId: null,
    assessmentId: 'assessment-1',
  };

  const pendingTransaction: TransactionItem = {
    ...refundedTransaction,
    id: 'payment-2',
    status: 'pending',
    attachmentFileUrl: 'https://example.local/pending.pdf',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionTable],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionTable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should use dashboard badge classes for statuses', () => {
    expect(component.getStatusClass('completed')).toBe('badge badge-success');
    expect(component.getStatusClass('pending')).toBe('badge badge-pending');
    expect(component.getStatusClass('failed')).toBe('badge badge-failed');
    expect(component.getStatusClass('refunded')).toBe('badge badge-refunded');
  });

  it('should present payment methods in a user-friendly way', () => {
    expect(component.getPaymentMethodPresentation('sbp')).toEqual({
      label: 'СБП',
      caption: 'Система быстрых платежей',
      icon: '/payment-methods/sbp.svg',
      iconType: 'asset',
    });

    expect(component.getPaymentMethodPresentation('bank_card').label).toBe('Банковская карта');
  });

  it('should provide a dedicated refund document label', () => {
    expect(component.getDocumentPresentation(refundedTransaction)).toEqual({
      label: 'Документ возврата',
      icon: '↩️',
    });
  });

  it('should hide documents for pending and failed transactions', () => {
    expect(component.canShowDocument(pendingTransaction)).toBe(false);
    expect(component.getUnavailableDocumentPresentation(pendingTransaction)).toEqual({
      label: 'Документ появится после оплаты',
      icon: '⏳',
    });
  });

  it('should keep rendering the current rows while the next page is loading', async () => {
    fixture.componentRef.setInput('transactions', [refundedTransaction]);
    fixture.componentRef.setInput('loading', true);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Возврат по оценке квартиры');
    expect(fixture.nativeElement.textContent).not.toContain('Загрузка истории транзакций...');
  });
});
