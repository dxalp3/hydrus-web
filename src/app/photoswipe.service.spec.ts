import { GALLERY_SLIDER_OPTIONS, PhotoswipeService } from './photoswipe.service';

describe('PhotoswipeService', () => {
  let service: PhotoswipeService;

  beforeEach(() => {
    service = Object.create(PhotoswipeService.prototype);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('exposes previous and next buttons in the gallery', () => {
    expect(GALLERY_SLIDER_OPTIONS).toEqual(jasmine.objectContaining({
      arrowPrev: true,
      arrowNext: true,
      arrowPrevTitle: 'Previous file',
      arrowNextTitle: 'Next file'
    }));
  });
});
