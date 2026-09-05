import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, finalize, switchMap } from 'rxjs';
import { HydrusPagesService } from '../hydrus-pages.service';
import { HydrusNewPageRequest, HydrusPageListItem, HydrusPageType } from '../hydrus-page';
import { ErrorService } from '../error.service';
import { NewPageDialogComponent } from '../new-page-dialog/new-page-dialog.component';

@Component({
  selector: 'app-pages',
  templateUrl: './pages.component.html',
  styleUrls: ['./pages.component.scss']
})
export class PagesComponent implements OnInit {

  constructor(
    public pagesService: HydrusPagesService,
    private errorService: ErrorService,
    private dialog: MatDialog,
    private snackbar: MatSnackBar
  ) { }

  HydrusPageType = HydrusPageType;

  pages: HydrusPageListItem[] = [];

  loading = false;
  creatingPage = false;

  ngOnInit() {
    this.loadPages();
  }

  loadPages() {
    this.loading = true;
    this.pagesService.getAllPages().subscribe({
      next: result => {
        this.pages = result;
        this.loading = false;
      },
      error: error => {
        this.loading = false;
        this.errorService.handleHydrusError(error, 'Error loading Hydrus pages');
      }
    });
  }

  newPage(): void {
    NewPageDialogComponent.open(this.dialog, {pages: this.pages}).afterClosed().pipe(
      filter((request): request is HydrusNewPageRequest => !!request),
      switchMap(request => {
        this.creatingPage = true;
        return this.pagesService.createPage(request).pipe(
          finalize(() => this.creatingPage = false)
        );
      })
    ).subscribe({
      next: page => {
        this.snackbar.open(`Created Hydrus page “${page.page_name}”`, undefined, {duration: 3500});
        this.loadPages();
      },
      error: error => this.handlePageCreationError(error)
    });
  }

  private handlePageCreationError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      let explanation: string;

      switch (error.status) {
        case HttpStatusCode.Forbidden:
          explanation = 'This API key does not have the Manage Pages permission. Enable it under services → review services in Hydrus.';
          break;
        case HttpStatusCode.NotFound:
          explanation = 'The manage_pages/new_page endpoint was not found. It requires Client API v93 (Hydrus v676 or newer).';
          break;
        case HttpStatusCode.BadRequest:
          explanation = typeof error.error === 'string'
            ? error.error.split('\n')[0]
            : 'Hydrus rejected the selected page settings.';
          break;
        default:
          this.errorService.handleHydrusHttpError(error, 'Could not create Hydrus page');
          return;
      }

      this.errorService.displayError(error, 'Could not create Hydrus page', explanation);
      return;
    }

    this.errorService.handleError(error, 'Could not create Hydrus page');
  }

}
