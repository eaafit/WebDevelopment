import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionTable } from './transaction-table';
import { provideRouter } from '@angular/router';

describe('TransactionTable', () => {
  let component: TransactionTable;
  let fixture: ComponentFixture<TransactionTable>;

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
});
