FROM postgres:17-alpine

ARG WAL_G_VERSION=3.0.9
ARG TARGETARCH

RUN apk add --no-cache curl gcompat restic rclone python3 tzdata \
    && case "$TARGETARCH" in \
        amd64) WAL_G_ARCH=amd64; WAL_G_SHA256=444ce216230c254edef803e098a59a1746806da3e0d55671d7b0f0082db14ef4 ;; \
        arm64) WAL_G_ARCH=aarch64; WAL_G_SHA256=cb37c5f8391bd8ef2efceeb9c6995059c0abf2fa74b9b717b42a16a7c93cfde1 ;; \
        *) exit 1 ;; \
    esac \
    && curl -fsSL --retry 3 "https://github.com/wal-g/wal-g/releases/download/v${WAL_G_VERSION}/wal-g-pg-24.04-${WAL_G_ARCH}.tar.gz" -o /tmp/wal-g.tar.gz \
    && printf '%s  %s\n' "$WAL_G_SHA256" /tmp/wal-g.tar.gz | sha256sum -c - \
    && tar -xzf /tmp/wal-g.tar.gz -C /usr/local/bin \
    && mv "/usr/local/bin/wal-g-pg-24.04-${WAL_G_ARCH}" /usr/local/bin/wal-g \
    && rm /tmp/wal-g.tar.gz

ENV TZ=UTC

COPY backup/backup_runner.py /usr/local/bin/backup_runner.py
COPY backup/backup.cron /etc/crontabs/root
COPY backup/backup-entrypoint.sh /usr/local/bin/backup-entrypoint.sh

RUN chmod 0644 /etc/crontabs/root \
    && chmod 0755 /usr/local/bin/backup-entrypoint.sh
