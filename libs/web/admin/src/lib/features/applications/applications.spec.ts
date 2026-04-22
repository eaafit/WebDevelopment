import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Applications } from './applications';
import { AdminApplicationsApiService } from './applications-api.service';

describe('Applications', () => {
  let component: Applications;
  let fixture: ComponentFixture<Applications>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Applications],
      providers: [
        provideRouter([]),
        {
          provide: AdminApplicationsApiService,
          useValue: {
            getAllApplications: async () => [],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Applications);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
