# Changelog

All notable changes to patlas are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [Semantic Versioning](https://semver.org/).

---

## [3.0.0] - 2026-06-27

**Proxmox Atlas v3** — patlas sheds the last of its inherited VMware DNA and becomes a Proxmox-native estate atlas: real RRD-derived metrics, three new value packs (performance/capacity, protection/risk, governance/ops), a Proxmox-correct network model, a self-host container, and full offline support.

### Added

- **RRD analytics (performance & capacity)** — per-node headroom (peak/avg/p95 CPU & memory, PSI memory pressure, IO-wait, load average, network throughput) and per-storage growth with projected days-to-full, parsed from the cv4pve RRD sheets. New `RrdHeadroomView` and `StorageGrowthView`. Single-snapshot trends now render from one export's RRD timestamps (no longer require multiple snapshots).
- **Protection & risk** — in-guest filesystem fill (Partitions sheet), disk hygiene (unused/orphaned disks, stray ISOs, risky cache modes), and backup coverage (vzdump task outcomes + per-disk backup flags). New `ProtectionView`.
- **Governance & ops** — cv4pve Issues panel, cluster access posture (users without 2FA, API tokens, root usage, ACL breadth), and resource pools. New `GovernanceView`.
- **Network topology tree** — a Proxmox-native bond/NIC → bridge → VLAN tree (deduplicated by per-node config, with VM counts and node spread), rendered across the web view, the HTML report, and the PPTX network slide; replaces the oversized upstream `network-diagram.svg` as the primary topology rendering (the upstream SVG remains as a collapsible secondary web section).
- **Storage by role** — datastores classified as VM data / backup / local-boot / other, reporting real datastore used vs capacity (from the Storages sheet, not the always-zero per-VM columns), surfaced in the Storage view, HTML report, and PPTX deck.
- **Self-hosting** — a multi-arch (amd64/arm64) nginx container image published to GHCR on each tagged release, a Helm chart, a configurable base path via `VITE_BASE`, and a self-hosting guide (Docker + Helm + air-gapped).
- **Offline support** — the PPTX rasterization wasm and font are precached for full offline export parity, plus an offline/privacy trust badge in the header.

### Changed

- **Network re-modelled to Proxmox-native** bridges/bonds/NICs/VLANs (from the Network sheet's stacked sections), replacing the inherited VMware vSwitch/dvSwitch/portgroup model.
- **Internal types renamed** to Proxmox-native names (`GuestRow`/`NodeRow`/`StorageRow`, `guests`/`nodes`/`storages`), de-VMware-ing the domain model; reference docs rewritten to cv4pve reality.

### Fixed

- **Node and guest CPU now derive from the cv4pve RRD Nodes sheet** (a 0–1 fraction), fixing the prior hardcoded 0% CPU everywhere; VM right-sizing gains real CPU utilization.
- **Estate/dashboard storage KPIs** are sourced from datastores rather than the uniformly-empty per-VM columns, fixing "In use 0" and implausible capacities.
- **PPTX rendition fixes** — FS-fill table capped to one slide with a remainder footer, backup-coverage tables rendered side-by-side, overview storage KPIs use VM-data datastore used/capacity, squashfs/iso9660/erofs excluded from FS-fill risk counts, and the blurry oversized network raster is no longer embedded.
- **Protection slide/report labels are localized** in all four locales (PPTX + HTML), instead of falling back to English.
- **VLAN-aware bridges count tagged VMs** in the topology tree (VLAN leaves derive from VM NIC tags, not only declared VLAN interfaces).
- **Security hardening** — service-worker message-handler origin guard, hardened worker `postMessage` handlers (CodeQL), and the resolved i18n bundle built via `Object.fromEntries` to avoid a prototype-pollution sink.

---

## [2.2.2] - 2026-06-24

### Fixed

- **PPTX export no longer fails when the report includes a network diagram.** v2.2.1 embedded the diagram as a raw SVG, which PowerPoint cannot render and which threw in the browser export worker — failing the whole PPTX export. The diagram is now rasterized to PNG via the same `@resvg/resvg-wasm` pipeline used for every deck chart, embedded with a bundled font so its text labels render. Rasterization is best-effort: any failure degrades to a factual note and never breaks the export.

### Added

- Bundled the OFL-licensed **NotoSans** font (loaded only at export time) so rasterized SVG text renders in the deck.

---

## [2.2.1] - 2026-06-24

### Fixed

- **PPTX Network slide** — now embeds the Proxmox `network-diagram.svg` (when the report was loaded as a `.zip` bundle) directly as a vector image, so the topology appears in the deck with crisp labels. Previously the slide was the inherited VMware one: for a Proxmox report it always rendered an empty note listing VMware sheet names (`vNetwork / vSwitch / dvSwitch / dvPort`). When no diagram is present it now shows a plain factual note.

### Changed

- Removed residual VMware terminology from PPTX and Network-view strings across all four locales (dropped the always-empty vSwitch/dvSwitch KPIs and `(vSwitch)`/`(dvSwitch)` parentheticals).
- Tightened the `terminology` test to forbid `vSwitch`, `dvSwitch`, `vNetwork`, `dvPort`, `vSphere`, `vSAN` so this jargon cannot regress.

---

## [2.2.0] - 2026-06-24

### Added

- **Three Proxmox-native metrics in the PPTX deck** — Snapshot Sprawl, Storage Content, and Cluster Health slides (KPI band + native tables), each emitted only when its data is non-empty.
- **Proxmox VE (node) End-of-Support** — node EOL is derived from the PVE version via a new `classifyPve`; the EOS catalogue gains a `proxmox-ve` product with EOL dates validated against endoflife.date. The EOS view's host section is relabeled "Node end-of-support" with the PVE version.
- **Network topology diagram** — the `network-diagram.svg` shipped in the Proxmox `.zip` bundle is now rendered in the Network view (via a sandboxed `<img>` data-URI, never raw HTML injection) and embedded in the exported HTML report.
- Wider guest-OS normalization for Proxmox/LXC strings (bare OS names and LXC template names), so more guests classify for EOS instead of "unknown".

### Changed

- Export filenames and the PPTX deck footer rebranded from "vatlas" to "patlas".
- EOS host bucket renamed `esxi → nodes` end-to-end; the VMware `esxi` classifier and catalogue entry removed.

### Notes

- The network diagram appears in the web app and the HTML report; it is deliberately excluded from the PPTX deck (rasterized SVG text would not render).
- DE/IT technical terminology still pending native review.

---

## [2.1.0] - 2026-06-24

### Added

- **Snapshot Sprawl view** — guest snapshots still held on the estate: count, guests-with-snapshots, total size, oldest snapshot age. Parses the report `Snapshots` sheet; excludes the Proxmox `current` live-state marker.
- **Storage Content view** — what occupies each storage pool, broken down by content type (images / rootdir / iso / vztmpl / backup …) and by storage, plus a backup-file inventory with per-guest recency. Parses the `Storage Content` sheet.
- **Cluster Health view** — HA status (quorum / fencing service state, HA-managed guest resources) and scheduled backup jobs. Parses the stacked composite `Cluster HA` / `Cluster` sheets via a shared `extractStackedSection` helper.
- Accept Proxmox report as a `.zip` bundle (was a bug — only `.xlsx` was accepted). The parser worker sniffs ZIP magic bytes and extracts `report.xlsx` from the bundle (`extractProxmoxBundle`); a bare `.xlsx` is parsed directly. Upload zone now accepts both `.zip` and `.xlsx`.
- Shared `extractStackedSection` helper for parsing stacked sub-table composite sheets.

### Changed

- All inherited analytics views relabeled to Proxmox terminology (cluster, node, guest, storage pool).
- DR / allocation-DR analysis removed (no Proxmox analog in scope).

### Notes

- The three Proxmox-native views (Snapshot Sprawl, Storage Content, Cluster Health) are web-only; deliberately excluded from the HTML report and PPTX deck.

---

## [2.0.x] - patlas fork foundation

### Changed

- Forked from [vatlas](https://github.com/fjacquet/vatlas) (VMware/RVTools sibling).
- Stripped VMware-specific language and RVTools input format.
- Remapped terminology to Proxmox at the UI and i18n layer: vCenter → cluster, ESXi host → node, VM → guest (QEMU VM or LXC container), datastore → storage pool.
- Unified QEMU VMs and LXC containers into a single guest inventory with a `guestType` flag (`qemu` | `lxc`).
- Added `fflate` for client-side zip extraction.
- i18n: four locales (EN, FR, DE, IT); DE/IT technical terminology pending native review.
