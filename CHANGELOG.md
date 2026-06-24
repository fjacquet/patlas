# Changelog

All notable changes to patlas are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [Semantic Versioning](https://semver.org/).

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
