# Design: E2E Interactive Workflow Diagrams

## 1. Goal
To build three distinct interactive HTML visualizations of the Full End-to-End (E2E) workflow for the Sukashawarma Outlet Suite. These visualizations will clearly map out the interactions between all 6 applications (Portal, Absensi, POS, Stok, Distribusi, Owner Dashboard).

## 2. The Three Approaches (Deliverables)

We will build three separate standalone HTML files:

### A. View 1: Swimlane Grid (`e2e_swimlane.html`)
- **Layout**: A pure HTML/CSS Grid where rows represent the Applications (Apps) and columns represent Time/Phases.
- **Visuals**: Pure HTML buttons connected by CSS-drawn lines/arrows.
- **Interactivity**: Clicking a node highlights the data path and updates a side panel with technical details, roles, and payloads.
- **Why**: Best for seeing how data jumps from one app to another over time.

### B. View 2: Giant Network Map (`e2e_network.html`)
- **Layout**: A massive, unconstrained canvas using Mermaid.js.
- **Visuals**: To prevent the truncation bug, every node will use the `htmlLabels: true` trick with an explicit `<div style="width:180px">` wrapper.
- **Interactivity**: Pan and zoom capability. Clicking nodes opens a side panel.
- **Why**: Best for seeing the entire system at a glance without being constrained by rows.

### C. View 3: Macro-to-Micro (`e2e_macro.html`)
- **Layout**: A pure HTML dashboard showing 6 large cards representing the 6 Apps, with thick animated data lines flowing between them.
- **Visuals**: High-level abstract view.
- **Interactivity**: Clicking an App card opens a full-screen Modal displaying the internal workflow of that specific app (reusing the logic from our previous per-app diagrams).
- **Why**: Best for high-level management who don't want to see all details at once, but want the ability to drill down.

## 3. Tech Stack
- **Styling**: Tailwind CSS (via CDN) for rapid UI development.
- **Interactivity**: Vanilla JavaScript.
- **Engine**: Pure HTML/CSS for Swimlane and Macro-to-Micro; Mermaid.js (with fixed-width HTML labels) for the Network Map.

## 4. Cross-App Integration Points to Highlight
All three diagrams MUST highlight these critical cross-app boundaries:
1. **Absensi -> POS**: "Checklist Buka" unlocks the POS Gate.
2. **POS -> Stok**: Sales deplete physical stock over time (Opname triggers).
3. **Stok -> Distribusi**: Alert Reorder Point triggers a Material Request.
4. **Distribusi -> Stok**: Verifikasi Penerimaan (Goods Receipt) adds items back to the Ledger.
5. **POS & Stok -> Dashboard**: Omzet and HPP calculation.

## 5. Implementation Phases
Since building 3 full interactive pages is substantial:
- **Phase 1**: Scaffold the 3 HTML files with Tailwind and JS base structures.
- **Phase 2**: Implement the Pure HTML Swimlane (View 1).
- **Phase 3**: Implement the Mermaid Network Map (View 2).
- **Phase 4**: Implement the Macro-to-Micro Modal interface (View 3).
