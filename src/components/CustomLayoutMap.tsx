import { CSSProperties } from 'react';
import { useT } from '../i18n';
import { CustomTemplateDefinition } from '../editor/types';

interface CustomLayoutMapProps {
  template: CustomTemplateDefinition;
  highlightedSlot?: string | null;
  className?: string;
}

function areaStyle(area: { x: number; y: number; width: number; height: number }): CSSProperties {
  return {
    left: `${area.x}%`,
    top: `${area.y}%`,
    width: `${area.width}%`,
    height: `${area.height}%`,
  };
}

export function CustomLayoutMap({ template, highlightedSlot, className }: CustomLayoutMapProps) {
  const t = useT();

  return (
    <div className={`custom-layout-map ${className ?? ''}`.trim()} aria-hidden="true">
      <div className="custom-layout-map__text" style={areaStyle(template.text)}>
        <span>{t('Text')}</span>
      </div>
      {template.frames.map((frame, index) => (
        <div
          key={frame.slot}
          className={`custom-layout-map__frame ${highlightedSlot === frame.slot ? 'is-highlighted' : ''}`.trim()}
          style={areaStyle(frame)}
        >
          <span>{frame.label.trim() ? t(frame.label.trim()) : `Frame ${index + 1}`}</span>
        </div>
      ))}
    </div>
  );
}
