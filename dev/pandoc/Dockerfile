FROM pandoc/latex:3.6

RUN apk add --no-cache python3 py3-pip py3-flask py3-gunicorn

# Point tlmgr to 2024 repo and install emoji
# textlive (latex) by default now is 2025 but the latest pandoc/latex still use textlive 2024
# we need to remove this cmnd when pandoc/latex has new version with texlive pointing 2025 repo 
RUN tlmgr option repository http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2024/tlnet-final
# Verify tlmgr is updated and install packages
RUN tlmgr install emoji

WORKDIR /app
COPY template.tex /app
COPY reference.docx /app
COPY pandoc.py /app

EXPOSE 80
ENTRYPOINT ["gunicorn", "-w", "4", "-b", "0.0.0.0:80", "pandoc:app"]
