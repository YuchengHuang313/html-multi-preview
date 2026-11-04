/*---------------------------------------------------------------------------------------------
 *  Copyright (c) YuchengHuang313. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

const viewType = 'htmlMultiPreview.rendered';
const pending = new Map<string, Promise<void>>();

/** Render a resource once, replacing its active clean source editor. */
export function showRenderedPreview(file?: vscode.Uri): Promise<void> {
	const active = vscode.window.tabGroups.activeTabGroup.activeTab;
	const input = active?.input;
	const uri = file ?? (input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom
		? input.uri : vscode.window.activeTextEditor?.document.uri);
	if (!uri) { return Promise.resolve(); }
	const key = uri.toString();
	const inFlight = pending.get(key);
	if (inFlight) { return inFlight; }
	const source = input instanceof vscode.TabInputText && input.uri.toString() === key ? active : undefined;
	const operation = (async (): Promise<void> => {
		const existing = vscode.window.tabGroups.all.find(group => group.tabs.some(tab =>
			tab.input instanceof vscode.TabInputCustom && tab.input.viewType === viewType &&
			tab.input.uri.toString() === key));
		await vscode.commands.executeCommand('vscode.openWith', uri, viewType, {
			viewColumn: existing?.viewColumn ?? vscode.window.tabGroups.activeTabGroup.viewColumn,
			preview: false,
			preserveFocus: false,
		});
		// openWith can resolve before the extension host receives the tab replacement event.
		const deadline = Date.now() + 5000;
		while (!vscode.window.tabGroups.all.some(group => group.tabs.some(tab =>
			tab.input instanceof vscode.TabInputCustom && tab.input.viewType === viewType &&
			tab.input.uri.toString() === key && tab.isActive && group.isActive))) {
			if (Date.now() >= deadline) { throw new Error('Rendered editor did not become active.'); }
			await new Promise(resolve => setTimeout(resolve, 20));
		}
		// Close only the captured source, never whichever editor became active while loading.
		// Keep dirty source tabs so rendering cannot discard edits or trigger a save dialog.
		const remainingSource = source && vscode.window.tabGroups.all
			.find(group => group.viewColumn === source.group.viewColumn)?.tabs.find(tab =>
			tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === key);
		if (remainingSource && !remainingSource.isDirty) {
			await vscode.window.tabGroups.close(remainingSource, true);
		}
	})();
	pending.set(key, operation);
	return operation.finally(() => { pending.delete(key); });
}
