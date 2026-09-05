import { HydrusPagesService } from './hydrus-pages.service';
import { HydrusPageType } from './hydrus-page';

describe('HydrusPagesService', () => {
  let api: jasmine.SpyObj<any>;
  let service: HydrusPagesService;

  beforeEach(() => {
    api = jasmine.createSpyObj('HydrusApiService', ['getPages', 'getPageInfo', 'refreshPage', 'createPage']);
    service = new HydrusPagesService(api);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('forwards page creation requests to the API', () => {
    const request = {page_type: HydrusPageType.ImportGallery};

    service.createPage(request);

    expect(api.createPage).toHaveBeenCalledOnceWith(request);
  });
});
