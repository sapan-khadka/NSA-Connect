FROM postgres:16-alpine

RUN apk add --no-cache \
        bash \
        curl \
        openssl \
        python3 \
        py3-pip \
    && pip3 install --no-cache-dir --break-system-packages awscli==1.38.19 \
    && rm -rf /root/.cache

ENV SUPERCRONIC_VERSION=v0.2.33
RUN curl -fsSL "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-amd64" \
        -o /usr/local/bin/supercronic \
    && chmod +x /usr/local/bin/supercronic

WORKDIR /backup

COPY scripts/ /backup/scripts/
COPY crontab /etc/cron.d/nsa-connect-backup

RUN chmod +x /backup/scripts/*.sh /backup/scripts/lib/*.sh \
    && chmod 0644 /etc/cron.d/nsa-connect-backup

ENV BACKUP_DIR=/backups \
    PATH="/backup/scripts:${PATH}"

ENTRYPOINT ["/backup/scripts/entrypoint.sh"]
