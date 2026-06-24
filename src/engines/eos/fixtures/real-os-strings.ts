// 50+ REAL distinct strings harvested 2026-05-17 from the three real RVTools
// fixtures + rvtools-sample.xlsx (vInfo "OS according to the configuration
// file" + "OS according to the VMware Tools"). Drives the <5%-unknown
// assertion (ROADMAP success criterion 5) and the RHEL-8 / Oracle-Linux
// variant tests (criterion 6). Verbatim from 07-RESEARCH.md §Code Examples.
export const REAL_OS_STRINGS = [
  // Windows Server (matchable → windows-server)
  'Microsoft Windows Server 2022 (64-bit)',
  'Microsoft Windows Server 2019 (64-bit)',
  'Microsoft Windows Server 2016 or later (64-bit)',
  'Microsoft Windows Server 2016 (64-bit)',
  'Microsoft Windows Server 2012 (64-bit)',
  'Microsoft Windows Server 2008 R2 (64-bit)',
  'Microsoft Windows Server 2025 (64-bit)',
  'Microsoft Windows 2000 Server',
  // Windows desktop (matchable → windows)
  'Microsoft Windows 10 (64-bit)',
  'Microsoft Windows 11 (64-bit)',
  'Microsoft Windows 7 (64-bit)',
  'Microsoft Windows 8 (64-bit)',
  'Microsoft Windows 2000',
  // RHEL — the FOUR variants the success criterion + Oracle-3 test target.
  'Red Hat Enterprise Linux 8 (64-bit)',
  'Red Hat Enterprise Linux 8.10',
  'RHEL 8 (64-bit)',
  'redhat enterprise linux 8',
  'Red Hat Enterprise Linux 7 (64-bit)',
  'Red Hat Enterprise Linux 9 (64-bit)',
  'Red Hat Enterprise Linux 6 (64-bit)',
  // Oracle Linux — the THREE variants the success criterion targets:
  'Oracle Linux 8',
  'Oracle Enterprise Linux 8',
  'Oracle Linux Server 8.10',
  // CentOS (incl. real multi-version forms → unknown per Pitfall 3)
  'CentOS 7 (64-bit)',
  'CentOS 8 (64-bit)',
  'CentOS 4/5 (64-bit)',
  'CentOS 4/5/6/7 (64-bit)',
  'CentOS 4/5/6 (64-bit)',
  'CentOS 6 (64-bit)',
  // Debian / SUSE / Ubuntu (Debian+SLES matchable; Ubuntu versionless → unknown)
  'Debian GNU/Linux 10 (64-bit)',
  'Debian GNU/Linux 12 (64-bit)',
  'Debian GNU/Linux 6 (64-bit)',
  'Debian GNU/Linux 11 (64-bit)',
  'Debian GNU/Linux 7 (64-bit)',
  'Debian GNU/Linux 8 (64-bit)',
  'Debian GNU/Linux 9 (64-bit)',
  'Debian GNU/Linux 5 (64-bit)',
  'SUSE Linux Enterprise 11 (64-bit)',
  'SUSE Linux Enterprise 12 (64-bit)',
  'SUSE Linux Enterprise 15 (64-bit)',
  'SUSE openSUSE (64-bit)',
  'Ubuntu Linux (64-bit)',
  // Legitimately UNKNOWN long tail (must reconcile into the unknown bucket, D-10):
  'Other (64-bit)',
  'Other (32-bit)',
  'Other Linux (64-bit)',
  'Other 3.x or later Linux (64-bit)',
  'Other 2.6.x Linux (64-bit)',
  'Other 3.x Linux (64-bit)',
  'Other 4.x or later Linux (64-bit)',
  'Other 4.x Linux (64-bit)',
  'Other 5.x Linux (64-bit)',
  'VMware Photon OS (64-bit)',
  'VMware ESXi 6.5 or later',
  'VMware ESXi 6.x',
  'VMware ESXi 8.0 or later',
  'FreeBSD (32-bit)',
  'FreeBSD Pre-11 versions (32-bit)',
  'Rocky Linux (64-bit)',
  'AlmaLinux (64-bit)',
  'FortiManager-VM64 v7.4.6-build2588 241218 (GA.M)',
  'FortiAnalyzer-VM64 v7.4.8-build2744 250926 (GA.M)',
] as const

// Proxmox guest OS strings exercised by normalizeOs.test.ts.
// Provenance note: only TWO entries are genuinely harvested from a real fixture
// (src/engines/parser/adapters/proxmox.test.ts — marked below); the remaining
// entries are representative Proxmox QEMU/LXC forms derived from the adapter
// code path and Proxmox community template naming conventions (not harvested).
// Proxmox QEMU: adapter joins Os Name + Os Version with a space → "Debian 12", etc.
// Proxmox LXC:  adapter uses Os Version alone → LXC template name, e.g. "debian-12-standard"
export const PROXMOX_OS_STRINGS = [
  // QEMU guests: bare "OsName OsVersion" forms (Proxmox adapter joins the two columns)
  'Debian 12', // real fixture (proxmox.test.ts)
  'Debian 11',
  'Ubuntu 22.04',
  'Ubuntu 24.04',
  'Ubuntu 20.04',
  'Rocky Linux 9',
  'AlmaLinux 9',
  'CentOS 7',
  // LXC containers: Os Version = Proxmox LXC template name
  'debian-12-standard',
  'debian-11-standard',
  'ubuntu-22.04-standard',
  'ubuntu-24.04-standard',
  'ubuntu-20.04-standard',
  'rockylinux-9-default',
  'almalinux-9-default',
  'centos-7-default',
  // LXC alpine template — legitimately unknown (alpine not in catalogue)
  'alpine 3.19', // real fixture (proxmox.test.ts)
] as const

// ESX Version strings (vHost "ESX Version") — all four real fixtures are 8.0.3:
export const REAL_ESX_VERSIONS = [
  'VMware ESXi 8.0.3 build-24674464',
  'VMware ESXi 8.0.3 build-24859861',
  'VMware ESXi 8.0.3 build-24784735',
  'VMware ESXi 8.0.3 build-24585383',
] as const
