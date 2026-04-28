import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { AuditMonitoringApiService } from '@notary-portal/ui';
import { AuditByEntity } from './audit-by-entity';

describe('AuditByEntity', () => {
  let component: AuditByEntity;
  let fixture: ComponentFixture<AuditByEntity>;
  let apiService: jest.Mocked<AuditMonitoringApiService>;

  const mockEvents = [
    {
      id: '1',
      occurredAt: '2026-04-25T10:00:00.000Z',
      eventType: 'USER_LOGIN',
      actionTitle: 'Вход в систему',
      actionContext: '',
      actorUserId: 'user-123',
      actorName: 'Иван Иванов',
      actorEmail: 'ivan@example.com',
      actorRoleLabel: 'Заявитель',
      targetType: '',
      targetId: '',
      targetTitle: '',
      targetContext: '',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      beforeJson: '',
      afterJson: '',
    },
  ];

  beforeEach(async () => {
    const apiServiceMock = {
      getAuditEvents: jest.fn().mockReturnValue(
        of({
          events: mockEvents,
          meta: {
            totalItems: 1,
            totalPages: 1,
            currentPage: 1,
            perPage: 50,
          },
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [AuditByEntity],
      providers: [
        {
          provide: AuditMonitoringApiService,
          useValue: apiServiceMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditByEntity);
    component = fixture.componentInstance;
    apiService = TestBed.inject(
      AuditMonitoringApiService,
    ) as jest.Mocked<AuditMonitoringApiService>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to "user" search mode', () => {
    expect(component.searchMode()).toBe('user');
  });

  it('should switch search mode and reset forms', () => {
    component.userForm.patchValue({ actorQuery: 'test' });
    component.setSearchMode('assessment');
    fixture.detectChanges();

    expect(component.searchMode()).toBe('assessment');
    expect(component.userForm.value.actorQuery).toBeNull();
    expect(component.events()).toEqual([]);
  });

  it('should call API with actorQuery when user searches by email/name', (done) => {
    component.userForm.patchValue({ actorQuery: 'ivan@example.com' });

    setTimeout(() => {
      expect(apiService.getAuditEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          actorQuery: 'ivan@example.com',
          actorUserId: '',
          targetId: '',
        }),
      );
      expect(component.events()).toEqual(mockEvents);
      done();
    }, 500);
  });

  it('should call API with actorUserId when user searches by userId', (done) => {
    component.userForm.patchValue({ actorUserId: 'user-123' });

    setTimeout(() => {
      expect(apiService.getAuditEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          actorQuery: '',
          actorUserId: 'user-123',
          targetId: '',
        }),
      );
      expect(component.events()).toEqual(mockEvents);
      done();
    }, 500);
  });

  it('should call API with targetId when searching by assessment', (done) => {
    component.setSearchMode('assessment');
    fixture.detectChanges();

    component.assessmentForm.patchValue({ assessmentId: 'assessment-456' });

    setTimeout(() => {
      expect(apiService.getAuditEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          actorQuery: '',
          actorUserId: '',
          targetId: 'assessment-456',
        }),
      );
      expect(component.events()).toEqual(mockEvents);
      done();
    }, 500);
  });

  it('should show empty state when no search criteria entered', () => {
    const emptyState = fixture.debugElement.query(By.css('.empty-state'));
    expect(emptyState).not.toBeNull();
    expect(emptyState.nativeElement.textContent).toContain('Введите критерии поиска');
  });

  it('should complete loading after fetching', (done) => {
    component.userForm.patchValue({ actorQuery: 'test' });

    setTimeout(() => {
      expect(component.loading()).toBe(false);
      expect(component.events()).toEqual(mockEvents);
      done();
    }, 500);
  });

  it('should set error state on API failure', (done) => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
    apiService.getAuditEvents.mockReturnValue(throwError(() => new Error('API Error')));

    component.userForm.patchValue({ actorQuery: 'test' });

    setTimeout(() => {
      expect(component.error()).toBe('Ошибка загрузки событий');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load audit events:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
      done();
    }, 500);
  });

  it('should populate events list when results are available', (done) => {
    component.userForm.patchValue({ actorQuery: 'ivan' });

    setTimeout(() => {
      expect(component.events().length).toBe(1);
      expect(component.events()[0].actionTitle).toBe('Вход в систему');
      done();
    }, 500);
  });

  it('should not call API when search input is empty', (done) => {
    apiService.getAuditEvents.mockClear();
    component.userForm.patchValue({ actorQuery: '' });

    setTimeout(() => {
      expect(apiService.getAuditEvents).not.toHaveBeenCalled();
      expect(component.events()).toEqual([]);
      done();
    }, 500);
  });
});
