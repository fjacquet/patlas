# Self-hosting patlas

patlas is a 100% client-side static site. Hosting it yourself — on a container
host or a Kubernetes cluster — is the strongest answer to the data-confidentiality
question: the app runs on **your** origin, and the same guarantees still hold
(CSP `connect-src 'self'`, the runtime fetch guard, and no dataset persistence).
Nothing the user drops in the browser ever leaves their device.

The published image is `ghcr.io/fjacquet/patlas`.

## Docker / Podman

```bash
# Build (context is the repo root; serves at the host root via VITE_BASE=/)
docker build -f deploy/Dockerfile -t patlas .

# Run — open http://localhost:8080
docker run --rm -p 8080:8080 patlas
```

Or pull the published image instead of building:

```bash
docker run --rm -p 8080:8080 ghcr.io/fjacquet/patlas:latest
```

The container runs nginx as a **non-root** user (uid 101) on port **8080**.

### Serving under a subpath

The default build serves at the host root (`/`). To serve under a subpath
behind a reverse proxy (e.g. `https://intranet/patlas/`), build with a matching
`VITE_BASE`:

```bash
docker build -f deploy/Dockerfile --build-arg VITE_BASE=/patlas/ -t patlas .
```

## Kubernetes (Helm)

The chart lives in [`deploy/helm/patlas`](helm/patlas).

```bash
# From a clone of the repo
helm install patlas deploy/helm/patlas

# Try it without an Ingress
kubectl port-forward svc/patlas 8080:80
# → http://127.0.0.1:8080
```

With an Ingress + TLS:

```bash
helm install patlas deploy/helm/patlas \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set 'ingress.hosts[0].host=patlas.example.com' \
  --set 'ingress.hosts[0].paths[0].path=/' \
  --set 'ingress.hosts[0].paths[0].pathType=Prefix'
```

Pin a specific image tag (defaults to the chart's `appVersion`):

```bash
helm install patlas deploy/helm/patlas --set image.tag=2.2.2
```

### Chart defaults

The chart is hardened and stateless out of the box:

| Setting | Default | Notes |
| --- | --- | --- |
| `replicaCount` | `2` | Stateless; scale freely or enable `autoscaling`. |
| `service.type` / `service.port` | `ClusterIP` / `80` | Container always listens on `8080`. |
| `ingress.enabled` | `false` | Set hosts/TLS under `ingress.*`. |
| `podSecurityContext` | `runAsNonRoot`, uid/gid 101, `RuntimeDefault` seccomp | — |
| `securityContext` | `readOnlyRootFilesystem`, drop ALL caps, no privilege escalation | nginx's writable paths are `emptyDir` volumes. |
| `serviceAccount.automount` | `false` | A static site needs no Kubernetes API access. |

Run the bundled smoke test after install:

```bash
helm test patlas
```

## Air-gapped / disconnected use

patlas works fully offline once loaded (it is an installable PWA with a
precache-only service worker). For a disconnected environment:

1. Pull/transfer the image to your internal registry, or `docker save`/`load`.
2. Deploy with the chart pointing `image.repository` at your registry.
3. Users load the site once; from then on it works with no network — they can
   verify this by disconnecting and watching the header badge switch to
   "Offline" while everything keeps working.

## Publishing the image (maintainers)

`.github/workflows/container.yml` builds and pushes a multi-arch
(`linux/amd64,linux/arm64`) image to GHCR on tagged releases (`v*`) and on
`workflow_dispatch`. Tags are derived from the release version
(`{{version}}`, `{{major}}.{{minor}}`, and `latest` on the default branch).
