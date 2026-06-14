// Expose the headful Chrome (running under xvfb) through Apify's Live View by
// serving a noVNC client on the container port. x11vnc mirrors the X display;
// websockify serves the noVNC web client + proxies the VNC websocket on one
// port. Apify shows whatever listens on APIFY_CONTAINER_PORT in the Live view
// tab, so the operator can solve the Helium 10 reCAPTCHA and click "Log In".
import { spawn } from 'child_process';
import { log } from 'apify';

export function startLiveView() {
  const display = process.env.DISPLAY || ':99';
  const port = process.env.APIFY_CONTAINER_PORT || '4321';
  try {
    spawn('x11vnc', ['-display', display, '-forever', '-shared', '-nopw', '-auth', 'guess', '-rfbport', '5900', '-quiet'], {
      stdio: 'ignore',
      detached: true,
    }).unref();
    spawn('websockify', ['--web', '/usr/share/novnc', port, 'localhost:5900'], {
      stdio: 'ignore',
      detached: true,
    }).unref();
    log.info(`Live View (noVNC) serving on container port ${port}.`);
  } catch (e) {
    log.warning(`Live View failed to start: ${e?.message ?? e}`);
  }
}
