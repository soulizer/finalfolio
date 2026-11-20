const DEFAULT_DESCRIPTION_LIMIT = 2000;
const DEFAULT_TAGS_LIMIT = 60;
const DEFAULT_TAG_LENGTH = 60;

/**
 * Normalises the AI tags/description an upstream service (for example UnAlbum)
 * already produced for a photo. The editor reuses these words instead of
 * re-uploading the pixels, so this value is stored on assets, allowed into
 * projects, and forwarded to the AI planner.
 */
export function sanitizeAssetAnalysis(
  value,
  { descriptionLimit = DEFAULT_DESCRIPTION_LIMIT, tagsLimit = DEFAULT_TAGS_LIMIT, tagLength = DEFAULT_TAG_LENGTH } = {},
) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const description =
    typeof value.description === 'string'
      ? value.description.replace(/\s+/g, ' ').trim().slice(0, descriptionLimit)
      : '';
  const tags = Array.isArray(value.tags)
    ? Array.from(
        new Set(
          value.tags
            .filter((tag) => typeof tag === 'string')
            .map((tag) => tag.replace(/\s+/g, ' ').trim().slice(0, tagLength))
            .filter(Boolean),
        ),
      ).slice(0, tagsLimit)
    : [];

  if (!description && !tags.length) {
    return null;
  }

  return {
    description,
    tags,
    ...(typeof value.source === 'string' && value.source.trim() ? { source: value.source.trim().slice(0, 40) } : {}),
    ...(typeof value.analyzedAt === 'string' && value.analyzedAt.trim()
      ? { analyzedAt: value.analyzedAt.trim().slice(0, 64) }
      : {}),
  };
}
