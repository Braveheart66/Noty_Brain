export function MockCaptureUI() {
  return (
    <div className="mock-ui mock-capture">
      {/* Title bar */}
      <div className="mock-titlebar">
        <span className="mock-emoji">📝</span>
        <span className="mock-title-text">Meeting Notes — Q4 Strategy</span>
        <div className="mock-dots">
          <span /><span /><span />
        </div>
      </div>
      {/* Content blocks */}
      <div className="mock-blocks">
        <div className="mock-block mock-h2">
          <span className="mock-block-handle">⋮⋮</span>
          Key Decisions
        </div>
        <div className="mock-block">
          <span className="mock-block-handle">⋮⋮</span>
          Expand the knowledge graph to support cross-team collaboration and shared context retrieval.
        </div>
        <div className="mock-block mock-bullet">
          <span className="mock-block-handle">⋮⋮</span>
          <span className="mock-bullet-dot" />
          Prioritize semantic search accuracy over recall
        </div>
        <div className="mock-block mock-bullet">
          <span className="mock-block-handle">⋮⋮</span>
          <span className="mock-bullet-dot" />
          Ship the new graph view by end of sprint
        </div>
        <div className="mock-block mock-code">
          <code>{"// TODO: integrate OpenAI embeddings API"}</code>
        </div>
        <div className="mock-slash-hint">
          <span className="mock-slash-icon">/</span>
          Type <kbd>/</kbd> for commands…
        </div>
      </div>
    </div>
  );
}
