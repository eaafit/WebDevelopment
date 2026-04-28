import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { RequestAssessment } from './RequestAssessment';
import { AdminApplicationsApiService } from './applications-api.service';

describe('RequestAssessment', () => {
  let component: RequestAssessment;
  let fixture: ComponentFixture<RequestAssessment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestAssessment],
      providers: [
        provideRouter([]),
        {
          provide: AdminApplicationsApiService,
          useValue: {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            preload: () => {},
            applications$: of([]),
            getAllApplications: async () => [],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestAssessment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
