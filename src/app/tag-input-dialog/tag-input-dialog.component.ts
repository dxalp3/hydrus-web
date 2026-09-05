import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogConfig, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HydrusSearchTags, TagDisplayType } from '../hydrus-tags';

interface TagInputDialogData {
  displayType: TagDisplayType;
  enableOrSearch: boolean;
  enableSystemPredicates: boolean;
  enableFavorites: boolean;
  multiSelectAutocomplete: boolean;
  enableSelectionGroups: boolean;
  title: string;
  submitButtonText: string;
  singleTagEdit?: string;
  initialTags?: HydrusSearchTags;
}

const defaultData: TagInputDialogData = {
  displayType: 'display',
  enableOrSearch: true,
  enableSystemPredicates: true,
  enableFavorites: true,
  multiSelectAutocomplete: false,
  enableSelectionGroups: false,
  title: 'Tags',
  submitButtonText: 'OK'
}

@Component({
  selector: 'app-tag-input-dialog',
  templateUrl: './tag-input-dialog.component.html',
  styleUrls: ['./tag-input-dialog.component.scss']
})
export class TagInputDialogComponent implements OnInit {

  tags: HydrusSearchTags = [];
  singleTag = '';

  constructor(
    public dialogRef: MatDialogRef<TagInputDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TagInputDialogData
  ) {
    if(!data) {
      this.data = defaultData;
    }
    this.singleTag = this.data.singleTagEdit ?? '';
    this.tags = this.data.initialTags ? [...this.data.initialTags] : [];
  }

  ngOnInit(): void {
  }

  static open(dialog: MatDialog, data?: Partial<TagInputDialogData>, config?: MatDialogConfig<TagInputDialogData>) {
    return dialog.open<TagInputDialogComponent, TagInputDialogData, HydrusSearchTags>(
      TagInputDialogComponent,
      {
        width: '648px',
        data: {
          ...defaultData,
          ...data
        },
        ...config
      }
    );
  }

  submitSingleTag() {
    const tag = this.singleTag.trim();
    if(tag) {
      this.dialogRef.close([tag]);
    }
  }

}
