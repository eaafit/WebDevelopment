import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PasswordRestore } from './password-restore';
import { UserRole } from '../auth/role.enum';

describe('PasswordRestore', () => {
  let component: PasswordRestore;
  let fixture: ComponentFixture<PasswordRestore>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordRestore],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordRestore);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show notification after request submission with selected role', () => {
    jest.useFakeTimers();
    component.selectRole(UserRole.Notary);
    component.contact = 'user@example.com';

    component.onSubmit();
    jest.advanceTimersByTime(800);

    expect(component.requestSent).toBe(true);
    expect(component.sentRole).toBe(UserRole.Notary);
    expect(component.sentTo).toBe('user@example.com');
    expect(component.isSubmitting).toBe(false);
    jest.useRealTimers();
  });
});
