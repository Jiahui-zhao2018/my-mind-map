import type { Node, Edge, Viewport, Connection } from "@xyflow/react";
export const shapes = ["rectangle", "rounded", "ellipse", "diamond"] as const;
export type Shape = (typeof shapes)[number];
export type NodeData = {
  title: string;
  details: string;
  shape: Shape;
  backgroundColor: string;
  borderColor: string;
};
export type MapNode = Node<NodeData, "mindmap">;
export type Document = {
  schemaVersion: 1;
  nodes: MapNode[];
  edges: Edge[];
  viewport: Viewport;
};
export const storageKey = "mindspace.document.v1";
export function newNode(shape: Shape, position = { x: 0, y: 0 }): MapNode {
  return {
    id: crypto.randomUUID(),
    type: "mindmap",
    position,
    data: {
      title: "New idea",
      details: "",
      shape,
      backgroundColor: "#ffffff",
      borderColor: "#8b96aa",
    },
  };
}
export function clean(doc: Document): Document {
  return {
    ...doc,
    nodes: doc.nodes.map(({ id, type, position, data }) => ({
      id,
      type,
      position,
      data,
    })),
    edges: doc.edges.map(
      ({ id, source, target, sourceHandle, targetHandle, type }) => ({
        id,
        source,
        target,
        sourceHandle,
        targetHandle,
        type,
      }),
    ),
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e7;
const color = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
export function parseDocument(text: string): Document {
  if (text.length > 5_000_000)
    throw new Error("File is too large (maximum 5 MB).");
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  if (
    !object(v) ||
    v.schemaVersion !== 1 ||
    !Array.isArray(v.nodes) ||
    !Array.isArray(v.edges) ||
    !object(v.viewport)
  )
    throw new Error("Unsupported or invalid MindMap document.");
  if (v.nodes.length > 2000 || v.edges.length > 10000)
    throw new Error("Diagram exceeds the supported size.");
  const ids = new Set<string>();
  const nodes: MapNode[] = v.nodes.map((n) => {
    if (
      !object(n) ||
      typeof n.id !== "string" ||
      !n.id ||
      ids.has(n.id) ||
      n.type !== "mindmap" ||
      !object(n.position) ||
      !finite(n.position.x) ||
      !finite(n.position.y) ||
      !object(n.data)
    )
      throw new Error("Invalid node or duplicate node ID.");
    const d = n.data;
    if (
      typeof d.title !== "string" ||
      !d.title.trim() ||
      d.title.length > 500 ||
      typeof d.details !== "string" ||
      d.details.length > 100000 ||
      !shapes.includes(d.shape as Shape) ||
      !color(d.backgroundColor) ||
      !color(d.borderColor)
    )
      throw new Error("Invalid node title, shape, details, or colors.");
    ids.add(n.id);
    return {
      id: n.id,
      type: "mindmap",
      position: { x: n.position.x, y: n.position.y },
      data: {
        title: d.title,
        details: d.details,
        shape: d.shape as Shape,
        backgroundColor: d.backgroundColor,
        borderColor: d.borderColor,
      },
    };
  });
  const edgeIds = new Set<string>(),
    pairs = new Set<string>();
  const edges: Edge[] = v.edges.map((e) => {
    if (
      !object(e) ||
      typeof e.id !== "string" ||
      !e.id ||
      edgeIds.has(e.id) ||
      typeof e.source !== "string" ||
      typeof e.target !== "string" ||
      !ids.has(e.source) ||
      !ids.has(e.target) ||
      e.source === e.target
    )
      throw new Error("Invalid connection reference or ID.");
    const pair = JSON.stringify([e.source, e.target]);
    if (pairs.has(pair)) throw new Error("Duplicate directed connection.");
    pairs.add(pair);
    edgeIds.add(e.id);
    for (const key of ["sourceHandle", "targetHandle"])
      if (
        e[key] != null &&
        !["top", "right", "bottom", "left"].includes(e[key] as string)
      )
        throw new Error("Invalid connection handle.");
    if (e.type != null && e.type !== "smoothstep" && e.type !== "default")
      throw new Error("Unsupported connection type.");
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle as string | null | undefined,
      targetHandle: e.targetHandle as string | null | undefined,
      type: "default",
    };
  });
  const p = v.viewport;
  if (
    !finite(p.x) ||
    !finite(p.y) ||
    !finite(p.zoom) ||
    p.zoom < 0.1 ||
    p.zoom > 4
  )
    throw new Error("Invalid viewport.");
  return {
    schemaVersion: 1,
    nodes,
    edges,
    viewport: { x: p.x, y: p.y, zoom: p.zoom },
  };
}
export function serialize(doc: Document) {
  return JSON.stringify(clean(doc), null, 2);
}
export function connect(
  doc: Document,
  c: Connection,
  exclude?: string,
): Document {
  if (
    !c.source ||
    !c.target ||
    c.source === c.target ||
    !doc.nodes.some((n) => n.id === c.source) ||
    !doc.nodes.some((n) => n.id === c.target) ||
    doc.edges.some(
      (e) => e.id !== exclude && e.source === c.source && e.target === c.target,
    )
  )
    return doc;
  return {
    ...doc,
    edges: [
      ...doc.edges.filter((e) => e.id !== exclude),
      { ...c, id: exclude ?? crypto.randomUUID(), type: "default" },
    ],
  };
}
export function remove(
  doc: Document,
  nodeIds: string[],
  edgeIds: string[],
): Document {
  return {
    ...doc,
    nodes: doc.nodes.filter((n) => !nodeIds.includes(n.id)),
    edges: doc.edges.filter(
      (e) =>
        !edgeIds.includes(e.id) &&
        !nodeIds.includes(e.source) &&
        !nodeIds.includes(e.target),
    ),
  };
}
export type History = {
  past: Document[];
  present: Document;
  future: Document[];
};
export function commit(h: History, doc: Document): History {
  if (serialize(doc) === serialize(h.present)) return h;
  return {
    past: [...h.past, h.present].slice(-100),
    present: clean(doc),
    future: [],
  };
}
export function undo(h: History): History {
  const p = h.past.at(-1);
  return p
    ? {
        past: h.past.slice(0, -1),
        present: p,
        future: [h.present, ...h.future],
      }
    : h;
}
export function redo(h: History): History {
  const f = h.future[0];
  return f
    ? { past: [...h.past, h.present], present: f, future: h.future.slice(1) }
    : h;
}
export function sample(): Document {
  const nodes: MapNode[] = [
    [
      "core",
      "Your next big idea",
      "rounded",
      320,
      180,
      "#ede9fe",
      "#9b87df",
      "Start with a question.\nExplore possibilities, connect ideas, and turn them into a plan.",
    ],
    [
      "explore",
      "Explore possibilities",
      "ellipse",
      20,
      40,
      "#e0f2fe",
      "#70add2",
      "Collect inspiration.\nWhat would you try if there were no constraints?",
    ],
    [
      "plan",
      "Make a plan",
      "rectangle",
      650,
      40,
      "#dcfce7",
      "#7dbb94",
      "Break your idea into achievable steps.",
    ],
    [
      "decide",
      "Choose a direction",
      "diamond",
      650,
      320,
      "#fff2d5",
      "#d5ad62",
      "Compare your options and decide what matters most.",
    ],
  ].map(([id, title, shape, x, y, bg, border, details]) => ({
    id: String(id),
    type: "mindmap",
    position: { x: Number(x), y: Number(y) },
    data: {
      title: String(title),
      shape: shape as Shape,
      details: String(details),
      backgroundColor: String(bg),
      borderColor: String(border),
    },
  }));
  return {
    schemaVersion: 1,
    nodes,
    edges: ["explore", "plan", "decide"].map((target) => ({
      id: `core-${target}`,
      source: "core",
      target,
      type: "default",
      sourceHandle: target === "explore" ? "left" : "right",
      targetHandle: target === "explore" ? "right" : "left",
    })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
export function load(): { doc: Document; error?: string } {
  try {
    const raw = localStorage.getItem(storageKey);
    return { doc: raw ? parseDocument(raw) : sample() };
  } catch {
    return {
      doc: sample(),
      error:
        "Saved data could not be restored. A sample is shown; your saved data remains untouched until you make a change.",
    };
  }
}
