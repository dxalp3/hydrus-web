import { Injectable, computed, signal } from '@angular/core';
import { LocalStorageService } from 'ngx-localstorage';

const STORAGE_KEY = 'selectionGroupsV1';
export const GENERIC_SELECTION_GROUP_ID = 'selection-general';
const SELECTION_GROUP_SEARCH_PREFIX = 'hydrus-web:selection-group:';

export interface SelectionGroupSearchPredicate {
  groupID: string;
  excluded: boolean;
}

export function selectionGroupSearchTag(groupID: string) {
  return SELECTION_GROUP_SEARCH_PREFIX + encodeURIComponent(groupID);
}

export function parseSelectionGroupSearchTag(value: string): SelectionGroupSearchPredicate | undefined {
  const excluded = value.startsWith('-');
  const predicate = excluded ? value.substring(1) : value;
  if(!predicate.startsWith(SELECTION_GROUP_SEARCH_PREFIX)) {
    return undefined;
  }

  try {
    const groupID = decodeURIComponent(predicate.substring(SELECTION_GROUP_SEARCH_PREFIX.length));
    return groupID ? {groupID, excluded} : undefined;
  } catch {
    return undefined;
  }
}

export function isSelectionGroupSearchTag(value: string) {
  return parseSelectionGroupSearchTag(value) !== undefined;
}

export const SELECTION_GROUP_COLORS = [
  '#3f51b5',
  '#e91e63',
  '#00897b',
  '#fb8c00',
  '#8e24aa',
  '#039be5',
  '#7cb342',
  '#e53935'
];

export interface SelectionGroup {
  id: string;
  name: string;
  color: string;
  downloadDirectory: string;
  fileIDs: Set<number>;
}

interface StoredSelectionGroup {
  id: string;
  name: string;
  color: string;
  downloadDirectory?: string;
  fileIDs: number[];
}

interface StoredSelectionGroups {
  activeGroupID: string;
  activeGroupIDs?: string[];
  showGroups?: boolean;
  showOtherGroups?: boolean;
  groups: StoredSelectionGroup[];
}

