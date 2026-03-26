import { createDefaultProject, normalizeProjectState } from './demoData';
import { ProjectState } from './types';

const DRAFT_STORAGE_KEY = 'crazyalbum-project-draft-v2';

export function readDraftProject() {
  const stored = localStorage.getItem(DRAFT_STORAGE_KEY);

  if (!stored) {
    return createDefaultProject();
  }

  try {
    return normalizeProjectState(JSON.parse(stored) as ProjectState);
  } catch {
    return createDefaultProject();
  }
}

export function writeDraftProject(project: ProjectState) {
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(project));
}

export function clearDraftProject() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}
