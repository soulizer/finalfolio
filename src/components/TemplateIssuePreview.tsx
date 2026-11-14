import { useMemo } from 'react';
import { createProjectFromUserTemplate } from '../editor/demoData';
import { UserTemplatePayload } from '../editor/types';
import { MagazinePreview } from './MagazinePreview';

export function TemplateIssuePreview({
  templatePayload,
  className,
}: {
  templatePayload: UserTemplatePayload;
  className?: string;
}) {
  const project = useMemo(() => createProjectFromUserTemplate(templatePayload), [templatePayload]);
  const firstPage = project.pages[0] ?? null;

  if (!firstPage) {
    return <div className={`template-issue-preview template-issue-preview--empty ${className ?? ''}`.trim()} />;
  }

  return (
    <div className={`template-issue-preview ${className ?? ''}`.trim()}>
      <div className="magazine-sheet magazine-sheet--template-preview">
        <MagazinePreview issue={project.issue} page={firstPage} assets={{}} frameRadius={project.frameRadius} pageNumber={1} />
      </div>
    </div>
  );
}
