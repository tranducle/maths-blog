# LaTeX/TikZ → SVG render service.
# Base: Debian slim + TeX Live (latex, tikz) + dvisvgm + Node.
#
# Build context is the render-service/ directory (deployed to Render.com from
# this subdir). The image is ~1.3GB; TeX Live minimal is the bulk.
FROM node:20-slim

# TeX Live: install only the slices we need (latex base + TikZ) + dvisvgm +
# Ghostscript (dvisvgm dependency for some PostScript paths). apt-get is the
# simplest path on Debian; the full scheme-basic is ~400MB, tikz adds ~200MB.
RUN apt-get update && apt-get install -y --no-install-recommends \
      texlive-latex-base \
      texlive-latex-recommended \
      texlive-latex-extra \
      texlive-fonts-recommended \
      texlive-pictures \
      texlive-pstricks \
      dvisvgm \
      ghostscript \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node deps first for layer caching.
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY app.js ./

# Render container does not need privileged access.
USER node

EXPOSE 3000
CMD ["node", "app.js"]
