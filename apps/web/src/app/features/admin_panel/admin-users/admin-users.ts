import { Component, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  templateUrl: './admin-users.html',
})
export class AdminUsersComponent implements AfterViewInit {
  ngAfterViewInit(): void {
    (window as any).initializeData?.();
    (window as any).renderUsers?.();

    const toggle = document.getElementById('isActive') as HTMLInputElement | null;
    const label = document.getElementById('statusLabel');
    if (toggle && label) {
      toggle.addEventListener('change', function (this: HTMLInputElement) {
        label.textContent = this.checked ? 'Активен' : 'Заблокирован';
      });
    }
  }
}
