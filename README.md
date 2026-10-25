# DPCN study guides

Study notes for **Dynamical Processes of Complex Networks (SC1.440)** at IIIT Hyderabad, written as three pages to read in order. Every topic starts in plain words, symbols are explained where they first appear, and section M on page 1 covers the maths the course uses.

1. **Page 1, Quiz 1 guide** (classes 1 to 6, network basics): https://arihant25.github.io/dpcn-study-guide/quiz1/
2. **Page 2, Mid-sem guide** (mid-sem syllabus, with the 2026 paper and marking scheme): https://arihant25.github.io/dpcn-study-guide/
3. **Page 3, After mid-sem guide** (classes 13 to 18): https://arihant25.github.io/dpcn-study-guide/after-midsem/

There is also a **Memory sheet** with the whole course on one page, short derivations and flashcards: https://arihant25.github.io/dpcn-study-guide/remember/

Quiz 2 and the end-sem cover the whole course. Page 1 opens with a map of which page teaches each class and a ranked list of derivations to learn (`shared/course-map.html`).

## Mid-sem guide covers

- Power law P(k) = Ck^-γ: the constant C, ⟨k⟩, ⟨k²⟩, the critical exponents 2 and 3, and how k_min, ⟨k⟩ and γ are related
- Linear vs log binning and log-log plots
- Average path length and degree of the star, open chain, ring and ring with degree k
- Erdős–Rényi graphs: binomial to Poisson, the giant component S = 1 − e^(−⟨k⟩S), S ~ (⟨k⟩ − 1)^β with β = 1, ⟨l⟩ and ⟨C⟩ compared with real networks, k_nn and the friendship paradox
- Fixed points, the four 1-D bifurcations, bistability and hysteresis (spruce budworm)
- SIS and SIR, the graph Laplacian, diffusion and SI/SIS on a network
- The 2026 mid-sem with the TA marking scheme, and 2024 past-paper questions, with worked answers

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

The pages are generated. Edit the parts in `src/` (Mid-sem guide), `src-after/` (After mid-sem guide), `src-quiz1/` (Quiz 1 guide) or `src-remember/` (Memory sheet), in file-name order, then run:

```
npm install
node build.mjs
```

`build.mjs` joins each folder's parts, renders `\( … \)` and `\[ … \]` TeX to MathML with temml, draws the plots as static SVG that follow the light/dark theme, and writes self-contained `index.html`, `after-midsem/index.html`, `quiz1/index.html` and `remember/index.html`. `{{ROOT}}` in a part becomes the path back to the site root, and `<!--include:shared/…-->` pulls in a shared part. The page switcher in the sidebar and the phone menu comes from `shared/pages.html`, `shared/nav-style.html` and `shared/nav-script.html`. The folders each carry their own copy of the head (CSS) and foot (scripts). `snap.mjs` takes screenshots of the figures (needs Chrome) for checking.
