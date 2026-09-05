import { HydrusPageState, HydrusPageType } from '../hydrus-page';
import { flattenPageGroups, NewPageDialogComponent, parseNewPageLines } from './new-page-dialog.component';

describe('NewPageDialogComponent', () => {
  it('trims and deduplicates line-based inputs', () => {
    expect(parseNewPageLines('tag one\ntag two\ntag one\n')).toEqual(['tag one', 'tag two']);
  });

  it('lists nested page groups as possible parents', () => {
    const groups = flattenPageGroups([{
      name: 'Downloads',
      page_key: 'parent',
      page_type: HydrusPageType.PageOfPages,
      page_state: HydrusPageState.Normal,
      selected: false,
      pages: [{
        name: 'Nested',
        page_key: 'child',
        page_type: HydrusPageType.PageOfPages,
        page_state: HydrusPageState.Normal,
        selected: false
      }]
    }]);

    expect(groups).toEqual([
      {pageKey: 'parent', label: 'Downloads'},
      {pageKey: 'child', label: '— Nested'}
    ]);
  });

  it('creates a seeded URL downloader request', () => {
    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    const component = new NewPageDialogComponent(dialogRef, {pages: []});
    component.ngOnInit();
    component.pageForm.patchValue({
      pageType: HydrusPageType.ImportURLs,
      pageName: 'Remote URLs',
      focusPage: false,
      urls: 'https://example.com/1\nhttps://example.com/2'
    });

    component.submit();

    expect(dialogRef.close).toHaveBeenCalledOnceWith({
      page_type: HydrusPageType.ImportURLs,
      page_name: 'Remote URLs',
      focus_page: false,
      urls: ['https://example.com/1', 'https://example.com/2']
    });
  });
});
