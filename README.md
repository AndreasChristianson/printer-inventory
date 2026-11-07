# printer-inventory

Public, read-only page showing the filament colors I have on hand, so people can pick one
for a print. Live at https://filament.pessimistic-it.com.

Data comes from the in-cluster [Spoolman](https://github.com/Donkie/Spoolman). The server
only ever issues `GET /api/v1/spool` upstream and exposes a grouped, one-row-per-filament
list at `/api/filaments`. It never proxies Spoolman's own API, which has writes and no
in-cluster auth.

## Shareable links

Every filter and sort is kept in the URL:

- `/?material=pla` shows PLA only (case-insensitive)
- `/?material=pla,pla%2B,petg` shows several materials
- `/?vendor=Polymaker&q=blue` filters by vendor plus search text
- `/?sort=remaining&dir=desc` sorts by most filament left (sort: `color`, `name`, `material`, `vendor`, `remaining`)

## Local dev

    SPOOLMAN_URL=http://<spoolman-host>:8000 npm start   # http://localhost:8080
    npm test

## Deploy

Pushes to `main` run test, build, and deploy: the image goes to ghcr, then the kustomize manifests
in `k8s-resources/` are applied to namespace `filament` using the `KUBE_CONFIG` repo secret.
The listener and its TLS cert are owned by the k8s-resources repo.
