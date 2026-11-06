import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { AssessmentResultsApiService } from '../assessment-results-api.service';
import type { AssessmentReport } from '../assessment-results.models';
import { AssessmentResultDetailComponent } from './result-detail';

const REPORTS: AssessmentReport[] = [
  {
    id: 'r-1',
    assessmentId: 'a-1',
    title: 'Отчёт об оценке №1',
    status: 'Signed',
    createdAt: '2026-10-01T10:00:00.000Z',
    fileUrl: '/mock/assessment-report.pdf',
    signedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'r-2',
    assessmentId: 'a-1',
    title: 'Дополнение №1',
    status: 'Draft',
    createdAt: '2026-10-01T10:00:00.000Z',
    fileUrl: null,
    signedAt: null,
  },
];

describe('AssessmentResultDetailComponent', () => {
  let fixture: ComponentFixture<AssessmentResultDetailComponent>;
  let getResult: jest.Mock;

  async function render(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [AssessmentResultDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ assessmentId: 'a-1' }) } },
        },
        {
          provide: AssessmentResultsApiService,
          useValue: { getResult, listReports: jest.fn().mockResolvedValue(REPORTS) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentResultDetailComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('loads result by assessmentId and renders summary and reports', async () => {
    getResult = jest.fn().mockResolvedValue({
      id: 'a-1',
      address: 'г. Москва, ул. Тверская, 1',
      objectTypeLabel: 'Квартира',
      area: '54',
      finalEstimatedValue: 9500000,
      assessedAt: '2026-10-01T10:00:00.000Z',
    });
    const element = await render();

    expect(getResult).toHaveBeenCalledWith('a-1');
    expect(element.querySelector('.detail-value')?.textContent?.replace(/\s/g, '')).toBe(
      '9500000₽',
    );
    expect(element.querySelectorAll('.report-item')).toHaveLength(2);

    const buttons = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.report-action button'),
    );
    expect(buttons[0].disabled).toBe(false);
    expect(buttons[1].disabled).toBe(true);
    expect(element.textContent).toContain('Ожидает подписи');
  });

  it('opens signed report in a new tab', async () => {
    getResult = jest.fn().mockResolvedValue(null);
    await render();
    const open = jest.spyOn(window, 'open').mockReturnValue(null);

    fixture.componentInstance.downloadReport(REPORTS[0]);
    fixture.componentInstance.downloadReport(REPORTS[1]);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('/mock/assessment-report.pdf', '_blank', 'noopener');
  });

  it('shows error when assessment is not completed', async () => {
    getResult = jest.fn().mockResolvedValue(null);
    const element = await render();

    expect(element.textContent).toContain('Оценка не найдена или ещё не завершена.');
  });
});
