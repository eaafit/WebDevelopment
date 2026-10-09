import { AfterViewInit, Component, ElementRef, OnDestroy, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { enhanceAuthPage } from '../auth-page.js';

@Component({
  selector: 'lib-auth-shell',
  standalone: true,
  imports: [RouterOutlet],
  template: '<div class="auth-shell" #shell><router-outlet /></div>',
  styleUrl: './auth-shell.scss',
})
export class AuthShell implements AfterViewInit, OnDestroy {
  private readonly shell = viewChild<ElementRef<HTMLElement>>('shell');
  private teardown: (() => void) | null = null;

  ngAfterViewInit(): void {
    const el = this.shell()?.nativeElement;
    if (el) this.teardown = enhanceAuthPage(el);
  }

  ngOnDestroy(): void {
    this.teardown?.();
  }
}
