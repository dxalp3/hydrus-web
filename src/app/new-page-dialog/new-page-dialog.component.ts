import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { HydrusNewPageRequest, HydrusPageListItem, HydrusPageType } from '../hydrus-page';

export interface NewPageDialogData {
  pages: HydrusPageListItem[];
}

interface PageTypeOption {
  type: HydrusPageType;
  label: string;
  description: string;
}

export interface PageGroupOption {
  pageKey: string;
  label: string;
}

export const PAGE_TYPE_OPTIONS: PageTypeOption[] = [
  {
    type: HydrusPageType.ImportGallery,
    label: 'Gallery downloader',
    description: 'Creates an empty native Gallery Downloader page in Hydrus.'
  },
  {
    type: HydrusPageType.ImportURLs,
    label: 'URL downloader',
    description: 'Creates a URL Downloader page and can seed it with URLs.'
  },
  {
    type: HydrusPageType.ImportWatcher,
    label: 'Thread watcher',
    description: 'Creates a watcher page, optionally with its first thread URL.'
  },
  {
    type: HydrusPageType.FileSearch,
    label: 'File search',
    description: 'Creates a file-search page and can run an initial tag search.'
  },
  {
    type: HydrusPageType.ImportSimpleDownloader,
    label: 'Simple downloader',
    description: 'Creates an empty Simple Downloader page.'
  },
  {
    type: HydrusPageType.Duplicates,
    label: 'Duplicates',
    description: 'Creates a duplicate-filter page.'
  },
  {
    type: HydrusPageType.PageOfPages,
    label: 'Page group',
    description: 'Creates a nested notebook for organising other pages.'
  },
  {
    type: HydrusPageType.ImportHDD,
    label: 'Hard-drive import',
    description: 'Creates a local import page using paths on the Hydrus machine.'
  }
];

export function parseNewPageLines(value: string): string[] {
  return [...new Set(value.split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
}

export function flattenPageGroups(pages: HydrusPageListItem[], depth = 0): PageGroupOption[] {
  return pages.flatMap(page => {
    const ownEntry = page.page_type === HydrusPageType.PageOfPages
      ? [{pageKey: page.page_key, label: `${'— '.repeat(depth)}${page.name}`}]
      : [];
    const children = page.pages ? flattenPageGroups(page.pages, depth + 1) : [];
    return [...ownEntry, ...children];
  });
}

@Component({
  selector: 'app-new-page-dialog',
  templateUrl: './new-page-dialog.component.html',
  styleUrls: ['./new-page-dialog.component.scss']
})
export class NewPageDialogComponent implements OnInit {
  readonly HydrusPageType = HydrusPageType;
  readonly pageTypeOptions = PAGE_TYPE_OPTIONS;
  readonly pageGroups: PageGroupOption[];

  readonly pageForm = new FormGroup({
    pageType: new FormControl(HydrusPageType.ImportGallery, {nonNullable: true, validators: Validators.required}),
    pageName: new FormControl('', {nonNullable: true, validators: Validators.maxLength(128)}),
    pageOfPagesKey: new FormControl('', {nonNullable: true}),
    focusPage: new FormControl(true, {nonNullable: true}),
    tags: new FormControl('', {nonNullable: true}),
    urls: new FormControl('', {nonNullable: true}),
    watcherUrl: new FormControl('', {nonNullable: true}),
    paths: new FormControl('', {nonNullable: true}),
    deleteAfterSuccess: new FormControl(false, {nonNullable: true})
  });

  constructor(
    public dialogRef: MatDialogRef<NewPageDialogComponent, HydrusNewPageRequest>,
    @Inject(MAT_DIALOG_DATA) public data: NewPageDialogData
  ) {
    this.pageGroups = flattenPageGroups(data?.pages ?? []);
  }

  ngOnInit(): void {
    this.pageForm.controls.pageType.valueChanges.subscribe(pageType => this.updateTypeValidators(pageType));
    this.updateTypeValidators(this.pageForm.controls.pageType.value);
  }

  get selectedPageType(): PageTypeOption {
    return this.pageTypeOptions.find(option => option.type === this.pageForm.controls.pageType.value)
      ?? this.pageTypeOptions[0];
  }

  submit(): void {
    if (this.pageForm.invalid) {
      this.pageForm.markAllAsTouched();
      return;
    }

    const value = this.pageForm.getRawValue();
    const request: HydrusNewPageRequest = {
      page_type: value.pageType,
      focus_page: value.focusPage
    };

    const pageName = value.pageName.trim();
    if (pageName) request.page_name = pageName;
    if (value.pageOfPagesKey) request.page_of_pages_key = value.pageOfPagesKey;

    switch (value.pageType) {
      case HydrusPageType.FileSearch:
        request.tags = parseNewPageLines(value.tags);
        break;
      case HydrusPageType.ImportURLs:
        request.urls = parseNewPageLines(value.urls);
        break;
      case HydrusPageType.ImportWatcher:
        if (value.watcherUrl.trim()) request.url = value.watcherUrl.trim();
        break;
      case HydrusPageType.ImportHDD:
        request.paths = parseNewPageLines(value.paths);
        request.delete_after_success = value.deleteAfterSuccess;
        break;
    }

    this.dialogRef.close(request);
  }

  private updateTypeValidators(pageType: HydrusPageType): void {
    const watcherUrl = this.pageForm.controls.watcherUrl;
    watcherUrl.clearValidators();

    if (pageType === HydrusPageType.ImportWatcher) {
      watcherUrl.addValidators(Validators.pattern(/^https?:\/\/.+/i));
    }

    watcherUrl.updateValueAndValidity({emitEvent: false});
  }

  static open(
    dialog: MatDialog,
    data: NewPageDialogData,
    config?: MatDialogConfig<NewPageDialogData>
  ) {
    return dialog.open<NewPageDialogComponent, NewPageDialogData, HydrusNewPageRequest>(
      NewPageDialogComponent,
      {
        width: '680px',
        maxWidth: '95vw',
        data,
        ...config
      }
    );
  }
}
