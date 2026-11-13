const vscode = require("vscode");
const { randomBytes } = require("node:crypto");

const stateUrl = "http://127.0.0.1:4174/api/state";
const chatViewCommand = "workbench.view.extension.kilo-code-ActivityBar";

class PetViewProvider {
  resolveWebviewView(view) {
    view.webview.options = { enableScripts: true };
    view.webview.html = getHtml(view.webview);

    const update = async () => {
      try {
        const response = await fetch(stateUrl);
        if (!response.ok) throw new Error(`Status service returned ${response.status}`);
        const state = await response.json();
        await view.webview.postMessage({ type: "state", status: state.status, label: state.label });
      } catch {
        await view.webview.postMessage({
          type: "state",
          status: "offline",
          label: "Kilo-Status nicht verbunden"
        });
      }
    };

    void update();
    const timer = setInterval(update, 1200);
    view.onDidDispose(() => clearInterval(timer));

    view.webview.onDidReceiveMessage(async (message) => {
      if (message?.type !== "openChat") return;
      try {
        await vscode.commands.executeCommand(chatViewCommand);
      } catch (error) {
        void vscode.window.showErrorMessage(`Der Kilo-Chat konnte nicht geöffnet werden: ${error.message}`);
      }
    });
  }
}

function getHtml(webview) {
  const nonce = getNonce();
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    :root { color-scheme: light dark; font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body { background: var(--vscode-panel-background); }
    #pet {
      position: fixed;
      left: auto;
      top: auto;
      right: 14px;
      bottom: 8px;
      width: 164px;
      min-height: 118px;
      padding: 5px 8px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      gap: 5px;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }
    #pet:active { cursor: grabbing; }
    #bubble {
      max-width: 100%;
      padding: 7px 10px;
      border: 1px solid var(--vscode-panel-border, #53675b);
      border-radius: 12px;
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      font-size: 12px;
      line-height: 1.3;
      text-align: center;
      box-shadow: 0 2px 8px #0003;
    }
    #face {
      position: relative;
      width: 66px;
      height: 62px;
      flex: 0 0 auto;
      border: 3px solid #13211d;
      border-radius: 42% 42% 36% 36%;
      background: #8ed4a6;
      box-shadow: inset -7px -4px 0 #69b68a;
      animation: idle 2.4s ease-in-out infinite;
    }
    #face::before, #face::after {
      content: "";
      position: absolute;
      top: -13px;
      width: 16px;
      height: 18px;
      border: 3px solid #13211d;
      border-radius: 6px 10px 3px 4px;
      background: #8ed4a6;
      z-index: -1;
    }
    #face::before { left: 3px; transform: rotate(-17deg); }
    #face::after { right: 3px; transform: scaleX(-1) rotate(-17deg); }
    .eye {
      position: absolute;
      top: 21px;
      width: 5px;
      height: 7px;
      border-radius: 50%;
      background: #13211d;
    }
    .eye.left { left: 17px; }
    .eye.right { right: 17px; }
    .mouth {
      position: absolute;
      left: 50%;
      top: 35px;
      width: 9px;
      height: 6px;
      border-bottom: 2px solid #13211d;
      border-radius: 50%;
      transform: translateX(-50%);
    }
    .working #face, .planning #face, .testing #face { animation: work .55s ease-in-out infinite alternate; }
    .done #face { animation: celebrate .48s ease-in-out 4; }
    .interrupted #face { filter: saturate(.65); }
    .offline #face { filter: grayscale(.6); }
    @keyframes idle { 50% { transform: translateY(-4px); } }
    @keyframes work { to { transform: translateY(-6px) rotate(5deg); } }
    @keyframes celebrate { 25% { transform: translateY(-18px) rotate(-10deg); } 75% { transform: translateY(-12px) rotate(10deg); } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; } }
  </style>
</head>
<body>
  <button id="pet" type="button" aria-label="Kilo-Chat öffnen. Ziehen zum Verschieben.">
    <span id="bubble" role="status" aria-live="polite">Verbinde mit Kilo …</span>
    <span id="face" aria-hidden="true"><span class="eye left"></span><span class="eye right"></span><span class="mouth"></span></span>
  </button>
  <script nonce="${nonce}">
    const pet = document.querySelector("#pet");
    const bubble = document.querySelector("#bubble");
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;
    let suppressClick = false;

    function clampPosition() {
      const rect = pet.getBoundingClientRect();
      const left = Math.max(0, Math.min(rect.left, window.innerWidth - rect.width));
      const top = Math.max(0, Math.min(rect.top, window.innerHeight - rect.height));
      pet.style.left = left + "px";
      pet.style.top = top + "px";
      pet.style.right = "auto";
      pet.style.bottom = "auto";
    }

    pet.addEventListener("pointerdown", (event) => {
      dragging = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      const rect = pet.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      pet.style.left = rect.left + "px";
      pet.style.top = rect.top + "px";
      pet.style.right = "auto";
      pet.style.bottom = "auto";
      pet.setPointerCapture(event.pointerId);
    });

    pet.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      if (Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY) > 5) moved = true;
      if (!moved) return;
      const left = Math.max(0, Math.min(event.clientX - offsetX, window.innerWidth - pet.offsetWidth));
      const top = Math.max(0, Math.min(event.clientY - offsetY, window.innerHeight - pet.offsetHeight));
      pet.style.left = left + "px";
      pet.style.top = top + "px";
    });

    pet.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false;
      suppressClick = moved;
      if (moved) {
        localStorage.setItem("kiloPetPosition", JSON.stringify({
          left: pet.offsetLeft,
          top: pet.offsetTop
        }));
      }
    });

    pet.addEventListener("click", (event) => {
      if (suppressClick) {
        event.preventDefault();
        suppressClick = false;
        return;
      }
      vscode.postMessage({ type: "openChat" });
    });

    window.addEventListener("resize", clampPosition);
    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message?.type !== "state") return;
      pet.className = message.status;
      bubble.textContent = message.label;
    });

    try {
      const position = JSON.parse(localStorage.getItem("kiloPetPosition"));
      if (Number.isFinite(position?.left) && Number.isFinite(position?.top)) {
        pet.style.left = position.left + "px";
        pet.style.top = position.top + "px";
        pet.style.right = "auto";
        pet.style.bottom = "auto";
      }
    } catch (error) {
      localStorage.removeItem("kiloPetPosition");
    }

    const vscode = acquireVsCodeApi();
  </script>
</body>
</html>`;
}

function getNonce() {
  return randomBytes(16).toString("base64");
}

function activate(context) {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("kiloPet.view", new PetViewProvider()),
    vscode.commands.registerCommand("kiloPet.open", () =>
      vscode.commands.executeCommand("workbench.view.extension.kiloPet")
    )
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
