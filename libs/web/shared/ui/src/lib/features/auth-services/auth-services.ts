import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

type AuthStep = 'contact' | 'confirm';

@Component({
  selector: 'lib-auth-services',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth-services.html',
  styleUrl: './auth-services.scss',
})
export class AuthServices {
  readonly step = signal<AuthStep>('contact');

  readonly contactForm: FormGroup;
  readonly codeForm: FormGroup;

  constructor(private readonly fb: FormBuilder) {
    this.contactForm = this.fb.group({
      contact: ['', [Validators.required]],
      agreeTerms: [false, [Validators.requiredTrue]],
    });

    this.codeForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(6)]],
    });
  }

  signInWithVk(): void {
    // TODO: integrate VK OAuth
    console.log('[auth] VK sign-in clicked');
  }

  signInWithGoogle(): void {
    // TODO: integrate Google OAuth
    console.log('[auth] Google sign-in clicked');
  }

  signInWithApple(): void {
    // TODO: integrate Apple OAuth
    console.log('[auth] Apple sign-in clicked');
  }

  signInWithYandex(): void {
    // TODO: integrate Yandex OAuth
    console.log('[auth] Yandex sign-in clicked');
  }

  submitContact(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    console.log('[auth] contact submitted', this.contactForm.value);
    this.step.set('confirm');
  }

  submitCode(): void {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }

    console.log('[auth] confirmation code submitted', this.codeForm.value);
  }

  resendCode(): void {
    console.log('[auth] resend confirmation code requested', this.contactForm.value);
  }

  backToContact(): void {
    this.step.set('contact');
  }
}
