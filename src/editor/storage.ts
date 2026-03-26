import { createDefaultProject } from './demoData';
import { ProjectState } from './types';

const DRAFT_STORAGE_KEY = 'crazyalbum-project-draft-v2';

export function readDraftProject() {
  const fresh = createDefaultProject();
  const stored = localStorage.getItem(DRAFT_STORAGE_KEY);

  if (!stored) {
    return fresh;
  }

  try {
    const parsed = JSON.parse(stored) as ProjectState;
    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0 || !Array.isArray(parsed.assets)) {
      return fresh;
    }

    return parsed;
  } catch {
    return fresh;
  }
}

export function writeDraftProject(project: ProjectState) {
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(project));
}

export function clearDraftProject() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}
