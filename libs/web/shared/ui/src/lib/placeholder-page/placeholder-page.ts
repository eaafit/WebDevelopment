import { Component, Input } from '@angular/core';

@Component({
  selector: 'lib-placeholder-page',
  standalone: true,
  templateUrl: './placeholder-page.html',
  styleUrl: './placeholder-page.scss',
})
export class PlaceholderPage {
  @Input() title = 'Страница в разработке';
  @Input() features: string[] = [];
}
