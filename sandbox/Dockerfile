# Sandbox Arch — image disiapkan sekali saat build.
# Runtime: non-root (visitor), rootfs read-only, tanpa instalasi paket.
FROM archlinux:latest

# Paket hanya saat build: python (stdlib HTTP server) + fastfetch.
# pacman sudah bawaan; metadata paket (/var/lib/pacman) ikut terbawa
# sehingga `pacman -Q` menampilkan daftar paket nyata.
RUN pacman-key --init \
    && pacman -Syu --noconfirm \
    && pacman -S --noconfirm python fastfetch \
    && pacman -Scc --noconfirm

# User non-root read-only (tidak punya shell interaktif: /usr/bin/false)
RUN useradd --create-home --uid 1000 --shell /usr/bin/false visitor

COPY --chown=visitor:visitor fs/ /home/visitor/
COPY server.py allowlist.py tests_selftest.py /opt/portfolio-sandbox/

# Fixture keamanan: symlink keluar sandbox — HARUS selalu ditolak cat.
RUN ln -s /etc/passwd /home/visitor/escape-link.txt

USER visitor
WORKDIR /home/visitor
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=3)"

CMD ["python", "/opt/portfolio-sandbox/server.py"]
