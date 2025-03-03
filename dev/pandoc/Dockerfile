FROM pandoc/latex:3.6

RUN apk add --no-cache python3 py3-pip py3-flask py3-gunicorn
RUN tlmgr install emoji 

WORKDIR /app
COPY template.tex /app
COPY reference.docx /app
COPY pandoc.py /app

EXPOSE 80
ENTRYPOINT ["gunicorn", "-w", "4", "-b", "0.0.0.0:80", "pandoc:app"]