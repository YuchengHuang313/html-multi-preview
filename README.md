# HTML Multi Preview

Private MIT-licensed fork of Microsoft Live Preview. Same embedded browser UI, navigation,
live reload, asset serving and Remote-SSH forwarding. **Render HTML replaces the active source
editor and reuses the existing rendered editor for the same file, including across editor groups.**
Different files retain independent rendered tabs. Unsaved edits are preserved.

## Install
Install `dist/html-multi-preview-1.2.2.vsix` using **Extensions: Install from VSIX...**.
Download the VSIX from this repository on each device (open the file and choose
**Download raw file**), then run **Extensions: Install from VSIX...** in VS Code.
Alternatively, with the VS Code CLI available:

```sh
code --install-extension ./html-multi-preview-1.2.2.vsix
```

Requires VS Code 1.109.0 or newer. The VSIX is platform-independent and can be
installed on Windows, macOS, and Linux; no Node.js installation is needed to use it.
For Remote-SSH, install on the SSH host. Reload the VS Code window if prompted.
Right-click HTML and choose **HTML Multi Preview: Show Preview**, or run that command
from the command palette. The editor toolbar also has a preview button.
Disable other HTML preview extensions for this workspace to avoid duplicate buttons.

Settings are under `htmlMultiPreview.*`, independently of Microsoft's `livePreview.*`.
For save-only refresh: `"htmlMultiPreview.autoRefreshPreview": "On Changes to Saved Files"`.
No telemetry is sent. No public network binding or manual port forwarding is required.
See UPSTREAM.md for provenance. Original documentation: README.upstream.md.

## Develop and verify
With Node.js 22+ and npm installed:

```sh
npm ci
npm run compile
# Linux without a display: prefix with xvfb-run -a; unset ELECTRON_RUN_AS_NODE.
node out/test/runTest.js
npx vsce package --no-dependencies --allow-missing-repository --out dist/html-multi-preview-1.2.2.vsix
node integration/run.cjs
```

The extension-host suite covers independent panels, concurrent startup requests,
and server lifetimes. The integration test opens A, B, A through the actual command,
checks that three tabs share one preview group, fetches relative HTML/CSS/JS assets,
and verifies that closing one tab leaves the other previews and server alive.
Remote-SSH uses the upstream HTTP/WebSocket `asExternalUri` forwarding implementation;
the local automated tests do not replace a visual check on your Windows SSH client.

## Open HTML directly as a rendered page
The HTML Multi Preview custom editor supports `.html` and `.htm`. Set:

```json
"workbench.editorAssociations": {
  "*.html": "htmlMultiPreview.rendered",
  "*.htm": "htmlMultiPreview.rendered"
}
```

Double-clicking different HTML files keeps separate rendered tabs. Opening the same file
again focuses its existing custom-editor tab. The toolbar and context-menu **Render HTML**
command use the same custom editor and do not create independent browser-preview duplicates.
Use **Reopen Editor With... → Text Editor** to edit the source.
The custom editor uses VS Code's [Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors).

Render HTML stays in the current editor group unless it focuses an existing rendered editor elsewhere.
The legacy low-level internal-preview command remains available for integration clients.

Right-click a loaded image or canvas → **复制图片 / Copy Image** to copy native-resolution PNG pixels to your local clipboard, including over Remote-SSH. Cross-origin images without CORS permission cannot be copied; an error is shown instead. Animated images copy the current rendered frame.

Automatic refresh defaults to `Never`. Window identity initialization no longer reloads reports; connection notifications and delayed file-refresh callbacks respect `Never`. Use the toolbar reload button to explicitly refresh.

Saved files are served from disk on every request, even when an open clean editor
buffer still contains an older generated report. Unsaved source edits and untitled
documents still use the editor buffer. This prevents old report counts from being
shown alongside newly generated images. Version 1.2.2 changes content loading only;
existing manual/automatic refresh preferences are preserved.

The Render HTML behavior is covered by `integration/render-reuse.cjs`: source replacement,
rapid repeated commands, cross-group reuse, distinct files, and unsaved-buffer preservation.
