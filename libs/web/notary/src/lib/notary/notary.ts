import { Component, ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'lib-notary',
  imports: [RouterModule],
  templateUrl: './notary.html',
  styleUrl: './notary.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Notary {}
