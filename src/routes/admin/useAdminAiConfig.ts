import { useState } from 'react';
import { translate } from '../../i18n';
import {
  type AdminAiConfigDraft,
  type AdminAiProviderDraft,
  testAdminAiProvider,
  updateAdminAiConfig,
} from '../../editor/api';

type UseAdminAiConfigOptions = {
  aiConfigDraft: AdminAiConfigDraft | null;
  refreshAll: () => Promise<void>;
  setAiConfigDraft: (value: AdminAiConfigDraft | null | ((current: AdminAiConfigDraft | null) => AdminAiConfigDraft | null)) => void;
  setMessage: (message: string | null) => void;
};

export function useAdminAiConfig({
  aiConfigDraft,
  refreshAll,
  setAiConfigDraft,
  setMessage,
}: UseAdminAiConfigOptions) {
  const [aiBusy, setAiBusy] = useState(false);
  const [aiTestBusyId, setAiTestBusyId] = useState<string | null>(null);

  function updateField<Key extends keyof Omit<AdminAiConfigDraft, 'providers'>>(
    field: Key,
    value: AdminAiConfigDraft[Key],
  ) {
    setAiConfigDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateProvider(index: number, field: keyof AdminAiProviderDraft, value: string | number | boolean) {
    setAiConfigDraft((current) => {
      if (!current) {
        return current;
      }

      const providers = [...current.providers];
      providers[index] = {
        ...providers[index],
        [field]: value,
      };
      return {
        ...current,
        providers,
      };
    });
  }

  function addProvider() {
    setAiConfigDraft((current) => {
      if (!current) {
        return current;
      }

      const nextOrder = current.providers.reduce((max, provider) => Math.max(max, provider.order), 0) + 10;
      return {
        ...current,
        providers: [
          ...current.providers,
          {
            name: '',
            model: '',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: '',
            order: nextOrder,
            enabled: true,
          },
        ],
      };
    });
  }

  function removeProvider(index: number) {
    setAiConfigDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        providers: current.providers.filter((_, providerIndex) => providerIndex !== index),
      };
    });
  }

  function moveProvider(index: number, direction: -1 | 1) {
    setAiConfigDraft((current) => {
      if (!current) {
        return current;
      }

      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.providers.length) {
        return current;
      }

      const providers = [...current.providers];
      const [provider] = providers.splice(index, 1);
      providers.splice(targetIndex, 0, provider);
      return {
        ...current,
        providers: providers.map((entry, providerIndex) => ({
          ...entry,
          order: (providerIndex + 1) * 10,
        })),
      };
    });
  }

  async function saveAiConfig(nextDraft: AdminAiConfigDraft) {
    setAiBusy(true);
    setMessage(null);

    try {
      const payload = await updateAdminAiConfig(nextDraft);
      setAiConfigDraft({
        enabled: payload.ai.enabled,
        userTotalLimit: payload.ai.userTotalLimit,
        dailyLimit: payload.ai.dailyLimit,
        maxImages: payload.ai.maxImages,
        requestTimeoutMs: payload.ai.requestTimeoutMs,
        prompt: payload.ai.prompt,
        providers: payload.ai.providers.map((provider) => ({
          id: provider.id,
          name: provider.name,
          model: provider.model,
          baseUrl: provider.baseUrl,
          apiKey: '',
          order: provider.order,
          enabled: provider.enabled,
          hasApiKey: provider.hasApiKey,
          apiKeyHint: provider.apiKeyHint,
        })),
      });
      await refreshAll();
      setMessage('AI settings saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save AI settings.');
      throw error;
    } finally {
      setAiBusy(false);
    }
  }

  async function handleSaveAiConfig() {
    if (!aiConfigDraft) {
      return;
    }

    await saveAiConfig(aiConfigDraft);
  }

  async function handleTestAiProvider(index: number) {
    if (!aiConfigDraft) {
      return;
    }

    const provider = aiConfigDraft.providers[index];
    if (!provider) {
      return;
    }

    setAiTestBusyId(provider.id ?? `draft-${index}`);
    setMessage(null);

    try {
      const result = await testAdminAiProvider({
        providerId: provider.id,
        provider,
      });
      setMessage(translate('AI connection passed in %s ms (%s).').replace('%s', String(result.latencyMs)).replace('%s', result.model));
    } catch (error) {
      setMessage(error instanceof Error && /^AI connection failed/i.test(error.message) ? translate('AI connection failed. Check the interface settings.') : translate('Unable to test this AI provider.'));
    } finally {
      setAiTestBusyId(null);
    }
  }

  return {
    addProvider,
    aiBusy,
    aiTestBusyId,
    handleSaveAiConfig,
    handleTestAiProvider,
    moveProvider,
    removeProvider,
    saveAiConfig,
    updateField,
    updateProvider,
  };
}
