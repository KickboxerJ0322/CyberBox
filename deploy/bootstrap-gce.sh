#!/usr/bin/env bash
set -euo pipefail
REPOSITORY_URL="https://github.com/KickboxerJ0322/CyberBox.git"
INSTALL_DIR="/opt/cyberbox"
apt-get update
apt-get install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
if [[ ! -d "${INSTALL_DIR}/.git" ]]; then git clone "${REPOSITORY_URL}" "${INSTALL_DIR}"; fi
cd "${INSTALL_DIR}"
if [[ ! -f .env ]]; then cp .env.example .env; fi
docker compose --profile images build
docker compose pull target-image docker-proxy
docker compose up -d --build
