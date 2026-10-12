'use strict';

// Native buttons support mouse, touch, Enter, and Space without a CDN dependency.
document.querySelectorAll('.ssh-lesson .command-activity').forEach((activity) => {
  const parts = activity.querySelectorAll('.command-part');
  const explanation = activity.querySelector('[aria-live="polite"]');
  parts.forEach((part) => {
    part.addEventListener('click', () => {
      parts.forEach((button) => button.setAttribute('aria-pressed', 'false'));
      part.setAttribute('aria-pressed', 'true');
      explanation.textContent = part.dataset.explanation;
      explanation.parentElement.scrollTop = 0;
    });
  });
});

document.querySelector('.ssh-skip-link').addEventListener('click', () => {
  document.querySelector('#main-content').focus();
});

// Reference output embedded for offline simulation; no real keys are created.
const simulationKeyOutput = "Your identification has been saved in ./server_key\nYour public key has been saved in ./server_key.pub\nThe key fingerprint is:\nSHA256:ZapN+WJi2Nj5SOafDxYXjaH9yuVrfKmUPDGwdDfw7vM science@demo-box-a.us-west1-b.c.automatic-gamma-506415-g4.internal\nThe key's randomart image is:\n+--[ED25519 256]--+\n|          . .    |\n|         o + o   |\n|        . O o +  |\n|         * * o . |\n|        S o = .  |\n|     = = = = =   |\n|    o X * +.* o. |\n|     = * + .oooo |\n|      o.+...oo  E|\n+----[SHA256]-----+\n";

// Validate path syntax only: the simulation never checks real files.
function isValidSimulatedKeyPath(path) {
  const filename = path.split('/').pop();
  return !/[\0\r\n]/.test(path) && Boolean(filename?.trim())
    && !['.', '..', '~'].includes(filename) && !path.startsWith('-');
}

