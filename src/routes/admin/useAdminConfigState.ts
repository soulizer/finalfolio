import { type Dispatch, type SetStateAction, useState } from 'react';
import {
  type AdminObjectStorageDraft,
  restoreAdminObjectStorageUploads,
  syncAdminObjectStorageUploads,
  testAdminObjectStorage,
  updateAdminObjectStorage,
  updateAdminSiteContent,
  updateAdminTemplateGovernance,
} from '../../editor/api';
import { getConfirmationMessage } from '../../editor/confirmations';
import type { SiteContent, TemplateGovernance } from '../../product/types';
import { createAdminObjectStorageDraft } from './useAdminWorkspace';

type UseAdminConfigStateOptions = {
  objectStorageDraft: AdminObjectStorageDraft | null;
  refreshAll: () => Promise<void>;
  setMessage: (message: string | null) => void;
  setObjectStorageDraft: Dispatch<SetStateAction<AdminObjectStorageDraft | null>>;
  setSiteContentDraft: Dispatch<SetStateAction<SiteContent | null>>;
  setTemplateGovernanceDraft: Dispatch<SetStateAction<TemplateGovernance | null>>;
  siteContentDraft: SiteContent | null;
  templateGovernanceDraft: TemplateGovernance | null;
};

type TemplateSettingField = 'enabled' | 'order' | 'category' | 'tag' | 'featured';

