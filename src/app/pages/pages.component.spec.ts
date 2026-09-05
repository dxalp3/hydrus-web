import { of } from 'rxjs';
import { HydrusPageType } from '../hydrus-page';
import { PagesComponent } from './pages.component';

describe('PagesComponent', () => {
  let component: PagesComponent;
  let pagesService: jasmine.SpyObj<any>;
  let dialog: jasmine.SpyObj<any>;
  let snackbar: jasmine.SpyObj<any>;

  beforeEach(() => {
    pagesService = jasmine.createSpyObj('HydrusPagesService', ['getAllPages', 'createPage']);
    pagesService.getAllPages.and.returnValue(of([]));
    dialog = jasmine.createSpyObj('MatDialog', ['open']);
    snackbar = jasmine.createSpyObj('MatSnackBar', ['open']);

    component = new PagesComponent(
      pagesService,
      jasmine.createSpyObj('ErrorService', ['handleHydrusError', 'handleHydrusHttpError', 'displayError', 'handleError']),
      dialog,
      snackbar
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the desktop page tree', () => {
    component.loadPages();

    expect(component.pages).toEqual([]);
    expect(component.loading).toBeFalse();
  });

  it('creates a page and refreshes the desktop page tree', () => {
    const request = {page_type: HydrusPageType.ImportGallery, focus_page: true};
    dialog.open.and.returnValue({afterClosed: () => of(request)});
    pagesService.createPage.and.returnValue(of({
      page_key: 'page-key',
      page_type: HydrusPageType.ImportGallery,
      page_name: 'gallery downloader'
    }));

    component.newPage();

    expect(pagesService.createPage).toHaveBeenCalledOnceWith(request);
    expect(pagesService.getAllPages).toHaveBeenCalled();
    expect(snackbar.open).toHaveBeenCalled();
    expect(component.creatingPage).toBeFalse();
  });
});
