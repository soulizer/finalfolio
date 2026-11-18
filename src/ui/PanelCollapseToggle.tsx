// One shared collapse control for every .editor-panel on the site. The button
// only marks the spot; the delegated behavior in panelCollapse.ts toggles the
// panel, keeps aria/title in sync, and remembers the state per route.
export function PanelCollapseToggle() {
  return (
    <button
      type="button"
      className="editor-panel__toggle"
      data-panel-toggle=""
      aria-expanded="true"
      title="Collapse panel"
    >
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M3 4.5 6 7.5 9 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
