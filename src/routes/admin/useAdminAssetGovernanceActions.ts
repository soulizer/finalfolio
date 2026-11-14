import { confirmAction } from '../../ui/confirm';
import {
  deleteAdminProject,
  deleteAdminUpload,
  retryAdminUploadObjectStorageSync,
} from '../../editor/api';
import { getConfirmationMessage } from '../../editor/confirmations';

type UseAdminAssetGovernanceActionsOptions = {
  refreshAll: () => Promise<void>;
  setMessage: (message: string | null) => void;
};

export function useAdminAssetGovernanceActions({ refreshAll, setMessage }: UseAdminAssetGovernanceActionsOptions) {
  async function handleDeleteProject(projectId: string) {
    const confirmed = await confirmAction({
      title: 'Delete this project?',
      body: `${getConfirmationMessage('deleteProject')} Unreferenced photos are removed as well.`,
      confirmLabel: 'Delete project',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setMessage(null);

    try {
      await deleteAdminProject(projectId);
      await refreshAll();
      setMessage('Project deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete project.');
    }
  }

  async function handleDeleteUpload(filename: string) {
    const confirmed = await confirmAction({
      title: 'Delete this upload?',
      body: getConfirmationMessage('deleteUpload', { filename }),
      confirmLabel: 'Delete upload',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setMessage(null);

    try {
      await deleteAdminUpload(filename);
      await refreshAll();
      setMessage('Upload deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete upload.');
    }
  }

  async function handleRetryUpload(filename: string) {
    setMessage(null);

    try {
      await retryAdminUploadObjectStorageSync(filename);
      await refreshAll();
      setMessage('Remote delivery retry queued.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to retry remote delivery.');
    }
  }

  return {
    handleDeleteProject,
    handleDeleteUpload,
    handleRetryUpload,
  };
}
