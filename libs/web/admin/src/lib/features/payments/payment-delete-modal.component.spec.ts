import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaymentDeleteModalComponent } from './payment-delete-modal.component';

describe('PaymentDeleteModalComponent', () => {
  let fixture: ComponentFixture<PaymentDeleteModalComponent>;
  let component: PaymentDeleteModalComponent;

  const payment = {
    id: 'payment-1',
    payer: 'user-1',
    amount: 12500,
    transactionId: 'txn_abc123',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentDeleteModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentDeleteModalComponent);
    component = fixture.componentInstance;
    component.payment = payment;
    fixture.detectChanges();
  });

  it('should create and render payment details', () => {
    expect(component).toBeTruthy();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Подтверждение удаления');
    expect(text).toContain('txn_abc123');
    expect(text).toContain('user-1');
  });

  it('should emit confirmed when delete button is clicked', () => {
    const confirmedSpy = jest.fn();
    component.confirmed.subscribe(confirmedSpy);

    const deleteButton: HTMLButtonElement | null = fixture.nativeElement.querySelector('.btn-danger');
    deleteButton?.click();

    expect(confirmedSpy).toHaveBeenCalledTimes(1);
  });

  it('should emit cancelled when cancel button is clicked', () => {
    const cancelledSpy = jest.fn();
    component.cancelled.subscribe(cancelledSpy);

    const cancelButton: HTMLButtonElement | null =
      fixture.nativeElement.querySelector('.btn-secondary');
    cancelButton?.click();

    expect(cancelledSpy).toHaveBeenCalledTimes(1);
  });

  it('should emit cancelled when backdrop is clicked', () => {
    const cancelledSpy = jest.fn();
    component.cancelled.subscribe(cancelledSpy);

    const backdrop: HTMLElement | null = fixture.nativeElement.querySelector('.delete-modal-backdrop');
    expect(backdrop).toBeTruthy();

    component.onBackdropClick({ target: backdrop } as unknown as Event);

    expect(cancelledSpy).toHaveBeenCalledTimes(1);
  });

  it('should not emit cancelled when inner modal is clicked', () => {
    const cancelledSpy = jest.fn();
    component.cancelled.subscribe(cancelledSpy);

    const modal: HTMLElement | null = fixture.nativeElement.querySelector('.delete-modal');
    component.onBackdropClick({ target: modal } as unknown as Event);

    expect(cancelledSpy).not.toHaveBeenCalled();
  });
});
