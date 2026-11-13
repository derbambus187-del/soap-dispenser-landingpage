# Local Forge — Coding Agents

Two coding-focused assistants, available in Safari on your iPad or in a desktop browser:

- **Builder** implements features, edits project files, and runs tests/builds.
- **Reviewer** reviews code, diagnoses bugs, and can make focused fixes.

The default model is xAI's `grok-4-1-fast`, accessed through its OpenAI-compatible API. This hosted model needs an xAI API key and network access. The key stays on the server and is never sent to the browser. For local, private use, you can still point the app at an Ollama endpoint and choose a tool-capable local model.

Replies stream into the chat as they are generated. Grok Fast avoids local model loading and uses a low-latency hosted model; actual response time still depends on your network and xAI account limits.

## 1. Install and configure the app

From this directory:

```bash
npm install
cp .env.example .env
```

Edit `.env`, set `MODEL_API_KEY` to your xAI API key, and set `WORKSPACE_ROOT` to the exact project folder the assistants may work in. Use an absolute path, for example:

```dotenv
WORKSPACE_ROOT=/home/alex/projects/my-app
```

On Windows, forward slashes work too, e.g. `C:/Users/Alex/Projects/my-app`. Leaving `WORKSPACE_ROOT` empty disables autonomous file work; normal chat remains available. Keep the API key only in the backend `.env` file and do not commit it.

## 2. Start the app

```bash
npm run dev
```

Open the local Vite URL printed in the terminal (normally `http://localhost:5173`).

## Install on iPad

1. Connect the laptop and iPad to the same **trusted home Wi-Fi**.
2. From this directory, start the tablet-accessible server:

   ```bash
   npm run dev:tablet
   ```

3. Find the laptop's local Wi-Fi IPv4 address:
   - Windows: `ipconfig` — use the Wi-Fi adapter's **IPv4 Address**.
   - macOS: System Settings → Wi-Fi → Details, or run `ipconfig getifaddr en0`.
   - Linux: run `hostname -I` and use the address for the Wi-Fi network.
4. On the iPad, open Safari and visit `http://<laptop-ip>:5173`, for example `http://192.168.1.25:5173`. Tap **Share** and choose **Add to Home Screen**.

The app and model requests still run through the backend; the iPad is the screen and input. If the page does not load, allow Node/Vite on the laptop's **private/home network** in the firewall and check that both devices are on the same Wi-Fi (some guest networks isolate devices). Stop `npm run dev:tablet` with Ctrl+C when finished. Safari may require HTTPS for some Home Screen web-app features; a private HTTPS Codespaces forwarded URL is preferable when local HTTP installation is unavailable.

The tablet mode shares this development app with devices on your local network and has **no sign-in**. Use only a trusted Wi-Fi network, do not enable router port forwarding, and do not use it on public or guest Wi-Fi. Anyone who can reach the app may send prompts to your model; if `WORKSPACE_ROOT` is configured, they may also ask the agent to edit files there and run the allowed project checks. For tablet chat without remote file edits, leave `WORKSPACE_ROOT` empty in `.env`.

### If this project is running in GitHub Codespaces

`localhost` on your iPad or computer is not the Codespace. Run `npm run dev:tablet`, then open the **Ports** tab in the VS Code terminal panel, forward port **5173**, and open the forwarded address shown there. Keep the port **Private**; GitHub authentication may be required on the iPad. Do not make it public. The API stays behind the Vite proxy and does not need its own forwarded port.

## Autonomous mode boundaries

When **Autonom** is selected, the agent can:

- List files and read text files in the configured project folder.
- Publish a short implementation plan after inspecting the project.
- Create folders and files, or make precise, unique text edits (maximum 128 KB per file).
- Run only predefined project checks: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `dotnet test`, or `dotnet build`, when available.
- See a live action log while the agent inspects, plans, edits, and checks its work.

It cannot run arbitrary shell commands, access files outside the selected folder, follow symlinks, overwrite a file through `write_file`, or read/edit `.env`, SSH keys, and common key files. To update an existing file, it must read it first and make a precise edit whose target text matches once. `.git`, dependency folders, and build outputs are not exposed to the model. Project test/build scripts are executable code; they run with a reduced environment that does not include the model API key. Only point `WORKSPACE_ROOT` at a project you trust, and keep backups or use Git before autonomous edits.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `MODEL_API_BASE_URL` | `https://api.x.ai/v1` | OpenAI-compatible model API endpoint |
| `MODEL_API_KEY` | empty | xAI API key for the default hosted model |
| `MODEL_NAME` | `grok-4-1-fast` | Model ID supported by the selected endpoint |
| `WORKSPACE_ROOT` | empty | The one project folder the agent may access |
| `PORT` | `3001` | Local backend port |

To use Ollama instead, set `MODEL_API_BASE_URL=http://127.0.0.1:11434/v1`, clear `MODEL_API_KEY`, and choose an installed tool-capable model in `MODEL_NAME`. Use the **Chat** mode for answers without file access. **Autonom** requires a tool-capable model and a configured workspace, and makes real edits and test/build runs.

The microphone button uses the browser's speech-recognition feature when available. Depending on the browser, audio may be processed by that browser's speech provider. Transcribed text is placed in the message box for you to review; it is not sent until you press Send. If voice recognition is not available, use the device keyboard's dictation button. **YouTube** and **Discord** quick-launch buttons open those sites directly. You can also type or dictate "Öffne YouTube" or "Öffne Discord" in either mode. A specific Discord channel needs its `discord.com/channels/...` link; the app will not guess server or channel IDs. Other website destinations are blocked.

## Checks

```bash
npm test
npm run build
```