export function useAdminConfigState({
  objectStorageDraft,
  refreshAll,
  setMessage,
  setObjectStorageDraft,
  setSiteContentDraft,
  setTemplateGovernanceDraft,
  siteContentDraft,
  templateGovernanceDraft,
}: UseAdminConfigStateOptions) {
  const [configBusy, setConfigBusy] = useState(false);
  const [objectStorageBusy, setObjectStorageBusy] = useState(false);

  async function handleSaveSiteContent() {
    if (!siteContentDraft) {
      return;
    }

    setConfigBusy(true);
    setMessage(null);

    try {
      const payload = await updateAdminSiteContent(siteContentDraft);
      setSiteContentDraft(payload.siteContent);
      await refreshAll();
      setMessage('Site settings saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save site settings.');
    } finally {
      setConfigBusy(false);
    }
  }

  async function handleSaveTemplateGovernance() {
    if (!templateGovernanceDraft) {
      return;
    }

    setConfigBusy(true);
    setMessage(null);

    try {
      const payload = await updateAdminTemplateGovernance(templateGovernanceDraft);
      setTemplateGovernanceDraft(payload.templateGovernance);
      await refreshAll();
      setMessage('Template governance saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save template governance.');
    } finally {
      setConfigBusy(false);
    }
  }

  function updateObjectStorageDraftField<Key extends keyof AdminObjectStorageDraft>(
    field: Key,
    value: AdminObjectStorageDraft[Key],
  ) {
    setObjectStorageDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  async function handleTestObjectStorage() {
    if (!objectStorageDraft) {
      return;
    }

    setObjectStorageBusy(true);
    setMessage(null);

    try {
      const result = await testAdminObjectStorage(objectStorageDraft);
      await refreshAll();
      setMessage(`Object storage test passed. ${result.message}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to test object storage.');
    } finally {
      setObjectStorageBusy(false);
    }
  }

  async function handleSaveObjectStorage() {
    if (!objectStorageDraft || !window.confirm(getConfirmationMessage('saveObjectStorageConfig'))) {
      return;
    }

    setObjectStorageBusy(true);
    setMessage(null);

    try {
      const payload = await updateAdminObjectStorage(objectStorageDraft, true);
      setObjectStorageDraft(createAdminObjectStorageDraft(payload.objectStorage));
      await refreshAll();
      setMessage('Object storage config saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save object storage config.');
    } finally {
      setObjectStorageBusy(false);
    }
  }

  async function handleSyncObjectStorage() {
    setObjectStorageBusy(true);
    setMessage(null);

    try {
      const result = await syncAdminObjectStorageUploads();
      await refreshAll();
      setMessage(
        result.failed.length
          ? `Mirrored ${result.synced} uploads and skipped ${result.skipped}. ${result.failed.length} uploads failed.`
          : `Mirrored ${result.synced} uploads and skipped ${result.skipped}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to sync historical uploads.');
    } finally {
      setObjectStorageBusy(false);
    }
  }

  async function handleRestoreObjectStorage() {
    if (!window.confirm(getConfirmationMessage('restoreObjectStorageUploads'))) {
      return;
    }

    setObjectStorageBusy(true);
    setMessage(null);

    try {
      const result = await restoreAdminObjectStorageUploads(true);
      await refreshAll();
      setMessage(
        result.failed.length
          ? `Restored ${result.restoredFiles} files and detached ${result.detachedUploads} uploads. ${result.failed.length} uploads failed.`
          : `Restored ${result.restoredFiles} files and detached ${result.detachedUploads} uploads.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to restore mirrored uploads.');
    } finally {
      setObjectStorageBusy(false);
    }
  }

  function updateSiteHero(field: keyof SiteContent['hero'], value: string) {
    setSiteContentDraft((current) => (current ? { ...current, hero: { ...current.hero, [field]: value } } : current));
  }

  function updateSiteFeature(index: number, field: 'title' | 'copy', value: string) {
    setSiteContentDraft((current) => {
      if (!current) {
        return current;
      }

      const nextFeatures = [...current.features];
      nextFeatures[index] = {
        ...nextFeatures[index],
        [field]: value,
      };
      return {
        ...current,
        features: nextFeatures,
      };
    });
  }

  function updateWorkflow(field: 'eyebrow' | 'title' | 'body', value: string) {
    setSiteContentDraft((current) => (current ? { ...current, workflow: { ...current.workflow, [field]: value } } : current));
  }

  function updateWorkflowStep(index: number, value: string) {
    setSiteContentDraft((current) => {
      if (!current) {
        return current;
      }

      const nextSteps = [...current.workflow.steps];
      nextSteps[index] = value;
      return {
        ...current,
        workflow: {
          ...current.workflow,
          steps: nextSteps,
        },
      };
    });
  }

  function updateFeaturedIssue(field: 'eyebrow' | 'title' | 'body', value: string) {
    setSiteContentDraft((current) =>
      current ? { ...current, featuredIssue: { ...current.featuredIssue, [field]: value } } : current,
    );
  }

  function updateFeaturedProjectId(value: string) {
    setSiteContentDraft((current) =>
      current
        ? {
            ...current,
            featuredIssue: {
              ...current.featuredIssue,
              projectId: value || null,
            },
          }
        : current,
    );
  }

  function updateFeaturedPageIds(value: string) {
    setSiteContentDraft((current) =>
      current
        ? {
            ...current,
            featuredIssue: {
              ...current.featuredIssue,
              pageIds: value
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean),
            },
          }
        : current,
    );
  }

  function updateSiteCta(field: keyof SiteContent['cta'], value: string) {
    setSiteContentDraft((current) => (current ? { ...current, cta: { ...current.cta, [field]: value } } : current));
  }

  function updateTemplateSetting(
    group: keyof TemplateGovernance,
    id: string,
    field: TemplateSettingField,
    value: boolean | number | string,
  ) {
    setTemplateGovernanceDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [group]: {
          ...current[group],
          [id]: {
            ...current[group][id],
            [field]: value,
          },
        },
      };
    });
  }

  return {
    configBusy,
    handleRestoreObjectStorage,
    handleSaveObjectStorage,
    handleSaveSiteContent,
    handleSaveTemplateGovernance,
    handleSyncObjectStorage,
    handleTestObjectStorage,
    objectStorageBusy,
    updateFeaturedIssue,
    updateFeaturedPageIds,
    updateFeaturedProjectId,
    updateObjectStorageDraftField,
    updateSiteCta,
    updateSiteFeature,
    updateSiteHero,
    updateTemplateSetting,
    updateWorkflow,
    updateWorkflowStep,
  };
}
