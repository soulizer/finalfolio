import { Asset, ProjectRecord, ProjectState } from './types';

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Request failed.');
  }

  return payload as T;
}

export function createProject(project: ProjectState) {
  return readJson<ProjectRecord>('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ project }),
  });
}

export function fetchProject(projectId: string) {
  return readJson<ProjectRecord>(`/api/projects/${projectId}`);
}

export function updateProject(projectId: string, project: ProjectState) {
  return readJson<ProjectRecord>(`/api/projects/${projectId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ project }),
  });
}

export async function uploadAssets(files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const payload = await readJson<{ assets: Asset[] }>('/api/uploads', {
    method: 'POST',
    body: formData,
  });

  return payload.assets;
}
