import { CSSProperties, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { createCustomTemplateDefinition } from '../../editor/demoData';
import {
  CUSTOM_LAYOUT_GAP_X_PERCENT,
  CUSTOM_LAYOUT_GAP_Y_PERCENT,
  clampLayoutArea,
  layoutAreaStyle,
} from '../../editor/layoutGeometry';
import {
  CUSTOM_TEMPLATE_FRAME_LABEL_LIMIT,
  CUSTOM_TEMPLATE_FRAME_LIMIT,
  CUSTOM_TEMPLATE_NAME_LIMIT,
} from '../../editor/limits';
import type { CustomTemplateDefinition, CustomTemplateFrame, LayoutArea } from '../../editor/types';
import { confirmAction } from '../../ui/confirm';
import { useEditorPreviewScale } from './useEditorPreviewScale';

type LayoutEditorDialogProps = {
  mode: 'new' | 'edit';
  initialTemplate: CustomTemplateDefinition;
  initialName: string;
  onClose: () => void;
  onDelete?: () => void;
  onSave: (template: CustomTemplateDefinition, applyToPage: boolean) => void;
};

type GeometryField = keyof LayoutArea;

const geometryFields: Array<{ key: GeometryField; label: string; min: number; max: number }> = [
  { key: 'x', label: 'X', min: 0, max: 88 },
  { key: 'y', label: 'Y', min: 0, max: 88 },
  { key: 'width', label: 'W', min: 12, max: 100 },
  { key: 'height', label: 'H', min: 12, max: 100 },
];

const ADD_FRAME_WIDTH = (100 - CUSTOM_LAYOUT_GAP_X_PERCENT) / 2;
const ADD_FRAME_HEIGHT = (100 - CUSTOM_LAYOUT_GAP_Y_PERCENT * 2) / 2;

function frameLabel(frame: CustomTemplateFrame, index: number, fallback: string) {
  return frame.label.trim() || `${fallback} ${index + 1}`;
}

function LayoutPagePreview({
  template,
  name,
  selectedSlot,
  scale,
}: {
  template: CustomTemplateDefinition;
  name: string;
  selectedSlot: string | null;
  scale: number;
}) {
  const t = useT();
  const pageStyle = {
    '--page-scale': scale,
    '--page-frame-radius': '12px',
  } as CSSProperties;

  return (
    <div className="magazine-sheet magazine-sheet--editor layout-editor-sheet" style={pageStyle}>
      <article className="magazine-page magazine-page--theme-warm-beige layout-editor-page">
        <header className="magazine-page__meta">
          <span>{t('Layout preview')}</span>
          <span>{t('Page %s').replace('%s', '01')}</span>
        </header>
        <div className="magazine-custom">
          <div className="magazine-custom__canvas">
            {template.frames.map((frame, index) => (
              <div
                key={frame.slot}
                className={`magazine-custom__frame layout-editor-frame ${selectedSlot === frame.slot ? 'is-selected' : ''}`}
                style={layoutAreaStyle(frame)}
              >
                <div className="layout-editor-frame__box">
                  <span className="layout-editor-frame__label">{frameLabel(frame, index, t('Image area'))}</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="8" cy="8" r="2.2" />
                    <path d="M3.4 19.2 9.6 12l3.7 4.2 2.6-2.9 4.7 5.9Z" />
                  </svg>
                </div>
              </div>
            ))}
            <section className="magazine-custom__text layout-editor-text" style={layoutAreaStyle(template.text)}>
              <span className="magazine-custom__label">{name || t('Untitled layout')}</span>
              <div className="magazine-heading-block">
                <p className="magazine-kicker">{t('Kicker')}</p>
                <h2>{t('Title')}</h2>
                <p className="layout-editor-text__deck">{t('Deck copy')}</p>
              </div>
              <p className="layout-editor-text__body">{t('Body copy stays editable on the page.')}</p>
              <footer>{t('Caption')}</footer>
            </section>
          </div>
        </div>
      </article>
    </div>
  );
}

export function LayoutEditorDialog({
  mode,
  initialTemplate,
  initialName,
  onClose,
  onDelete,
  onSave,
}: LayoutEditorDialogProps) {
  const t = useT();
  const [draft, setDraft] = useState<CustomTemplateDefinition>(() => initialTemplate);
  const [name, setName] = useState(initialName);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(initialTemplate.frames[0]?.slot ?? null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const previewAreaRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const previewScale = useEditorPreviewScale({
    loadState: 'ready',
    canvasRef: previewAreaRef,
    sheetProbeRef: previewCanvasRef,
    minAvailableWidth: 120,
    minAvailableHeight: 120,
  });

  const dirty = useMemo(
    () => name !== initialName || JSON.stringify(draft) !== JSON.stringify(initialTemplate),
    [draft, initialName, initialTemplate, name],
  );

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus?.();
    };
  }, []);

  async function requestClose() {
    if (dirty) {
      const confirmed = await confirmAction({
        title: 'Discard unsaved layout changes?',
        body: 'The layout editor has changes that have not been saved yet.',
        confirmLabel: 'Discard changes',
        tone: 'danger',
      });
      if (!confirmed) {
        return;
      }
    }

    onClose();
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void requestClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  function updateTextArea(field: GeometryField, value: number) {
    setDraft((current) => ({
      ...current,
      text: clampLayoutArea({ ...current.text, [field]: value }),
    }));
  }

  function updateFrame(slot: string, field: GeometryField, value: number) {
    setDraft((current) => ({
      ...current,
      frames: current.frames.map((frame) =>
        frame.slot === slot
          ? {
              ...frame,
              ...clampLayoutArea({ ...frame, [field]: value }),
            }
          : frame,
      ),
    }));
  }

  function updateFrameLabel(slot: string, label: string) {
    setDraft((current) => ({
      ...current,
      frames: current.frames.map((frame) => (frame.slot === slot ? { ...frame, label } : frame)),
    }));
  }

  function addFrame() {
    if (draft.frames.length >= CUSTOM_TEMPLATE_FRAME_LIMIT) {
      return;
    }

    setDraft((current) => {
      if (current.frames.length >= CUSTOM_TEMPLATE_FRAME_LIMIT) {
        return current;
      }

      const index = current.frames.length;
      const column = index % 2;
      const row = Math.floor(index / 2);
      const frame: CustomTemplateFrame = {
        slot: `frame${index + 1}`,
        label: '',
        x: column ? ADD_FRAME_WIDTH + CUSTOM_LAYOUT_GAP_X_PERCENT : 0,
        y: Math.min(100 - ADD_FRAME_HEIGHT, row * (ADD_FRAME_HEIGHT + CUSTOM_LAYOUT_GAP_Y_PERCENT)),
        width: ADD_FRAME_WIDTH,
        height: ADD_FRAME_HEIGHT,
      };
      return {
        ...current,
        frames: [...current.frames, frame],
      };
    });
  }

  function removeFrame(slot: string) {
    if (draft.frames.length <= 1) {
      return;
    }

    setDraft((current) => ({
      ...current,
      frames: current.frames.filter((frame) => frame.slot !== slot),
    }));
    if (selectedSlot === slot) {
      const nextFrame = draft.frames.find((frame) => frame.slot !== slot);
      setSelectedSlot(nextFrame?.slot ?? null);
    }
  }

  function resetGeometry() {
    setDraft(createCustomTemplateDefinition({ name: draft.name }));
  }

  function handleSave(applyToPage: boolean) {
    const nextName = name.trim();
    if (!nextName) {
      setSaveError(t('Enter a name for this layout.'));
      nameInputRef.current?.focus();
      return;
    }

    const template: CustomTemplateDefinition = {
      ...draft,
      name: nextName.slice(0, CUSTOM_TEMPLATE_NAME_LIMIT),
      frames: draft.frames.map((frame, index) => ({
        ...frame,
        label: frameLabel(frame, index, t('Image area')).slice(0, CUSTOM_TEMPLATE_FRAME_LABEL_LIMIT),
      })),
    };
    onSave(template, applyToPage);
  }

  return (
    <div
      className="layout-editor-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          void requestClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="layout-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="layout-editor-title"
        tabIndex={-1}
      >
        <header className="layout-editor-header">
          <div className="layout-editor-header__copy">
            <p className="eyebrow">{t('Layout library')}</p>
            <h2 id="layout-editor-title">{mode === 'new' ? t('New custom layout') : t('Edit layout')}</h2>
          </div>
          <div className="layout-editor-header__meta">
            <span className="panel-tag">
              {draft.frames.length === 1
                ? t('1 image area')
                : t('%s image areas').replace('%s', String(draft.frames.length))}
            </span>
            <button
              type="button"
              className="layout-editor-close"
              aria-label={t('Close')}
              title={t('Close')}
              onClick={() => void requestClose()}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </header>

        <div className="layout-editor-main">
          <div className="layout-editor-preview" ref={previewAreaRef} aria-label={t('Layout preview')}>
            <div className="magazine-sheet-probe" ref={previewCanvasRef} aria-hidden="true" />
            <LayoutPagePreview
              template={draft}
              name={name}
              selectedSlot={selectedSlot}
              scale={previewScale}
            />
            <p className="layout-editor-preview__hint">
              {t('This preview uses the same page size and image gaps as the printed folio.')}
            </p>
          </div>

          <aside className="layout-editor-controls">
            <section className="layout-editor-section">
              <div className="layout-editor-section__header">
                <span className="editor-panel__label">{t('Text area')}</span>
                <span className="panel-tag">{t('Percentages')}</span>
              </div>
              <div className="layout-editor-geometry">
                {geometryFields.map((field) => (
                  <label className="field" key={`text-${field.key}`}>
                    <span>{field.label}</span>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step="1"
                      value={Math.round(draft.text[field.key])}
                      onChange={(event) => updateTextArea(field.key, Number(event.target.value))}
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="layout-editor-section">
              <div className="layout-editor-section__header">
                <span className="editor-panel__label">{t('Image areas')}</span>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  disabled={draft.frames.length >= CUSTOM_TEMPLATE_FRAME_LIMIT}
                  onClick={addFrame}
                >
                  {draft.frames.length >= CUSTOM_TEMPLATE_FRAME_LIMIT ? t('Limit reached') : t('Add image area')}
                </button>
              </div>
              <div className="layout-editor-frame-list">
                {draft.frames.map((frame, index) => (
                  <article
                    key={frame.slot}
                    className={`layout-editor-frame-card ${selectedSlot === frame.slot ? 'is-selected' : ''}`}
                    onFocus={() => setSelectedSlot(frame.slot)}
                    onMouseEnter={() => setSelectedSlot(frame.slot)}
                  >
                    <div className="layout-editor-frame-card__header">
                      <span className="editor-panel__label">
                        {t('Image area')} {index + 1}
                      </span>
                      <button
                        type="button"
                        className="layout-editor-frame-card__remove"
                        disabled={draft.frames.length <= 1}
                        aria-label={t('Remove image area')}
                        title={draft.frames.length <= 1 ? t('Keep at least one image area') : t('Remove image area')}
                        onClick={() => removeFrame(frame.slot)}
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M3.5 4.5h9M6.2 4.5V3.2h3.6v1.3M5 4.5l.5 8.3h5l.5-8.3M6.8 7v3.6M9.2 7v3.6" />
                        </svg>
                      </button>
                    </div>
                    <label className="field">
                      <span>{t('Label')}</span>
                      <input
                        maxLength={CUSTOM_TEMPLATE_FRAME_LABEL_LIMIT}
                        value={frame.label}
                        placeholder={`${t('Image area')} ${index + 1}`}
                        onChange={(event) => updateFrameLabel(frame.slot, event.target.value)}
                      />
                    </label>
                    <div className="layout-editor-geometry">
                      {geometryFields.map((field) => (
                        <label className="field" key={`${frame.slot}-${field.key}`}>
                          <span>{field.label}</span>
                          <input
                            type="number"
                            min={field.min}
                            max={field.max}
                            step="1"
                            value={Math.round(frame[field.key])}
                            onChange={(event) => updateFrame(frame.slot, field.key, Number(event.target.value))}
                          />
                        </label>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <button type="button" className="button button--ghost button--small" onClick={resetGeometry}>
                {t('Reset base')}
              </button>
            </section>
          </aside>
        </div>

        <footer className="layout-editor-footer">
          {onDelete ? (
            <button type="button" className="button button--danger-ghost button--small" onClick={onDelete}>
              {t('Delete layout')}
            </button>
          ) : null}
          <label className="field layout-editor-name-field">
            <span>{t('Template name')}</span>
            <input
              ref={nameInputRef}
              maxLength={CUSTOM_TEMPLATE_NAME_LIMIT}
              value={name}
              placeholder={t('Name this layout')}
              onChange={(event) => {
                setName(event.target.value);
                setSaveError(null);
              }}
            />
          </label>
          {saveError ? (
            <p className="layout-editor-error" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="layout-editor-footer__actions">
            <button type="button" className="button button--ghost button--small" onClick={() => void requestClose()}>
              {t('Cancel')}
            </button>
            <button type="button" className="button button--ghost button--small" onClick={() => handleSave(false)}>
              {t('Save layout')}
            </button>
            <button type="button" className="button button--primary button--small" onClick={() => handleSave(true)}>
              {t('Save and apply')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
