import { NgxFileDragDropComponent } from './ngx-file-drag-drop.component';

describe('NgxFileDragDropComponent', () => {
  let component: NgxFileDragDropComponent;

  beforeEach(() => {
    component = new NgxFileDragDropComponent();
    component.multiple = true;
  });

  it('keeps large queues collapsed and bounds the expanded preview', () => {
    const files = Array.from({length: 6}, (_, index) => new File(['file'], `file-${index}.jpg`));
    component.collapseThreshold = 3;
    component.expandedFileLimit = 2;
    component.writeValue(files);

    expect(component.isFileListCollapsible).toBeTrue();
    expect(component.visibleFiles).toEqual([]);

    const event = jasmine.createSpyObj<Event>('Event', ['preventDefault', 'stopPropagation']);
    component.toggleFileList(event);

    expect(component.visibleFiles).toEqual(files.slice(0, 2));
    expect(component.hiddenFileCount).toBe(4);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('renders every file when the queue is below the collapse threshold', () => {
    const files = [new File(['one'], 'one.jpg'), new File(['two'], 'two.jpg')];
    component.collapseThreshold = 3;

    component.writeValue(files);

    expect(component.isFileListCollapsible).toBeFalse();
    expect(component.visibleFiles).toEqual(files);
  });

  it('compacts deep paths while retaining the full name in its tooltip', () => {
    const file = new File(['image'], 'an-extremely-long-file-name-that-needs-compacting.png');
    const relativePath = 'root/a/very/deep/folder/an-extremely-long-file-name-that-needs-compacting.png';
    Object.defineProperty(file, 'webkitRelativePath', {value: relativePath});
    component.maxFileNameLength = 36;

    const displayName = component.getFileName(file);

    expect(displayName.length).toBeLessThanOrEqual(36);
    expect(displayName).toContain('root/…/');
    expect(displayName).toContain('.png');
    expect(component.getFileTooltip(file)).toContain(relativePath);
  });
});
