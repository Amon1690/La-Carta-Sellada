import { Component, ElementRef, ViewChild, input, output } from '@angular/core';
import { GameStatBlock } from '../../../../core/models/campaign';

export interface TokenSheet {
  token: { image: string; hp: number; maxHp: number; initiative: number; hidden: boolean };
  name: string;
  summary: string;
  meta: string[];
  statistics?: GameStatBlock;
  sections: { title: string; entries: string[] }[];
  missingSource?: boolean;
}

@Component({
  selector: 'app-vtt-token-sheet',
  templateUrl: './token-sheet.html',
  styleUrl: './token-sheet.scss',
})
export class VttTokenSheet {
  readonly sheet = input<TokenSheet>();
  readonly closed = output<void>();

  @ViewChild('sheetDialog') private dialog?: ElementRef<HTMLDialogElement>;

  get isOpen(): boolean { return this.dialog?.nativeElement.open ?? false; }

  open(): void {
    const dialog = this.dialog?.nativeElement;
    if (dialog && !dialog.open) dialog.showModal();
  }

  close(): void { this.dialog?.nativeElement.close(); }
}
