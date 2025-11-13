FROM pandoc/latex:3.6

RUN apk add --no-cache python3 py3-pip py3-flask py3-gunicorn font-noto font-noto-emoji fontconfig curl

# Download Symbola font (monochrome emoji support for LaTeX PDFs)
RUN mkdir -p /usr/share/fonts/truetype/symbola && \
    cd /usr/share/fonts/truetype/symbola && \
    curl -L -o Symbola.ttf "https://github.com/ChiefMikeK/ttf-symbola/raw/master/Symbola.ttf" && \
    fc-cache -fv

# Verify Symbola is installed
RUN fc-list | grep -i symbola

# Point tlmgr to 2024 repo and install emoji
# textlive (latex) by default now is 2025 but the latest pandoc/latex still use textlive 2024
# we need to remove this cmnd when pandoc/latex has new version with texlive pointing 2025 repo 
RUN tlmgr option repository http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2024/tlnet-final
# Verify tlmgr is updated and install packages including emoji package for emoji support
RUN tlmgr install emoji newunicodechar svg transparent ragged2e

WORKDIR /app
COPY template.tex /app
COPY reference.docx /app
COPY pandoc.py /app

# Set environment variables for paths
ENV TEMPLATE_PATH=/app/template.tex
ENV REFERENCE_DOC_PATH=/app/reference.docx
ENV OUTPUT_DIR=/app

EXPOSE 80
ENTRYPOINT ["gunicorn", "-w", "4", "-b", "0.0.0.0:80", "pandoc:app"]
