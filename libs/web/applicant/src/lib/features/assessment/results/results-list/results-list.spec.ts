import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EstimationFormSessionService } from '../../../estimation-form/estimation-form-session.service';
import { AssessmentResultsApiService } from '../assessment-results-api.service';
import { AssessmentResultsComponent } from './results-list';

describe('AssessmentResultsComponent', () => {
  let fixture: ComponentFixture<AssessmentResultsComponent>;
  let listResults: jest.Mock;

  async function render(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [AssessmentResultsComponent],
      providers: [
        provideRouter([]),
        { provide: AssessmentResultsApiService, useValue: { listResults } },
        {
          provide: EstimationFormSessionService,
          useValue: { ensureUserId: jest.fn().mockResolvedValue('user-1') },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentResultsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows empty state when there are no assessed objects', async () => {
    listResults = jest.fn().mockResolvedValue([]);
    const element = await render();

    expect(listResults).toHaveBeenCalledWith('user-1');
    expect(element.textContent).toContain('Оценённых объектов пока нет');
  });

  it('renders result cards with formatted value', async () => {
    listResults = jest.fn().mockResolvedValue([
      {
        id: 'a-1',
        address: 'г. Москва, ул. Тверская, 1',
        objectTypeLabel: 'Квартира',
        area: '54',
        finalEstimatedValue: 12500000,
        assessedAt: '2026-10-01T10:00:00.000Z',
      },
    ]);
    const element = await render();

    expect(element.querySelectorAll('.result-card')).toHaveLength(1);
    expect(element.textContent).toContain('г. Москва, ул. Тверская, 1');
    expect(element.textContent?.replace(/\s/g, '')).toContain('12500000₽');
    expect(element.textContent).toContain('Подробнее');
  });
});