export function normalizeSelectionGroupDirectory(value: string): string | undefined {
  const trimmed = value.trim();
  if(!trimmed) {
    return '';
  }

  const normalized = trimmed.replace(/\\/g, '/');
  if(normalized.startsWith('/') || /^[a-z]:($|\/)/i.test(normalized)) {
    return undefined;
  }

  const parts = normalized.split('/').filter(part => part.length > 0);
  if(parts.some(part => part === '.' || part === '..' || /[<>:"|?*\0]/.test(part))) {
    return undefined;
  }
  return parts.join('/');
}

function defaultGroup(): SelectionGroup {
  return {
    id: GENERIC_SELECTION_GROUP_ID,
    name: 'General selection',
    color: '#607d8b',
    downloadDirectory: '',
    fileIDs: new Set<number>()
  };
}

function isStoredGroup(value: unknown): value is StoredSelectionGroup {
  if(!value || typeof value !== 'object') {
    return false;
  }

  const group = value as StoredSelectionGroup;
  return typeof group.id === 'string'
    && group.id.length > 0
    && typeof group.name === 'string'
    && group.name.length > 0
    && typeof group.color === 'string'
    && /^#[0-9a-f]{6}$/i.test(group.color)
    && (group.downloadDirectory === undefined || typeof group.downloadDirectory === 'string')
    && Array.isArray(group.fileIDs)
    && group.fileIDs.every(fileID => Number.isInteger(fileID));
}

@Injectable({
  providedIn: 'root'
})
export class SelectionGroupsService {

  private readonly groupsState = signal<SelectionGroup[]>([defaultGroup()]);
  private readonly activeGroupIDState = signal(GENERIC_SELECTION_GROUP_ID);
  private readonly activeGroupIDsState = signal<Set<string>>(new Set([GENERIC_SELECTION_GROUP_ID]));
  private readonly showGroupsState = signal(true);

  readonly groups = this.groupsState.asReadonly();
  readonly activeGroupID = this.activeGroupIDState.asReadonly();
  readonly activeGroupIDs = this.activeGroupIDsState.asReadonly();
  readonly showGroups = this.showGroupsState.asReadonly();
  readonly activeGroups = computed(() => {
    const activeGroupIDs = this.activeGroupIDsState();
    return this.groupsState().filter(group => activeGroupIDs.has(group.id));
  });
  readonly activeNamedGroups = computed(() =>
    this.activeGroups().filter(group => group.id !== GENERIC_SELECTION_GROUP_ID)
  );
  readonly groupModeActive = computed(() => this.activeNamedGroups().length > 0);
  readonly activeGroup = computed(() => {
    const groups = this.groupsState();
    return groups.find(group => group.id === this.activeGroupIDState()) ?? groups[0];
  });
  readonly activeFileIDs = computed(() => {
    const fileIDs = new Set<number>();
    this.activeGroups().forEach(group => group.fileIDs.forEach(fileID => fileIDs.add(fileID)));
    return fileIDs;
  });

  constructor(private localStorage: LocalStorageService) {
    const stored = this.restore();
    if(stored) {
      this.groupsState.set(stored.groups);
      this.activeGroupIDState.set(stored.activeGroupID);
      this.activeGroupIDsState.set(stored.activeGroupIDs);
      this.showGroupsState.set(stored.showGroups);
      this.persist();
    }
  }

  createGroup() {
    const groups = this.groupsState();
    const usedNumbers = new Set(groups.map(group => {
      const match = /^selection-group-(\d+)$/.exec(group.id);
      return match ? Number(match[1]) : 0;
    }));
    let groupNumber = 1;
    while(usedNumbers.has(groupNumber)) {
      groupNumber++;
    }

    const group: SelectionGroup = {
      id: `selection-group-${groupNumber}`,
      name: `Group ${groupNumber}`,
      color: SELECTION_GROUP_COLORS[(groupNumber - 1) % SELECTION_GROUP_COLORS.length],
      downloadDirectory: '',
      fileIDs: new Set<number>()
    };

    this.groupsState.set([...groups, group]);
    this.activeGroupIDState.set(group.id);
    this.activeGroupIDsState.set(new Set([group.id]));
    this.persist();
    return group;
  }

  setActiveGroup(groupID: string) {
    if(!this.groupsState().some(group => group.id === groupID)) {
      return false;
    }

    this.activeGroupIDState.set(groupID);
    this.activeGroupIDsState.set(new Set([groupID]));
    this.persist();
    return true;
  }

  toggleActiveGroup(groupID: string) {
    if(!this.groupsState().some(group => group.id === groupID)) {
      return false;
    }

    if(groupID === GENERIC_SELECTION_GROUP_ID) {
      if(this.activeGroupIDsState().has(GENERIC_SELECTION_GROUP_ID)) {
        return false;
      }
      return this.setActiveGroup(GENERIC_SELECTION_GROUP_ID);
    }

    const activeGroupIDs = new Set(this.activeGroupIDsState());
    activeGroupIDs.delete(GENERIC_SELECTION_GROUP_ID);
    if(activeGroupIDs.has(groupID)) {
      activeGroupIDs.delete(groupID);
      if(activeGroupIDs.size === 0) {
        activeGroupIDs.add(GENERIC_SELECTION_GROUP_ID);
        this.activeGroupIDState.set(GENERIC_SELECTION_GROUP_ID);
      } else if(this.activeGroupIDState() === groupID) {
        this.activeGroupIDState.set(activeGroupIDs.values().next().value as string);
      }
    } else {
      activeGroupIDs.add(groupID);
      this.activeGroupIDState.set(groupID);
    }
    this.activeGroupIDsState.set(activeGroupIDs);
    this.persist();
    return true;
  }

  setShowGroups(show: boolean) {
    this.showGroupsState.set(show);
    this.persist();
  }

  toggleShowGroups() {
    this.setShowGroups(!this.showGroupsState());
  }

  setActiveFiles(fileIDs: Set<number>) {
    const previousFileIDs = this.activeFileIDs();
    const addedFileIDs = Array.from(fileIDs).filter(fileID => !previousFileIDs.has(fileID));
    const removedFileIDs = Array.from(previousFileIDs).filter(fileID => !fileIDs.has(fileID));
    const activeGroupIDs = this.activeGroupIDsState();
    this.groupsState.update(groups => groups.map(group => {
      if(!activeGroupIDs.has(group.id)) {
        return group;
      }
      const nextFileIDs = new Set(group.fileIDs);
      addedFileIDs.forEach(fileID => nextFileIDs.add(fileID));
      removedFileIDs.forEach(fileID => nextFileIDs.delete(fileID));
      return {...group, fileIDs: nextFileIDs};
    }));
    this.persist();
  }

  updateGroup(groupID: string, changes: Pick<SelectionGroup, 'name' | 'color' | 'downloadDirectory'>) {
    if(groupID === GENERIC_SELECTION_GROUP_ID) {
      return false;
    }
    const name = changes.name.trim();
    const downloadDirectory = normalizeSelectionGroupDirectory(changes.downloadDirectory);
    if(!name || !/^#[0-9a-f]{6}$/i.test(changes.color) || downloadDirectory === undefined) {
      return false;
    }

    let updated = false;
    this.groupsState.update(groups => groups.map(group => {
      if(group.id !== groupID) {
        return group;
      }
      updated = true;
      return {...group, name, color: changes.color, downloadDirectory};
    }));
    if(updated) {
      this.persist();
    }
    return updated;
  }

  clearGroup(groupID: string) {
    let cleared = false;
    this.groupsState.update(groups => groups.map(group => {
      if(group.id !== groupID) {
        return group;
      }
      cleared = true;
      return {...group, fileIDs: new Set<number>()};
    }));
    if(cleared) {
      this.persist();
    }
    return cleared;
  }

  deleteGroup(groupID: string) {
    if(groupID === GENERIC_SELECTION_GROUP_ID) {
      return false;
    }

    const nextGroups = this.groupsState().filter(group => group.id !== groupID);
    if(nextGroups.length === this.groupsState().length) {
      return false;
    }

    this.groupsState.set(nextGroups);
    const activeGroupIDs = new Set(this.activeGroupIDsState());
    activeGroupIDs.delete(groupID);
    if(activeGroupIDs.size === 0) {
      activeGroupIDs.add(GENERIC_SELECTION_GROUP_ID);
    }
    this.activeGroupIDsState.set(activeGroupIDs);
    if(this.activeGroupIDState() === groupID || !activeGroupIDs.has(this.activeGroupIDState())) {
      this.activeGroupIDState.set(activeGroupIDs.values().next().value as string);
    }
    this.persist();
    return true;
  }

  membershipColors(fileID: number) {
    return this.groupsState()
      .filter(group => group.fileIDs.has(fileID))
      .map(group => group.color);
  }

  isGenericGroup(groupID: string) {
    return groupID === GENERIC_SELECTION_GROUP_ID;
  }

  private restore(): {
    groups: SelectionGroup[];
    activeGroupID: string;
    activeGroupIDs: Set<string>;
    showGroups: boolean;
  } | undefined {
    let stored: StoredSelectionGroups | undefined;
    try {
      stored = this.localStorage.get(STORAGE_KEY) as StoredSelectionGroups | undefined;
    } catch {
      return undefined;
    }
    if(
      !stored
      || !Array.isArray(stored.groups)
      || !stored.groups.every(isStoredGroup)
      || typeof stored.activeGroupID !== 'string'
    ) {
      return undefined;
    }

    const uniqueGroups = stored.groups.filter((group, index, groups) =>
      groups.findIndex(candidate => candidate.id === group.id) === index
    );
    const hadGenericGroup = uniqueGroups.some(group => group.id === GENERIC_SELECTION_GROUP_ID);
    if(!hadGenericGroup) {
      const legacyActiveGroupIDs = Array.isArray(stored.activeGroupIDs)
        ? new Set(stored.activeGroupIDs)
        : new Set([stored.activeGroupID]);
      const generalFileIDs = new Set<number>();
      uniqueGroups
        .filter(group => legacyActiveGroupIDs.has(group.id))
        .forEach(group => group.fileIDs.forEach(fileID => generalFileIDs.add(fileID)));
      uniqueGroups.unshift({
        ...defaultGroup(),
        fileIDs: Array.from(generalFileIDs)
      });
    }

    const groups = uniqueGroups.map(group => ({
      ...group,
      downloadDirectory: normalizeSelectionGroupDirectory(group.downloadDirectory ?? '') ?? '',
      fileIDs: new Set(group.fileIDs)
    }));
    const validGroupIDs = new Set(groups.map(group => group.id));
    let activeGroupID = hadGenericGroup && groups.some(group => group.id === stored.activeGroupID)
      ? stored.activeGroupID
      : GENERIC_SELECTION_GROUP_ID;
    const restoredActiveGroupIDs = hadGenericGroup && Array.isArray(stored.activeGroupIDs)
      ? stored.activeGroupIDs.filter(groupID => typeof groupID === 'string' && validGroupIDs.has(groupID))
      : [activeGroupID];
    const activeGroupIDs = new Set(restoredActiveGroupIDs);
    if(activeGroupIDs.size === 0) {
      activeGroupIDs.add(activeGroupID);
    }
    if(activeGroupIDs.size > 1 && activeGroupIDs.has(GENERIC_SELECTION_GROUP_ID)) {
      activeGroupIDs.delete(GENERIC_SELECTION_GROUP_ID);
    }
    if(!activeGroupIDs.has(activeGroupID)) {
      activeGroupID = activeGroupIDs.values().next().value as string;
    }
    const showGroups = typeof stored.showGroups === 'boolean'
      ? stored.showGroups
      : typeof stored.showOtherGroups === 'boolean'
        ? stored.showOtherGroups
      : true;
    return {groups, activeGroupID, activeGroupIDs, showGroups};
  }

  private persist() {
    const stored: StoredSelectionGroups = {
      activeGroupID: this.activeGroupIDState(),
      activeGroupIDs: Array.from(this.activeGroupIDsState()),
      showGroups: this.showGroupsState(),
      groups: this.groupsState().map(group => ({
        ...group,
        fileIDs: Array.from(group.fileIDs)
      }))
    };
    try {
      this.localStorage.set(STORAGE_KEY, stored);
    } catch {
      // The in-memory groups remain usable if browser storage is unavailable or full.
    }
  }
}
