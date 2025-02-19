FROM pandoc/core:3.6

RUN apk add --no-cache python3 py3-pip py3-flask py3-gunicorn

WORKDIR /app
COPY pandoc.py /app
EXPOSE 80
ENTRYPOINT ["gunicorn", "-w", "4", "-b", "0.0.0.0:80", "pandoc:app"]