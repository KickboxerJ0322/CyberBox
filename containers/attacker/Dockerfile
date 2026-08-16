FROM kalilinux/kali-rolling:latest
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash curl wget iputils-ping iproute2 dnsutils nmap python3 \
    git netcat-openbsd openssl procps ca-certificates less nano jq \
    gobuster nikto sqlmap dirb \
    && setcap -r /usr/lib/nmap/nmap \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash cyberbox \
    && printf '\nexport PS1="\\[\\e[32m\\]cyberbox@lab\\[\\e[0m\\]:\\[\\e[34m\\]\\w\\[\\e[0m\\]$ "\n' >> /home/cyberbox/.bashrc \
    && printf 'CyberRoom isolated Kali training container. Only inspect the host named target.\n' > /home/cyberbox/README.txt \
    && chown -R cyberbox:cyberbox /home/cyberbox
USER cyberbox
WORKDIR /home/cyberbox
CMD ["sleep", "infinity"]
