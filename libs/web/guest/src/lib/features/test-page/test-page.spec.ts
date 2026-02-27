import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestPage } from './test-page';
import { provideRouter } from '@angular/router';

describe('TestPage', () => {
  let component: TestPage;
  let fixture: ComponentFixture<TestPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TestPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
