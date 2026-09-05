import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { normalizeSelectionGroupDirectory } from '../selection-groups.service';

export interface SelectionGroupDialogData {
  name: string;
  color: string;
  downloadDirectory: string;
}

@Component({
  selector: 'app-selection-group-dialog',
  templateUrl: './selection-group-dialog.component.html',
  styleUrl: './selection-group-dialog.component.scss'
})
export class SelectionGroupDialogComponent {

  name: string;
  color: string;
  downloadDirectory: string;

  constructor(
    public dialogRef: MatDialogRef<SelectionGroupDialogComponent, SelectionGroupDialogData>,
    @Inject(MAT_DIALOG_DATA) data: SelectionGroupDialogData
  ) {
    this.name = data.name;
    this.color = data.color;
    this.downloadDirectory = data.downloadDirectory;
  }

  static open(dialog: MatDialog, data: SelectionGroupDialogData) {
    return dialog.open<SelectionGroupDialogComponent, SelectionGroupDialogData, SelectionGroupDialogData>(
      SelectionGroupDialogComponent,
      {data, width: '360px', maxWidth: 'calc(100vw - 32px)'}
    );
  }

  save() {
    const name = this.name.trim();
    const downloadDirectory = normalizeSelectionGroupDirectory(this.downloadDirectory);
    if(name && downloadDirectory !== undefined) {
      this.dialogRef.close({name, color: this.color, downloadDirectory});
    }
  }

  get downloadDirectoryValid() {
    return normalizeSelectionGroupDirectory(this.downloadDirectory) !== undefined;
  }
}
