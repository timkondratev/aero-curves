# Aero Curves

Aero Curves is a lightweight curve editor for games and simulations. Build, tweak, and visualize control-point curves with a fast, keyboard-friendly UI.

![Aero Curves screenshot](media/screenshot_1.png)

## Features

- Multi-plot workspace with per-plot domains
- Drag-select and multi-select points
- Grid display with adjustable snap step on X/Y
- Background image tracing with opacity, offset, and scale controls
- Transform tools: flip, mirror, duplicate, and trim selections
- Copy/paste points and normalize to the current domain

## Getting started

```bash
npm install
npm run dev
```

Build and preview the production bundle:

```bash
npm run build
npm run preview
```

## Usage

- Double-click the plot to add a point; double-click a point to remove it.
- Drag points to edit the curve; use Cmd/Ctrl/Shift to add or remove points from the selection.
- Drag on empty space to brush-select a range of points.
- Use the sidebar to edit domains, snapping, grid visibility, and selection coordinates.
- Use the Data panel to copy points as JSON or normalize the curve to the domain.
