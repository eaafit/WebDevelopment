import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Payments } from './payments';

describe('Payments', () => {
  let component: Payments;
  let fixture: ComponentFixture<Payments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Payments],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Payments);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should build csv content for filtered payments', () => {
    component.searchTerm = 'txn_abc123';

    const exportedText = (
      component as Payments & {
        buildCsvContent: (payments: Payments['filteredPayments']) => string;
      }
    ).buildCsvContent(component.filteredPayments);

    expect(exportedText).toContain('"ID";"Дата платежа";"Плательщик"');
    expect(exportedText).toContain('txn_abc123');
    expect(exportedText).not.toContain('sub_xyz789');
  });
});
