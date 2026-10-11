# ===== Stage build: toolchain + node-pty + dispatcher compiled =====
FROM archlinux:latest AS build
RUN pacman-key --init \
    && pacman -Syu --noconfirm \
    && pacman -S --noconfirm nodejs npm base-devel go fastfetch \
    && pacman -Scc --noconfirm

WORKDIR /build/pty
COPY package.json ./
RUN npm install --no-audit --no-fund --omit=dev \
    && npm install -g node-gyp \
    && cd node_modules/node-pty \
    && node-gyp rebuild

# Dispatcher portfolio → binary Go statis (tanpa interpreter di runtime)
WORKDIR /build/cli
COPY portfolio-cli.go go.mod ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/portfolio-cli .

# ===== Stage runtime: MINIMAL — tanpa interpreter/kompiler =====
FROM archlinux:latest
RUN pacman-key --init \
    && pacman -Syu --noconfirm \
    && pacman -S --noconfirm nodejs fastfetch \
    && pacman -Scc --noconfirm

# node HANYA untuk bridge (berjalan sebagai root terkurung). Visitor
# (uid 1000) tidak boleh mengeksekusinya — tidak ada interpreter sama sekali.
RUN chmod 750 /usr/bin/node

COPY --from=build /build/pty/node_modules /opt/pty-server/node_modules
COPY server.js /opt/pty-server/

# Dispatcher compiled — tanpa python di runtime
COPY --from=build /out/portfolio-cli /opt/portfolio-cli
RUN chmod 755 /opt/portfolio-cli

# User shell non-root (yang dijalankan visitor lewat PTY)
RUN useradd --create-home --uid 1000 --shell /usr/bin/bash visitor

# ALLOWLIST PATH: hanya binary read-only + dispatcher.
RUN mkdir -p /opt/bin \
    && for b in ls cat pwd whoami uname fastfetch pacman grep head wc \
                echo date sort tr; do \
         [ -e "/usr/bin/$b" ] && ln -sf "/usr/bin/$b" "/opt/bin/$b" || true; \
       done \
    && for c in about skills projects experience education certifications \
                publications contact github socials show help clear config-admin; do \
         ln -sf /opt/portfolio-cli "/opt/bin/$c"; \
       done

COPY fs/ /home/visitor/
RUN chown -R visitor:visitor /home/visitor \
    && mv /home/visitor/bashrc /home/visitor/.bashrc \
    && chmod 755 /home/visitor

# Bridge berjalan sebagai root terkurung (cap_drop ALL + cap_add SETUID dari
# compose) semata-mata untuk menurunkan proses PTY ke uid 1000 (visitor).
USER root
WORKDIR /home/visitor
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status===404?0:1)).catch(()=>process.exit(1))"

CMD ["node", "/opt/pty-server/server.js"]
