# Upstream attribution

Derived from https://github.com/microsoft/vscode-livepreview at commit `ba8be8e5f6cad44ff5a8f0ed17f4cd312ad6f832`.
Microsoft's MIT copyright and license are retained in LICENSE and source headers.
This is a private third-party fork, not an official Microsoft release.

Changes: independent preview on each explicit open, multi-panel lifetime/focus management,
queued opens during server startup, isolated extension/command/configuration/task/webview IDs,
workspace execution for SSH, and disabled telemetry. Original renderer and HTTP/WebSocket
forwarding are retained. Built-in integrated-browser reuse is bypassed.
