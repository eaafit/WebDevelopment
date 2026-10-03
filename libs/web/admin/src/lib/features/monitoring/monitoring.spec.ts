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

  it('should default to "all-events" tab', () => {
    expect(component.activeTab()).toBe('all-events');
  });

  it('should render shared audit monitoring page in admin mode on "all-events" tab', () => {
    fixture.detectChanges();

    const sharedPage = fixture.debugElement.query(By.directive(AuditMonitoringPage));
    expect(sharedPage).not.toBeNull();
    expect(sharedPage.componentInstance.mode).toBe('admin');
  });

  it('should switch to "by-user-order" tab and render AuditByEntity component', () => {
    component.setActiveTab('by-user-order');
    fixture.detectChanges();

    expect(component.activeTab()).toBe('by-user-order');

    const auditByEntity = fixture.debugElement.query(By.css('lib-audit-by-entity'));
    expect(auditByEntity).not.toBeNull();

    const sharedPage = fixture.debugElement.query(By.directive(AuditMonitoringPage));
    expect(sharedPage).toBeNull();
  });

  it('should switch to "security-events" tab and render SecurityEvents component', () => {
    component.setActiveTab('security-events');
    fixture.detectChanges();

    expect(component.activeTab()).toBe('security-events');

    const securityEvents = fixture.debugElement.query(By.css('lib-security-events'));
    expect(securityEvents).not.toBeNull();

    const sharedPage = fixture.debugElement.query(By.directive(AuditMonitoringPage));
    expect(sharedPage).toBeNull();
  });
});
