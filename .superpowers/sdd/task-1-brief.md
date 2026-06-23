### Task 1: Fork & rebrand patlas baseline

Create the patlas repo as a fork of vatlas, rebrand identifiers, and confirm the **unchanged** (still-VMware) app builds and tests pass. This is the safe baseline before any Proxmox change.

**Files:**
- Modify: `package.json` (name `vatlas`→`patlas`), `vite.config.ts` (base `/vatlas/`→`/patlas/`), `index.html` title, `src/store/*` + theme/lang hooks (`vatlas-theme`→`patlas-theme`, `vatlas-lang`→`patlas-lang`), `README.md`, `CLAUDE.md` project name.
- The supply-chain/bundle-size check scripts referencing the name.

- [ ] **Step 1: Create the fork**

```bash
# from a directory above the vatlas checkout
git clone /Users/fjacquet/Projects/vatlas patlas
cd patlas
git remote remove origin   # new repo gets its own origin later
git checkout -b main
```

- [ ] **Step 2: Rebrand identifiers**

Replace every `vatlas` token with `patlas` in the files listed above (storage keys, Vite `base`, package name, page title, docs headers). Leave engine internals (`cluster`/`host`/`vinfo`) untouched.

- [ ] **Step 3: Verify the baseline builds and tests pass (still VMware)**

Run:
```bash
npm install
npm run typecheck
npx @biomejs/biome check .
npm run test:run
```
Expected: typecheck clean, lint clean, all existing tests PASS. (We have changed nothing functional yet.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(patlas-01): fork vatlas, rebrand identifiers and storage keys"
```

---

