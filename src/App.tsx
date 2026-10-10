import { EditContext, MindMapNode } from "./MindMapNode";
import { DetailPopover, type Popover } from "./DetailPopover";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  ConnectionMode,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type Connection,
  type Edge,
} from "@xyflow/react";
import {
  newNode,
  shapes,
  connect,
  remove,
  commit,
  undo,
  redo,
  load,
  serialize,
  parseDocument,
  storageKey,
  type MapNode,
  type Shape,
  type Document,
  type History,
} from "./model";
const nodeTypes = { mindmap: MindMapNode };
function Editor() {
  const [initial] = useState(load);
  const [history, setHistory] = useState<History>({
    past: [],
    present: initial.doc,
    future: [],
  });
  const doc = history.present;
  const [nodes, setNodes] = useState(doc.nodes);
  const [edges, setEdges] = useState(doc.edges);
  const [edit, setEdit] = useState(false);
  const [selection, setSelection] = useState<{ node?: string; edge?: string }>(
    {},
  );
  const [popover, setPopover] = useState<Popover | null>(null);
  const [message, setMessage] = useState(initial.error ?? "");
  const [status, setStatus] = useState("Saved locally");
  const [dirty, setDirty] = useState(false);
  const [viewport, setViewport] = useState(doc.viewport);
  const [titleDraft, setTitleDraft] = useState("");
  const flow = useReactFlow<MapNode>();
  const file = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const importing = useRef(false);
  const dragging = useRef(false);
  const cancelTimers = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (hide.current) clearTimeout(hide.current);
  }, []);
  const close = useCallback(() => {
    cancelTimers();
    setPopover(null);
    lastTrigger.current?.focus();
  }, [cancelTimers]);
  const update = useCallback((next: Document) => {
    setHistory((h) => commit(h, next));
    setDirty(true);
    setStatus("Saving…");
  }, []);
  useEffect(() => {
    setNodes((previous) =>
      doc.nodes.map((n) => ({
        ...n,
        measured: previous.find((p) => p.id === n.id)?.measured,
      })),
    );
    setEdges(doc.edges);
  }, [doc]);
  const selected = nodes.find((n) => n.id === selection.node);
  useEffect(
    () => setTitleDraft(selected?.data.title ?? ""),
    [selected?.id, selected?.data.title],
  );
  useEffect(() => {
    if (!dirty) return;
    setStatus("Saving…");
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, serialize({ ...doc, viewport }));
        setStatus("Saved locally");
      } catch {
        setStatus("Save failed");
        setMessage(
          "Local storage is unavailable or full. Export JSON to keep your work.",
        );
      }
    }, 500);
    return () => clearTimeout(t);
  }, [doc, viewport, dirty]);
  useEffect(() => () => cancelTimers(), [cancelTimers]);
  const deleteSelected = useCallback(() => {
    if (!edit) return;
    update(
      remove(
        doc,
        nodes
          .filter((n) => n.selected || n.id === selection.node)
          .map((n) => n.id),
        edges
          .filter((e) => e.selected || e.id === selection.edge)
          .map((e) => e.id),
      ),
    );
    setSelection({});
  }, [edit, doc, nodes, edges, selection, update]);
  const travel = useCallback(
    (direction: "undo" | "redo") => {
      if (!edit) return;
      setHistory((h) => (direction === "undo" ? undo(h) : redo(h)));
      setDirty(true);
      setSelection({});
    },
    [edit],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        setSelection({});
        setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
        setEdges((es) => es.map((x) => ({ ...x, selected: false })));
        return;
      }
      if (
        e.target instanceof Element &&
        e.target.closest('input,textarea,select,[contenteditable="true"]')
      )
        return;
      if (!edit) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        travel(e.shiftKey ? "redo" : "undo");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [edit, deleteSelected, travel, close]);
  useEffect(() => {
    if (!popover?.pinned) return;
    const outside = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(".detail-popover")) close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [popover?.pinned, close]);
  const mutateNode = (data: Partial<MapNode["data"]>) => {
    if (selected && edit)
      update({
        ...doc,
        nodes: doc.nodes.map((n) =>
          n.id === selected.id ? { ...n, data: { ...n.data, ...data } } : n,
        ),
      });
  };
  const add = (shape: Shape) => {
    if (!edit) return;
    const rect = document.querySelector(".react-flow")?.getBoundingClientRect();
    const position = flow.screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 800) / 2 - 100,
      y: (rect?.top ?? 0) + (rect?.height ?? 500) / 2 - 60,
    });
    const node = newNode(shape, position);
    update({ ...doc, nodes: [...doc.nodes, node] });
    setSelection({ node: node.id });
  };
  const duplicate = () => {
    if (!selected || !edit) return;
    const n = {
      ...selected,
      id: crypto.randomUUID(),
      selected: false,
      position: { x: selected.position.x + 40, y: selected.position.y + 40 },
      data: { ...selected.data },
    };
    update({ ...doc, nodes: [...doc.nodes, n] });
    setSelection({ node: n.id });
  };
  const valid = (c: Connection | Edge) =>
    c.source !== c.target &&
    !doc.edges.some(
      (e) =>
        e.id !== ("id" in c ? c.id : undefined) &&
        e.source === c.source &&
        e.target === c.target,
    );
  const open = (
    node: MapNode,
    event: {
      clientX: number;
      clientY: number;
      currentTarget: EventTarget | null;
    },
    pinned: boolean,
  ) => {
    if (edit || !node.data.details) return;
    cancelTimers();
    if (!pinned && popover?.pinned) return;
    const anchor =
      event.currentTarget instanceof Element
        ? event.currentTarget.getBoundingClientRect()
        : null;
    const value = {
      node,
      x: anchor
        ? anchor.right + 332 < window.innerWidth
          ? anchor.right + 12
          : Math.max(12, anchor.left - 332)
        : event.clientX + 16,
      y: anchor?.top ?? event.clientY + 16,
      pinned,
    };
    if (pinned) {
      lastTrigger.current = event.currentTarget as HTMLElement;
      setPopover(value);
    } else timer.current = setTimeout(() => setPopover(value), 350);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    hide.current = setTimeout(
      () => setPopover((p) => (p?.pinned ? p : null)),
      180,
    );
  };
  const importFile = async (f: File) => {
    if (importing.current) return;
    importing.current = true;
    try {
      if (f.size > 5_000_000)
        throw new Error("File is too large (maximum 5 MB).");
      const next = parseDocument(await f.text());
      if (
        !window.confirm(
          "Replace the current diagram with this imported document?",
        )
      )
        return;
      update(next);
      setViewport(next.viewport);
      await flow.setViewport(next.viewport);
      setSelection({});
      close();
      setMessage("Diagram imported successfully.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed.");
    } finally {
      importing.current = false;
      if (file.current) file.current.value = "";
    }
  };
  const exportFile = () => {
    const url = URL.createObjectURL(
      new Blob([serialize({ ...doc, viewport })], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "mindspace.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <EditContext.Provider value={edit}>
      <div className="app">
        <header className="toolbar">
          <div className="brand">
            <span className="brand-mark">✣</span>
            <div>
              <h1>Mindspace</h1>
              <small>A little room for big ideas</small>
            </div>
          </div>
          <div className="mode-switch" aria-label="Diagram mode">
            <button
              aria-pressed={!edit}
              onClick={() => {
                setEdit(false);
                setSelection({});
                close();
              }}
            >
              View
            </button>
            <button
              aria-pressed={edit}
              onClick={() => {
                setEdit(true);
                close();
              }}
            >
              Edit
            </button>
          </div>
          <span className="save-status" role="status">
            {status === "Saved locally" ? "● " : ""}
            {status}
          </span>
          <div className="file-actions">
            <button onClick={() => file.current?.click()}>Import JSON</button>
            <button onClick={exportFile}>Export JSON ↗</button>
            <button
              onClick={() => flow.fitView({ padding: 0.2, duration: 250 })}
            >
              Fit to view
            </button>
          </div>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            aria-label="Import document"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
            }}
          />
        </header>
        {edit && (
          <nav className="edit-toolbar" aria-label="Editing tools">
            <span>Add an idea</span>
            {shapes.map((s) => (
              <button key={s} onClick={() => add(s)}>
                {s === "rectangle"
                  ? "▭"
                  : s === "rounded"
                    ? "▢"
                    : s === "ellipse"
                      ? "◯"
                      : "◇"}{" "}
                <span>
                  {s === "rounded"
                    ? "Rounded"
                    : s[0].toUpperCase() + s.slice(1)}
                </span>
              </button>
            ))}
            <div className="separator" />
            <button disabled={!selection.node} onClick={duplicate}>
              Duplicate
            </button>
            <button
              disabled={!selection.node && !selection.edge}
              onClick={deleteSelected}
            >
              Delete
            </button>
            <div className="spacer" />
            <button
              disabled={!history.past.length}
              onClick={() => travel("undo")}
            >
              ↶ Undo
            </button>
            <button
              disabled={!history.future.length}
              onClick={() => travel("redo")}
            >
              ↷ Redo
            </button>
          </nav>
        )}
        {message && (
          <div className="notice" role="alert">
            {message}
            <button aria-label="Dismiss message" onClick={() => setMessage("")}>
              ×
            </button>
          </div>
        )}
        <main>
          <div className="canvas">
            <div className="canvas-caption">
              <span>
                {edit ? "YOUR IDEAS, CONNECTED" : "EXPLORE YOUR IDEAS"}
              </span>
              <p>
                {edit
                  ? "Create freely. Connect what matters."
                  : "Hover for a glimpse. Click to go deeper."}
              </p>
            </div>
            <ReactFlow<MapNode>
              nodes={nodes.map((n) => ({
                ...n,
                selected: edit && (n.selected || n.id === selection.node),
              }))}
              edges={edges.map((e) => ({
                ...e,
                selected: edit && (e.selected || e.id === selection.edge),
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 22,
                  height: 22,
                  color: "#8391a8",
                },
                style: { stroke: "#8391a8", strokeWidth: 2 },
              }))}
              nodeTypes={nodeTypes}
              defaultViewport={initial.doc.viewport}
              minZoom={0.1}
              maxZoom={4}
              connectionMode={ConnectionMode.Loose}
              nodesDraggable={edit}
              nodesConnectable={edit}
              edgesReconnectable={edit}
              elementsSelectable={edit}
              deleteKeyCode={null}
              isValidConnection={valid}
              onNodesChange={(changes) => {
                const allowed = edit
                  ? changes
                  : changes.filter((change) => change.type === "dimensions");
                const next = applyNodeChanges(allowed, nodes);
                setNodes(next);
                if (
                  edit &&
                  !dragging.current &&
                  changes.some((c) => c.type === "position" && !c.dragging)
                )
                  update({ ...doc, nodes: next });
              }}
              onEdgesChange={(changes) => {
                if (!edit) return;
                setEdges((es) => applyEdgeChanges(changes, es));
              }}
              onNodeDragStart={() => {
                dragging.current = true;
                close();
              }}
              onNodeDragStop={(_, node, moved) => {
                dragging.current = false;
                if (edit)
                  update({
                    ...doc,
                    nodes: doc.nodes.map((n) => {
                      const match =
                        moved.find((m) => m.id === n.id) ??
                        (n.id === node.id ? node : undefined);
                      return match ? { ...n, position: match.position } : n;
                    }),
                  });
              }}
              onConnect={(c) => {
                if (edit) update(connect(doc, c));
              }}
              onReconnect={(edge, c) => {
                if (edit) update(connect(doc, c, edge.id));
              }}
              onNodeClick={(event, node) => {
                if (edit) setSelection({ node: node.id });
                else open(node, event, true);
              }}
              onEdgeClick={(_, edge) => {
                if (edit) setSelection({ edge: edge.id });
              }}
              onPaneClick={() => {
                setSelection({});
                close();
              }}
              onNodeMouseEnter={(event, node) => {
                if (!dragging.current) open(node, event, false);
              }}
              onNodeMouseLeave={leave}
              onMoveEnd={(_, v) => {
                if (
                  v.x !== viewport.x ||
                  v.y !== viewport.y ||
                  v.zoom !== viewport.zoom
                ) {
                  setViewport(v);
                  setDirty(true);
                }
              }}
              onKeyDown={(e) => {
                if (!edit && (e.key === "Enter" || e.key === " ")) {
                  const id = (e.target as HTMLElement)
                    .closest("[data-id]")
                    ?.getAttribute("data-id");
                  const n = nodes.find((n) => n.id === id);
                  if (n) {
                    e.preventDefault();
                    const r = (e.target as HTMLElement).getBoundingClientRect();
                    open(
                      n,
                      {
                        clientX: r.right,
                        clientY: r.top,
                        currentTarget: e.target,
                      },
                      true,
                    );
                  }
                }
              }}
            >
              <Background gap={24} size={1} color="#d4dce8" />
              <Controls showInteractive={false} />
            </ReactFlow>
            <div className="canvas-footer">
              <span>
                {nodes.length} ideas <span className="dot">·</span>{" "}
                {edges.length} connections
              </span>
              <span>
                {edit
                  ? "Drag to arrange · Connect from any side"
                  : "Read-only view"}
              </span>
            </div>
          </div>
          {edit && (
            <aside className="properties">
              <div className="panel-label">IDEA PROPERTIES</div>
              {selected ? (
                <>
                  <h2>Make it yours</h2>
                  <label>
                    Title
                    <input
                      value={titleDraft}
                      maxLength={500}
                      aria-invalid={!titleDraft.trim()}
                      onChange={(e) => {
                        setTitleDraft(e.target.value);
                        if (e.target.value.trim())
                          mutateNode({ title: e.target.value });
                      }}
                      onBlur={() => {
                        if (!titleDraft.trim())
                          setTitleDraft(selected.data.title);
                      }}
                    />
                  </label>
                  {!titleDraft.trim() && (
                    <small role="alert">A title is required.</small>
                  )}
                  <label>
                    Details
                    <textarea
                      rows={8}
                      maxLength={100000}
                      value={selected.data.details}
                      onChange={(e) => mutateNode({ details: e.target.value })}
                      placeholder="Add context, thoughts, or next steps…"
                    />
                  </label>
                  <small>
                    Details appear when you inspect this idea in View mode.
                  </small>
                  <label>
                    Shape
                    <select
                      value={selected.data.shape}
                      onChange={(e) =>
                        mutateNode({ shape: e.target.value as Shape })
                      }
                    >
                      {shapes.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="colors">
                    <label>
                      Background
                      <input
                        type="color"
                        value={selected.data.backgroundColor}
                        onChange={(e) =>
                          mutateNode({ backgroundColor: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Border
                      <input
                        type="color"
                        value={selected.data.borderColor}
                        onChange={(e) =>
                          mutateNode({ borderColor: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <button className="danger" onClick={deleteSelected}>
                    Delete idea
                  </button>
                </>
              ) : selection.edge ? (
                <>
                  <h2>Connection</h2>
                  <p>Directed relationships help tell the story.</p>
                  <button className="danger" onClick={deleteSelected}>
                    Delete connection
                  </button>
                </>
              ) : (
                <div className="empty-panel">
                  <span>✧</span>
                  <h2>Every idea starts somewhere</h2>
                  <p>
                    Select an idea to edit its details, or add a new one from
                    the toolbar.
                  </p>
                  <small>Delete to remove · ⌘/Ctrl Z to undo</small>
                </div>
              )}
            </aside>
          )}
        </main>
        {popover && !edit && (
          <DetailPopover
            value={popover}
            onClose={close}
            onEnter={() => {
              if (hide.current) clearTimeout(hide.current);
            }}
            onLeave={leave}
          />
        )}
      </div>
    </EditContext.Provider>
  );
}
export default function App() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
