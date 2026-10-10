import { createContext, useContext } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { MapNode } from "./model";
export const EditContext = createContext(false);
export function MindMapNode({ data, selected }: NodeProps<MapNode>) {
  const edit = useContext(EditContext);
  return (
    <div
      className={`map-node ${data.shape} ${selected && edit ? "selected" : ""}`}
      style={{ color: "#243047" }}
    >
      <svg
        className="node-shape"
        viewBox="0 0 200 120"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {data.shape === "ellipse" ? (
          <ellipse
            cx="100"
            cy="60"
            rx="98"
            ry="58"
            fill={data.backgroundColor}
            stroke={data.borderColor}
          />
        ) : data.shape === "diamond" ? (
          <polygon
            points="100,2 198,60 100,118 2,60"
            fill={data.backgroundColor}
            stroke={data.borderColor}
          />
        ) : (
          <rect
            x="2"
            y="2"
            width="196"
            height="116"
            rx={data.shape === "rounded" ? 18 : 0}
            fill={data.backgroundColor}
            stroke={data.borderColor}
          />
        )}
      </svg>
      <span className="node-title" title={data.title}>
        {data.title}
      </span>
      {data.details && (
        <span className="detail-dot" aria-label="Has details">
          •
        </span>
      )}
      {(
        [
          ["top", Position.Top],
          ["right", Position.Right],
          ["bottom", Position.Bottom],
          ["left", Position.Left],
        ] as const
      ).map(([id, position]) => (
        <Handle
          key={id}
          id={id}
          type="source"
          position={position}
          isConnectable={edit}
          style={edit ? undefined : { opacity: 0, pointerEvents: "none" }}
        />
      ))}
    </div>
  );
}
