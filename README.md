# Nodes to Bifurcations — DPCN Study Guide

A single-page, worked study guide for **Dynamical Processes of Complex Networks (SC1.440)** at IIIT Hyderabad.

**Live page:** https://arihant25.github.io/dpcn-study-guide/

It is built from the course slides (Modules 1, 2a, 2b, 2c1, 2c2, 2d, Module 3 path-length, the ER random-graph decks, and the 1-D bifurcation note) and calibrated against every past paper — surprise quizzes, written quizzes, and the mid-sem. It teaches each topic from scratch, then drills the exact question types the course sets, with worked solutions.

## Covers

- **Structure** — adjacency matrix, degree & handshaking, mean degree & density, walks/trails/paths/cycles, Eulerian & Hamiltonian graphs, distance/diameter/BFS, clustering coefficient, the four centralities, special graphs & spanning trees
- **Network models & distributions** — degree distributions & power laws (linear vs log binning, log-log slope, moment rules), path length of regular graphs (chain (n+1)/3, ring N/4, D-D lattice N^(1/D)), Erdős–Rényi random graphs (Poisson degrees, C = p, small-world ln N, the giant-component threshold ⟨k⟩ = 1, connectivity at ⟨k⟩ = ln N, the threshold ladder, friendship paradox)
- **Dynamics** — fixed points & linear stability, Euler's method, the four 1-D bifurcations (with live-drawn diagrams), bistability & hysteresis (Spruce Budworm), SIS/SIR & predator–prey
- **Proofs he actually asks** — triangles = ⅙·tr(A³), handshaking, continuous & discrete-map stability, solving SIS

## Notes

- Single self-contained `index.html` — no build step, no dependencies. Fonts load from Google Fonts.
- Dark/light theme toggle; bifurcation diagrams and the giant-component curve are drawn in-browser, and follow the course note's convention (**dashed = stable, solid = unstable**).
- Now covers through the mid-sem material (degree distributions, path length, Erdős–Rényi). Remaining topics (scale-free/BA in depth, Kuramoto, Lorenz, advanced percolation) are added as those lectures are taught.
