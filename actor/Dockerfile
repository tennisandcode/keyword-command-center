FROM apify/actor-node-playwright-chrome:20

# noVNC stack so the headful browser is visible/controllable in Apify Live View
# (operator solves the Helium 10 reCAPTCHA there). Root for apt, then back to
# the image's non-root user. index.html -> vnc_lite.html makes the container
# root URL auto-connect to the VNC session.
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends x11vnc novnc websockify \
 && ln -sf /usr/share/novnc/vnc_lite.html /usr/share/novnc/index.html \
 && rm -rf /var/lib/apt/lists/*
USER myuser

COPY package*.json ./
RUN npm --quiet set progress=false && npm install --omit=dev

COPY . ./

CMD npm start --silent
