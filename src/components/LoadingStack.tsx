type LoadingPlaceholderVariant =
  | 'eyebrow'
  | 'title'
  | 'line-short'
  | 'line-medium'
  | 'line-long'
  | 'line-full';

export function LoadingStack({
  lines,
  className = '',
  tight = false,
}: {
  lines: LoadingPlaceholderVariant[];
  className?: string;
  tight?: boolean;
}) {
  return (
    <div className={`loading-stack ${tight ? 'loading-stack--tight' : ''} ${className}`.trim()} aria-hidden="true">
      {lines.map((line, index) => (
        <span key={`${line}-${index}`} className={`loading-placeholder loading-placeholder--${line}`} />
      ))}
    </div>
  );
}
