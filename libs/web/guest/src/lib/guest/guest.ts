import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'lib-guest',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './guest.html',
  styleUrl: './guest.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Guest {
  currentYear = new Date().getFullYear();
}
