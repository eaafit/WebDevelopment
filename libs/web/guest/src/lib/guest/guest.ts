import { Component, ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'lib-guest',
  imports: [RouterModule],
  templateUrl: './guest.html',
  styleUrl: './guest.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Guest {}
