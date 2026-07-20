Deployment checklist for DigitalOcean Droplet (2 vCPU / 4GB)

1) Prepare Droplet
   - Create droplet (Ubuntu 22.04) and enable backups.
   - Open firewall for ports 22, 80, 443, and your app port if needed (3000).

2) Install Docker & Docker Compose
   - curl -fsSL https://get.docker.com | sh
   - sudo usermod -aG docker $USER
   - sudo apt install -y docker-compose-plugin

3) Clone repo and configure
   - git clone ... && cd jaguares
   - cp .env.example .env  and fill values (use Managed MySQL/Spaces creds if available)

4) Run with docker-compose
   - docker compose -f docker-compose.prod.yml up -d --build
   - Verify containers: docker compose ps

5) Optional: Use systemd timer for purge (if not using purge container)
   - Copy scripts/systemd/jaguares-purge.service -> /etc/systemd/system/jaguares-purge.service
   - Copy scripts/systemd/jaguares-purge.timer -> /etc/systemd/system/jaguares-purge.timer
   - sudo systemctl daemon-reload
   - sudo systemctl enable --now jaguares-purge.timer

6) TLS and reverse proxy
   - Install Traefik or Nginx as reverse-proxy and configure Let's Encrypt.
   - Point domain to droplet IP and configure CORS_ORIGIN, TRUST_PROXY.

7) Monitoring & backups
   - Enable DigitalOcean Monitoring; configure backups for DB and droplet snapshots.

Notes
- Prefer Managed MySQL and DigitalOcean Spaces for production storage and backups.
- When using Spaces, adapt pagosController to serve files from Spaces (presigned URLs) instead of sendFile.
