import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmHost } from './core/ui/confirm-host';

@Component({
  imports: [RouterOutlet, ConfirmHost],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('frontend');
}
