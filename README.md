# Mindspace — Personal MindMap

A browser-only, free-form diagram editor built with React, TypeScript, Vite, and React Flow. No account, server, API key, or backend is needed.

## Run

Use Node.js 22.12+ (Node 24 was verified).

```sh
npm ci --cache /tmp/mindspace-npm-cache
npm run dev
```

Run these commands in this repository. Vite listens on port 5173 by default. For a production build, run `npm run build`; deploy the generated `dist/` directory to a static host.

## Use

The application starts in **View** mode with four sample ideas. Pan, zoom, or fit the diagram with the canvas controls. Hover over an idea for a delayed preview; click it for complete, scrollable plain-text details. Press Escape, click outside, or use the close button to dismiss. Focus a node and press Enter or Space to inspect it with a keyboard. Ideas without details do not open a popover.

Switch to **Edit** to add rectangles, rounded rectangles, ellipses, and diamonds. Drag nodes freely. Select an idea to edit its title, multiline details, shape, and colors. Drag between the handles on any of the four sides to create directed connections. Drag an existing connection endpoint to reconnect it. Self-connections and duplicate directed pairs are rejected. Select an edge to delete it; deleting a node also deletes its connected edges. Duplicate a selected node from the toolbar.

- Delete / Backspace: delete selected elements.
- Ctrl/Cmd + Z: undo.
- Ctrl/Cmd + Shift + Z: redo.
- Escape: clear selection or close details.

Editing shortcuts do not intercept text inputs. View mode does not move or mutate graph elements. Changing modes preserves the viewport.

Changes save automatically to LocalStorage after a 500 ms debounce; node dragging commits at drag completion. Node data, connections, and the viewport persist. Save failures are surfaced in the toolbar. JSON export provides a portable backup. Import validates schema version, IDs, shapes, colors, handle names, coordinates, and edge references, then asks before replacing the diagram. Invalid saved data shows a warning and a sample, without overwriting the saved value until the next change.

## Verify

```sh
npm run typecheck
npm test
npm run build
```

For browser interaction tests:

```sh
npx playwright install chromium
npm run test:e2e
```

If Chromium is already installed, skip the download:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

The browser suite runs a temporary Vite server and exercises hover/click details, read-only behavior, dragging, handle connections, undo/redo, persistence, deletion, and JSON export/import. Stop any server already using port 5173 before running it.

## Code

- `src/App.tsx`: toolbar, canvas interactions, properties panel, modes, and history coordination.
- `src/MindMapNode.tsx`: SVG shapes and four-side connection handles.
- `src/DetailPopover.tsx`: constrained, accessible detail display.
- `src/model.ts`: typed document model, validation, persistence, serialization, graph mutations, and bounded history.
- `src/style.css`: responsive desktop layout and diagram styling.
- `src/*.test.*` and `e2e/`: automated unit, component, and browser tests.

## Limits and future work

Plain text only. Saving is per browser origin; no collaboration, cloud sync, or cross-tab conflict resolution. Export backups before clearing browser storage. Undo history is limited to 100 mutations, is session-only, and excludes viewport navigation. Titles are limited to 500 characters and visually bounded to keep shapes readable; hover the title to see the complete title. Imports are limited to 5 MB, 2,000 nodes, and 10,000 edges. Browser tests currently target Chromium; Firefox/Safari and touch-first layouts would be useful next steps. Larger diagrams could benefit from searchable ideas and grouped text-edit history.
