import { CSSProperties, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IssueTurnJsBook, type TurnJsBookHandle } from './IssueTurnJsBook';
import { IssueViewReaderChrome, IssueViewSidebar } from './IssueViewChrome';
import { useIssueViewMobilePanelState, useIssueViewReaderMode } from './useIssueViewChromeState';
import { useIssueViewDocumentState } from './useIssueViewDocumentState';
import { useIssueViewSidebarOffset, useIssueViewViewportLayout } from './useIssueViewLayout';
import { useIssueViewNavigation } from './useIssueViewNavigation';
import { useIssueViewNavigationBridge } from './useIssueViewNavigationBridge';
import { useIssueViewPresentation } from './useIssueViewPresentation';
import { useIssueViewShareState } from './useIssueViewShareState';
import { IssueViewLoadingState, IssueViewUnavailableState } from './IssueViewShellStates';
import { useSession } from '../session';
import { clamp } from './issueViewReaderState';

export function IssueViewPage() {
  const { shareId = '' } = useParams();
  const { user: session, ready: sessionReady } = useSession();
  const [isTurning, setIsTurning] = useState(false);
  const bookRef = useRef<TurnJsBookHandle | null>(null);
  const navigationBridge = useIssueViewNavigationBridge({
    onBeforeLoad: () => {
      setIsTurning(false);
    },
  });
  const mobileSinglePageActive = useIssueViewReaderMode();
  const { issue, loadError, loadingShellVisible, loadState } = useIssueViewShareState({
    onBeforeLoad: navigationBridge.handleBeforeIssueLoad,
    onLoaded: navigationBridge.handleIssueLoaded,
    shareId,
  });
  const {
    effectiveViewerViewportSize,
    fullscreenActive,
    shellClassName,
    shellRef,
    toggleFullscreen,
    viewerViewportRef,
    viewerViewportSize,
  } = useIssueViewViewportLayout({
    loadState,
    mobileSinglePageActive,
    onRefreshLayout: () => bookRef.current?.refreshLayout(),
  });
  const { closeMobilePanel, mobilePanelOpen, toggleMobilePanel } = useIssueViewMobilePanelState({
    fullscreenActive,
    mobileSinglePageActive,
  });
  const { assetsById, pageCount, pages, renderedPages } = useIssueViewDocumentState({ issue });
  const {
    currentTurnPage,
    currentViewPages,
    handleAdvanceToNextPage,
    handleAdvanceToPreviousPage,
    handleBookViewChange,
    handleMobileTouchCancel,
    handleMobileTouchEnd,
    handleMobileTouchStart,
    initializeLoadedIssue,
    mobileVisiblePage,
    resetNavigationState,
    stableTurnPageRef,
  } = useIssueViewNavigation({
    bookRef,
    isTurning,
    loadState,
    mobileSinglePageActive,
    pageCount,
  });
  navigationBridge.connectNavigation({
    initializeLoadedIssue,
    resetNavigationState,
  });
  const {
    bookKey,
    currentView,
    mobileStatusLabel,
    mobileStageTranslateX,
    pageHeight,
    pageScale,
    pageWidth,
    sheetMetrics,
    showDesktopSidebar,
    showMobileChrome,
    viewerClipHeight,
    viewerClipWidth,
    viewerDisplayMode,
    viewerHint,
    viewerPositionMode,
    viewerReady,
    viewerStageWidth,
  } = useIssueViewPresentation({
    currentViewPages,
    effectiveViewerViewportSize,
    fullscreenActive,
    mobileSinglePageActive,
    mobileVisiblePage,
    pageCount,
    pages,
    shareId,
  });
  // Before the book reports its first view, the reader always opens at the
  // cover; treating [0,0] as a spread would flash a left shadow for 500ms.
  const viewKnown = currentViewPages[0] > 0 || currentViewPages[1] > 0;
  const restMode = viewKnown ? currentView.mode : 'single-right';
  // Rest state only: while any leaf is lifted, the book hides its desk shadow
  // itself (see `data-lifted` in useIssueTurnJsRuntime), so this mode is shown
  // only when the landed view is on the table.
  const shadowHalves = {
    left: restMode !== 'single-right',
    right: restMode !== 'single-left',
  };
  const initialBookPage = clamp(
    stableTurnPageRef.current || currentTurnPage,
    1,
    Math.max(pageCount, 1),
  );
  const sidebarTopOffset = useIssueViewSidebarOffset({
    pageHeight,
    shellRef,
    showDesktopSidebar,
    viewerViewportHeight: viewerViewportSize.height,
    viewerViewportRef,
  });

  if (loadState === 'loading') {
    if (!loadingShellVisible) {
      return <div ref={shellRef} className={shellClassName} aria-hidden="true" />;
    }

    return (
      <IssueViewLoadingState
        shellClassName={shellClassName}
        shellRef={shellRef}
        sidebarTopOffset={sidebarTopOffset}
      />
    );
  }

  if (loadState === 'error' || !issue) {
    return <IssueViewUnavailableState loadError={loadError} shellClassName={shellClassName} />;
  }

  return (
    <div ref={shellRef} className={shellClassName}>
      <main
        id="main-content"
        className="issue-view-layout"
        style={
          {
            '--issue-view-sidebar-top-offset': `${sidebarTopOffset || 0}px`,
          } as CSSProperties
        }
      >
        <section className="issue-view-reader">
          <div
            ref={viewerViewportRef}
            className={`issue-viewer__viewport issue-viewer__viewport--${viewerPositionMode}`.trim()}
            onTouchStart={mobileSinglePageActive ? handleMobileTouchStart : undefined}
            onTouchEnd={mobileSinglePageActive ? handleMobileTouchEnd : undefined}
            onTouchCancel={mobileSinglePageActive ? handleMobileTouchCancel : undefined}
          >
            <div
              className="issue-viewer__clip issue-viewer__clip--turnjs"
              style={
                {
                  '--issue-viewer-clip-max-width': `${viewerClipWidth}px`,
                  '--issue-viewer-clip-max-height': `${viewerClipHeight}px`,
                } as CSSProperties
              }
            >
              {pageCount && viewerReady ? (
                <div
                  className="issue-viewer__turnjs-stage"
                  style={
                    {
                      width: `${viewerStageWidth}px`,
                      height: `${Math.round(pageHeight)}px`,
                      transform: mobileSinglePageActive ? `translateX(${mobileStageTranslateX}px)` : undefined,
                      transition: mobileSinglePageActive ? 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
                    } as CSSProperties
                  }
                >
                  <IssueTurnJsBook
                    key={bookKey}
                    ref={bookRef}
                    issueLabel={issue.issue}
                    renderedPages={renderedPages}
                    assetsById={assetsById}
                    frameRadius={issue.frameRadius}
                    sheetWidth={sheetMetrics.width}
                    sheetHeight={sheetMetrics.height}
                    pageWidth={pageWidth}
                    pageHeight={pageHeight}
                    pageScale={pageScale}
                    displayMode={viewerDisplayMode}
                    pageSideMode={currentView.mode}
                    turning={isTurning}
                    shadowLeft={shadowHalves.left}
                    shadowRight={shadowHalves.right}
                    initialPage={initialBookPage}
                    onTurningChange={setIsTurning}
                    onViewChange={handleBookViewChange}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <IssueViewReaderChrome
            currentView={currentView}
            fullscreenActive={fullscreenActive}
            isTurning={isTurning}
            issue={issue}
            mobilePanelOpen={mobilePanelOpen}
            mobileStatusLabel={mobileStatusLabel}
            pageCount={pageCount}
            pageWidth={pageWidth}
            session={session}
            sessionReady={sessionReady}
            showMobileChrome={showMobileChrome}
            onAdvanceToNextPage={handleAdvanceToNextPage}
            onAdvanceToPreviousPage={handleAdvanceToPreviousPage}
            onCloseMobilePanel={closeMobilePanel}
            onToggleFullscreen={toggleFullscreen}
            onToggleMobilePanel={toggleMobilePanel}
          />
        </section>

        <IssueViewSidebar
          currentView={currentView}
          fullscreenActive={fullscreenActive}
          isTurning={isTurning}
          issue={issue}
          pageCount={pageCount}
          session={session}
          sessionReady={sessionReady}
          showDesktopSidebar={showDesktopSidebar}
          viewerHint={viewerHint}
          onAdvanceToNextPage={handleAdvanceToNextPage}
          onAdvanceToPreviousPage={handleAdvanceToPreviousPage}
          onToggleFullscreen={toggleFullscreen}
        />
      </main>
    </div>
  );
}
