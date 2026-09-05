import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HydrusBasicFile } from '../hydrus-file';

export interface GalleryContextMenuState {
  file: HydrusBasicFile;
  x: number;
  y: number;
  closeGallery: () => void;
  selection?: GalleryContextMenuSelection;
}

export interface GalleryContextMenuSelection {
  isSelected: () => boolean;
  toggle: () => void;
  selectedCount: () => number;
  openActions: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class GalleryContextMenuService {
  private readonly stateSubject = new BehaviorSubject<GalleryContextMenuState | null>(null);

  readonly state$ = this.stateSubject.asObservable();

  open(
    file: HydrusBasicFile,
    x: number,
    y: number,
    closeGallery: () => void,
    selection?: GalleryContextMenuSelection
  ) {
    this.stateSubject.next({file, x, y, closeGallery, selection});
  }

  close() {
    this.stateSubject.next(null);
  }
}
