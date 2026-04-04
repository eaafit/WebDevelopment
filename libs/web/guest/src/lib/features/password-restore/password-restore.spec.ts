import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PasswordRestore } from './password-restore';
import { UserRole } from '../auth/role.enum';

describe('PasswordRestore', () => {
  let component: PasswordRestore;
  let fixture: ComponentFixture<PasswordRestore>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordRestore],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordRestore);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show notification after request submission with selected role', fakeAsync(() => {
    component.selectRole(UserRole.Notary);
    component.contact = 'user@example.com';

    component.onSubmit();
    tick(800);

    expect(component.requestSent).toBeTrue();
    expect(component.sentRole).toBe(UserRole.Notary);
    expect(component.sentTo).toBe('user@example.com');
    expect(component.isSubmitting).toBeFalse();
  }));
});
