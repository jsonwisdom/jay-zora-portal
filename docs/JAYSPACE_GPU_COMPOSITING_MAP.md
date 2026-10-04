# JaySpace GPU Compositing Map

Purpose: keep the observatory readable on mobile Safari by forcing stable compositing planes.

## Layer Stack

| Layer | Selector | z-index | Role | GPU Rule |
|---:|---|---:|---|---|
| 0 | `.observatory` | base | world background | static root context |
| 1 | `.stars` | fixed | distant stars | isolated transform plane |
| 2 | `.nebula` | fixed | slow glow field | isolated transform plane, blur allowed |
| 3 | `.dust` | fixed | grid / dust field | isolated transform plane |
| 4 | `.vignette` | fixed | depth falloff | isolated overlay, no interactive events |
| 5 | `.forest-stage` | 5 | camera interaction surface | contained interaction plane |
| 6 | `.flow-svg` | 2 within camera | live and ghost receipt paths | isolated SVG plane, fill disabled |
| 7 | `.trunk`, `.witness-ring`, `.root-node` | 3 | root authority + witness perimeter | independent transform planes |
| 8 | `.grove-node` | 4 | clickable proof groves | isolated card plane |
| 9 | `.hud`, `.leaf-inspector` | 20+ | human-readable controls | glass UI plane |

## Hard Rules

1. SVG paths must declare `fill="none"` in markup and CSS.
2. Animated SVG layers must use `isolation: isolate`.
3. Do not put `filter: blur()` on a parent containing both live paths and ghost paths.
4. Large layers should not use `mix-blend-mode` except static vignette/future small diff highlights.
5. Future heatmaps and fork timelines should use canvas snapshots instead of many blurred SVG paths.

## Current Status

- Spatial truth: active.
- Temporal truth: active.
- Replay ghosts: active.
- Safari SVG fill guard: active.
- Next layer: constitutional memory with fork timelines and diff archaeology.
