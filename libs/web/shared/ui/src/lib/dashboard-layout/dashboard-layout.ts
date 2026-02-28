import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

export interface DashboardMenuItem {
  label: string;
  route: string;
  icon?: string;
}

@Component({
  selector: 'lib-dashboard-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.scss',
})
export class DashboardLayout {
  @Input() title = 'Нотариальная оценка';
  @Input() pageTitle = '';
  @Input() menuItems: DashboardMenuItem[] = [];
  @Input() userLabel = 'Пользователь';

  currentYear = new Date().getFullYear();
}
