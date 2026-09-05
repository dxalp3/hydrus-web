import { LocalStorageService } from 'ngx-localstorage';
import { GENERIC_SELECTION_GROUP_ID, SelectionGroupsService } from './selection-groups.service';

describe('SelectionGroupsService', () => {
  let stored: unknown;
  let service: SelectionGroupsService;

  beforeEach(() => {
    stored = undefined;
    const localStorage = {
      get: jasmine.createSpy('get').and.callFake(() => stored),
      set: jasmine.createSpy('set').and.callFake((_key: string, value: unknown) => stored = value)
    } as unknown as LocalStorageService;
    service = new SelectionGroupsService(localStorage);
  });

  it('starts with an empty general selection and named groups disabled', () => {
    expect(service.groups().length).toBe(1);
    expect(service.activeGroup().name).toBe('General selection');
    expect(service.activeGroupIDs()).toEqual(new Set([GENERIC_SELECTION_GROUP_ID]));
    expect(service.groupModeActive()).toBeFalse();
    expect(service.activeFileIDs().size).toBe(0);
    expect(service.showGroups()).toBeTrue();
  });

  it('keeps selections independent when switching groups', () => {
    service.setActiveFiles(new Set([1, 2]));
    const firstGroup = service.createGroup();
    service.setActiveFiles(new Set([3]));

    expect(service.activeFileIDs()).toEqual(new Set([3]));

    service.setActiveGroup(GENERIC_SELECTION_GROUP_ID);
    expect(service.activeFileIDs()).toEqual(new Set([1, 2]));
    expect(service.groups().find(group => group.id === firstGroup.id)?.fileIDs).toEqual(new Set([3]));
  });

  it('applies new selection changes to every active group while preserving their existing members', () => {
    service.setActiveFiles(new Set([99]));
    const firstGroup = service.createGroup();
    service.setActiveFiles(new Set([1]));
    const secondGroup = service.createGroup();
    service.setActiveFiles(new Set([2]));

    service.toggleActiveGroup(firstGroup.id);
    expect(service.activeGroupIDs()).toEqual(new Set([secondGroup.id, firstGroup.id]));
    expect(service.activeFileIDs()).toEqual(new Set([1, 2]));

    service.setActiveFiles(new Set([1, 2, 3]));
    expect(service.groups().find(group => group.id === firstGroup.id)?.fileIDs).toEqual(new Set([1, 3]));
    expect(service.groups().find(group => group.id === secondGroup.id)?.fileIDs).toEqual(new Set([2, 3]));
    expect(service.groups().find(group => group.id === GENERIC_SELECTION_GROUP_ID)?.fileIDs).toEqual(new Set([99]));

    service.setActiveFiles(new Set([1, 3]));
    expect(service.groups().find(group => group.id === firstGroup.id)?.fileIDs).toEqual(new Set([1, 3]));
    expect(service.groups().find(group => group.id === secondGroup.id)?.fileIDs).toEqual(new Set([3]));
  });

  it('returns to the general selection when the last named group is disabled', () => {
    const group = service.createGroup();

    expect(service.toggleActiveGroup(group.id)).toBeTrue();
    expect(service.activeGroupIDs()).toEqual(new Set([GENERIC_SELECTION_GROUP_ID]));
    expect(service.groupModeActive()).toBeFalse();
  });

  it('restores persisted groups and their active selection', () => {
    service.setActiveFiles(new Set([11]));
    const firstGroup = service.createGroup();
    service.setActiveFiles(new Set([22, 33]));
    service.setShowGroups(false);

    const localStorage = {
      get: jasmine.createSpy('get').and.returnValue(stored),
      set: jasmine.createSpy('set')
    } as unknown as LocalStorageService;
    const restored = new SelectionGroupsService(localStorage);

    expect(restored.activeGroupID()).toBe(firstGroup.id);
    expect(restored.activeFileIDs()).toEqual(new Set([22, 33]));
    expect(restored.groups().find(group => group.id === GENERIC_SELECTION_GROUP_ID)?.fileIDs).toEqual(new Set([11]));
    expect(restored.showGroups()).toBeFalse();
  });

  it('restores multiple active groups and normalized download folders', () => {
    const firstGroup = service.createGroup();
    service.setActiveFiles(new Set([11]));
    const secondGroup = service.createGroup();
    service.updateGroup(secondGroup.id, {
      name: 'Downloads',
      color: '#e91e63',
      downloadDirectory: 'projects\\later//images'
    });
    service.toggleActiveGroup(firstGroup.id);

    const localStorage = {
      get: jasmine.createSpy('get').and.returnValue(stored),
      set: jasmine.createSpy('set')
    } as unknown as LocalStorageService;
    const restored = new SelectionGroupsService(localStorage);

    expect(restored.activeGroupIDs()).toEqual(new Set([secondGroup.id, firstGroup.id]));
    expect(restored.groups().find(group => group.id === secondGroup.id)?.downloadDirectory).toBe('projects/later/images');
  });

  it('migrates stored groups created before active sets and download folders existed', () => {
    stored = {
      activeGroupID: 'selection-group-1',
      showOtherGroups: false,
      groups: [{
        id: 'selection-group-1',
        name: 'Group 1',
        color: '#3f51b5',
        fileIDs: [7]
      }]
    };
    const localStorage = {
      get: jasmine.createSpy('get').and.returnValue(stored),
      set: jasmine.createSpy('set')
    } as unknown as LocalStorageService;

    const restored = new SelectionGroupsService(localStorage);

    expect(restored.activeGroupIDs()).toEqual(new Set([GENERIC_SELECTION_GROUP_ID]));
    expect(restored.showGroups()).toBeFalse();
    expect(restored.groups().find(group => group.id === GENERIC_SELECTION_GROUP_ID)?.downloadDirectory).toBe('');
    expect(restored.activeFileIDs()).toEqual(new Set([7]));
    expect(restored.groups().find(group => group.id === 'selection-group-1')?.fileIDs).toEqual(new Set([7]));
  });

  it('migrates the active union from the previous group model into General selection', () => {
    stored = {
      activeGroupID: 'selection-group-2',
      activeGroupIDs: ['selection-group-1', 'selection-group-2'],
      groups: [
        {id: 'selection-group-1', name: 'First', color: '#3f51b5', fileIDs: [1, 2]},
        {id: 'selection-group-2', name: 'Second', color: '#e91e63', fileIDs: [2, 3]}
      ]
    };
    const localStorage = {
      get: jasmine.createSpy('get').and.returnValue(stored),
      set: jasmine.createSpy('set')
    } as unknown as LocalStorageService;

    const restored = new SelectionGroupsService(localStorage);

    expect(restored.groupModeActive()).toBeFalse();
    expect(restored.activeFileIDs()).toEqual(new Set([1, 2, 3]));
    expect(restored.groups().find(group => group.id === 'selection-group-1')?.fileIDs).toEqual(new Set([1, 2]));
    expect(restored.groups().find(group => group.id === 'selection-group-2')?.fileIDs).toEqual(new Set([2, 3]));
  });

  it('rejects unsafe download folder prefixes', () => {
    const group = service.createGroup();
    expect(service.updateGroup(group.id, {
      name: 'Group 1',
      color: '#3f51b5',
      downloadDirectory: '../outside'
    })).toBeFalse();
    expect(service.groups().find(candidate => candidate.id === group.id)?.downloadDirectory).toBe('');
  });

  it('toggles whether selection group names are visible', () => {
    service.toggleShowGroups();

    expect(service.showGroups()).toBeFalse();
    expect((stored as any).showGroups).toBeFalse();
  });

  it('does not delete the general selection', () => {
    expect(service.deleteGroup(GENERIC_SELECTION_GROUP_ID)).toBeFalse();
    expect(service.groups().length).toBe(1);
  });
});
