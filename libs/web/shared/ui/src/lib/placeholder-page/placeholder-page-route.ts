import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PlaceholderPage } from './placeholder-page';

@Component({
  selector: 'lib-placeholder-page-route',
  standalone: true,
  imports: [PlaceholderPage],
  template: `
    <lib-placeholder-page
      [title]="route.snapshot.data['title'] ?? 'Страница'"
      [features]="route.snapshot.data['features'] ?? []"
    />
  `,
})
export class PlaceholderPageRoute {
  route = inject(ActivatedRoute);
}