function isValidSimulatedLogin(command) {
  const match = command.match(/^\s*ssh\s+-i\s+(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s"'`$;&|<>\\]+))\s+learner@192\.0\.2\.10\s*$/);
  if (!match) return false;
  const path = match[1] ?? match[2] ?? match[3];
  return isValidSimulatedKeyPath(path);
}

function parseSimulatedKeygen(command) {
  if (/^\s*ssh-keygen\s+-t\s+ed25519\s*$/.test(command)) return { path: null };
  const match = command.match(/^\s*ssh-keygen\s+-t\s+ed25519\s+-f\s+(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s"'`$;&|<>\\]+))\s*$/);
  if (!match) return null;
  const path = match[1] ?? match[2] ?? match[3];
  return isValidSimulatedKeyPath(path) ? { path } : null;
}

// State is separate for every card; submitted strings are never executed.
function createTerminalSimulation(kind) {
  const shell = 'learner@local:~$';
  const filenamePrompt = 'Enter a file in which to save the key:';
  const passphrasePrompt = 'Enter passphrase (empty for no passphrase):';
  const confirmPassphrasePrompt = 'Enter same passphrase again:';
  const hostPrompt = 'Are you sure you want to continue connecting (yes/no/[fingerprint])?';
  let stage = 'command';
  let path = './server_key';
  let passphrase = null;
  function prompt() {
    return { command: shell, filename: filenamePrompt, passphrase: passphrasePrompt,
      repeat: confirmPassphrasePrompt, confirmation: hostPrompt,
      complete: kind === 'login' ? 'learner@practice-vm:~$' : shell }[stage];
  }
  function snapshot() { return { stage, prompt: prompt(), masked: stage === 'passphrase' || stage === 'repeat', complete: stage === 'complete' }; }
  return {
    snapshot,
    reset() { stage = 'command'; path = './server_key'; passphrase = null; return snapshot(); },
    submit(raw) {
      if (stage === 'complete') return { ...snapshot(), output: '', announcement: '' };
      const secret = stage === 'passphrase' || stage === 'repeat';
      let output = prompt() + (secret ? '\n' : ' ' + raw + '\n');
      let message = '';
      if (stage === 'command') {
        const command = raw.trim().split(/\s+/).join(' ');
        const keygen = kind === 'keygen' ? parseSimulatedKeygen(raw) : null;
        if (keygen) {
          output += 'Generating public/private ed25519 key pair.\n';
          if (keygen.path !== null) path = keygen.path;
          stage = keygen.path !== null ? 'passphrase' : 'filename';
        } else if (kind === 'login' && isValidSimulatedLogin(raw)) {
          output += "The authenticity of host '192.0.2.10 (192.0.2.10)' can't be established.\nED25519 key fingerprint is: SHA256:tpEXkuuSen8agypTccsvsCWL7T6Igjka9YJmlWEU36g\n";
          stage = 'confirmation';
        } else {
          const expectedCommand = kind === 'keygen' ? 'ssh-keygen' : 'ssh';
          message = command.split(' ')[0] === expectedCommand
            ? `sim: [${expectedCommand}] not quite try again`
            : 'sim: command not found.';
          output += message + '\n';
        }
      } else if (stage === 'filename') {
        const name = raw.trim();
        if (isValidSimulatedKeyPath(name)) {
          path = name; stage = 'passphrase';
        } else {
          message = 'Enter a filename, optionally including its path. A directory path alone is not accepted.';
          output += message + '\n';
        }
      } else if (stage === 'passphrase') { passphrase = raw; stage = 'repeat'; }
      else if (stage === 'repeat') {
        const matches = raw === passphrase;
        passphrase = null;
        if (matches) {
          output += simulationKeyOutput.replaceAll('./server_key', path);
          stage = 'complete'; message = 'Key pair created. Complete. Select Start over to practice again.';
        } else {
          message = 'Passphrases do not match. Please enter your practice passphrase again.';
          output += message + '\n'; stage = 'passphrase';
        }
      } else if (stage === 'confirmation') {
        const answer = raw.trim();
        if (answer === 'yes') {
          output += "Warning: Permanently added '192.0.2.10' (ED25519) to the list of known hosts.\nWelcome to Ubuntu 24.04.4 LTS\n\nlearner@practice-vm:~$\n";
          stage = 'complete'; message = 'Login successful. Complete. Select Start over to practice again.';
        } else if (answer === 'no') {
          message = 'Connection canceled.'; output += message + '\n'; stage = 'command';
        } else { message = 'Please type yes or no.'; output += message + '\n'; }
      }
      return { ...snapshot(), output, announcement: message || output + prompt() };
    }
  };
}

// Return a cancellation function so reset can stop pending output immediately.
function displayOneByOne(output, printLine, finished, delay = 100) {
  const lines = output.match(/[^\n]*\n|[^\n]+$/g) || [];
  let index = 0;
  let timer = null;
  let canceled = false;
  function next() {
    if (canceled) return;
    if (index < lines.length) printLine(lines[index++]);
    if (index < lines.length) timer = setTimeout(next, delay);
    else finished();
  }
  next();
  return () => { canceled = true; clearTimeout(timer); };
}

// Keep the screenshot explanations local to the lesson's native modal.
(() => {
  const dialog = document.querySelector('#terminal-dialog');
  const hotspots = document.querySelectorAll('.terminal-hotspot');
  const close = dialog.querySelector('.terminal-dialog-close');
  let origin = null;
  const explanations = {
    login: { title: 'SSH login', html: 'This command starts a secure connection to your virtual machine, requesting to login as <code>username</code>.' },
    key: { title: 'Create an SSH key pair', html: 'This command creates an cryptographic key pair, which is used to authenticate and secure your connection.' }
  };
  function position() {
    if (!dialog.open || !origin) return;
    const bounds = origin.getBoundingClientRect();
    const margin = 16;
    const right = bounds.right + 12;
    const left = right + dialog.offsetWidth <= window.innerWidth - margin
      ? right
      : bounds.left - dialog.offsetWidth - 12 >= margin
        ? bounds.left - dialog.offsetWidth - 12 : bounds.left;
    dialog.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - dialog.offsetWidth - margin))}px`;
    dialog.style.top = `${Math.max(margin, Math.min(bounds.top + bounds.height / 2 - dialog.offsetHeight / 2, window.innerHeight - dialog.offsetHeight - margin))}px`;
  }
  hotspots.forEach((hotspot) => hotspot.addEventListener('click', () => {
    origin = hotspot;
    const explanation = explanations[hotspot.dataset.command];
    hotspots.forEach((button) => button.setAttribute('aria-pressed', String(button === hotspot)));
    dialog.querySelector('#terminal-dialog-title').textContent = explanation.title;
    // Only fixed author-provided markup is used here; learner input uses textContent.
    dialog.querySelector('.terminal-dialog-explanation').innerHTML = explanation.html;
    dialog.showModal();
    position();
    close.focus({ preventScroll: true });
  }));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => origin?.focus({ preventScroll: true }));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') { event.preventDefault(); close.focus(); }
  });
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, { passive: true });
})();

document.querySelectorAll('.simulation-card').forEach((card) => {
  const simulation = createTerminalSimulation(card.dataset.simulation);
  const input = card.querySelector('.simulation-input');
  const label = card.querySelector('.simulation-input-label');
  const history = card.querySelector('.simulation-transcript pre');
  const scroll = card.querySelector('.simulation-transcript');
  const status = card.querySelector('.simulation-status');
  const announcement = card.querySelector('.simulation-announcement');
  const submit = card.querySelector('.simulation-submit');
  const response = { busy: false, cancel: () => {} };
  function render(state) {
    label.textContent = state.complete ? 'Complete — select Start over to practice again.' : state.prompt;
    input.type = state.masked ? 'password' : 'text';
    input.readOnly = state.complete;
    input.value = '';
    submit.disabled = state.complete;
    status.textContent = state.complete ? 'Complete' : 'Incomplete';
    status.classList.toggle('is-complete', state.complete);
  }
  render(simulation.snapshot());
  card.querySelector('.simulation-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (response.busy) return;
    const result = simulation.submit(input.value);
    if (!result.output) return;
    response.busy = true;
    input.value = '';
    input.readOnly = true;
    submit.disabled = true;
    label.textContent = 'Displaying terminal response…';
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 100;
    response.cancel = displayOneByOne(result.output, (line) => {
      history.textContent += line;
      scroll.scrollTop = scroll.scrollHeight;
      if (line.trim()) announcement.textContent = line.trim();
    }, () => {
      response.busy = false;
      render(result);
      announcement.textContent = result.complete
        ? 'Complete. Select Start over to practice again.' : result.prompt;
      input.focus({ preventScroll: true });
    }, delay);
  });
  card.querySelector('.simulation-reset').addEventListener('click', () => {
    response.cancel();
    response.busy = false;
    render(simulation.reset());
    history.textContent = '';
    announcement.textContent = 'Simulation reset. Enter a command to begin.';
    scroll.scrollTop = 0;
    input.focus({ preventScroll: true });
  });
});
