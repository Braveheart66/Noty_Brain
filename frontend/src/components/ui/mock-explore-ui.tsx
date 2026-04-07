export function MockExploreUI() {
  return (
    <div className="mock-ui mock-explore">
      {/* Search bar */}
      <div className="mock-search-bar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span className="mock-search-text">What were the key decisions from last quarter?</span>
      </div>

      {/* AI answer */}
      <div className="mock-answer">
        <div className="mock-answer-label">
          <span className="mock-ai-badge">AI</span>
          Answer from your notes
        </div>
        <p className="mock-answer-text">
          Based on 4 relevant notes, the key decisions included prioritizing semantic search accuracy, 
          expanding the graph for cross-team use, and shipping the new 3D graph view by end of sprint.
        </p>
        <div className="mock-confidence">
          <div className="mock-confidence-bar">
            <div className="mock-confidence-fill" />
          </div>
          <span>92% confidence</span>
        </div>
      </div>

      {/* Result pills */}
      <div className="mock-results">
        <div className="mock-result-pill">
          <span className="mock-result-emoji">📋</span>
          <div className="mock-result-info">
            <strong>Q4 Strategy Meeting</strong>
            <small>0.94 similarity</small>
          </div>
        </div>
        <div className="mock-result-pill">
          <span className="mock-result-emoji">🧠</span>
          <div className="mock-result-info">
            <strong>Graph Lab Roadmap</strong>
            <small>0.89 similarity</small>
          </div>
        </div>
        <div className="mock-result-pill">
          <span className="mock-result-emoji">🔗</span>
          <div className="mock-result-info">
            <strong>Search Architecture Notes</strong>
            <small>0.85 similarity</small>
          </div>
        </div>
      </div>
    </div>
  );
}
