import { templatePackOrder, TemplatePackId, templateOrder } from '../editor/demoData';
import { TemplateId } from '../editor/types';
import { TemplateGovernance } from './types';

function sortGovernedIds<T extends string>(ids: readonly T[], settings: Record<string, { enabled: boolean; order: number }> | undefined) {
  return [...ids]
    .filter((id) => settings?.[id]?.enabled !== false)
    .sort((left, right) => {
      const leftOrder = settings?.[left]?.order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = settings?.[right]?.order ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return ids.indexOf(left) - ids.indexOf(right);
    });
}

export function getGovernedTemplateIds(governance: TemplateGovernance | null, currentTemplate?: TemplateId | null) {
  const visible = sortGovernedIds(templateOrder, governance?.templates);
  if (!currentTemplate || visible.includes(currentTemplate)) {
    return visible;
  }

  return [...visible, currentTemplate];
}

export function getGovernedTemplatePackIds(governance: TemplateGovernance | null) {
  return sortGovernedIds(templatePackOrder, governance?.packs) as TemplatePackId[];
}
