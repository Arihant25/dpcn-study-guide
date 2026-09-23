# DPCN Mid-sem Guide

A study guide for **Dynamical Processes of Complex Networks (SC1.440)** at IIIT Hyderabad, covering only the mid-sem syllabus. It assumes no background: every topic starts in plain words, symbols are explained where they first appear, and a short maths primer covers sums, integrals, e and ln, slopes, probability and eigenvectors.

**Live page:** https://arihant25.github.io/dpcn-study-guide/
**Quiz 1 guide** (the earlier, longer version): https://arihant25.github.io/dpcn-study-guide/quiz1/

## Covers

- Power law P(k) = Ck^-γ: the constant C, ⟨k⟩, ⟨k²⟩, the critical exponents 2 and 3, and how k_min, ⟨k⟩ and γ are related
- Linear vs log binning and log-log plots
- Average path length and degree of the star, open chain, ring and ring with degree k
- Erdős–Rényi graphs: binomial to Poisson, the giant component S = 1 − e^(−⟨k⟩S), S ~ (⟨k⟩ − 1)^β with β = 1, ⟨l⟩ and ⟨C⟩ compared with real networks, k_nn and the friendship paradox
- Fixed points, the four 1-D bifurcations, bistability and hysteresis (spruce budworm)
- SIS and SIR, the graph Laplacian, diffusion and SI/SIS on a network
- 2024 past-paper questions on this syllabus, with model answers

## Editing

The page is generated. Edit the parts in `src/` (in order `00-head.html` … `99-foot.html`), then run:

```
npm install
node build.mjs
```

`build.mjs` joins the parts, renders `\( … \)` and `\[ … \]` TeX to MathML with temml, draws the plots as static SVG that follow the light/dark theme, and writes the self-contained `index.html`. `snap.mjs` takes screenshots of the figures (needs Chrome) for checking.
