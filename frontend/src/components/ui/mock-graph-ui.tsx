import { motion } from "framer-motion";

const NODES = [
  { id: "a", cx: 120, cy: 80, r: 14, color: "#1f7a63", label: "Strategy" },
  { id: "b", cx: 260, cy: 60, r: 11, color: "#0f6ba8", label: "Research" },
  { id: "c", cx: 200, cy: 180, r: 16, color: "#2a8f86", label: "Graph Lab" },
  { id: "d", cx: 340, cy: 150, r: 12, color: "#a03f75", label: "Design" },
  { id: "e", cx: 80, cy: 200, r: 10, color: "#cb5a2f", label: "Roadmap" },
  { id: "f", cx: 310, cy: 250, r: 13, color: "#3653b8", label: "AI Search" },
];

const EDGES = [
  { from: "a", to: "b" },
  { from: "a", to: "c" },
  { from: "b", to: "d" },
  { from: "c", to: "e" },
  { from: "c", to: "f" },
];

function nodeById(id: string) {
  return NODES.find((n) => n.id === id)!;
}

export function MockGraphUI() {
  return (
    <div className="mock-ui mock-graph">
      <svg viewBox="0 0 420 310" className="mock-graph-svg">
        {/* Edges */}
        {EDGES.map((edge) => {
          const s = nodeById(edge.from);
          const t = nodeById(edge.to);
          return (
            <motion.line
              key={`${edge.from}-${edge.to}`}
              x1={s.cx}
              y1={s.cy}
              x2={t.cx}
              y2={t.cy}
              stroke="rgba(31,122,99,0.3)"
              strokeWidth={1.5}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.3 }}
            />
          );
        })}

        {/* Nodes */}
        {NODES.map((node, i) => (
          <g key={node.id}>
            {/* Pulse glow ring */}
            <motion.circle
              cx={node.cx}
              cy={node.cy}
              r={node.r + 4}
              fill="none"
              stroke={node.color}
              strokeWidth={1.5}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: [0.15, 0.45, 0.15],
                scale: [1, 1.25, 1],
              }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                delay: i * 0.4,
                ease: "easeInOut",
              }}
              style={{ transformOrigin: `${node.cx}px ${node.cy}px` }}
            />

            {/* Node circle */}
            <motion.circle
              cx={node.cx}
              cy={node.cy}
              r={node.r}
              fill={node.color}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: i * 0.12,
              }}
              style={{ transformOrigin: `${node.cx}px ${node.cy}px` }}
            />

            {/* Label */}
            <text
              x={node.cx}
              y={node.cy + node.r + 16}
              textAnchor="middle"
              fill="var(--ink-soft)"
              fontSize="11"
              fontFamily='"IBM Plex Mono", monospace'
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
