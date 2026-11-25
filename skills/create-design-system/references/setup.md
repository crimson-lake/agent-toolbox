# One-time Playwright CLI setup

Read this only when Node.js, Playwright CLI, or a browser is missing or cannot start. The normal extraction workflow stays in `SKILL.md`.

## Check what is already available

Run `node --version` and `playwright-cli --version`. If the project has its own Playwright CLI installation, use `pnpm exec playwright-cli --version` or `npm exec -- playwright-cli --version` instead.

Before installing a missing component or downloading a browser, tell the user briefly what is needed and that you will set it up. Then proceed through the permitted package manager. Ask for approval only if the environment requires it.

## Install the CLI if missing

If Node.js is missing, use the user's normal platform or project setup to install Node.js and npm first. Do not silently change an existing project's Node version.

Prefer pnpm when available:

```text
pnpm add -g @playwright/cli@latest
```

Otherwise use npm:

```text
npm install -g @playwright/cli@latest
```

**`EACCES` / permission denied on a global install** (common on Linux VMs where the npm prefix is `/usr`): do not use `sudo`. Install into a user prefix instead and check that its `bin` folder is on `PATH`:

```bash
npm install -g --prefix "$HOME/.local" @playwright/cli@latest
"$HOME/.local/bin/playwright-cli" --version
echo "$PATH" | tr ':' '\n' | grep -qx "$HOME/.local/bin" && echo "on PATH" || echo "add \$HOME/.local/bin to PATH or call it by full path"
```

For projects that keep the CLI as a local dependency, add `@playwright/cli` through the project's package manager and run it with `pnpm exec playwright-cli` or `npm exec -- playwright-cli`. Use the same runner for every command in `SKILL.md`; no shell alias is needed. Check the version again after installation.

## Configure a browser once

From the project root, run `playwright-cli install` (or the selected project-local runner followed by `install`). The CLI checks for installed Chrome or Edge. If neither is present, it installs its managed Chromium and creates browser configuration. Chrome is not required after this setup.

The setup may create `.playwright/` and update `.gitignore` (observed: it appends `.playwright-cli/`, whose snapshots and logs may contain credentials). Inspect those changes in an existing repository and mention the `.gitignore` change to the user so it is committed deliberately, not by accident. If browser setup fails, report the exact error to the user and follow the [Playwright CLI instructions](https://github.com/microsoft/playwright-cli) for that platform. Do not assume that simply omitting `--browser=chrome` makes an unconfigured CLI work.
