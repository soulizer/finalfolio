import type { NavigateFunction } from 'react-router-dom';
import { translate } from '../../i18n';
import { duplicateProject, patchProject, type UserSession } from '../../editor/api';
import type { ProjectRecord } from '../../editor/types';

type ProjectActionBusy = 'duplicate' | 'archive' | 'unarchive' | null;
type SetProjectActionBusy = (value: ProjectActionBusy) => void;
type SetMessage = (message: string | null) => void;
type SetProjectRecord = (
  value: ProjectRecord | ((current: ProjectRecord | null) => ProjectRecord | null)
) => void;

type DuplicateProjectRecordOptions = {
  session: UserSession | null;
  projectRecord: ProjectRecord | null;
  navigate: NavigateFunction;
  setProjectActionBusy: SetProjectActionBusy;
  setMessage: SetMessage;
};

type ToggleProjectArchiveOptions = {
  nextArchived: boolean;
  projectRecord: ProjectRecord | null;
  setProjectActionBusy: SetProjectActionBusy;
  setMessage: SetMessage;
  setProjectRecord: SetProjectRecord;
};

type CreateEditorProjectShellActionsOptions = {
  session: UserSession | null;
  projectRecord: ProjectRecord | null;
  navigate: NavigateFunction;
  setProjectActionBusy: SetProjectActionBusy;
  setMessage: SetMessage;
  setProjectRecord: SetProjectRecord;
};

export function createEditorProjectShellActions({
  session,
  projectRecord,
  navigate,
  setProjectActionBusy,
  setMessage,
  setProjectRecord,
}: CreateEditorProjectShellActionsOptions) {
  async function handleDuplicateCurrentProject() {
    await duplicateProjectRecord({
      session,
      projectRecord,
      navigate,
      setProjectActionBusy,
      setMessage,
    });
  }

  async function handleArchiveToggle(nextArchived: boolean) {
    await toggleProjectArchiveState({
      nextArchived,
      projectRecord,
      setProjectActionBusy,
      setMessage,
      setProjectRecord,
    });
  }

  function openAccountPage() {
    if (session) {
      window.location.assign('/account');
      return;
    }

    window.location.assign(`/auth?next=${encodeURIComponent(projectRecord?.sharePath ?? '/editor')}`);
  }

  function openAdminPage() {
    window.location.assign('/admin');
  }

  return {
    handleArchiveToggle,
    handleDuplicateCurrentProject,
    openAccountPage,
    openAdminPage,
  };
}

export async function duplicateProjectRecord({
  session,
  projectRecord,
  navigate,
  setProjectActionBusy,
  setMessage,
}: DuplicateProjectRecordOptions) {
  if (!projectRecord) {
    setMessage(translate('Save this folio first before creating a duplicate.'));
    return;
  }

  if (!session) {
    setMessage(translate('Sign in first to duplicate this folio into your account.'));
    return;
  }

  setProjectActionBusy('duplicate');
  setMessage(translate('Creating a duplicate project...'));
  try {
    const duplicatedRecord = await duplicateProject(projectRecord.id);
    navigate(duplicatedRecord.sharePath);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : translate('Unable to duplicate this project.'));
  } finally {
    setProjectActionBusy(null);
  }
}

export async function toggleProjectArchiveState({
  nextArchived,
  projectRecord,
  setProjectActionBusy,
  setMessage,
  setProjectRecord,
}: ToggleProjectArchiveOptions) {
  if (!projectRecord) {
    setMessage(translate('Save this folio first before changing archive status.'));
    return;
  }

  setProjectActionBusy(nextArchived ? 'archive' : 'unarchive');
  setMessage(translate(nextArchived ? 'Archiving this project...' : 'Restoring this project...'));
  try {
    const updatedRecord = await patchProject(projectRecord.id, nextArchived ? { archive: true } : { unarchive: true });
    setProjectRecord((current) => (current ? { ...current, archivedAt: updatedRecord.archivedAt ?? null } : updatedRecord));
    setMessage(translate(nextArchived ? 'Project archived.' : 'Project restored to active projects.'));
  } catch (error) {
    setMessage(error instanceof Error ? error.message : translate('Unable to update archive state.'));
  } finally {
    setProjectActionBusy(null);
  }
}
