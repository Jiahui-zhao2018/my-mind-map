import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "./App";
import { storageKey, sample, serialize } from "./model";
describe("application interactions", () => {
  it("starts read-only, toggles editing, creates and edits an idea", async () => {
    render(<App />);
    expect(
      screen.queryByRole("button", { name: /Duplicate/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: /Rectangle/ }));
    const title = screen.getByLabelText("Title");
    fireEvent.change(title, { target: { value: "A new project" } });
    fireEvent.change(screen.getByLabelText("Details"), {
      target: { value: "First line\nSecond line" },
    });
    expect(screen.getByDisplayValue("A new project")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Delete" });
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(storageKey)!);
      expect(saved.nodes).toHaveLength(5);
      expect(saved.nodes.at(-1).data.details).toBe("First line\nSecond line");
    });
  });
  it("opens full click details, closes with Escape, and keeps graph read-only", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Your next big idea"));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Explore possibilities, connect ideas",
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector(".react-flow__handle")).toHaveStyle({
      opacity: "0",
      pointerEvents: "none",
    });
  });
  it("shows delayed hover preview and dismisses it on leave", async () => {
    render(<App />);
    const node = screen
      .getByText("Your next big idea")
      .closest(".react-flow__node")!;
    fireEvent.mouseEnter(node, { clientX: 100, clientY: 100 });
    await waitFor(() =>
      expect(screen.getByRole("tooltip")).toBeInTheDocument(),
    );
    fireEvent.mouseLeave(node);
    await waitFor(() =>
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
    );
  });
  it("restores a saved document and supports undo/redo buttons and input-safe shortcuts", () => {
    const d = sample();
    d.nodes[0].data.title = "Restored";
    localStorage.setItem(storageKey, serialize(d));
    render(<App />);
    expect(screen.getByText("Restored")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: /Ellipse/ }));
    expect(screen.getByDisplayValue("New idea")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Delete" });
    expect(screen.getByDisplayValue("New idea")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    expect(screen.queryByText("New idea")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Redo/ }));
    expect(screen.getByText("New idea")).toBeInTheDocument();
  });
  it("rejects invalid import with feedback", async () => {
    render(<App />);
    const f = new File(["bad"], "bad.json", { type: "application/json" });
    Object.defineProperty(f, "text", { value: async () => "bad" });
    fireEvent.change(screen.getByLabelText("Import document"), {
      target: { files: [f] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "not valid JSON",
    );
  });
  it("confirms valid import and restores its content", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);
    const d = sample();
    d.nodes[0].data.title = "Imported idea";
    const f = new File([serialize(d)], "map.json");
    Object.defineProperty(f, "text", { value: async () => serialize(d) });
    await act(async () =>
      fireEvent.change(screen.getByLabelText("Import document"), {
        target: { files: [f] },
      }),
    );
    expect(await screen.findByText("Imported idea")).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalled();
  });
});
