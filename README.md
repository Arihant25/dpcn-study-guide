# DPCN study guides

A study guide for **Dynamical Processes of Complex Networks (SC1.440)** at IIIT Hyderabad, covering only the mid-sem syllabus. It assumes no background: every topic starts in plain words, symbols are explained where they first appear, and a short maths primer covers sums, integrals, e and ln, slopes, probability and eigenvectors.

**Live page:** https://arihant25.github.io/dpcn-study-guide/
**After mid-sem guide** (classes 13 to 18): https://arihant25.github.io/dpcn-study-guide/after-midsem/
**Quiz 1 guide** (classes 1 to 6, rewritten in the same style): https://arihant25.github.io/dpcn-study-guide/quiz1/

Quiz 2 and the end-sem cover the whole course; every guide opens with the same whole-course map and list of derivations to learn (`shared/course-map.html`).

## Covers

- Power law P(k) = Ck^-γ: the constant C, ⟨k⟩, ⟨k²⟩, the critical exponents 2 and 3, and how k_min, ⟨k⟩ and γ are related
- Linear vs log binning and log-log plots
- Average path length and degree of the star, open chain, ring and ring with degree k
- Erdős–Rényi graphs: binomial to Poisson, the giant component S = 1 − e^(−⟨k⟩S), S ~ (⟨k⟩ − 1)^β with β = 1, ⟨l⟩ and ⟨C⟩ compared with real networks, k_nn and the friendship paradox
- Fixed points, the four 1-D bifurcations, bistability and hysteresis (spruce budworm)
- SIS and SIR, the graph Laplacian, diffusion and SI/SIS on a network
- 2024 past-paper questions on this syllabus, with model answers

## After mid-sem guide covers

- 2-D linear systems: eigen-solutions, trace–determinant classification, initial value problems, Romeo and Juliet
- Jacobian linearisation; rabbits vs sheep (competitive exclusion); Lotka–Volterra predator–prey
- Stability of dynamics on networks (αI + βL), population growth with migration
- Limit cycles, Stuart–Landau polar form, Hopf bifurcation, van der Pol, Poincaré–Bendixson, aging transition
- Euler/RK4, map stability and cobwebs, logistic map period doubling and chaos, Lorenz fixed points and Jacobians
- Two coupled phase oscillators, Kuramoto order parameter and critical coupling
- May's stability criterion and the elliptic law; double pendulum normal modes
- Every topic is built around a numbered derivation to learn, plus 2024 past-paper questions

## Editing

The pages are generated. Edit the parts in `src/` (Mid-sem guide), `src-after/` (After mid-sem guide) or `src-quiz1/` (Quiz 1 guide), in file-name order, then run:

```
npm install
node build.mjs
```

`build.mjs` joins each folder's parts, renders `\( … \)` and `\[ … \]` TeX to MathML with temml, draws the plots as static SVG that follow the light/dark theme, and writes self-contained `index.html`, `after-midsem/index.html` and `quiz1/index.html`. `{{ROOT}}` in a part becomes the path back to the site root, and `<!--include:shared/…-->` pulls in a shared part. The two folders each carry their own copy of the head (CSS) and foot (scripts). `snap.mjs` takes screenshots of the figures (needs Chrome) for checking.
