# Nodes to Bifurcations — DPCN Study Guide

A single-page, worked study guide for **Dynamical Processes of Complex Networks (SC1.440)** at IIIT Hyderabad.

**Live page:** https://arihant25.github.io/dpcn-study-guide/

It is built from the course slides (Modules 1, 2a, 2b, 2c1, 2c2, and the 1-D bifurcation note) and calibrated against every past paper — surprise quizzes, written quizzes, and the mid-sem. It teaches each topic from scratch, then drills the exact question types the course sets, with worked solutions.

## Covers

- **Structure** — adjacency matrix, degree & handshaking, mean degree & density, walks/trails/paths/cycles, Eulerian & Hamiltonian graphs, distance/diameter/BFS, clustering coefficient, the four centralities, special graphs & spanning trees
- **Dynamics** — fixed points & linear stability, Euler's method, the four 1-D bifurcations (with live-drawn diagrams), bistability & hysteresis (Spruce Budworm), SIS/SIR & predator–prey
- **Proofs he actually asks** — triangles = ⅙·tr(A³), handshaking, continuous & discrete-map stability, solving SIS

## Notes

- Single self-contained `index.html` — no build step, no dependencies. Fonts load from Google Fonts.
- Dark/light theme toggle; bifurcation diagrams are drawn in-browser and follow the course note's convention (**dashed = stable, solid = unstable**).
- Scope stops at the network-metrics + nonlinear-dynamics half. Later modules (in-depth Erdős–Rényi, scale-free/BA, Kuramoto, Lorenz, percolation) are Quiz-2 / mid-sem territory and can be added once those slides are in.
