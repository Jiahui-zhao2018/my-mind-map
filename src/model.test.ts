import { describe, it, expect } from "vitest";
import {
  newNode,
  sample,
  connect,
  remove,
  commit,
  undo,
  redo,
  serialize,
  parseDocument,
  load,
  storageKey,
  type History,
} from "./model";
describe("document operations", () => {
  it("creates all supported shapes with independent IDs", () => {
    const nodes = ["rectangle", "rounded", "ellipse", "diamond"].map((s) =>
      newNode(s as "rectangle"),
    );
    expect(new Set(nodes.map((n) => n.id)).size).toBe(4);
    expect(nodes[2].data.shape).toBe("ellipse");
  });
  it("connects, rejects duplicate/self edges and reconnects", () => {
    const d = { ...sample(), edges: [] };
    const c = {
      source: "core",
      target: "plan",
      sourceHandle: "right",
      targetHandle: "left",
    };
    const next = connect(d, c);
    expect(next.edges).toHaveLength(1);
    expect(connect(next, c)).toBe(next);
    expect(connect(next, { ...c, target: "core" })).toBe(next);
    expect(
      connect(next, { ...c, target: "decide" }, next.edges[0].id).edges[0]
        .target,
    ).toBe("decide");
  });
  it("deletes connections independently and cascades node deletion", () => {
    const d = sample();
    expect(remove(d, [], [d.edges[0].id]).edges).toHaveLength(2);
    expect(remove(d, ["core"], []).edges).toHaveLength(0);
    expect(remove(d, ["core"], []).nodes).toHaveLength(3);
  });
  it("undoes and redoes adding, moving, editing, connecting and deleting", () => {
    let h: History = { past: [], present: sample(), future: [] };
    const n = newNode("ellipse");
    h = commit(h, { ...h.present, nodes: [...h.present.nodes, n] });
    h = commit(h, {
      ...h.present,
      nodes: h.present.nodes.map((x) =>
        x.id === n.id
          ? {
              ...x,
              position: { x: 123, y: 456 },
              data: { ...x.data, title: "Changed", details: "line 1\nline 2" },
            }
          : x,
      ),
    });
    expect(h.present.nodes.at(-1)?.position.x).toBe(123);
    expect(undo(h).present.nodes.at(-1)?.data.title).toBe("New idea");
    expect(redo(undo(h)).present).toEqual(h.present);
    h = commit(
      h,
      connect(h.present, {
        source: n.id,
        target: "core",
        sourceHandle: "bottom",
        targetHandle: "top",
      }),
    );
    h = commit(h, remove(h.present, [n.id], []));
    expect(undo(h).present.edges).toHaveLength(4);
    expect(redo(undo(h)).present.nodes).toHaveLength(4);
  });
  it("round trips JSON, excludes selection state and restores local storage", () => {
    const d = sample();
    d.nodes[0].selected = true;
    const text = serialize(d);
    expect(text).not.toContain("selected");
    expect(parseDocument(text)).toEqual(JSON.parse(text));
    localStorage.setItem(storageKey, text);
    expect(load().doc.nodes[0].data.details).toContain("\n");
  });
  it("recovers malformed storage without overwriting it", () => {
    localStorage.setItem(storageKey, "bad");
    expect(load().error).toBeTruthy();
    expect(localStorage.getItem(storageKey)).toBe("bad");
  });
  it.each([
    "no json",
    "{}",
    JSON.stringify({ ...sample(), schemaVersion: 2 }),
    JSON.stringify({
      ...sample(),
      edges: [{ id: "x", source: "missing", target: "core" }],
    }),
    JSON.stringify({
      ...sample(),
      nodes: [
        {
          ...sample().nodes[0],
          data: { ...sample().nodes[0].data, shape: "script" },
        },
      ],
    }),
    JSON.stringify({ ...sample(), viewport: { x: 0, y: 0, zoom: 0 } }),
  ])("rejects invalid document %s", (text) => {
    expect(() => parseDocument(text)).toThrow();
  });
});
