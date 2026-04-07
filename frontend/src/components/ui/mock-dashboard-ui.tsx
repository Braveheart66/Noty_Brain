export function MockDashboardUI() {
  return (
    <div className="mock-dashboard">
      {/* Top bar */}
      <div className="mock-dash-topbar">
        <div className="mock-dash-logo">
          <span className="mock-dash-logo-icon">🧠</span>
          <span className="mock-dash-logo-text">Noty Brain</span>
        </div>
        <div className="mock-dash-nav">
          <span className="mock-dash-nav-active">Capture</span>
          <span>Explore</span>
          <span>Graph Lab</span>
        </div>
        <div className="mock-dash-avatar" />
      </div>

      {/* Body */}
      <div className="mock-dash-body">
        {/* Sidebar */}
        <div className="mock-dash-sidebar">
          <div className="mock-dash-sidebar-header">Notes</div>
          {["📝 Q4 Strategy", "🧠 AI Research", "📋 Sprint Plan", "🔗 Architecture", "💡 Ideas"].map(
            (label, i) => (
              <div
                key={label}
                className={`mock-dash-sidebar-item${i === 0 ? " active" : ""}`}
              >
                {label}
              </div>
            )
          )}
        </div>

        {/* Main content area */}
        <div className="mock-dash-main">
          <div className="mock-dash-editor-title">📝 Q4 Strategy Meeting</div>
          <div className="mock-dash-editor-lines">
            <div className="mock-dash-line heading">Key Decisions</div>
            <div className="mock-dash-line">
              Prioritize semantic search accuracy over recall
            </div>
            <div className="mock-dash-line">
              Ship the new 3D graph view by end of sprint
            </div>
            <div className="mock-dash-line dim">
              Expand knowledge graph for cross-team collaboration
            </div>
            <div className="mock-dash-line code">
              {"// TODO: integrate embeddings pipeline"}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="mock-dash-panel">
          <div className="mock-dash-panel-title">Intelligence</div>
          <div className="mock-dash-panel-card">
            <strong>Backlinks</strong>
            <span>3 connected</span>
          </div>
          <div className="mock-dash-panel-card">
            <strong>Graph Position</strong>
            <span>Cluster 2</span>
          </div>
          <div className="mock-dash-panel-card">
            <strong>Similar Notes</strong>
            <span>5 matches</span>
          </div>
        </div>
      </div>
    </div>
  );
}
