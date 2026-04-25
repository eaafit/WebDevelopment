import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { AuditMonitoringApiService, AuditMonitoringPage } from '@notary-portal/ui';
import { Monitoring } from './monitoring';

describe('Monitoring', () => {
  let component: Monitoring;
  let fixture: ComponentFixture<Monitoring>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Monitoring],
      providers: [
        {
          provide: AuditMonitoringApiService,
          useValue: {
            getAuditEvents: jest.fn().mockReturnValue(
              of({
                events: [],
                meta: {
                  totalItems: 0,
                  totalPages: 1,
                  currentPage: 1,
                  perPage: 20,
                },
              }),
            ),
            exportAuditEvents: jest.fn().mockReturnValue(of([])),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Monitoring);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render shared audit monitoring page in admin mode', () => {
    fixture.detectChanges();

    const sharedPage = fixture.debugElement.query(By.directive(AuditMonitoringPage));
    expect(sharedPage).not.toBeNull();
    expect(sharedPage.componentInstance.mode).toBe('admin');
  });
});
