import { Component, HostListener } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { take } from 'rxjs';
import { FileInfoSheetComponent } from '../file-info-sheet/file-info-sheet.component';
import { GalleryContextMenuService, GalleryContextMenuState } from './gallery-context-menu.service';

@Component({
  selector: 'app-gallery-context-menu',
  templateUrl: './gallery-context-menu.component.html',
  styleUrl: './gallery-context-menu.component.scss'
})
export class GalleryContextMenuComponent {
  readonly menuWidth = 280;
  readonly menuEstimatedHeight = 472;
  readonly viewportMargin = 8;

  constructor(
    public contextMenu: GalleryContextMenuService,
    private bottomSheet: MatBottomSheet
  ) { }

  left(state: GalleryContextMenuState) {
    return Math.max(
      this.viewportMargin,
      Math.min(state.x, window.innerWidth - this.menuWidth - this.viewportMargin)
    );
  }

  top(state: GalleryContextMenuState) {
    return Math.max(
      this.viewportMargin,
      Math.min(state.y, window.innerHeight - this.menuEstimatedHeight - this.viewportMargin)
    );
  }

  openFileInfo(state: GalleryContextMenuState, editTags = false) {
    this.contextMenu.close();
    FileInfoSheetComponent.open(this.bottomSheet, state.file, {editTags})
      .afterDismissed()
      .pipe(take(1))
      .subscribe(result => {
        if(result) {
          state.closeGallery();
        }
      });
  }

  toggleSelection(state: GalleryContextMenuState) {
    state.selection?.toggle();
    this.contextMenu.close();
  }

  openSelectionActions(state: GalleryContextMenuState) {
    this.contextMenu.close();
    state.selection?.openActions();
  }

  close() {
    this.contextMenu.close();
  }

  preventNativeContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  @HostListener('window:blur')
  @HostListener('window:resize')
  closeFromOutsideInteraction() {
    this.close();
  }
}
