// Expose the headful Chrome (running under xvfb) through Apify's Live View by
// serving a noVNC client on the container port. x11vnc mirrors the X display;
// websockify serves the noVNC web client + proxies the VNC websocket on one
// port. Apify shows whatever listens on APIFY_CONTAINER_PORT in the Live view
// tab, so the operator can solve the Helium 10 reCAPTCHA and click "Log In".
import { spawn } from 'child_process';
import { log } from 'apify';

function run(cmd, args, name) {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const onData = (d) => String(d).split('\n').filter(Boolean).forEach((l) => log.info(`[${name}] ${l.slice(0, 200)}`));
  p.stdout.on('data', onData);
  p.stderr.on('data', onData);
  p.on('error', (e) => log.warning(`[${name}] spawn error: ${e.message}`));
  p.on('exit', (c) => log.warning(`[${name}] exited (code ${c})`));
  return p;
}

export function startLiveView() {
  const display = process.env.DISPLAY || ':99';
  const port = process.env.APIFY_CONTAINER_PORT || '4321';
  const xauth = process.env.XAUTHORITY;
  log.info(`Live View starting — DISPLAY=${display} PORT=${port} XAUTHORITY=${xauth || '(unset)'}`);

  // -auth points x11vnc at xvfb-run's cookie; fall back to "guess" if unset.
  const authArgs = xauth ? ['-auth', xauth] : ['-auth', 'guess'];
  run(
    'x11vnc',
    ['-display', display, ...authArgs, '-forever', '-shared', '-nopw', '-noxdamage', '-repeat', '-rfbport', '5900'],
    'x11vnc'
  );

  // Give x11vnc a moment to bind :5900 before websockify proxies to it.
  setTimeout(() => {
    run('websockify', ['--web', '/usr/share/novnc', String(port), 'localhost:5900'], 'websockify');
  }, 2000);
}
