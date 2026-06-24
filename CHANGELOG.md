# Changelog

All notable changes to patlas are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [Semantic Versioning](https://semver.org/).

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
