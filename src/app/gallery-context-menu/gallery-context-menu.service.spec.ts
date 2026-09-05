import { HydrusBasicFile } from '../hydrus-file';
import { GalleryContextMenuService } from './gallery-context-menu.service';

describe('GalleryContextMenuService', () => {
  it('opens and closes a menu for a gallery file', () => {
    const service = new GalleryContextMenuService();
    const file = {hash: 'test'} as HydrusBasicFile;
    const closeGallery = jasmine.createSpy('closeGallery');

    service.open(file, 12, 34, closeGallery);

    let currentState;
    const subscription = service.state$.subscribe(state => currentState = state);
    expect(currentState).toEqual({file, x: 12, y: 34, closeGallery, selection: undefined});

    service.close();
    expect(currentState).toBeNull();
    subscription.unsubscribe();
  });
});
