/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import sinon from 'sinon';
import vscode from 'vscode';
import { PreviewManager } from '../../editorPreview/previewManager';
import { MockTelemetryReporter } from './mocks/mockTelemetryReporter';
import { ConnectionManager } from '../../connectionInfo/connectionManager';
import { EndpointManager } from '../../infoManagers/endpointManager';
import { AutoRefreshPreview, CustomExternalBrowser, SettingUtil } from '../../utils/settingsUtil';
import { makeSetting, testWorkspaces } from './common';
import { Connection } from '../../connectionInfo/connection';
import { WebviewComm } from '../../editorPreview/webviewComm';
import { ExternalBrowserUtils } from '../../utils/externalBrowserUtils';

describe('PreviewManager', () => {
	let sandbox: sinon.SinonSandbox;
	let previewManager: PreviewManager;
	let endpointManager: EndpointManager;
	let connection: Connection;

	const init = async (): Promise<void> => {
		sandbox = sinon.createSandbox();
		sandbox.stub(SettingUtil, 'GetConfig').returns(makeSetting({}));
	};

	before(async () => {
		await init();
		const extensionUri = vscode.Uri.file('c:/Users/TestUser/vscode-livepreview/');

		const telemetryReporter = new MockTelemetryReporter();
		const connectionManager = new ConnectionManager();
		connection = await connectionManager.createAndAddNewConnection(testWorkspaces[0]);
		endpointManager = new EndpointManager();

		previewManager = new PreviewManager(
			extensionUri,
			telemetryReporter,
			connectionManager,
			endpointManager,
			() => {
				// noop
			}
		);

	});

	after(async () => {
		await previewManager.currentPanel?.panel.dispose();
		previewManager.dispose();
		sandbox.restore();
	});

	it("previews in embedded preview", async () => {
		const goToFile = sinon.spy(WebviewComm.prototype, 'goToFile');

		await previewManager.launchFileInEmbeddedPreview(undefined, connection,
			testWorkspaces[0].uri);
		const initialPanel = previewManager.currentPanel?.panel;
		await previewManager.launchFileInEmbeddedPreview(undefined, connection,
			vscode.Uri.joinPath(testWorkspaces[0].uri, "/index.html"));
		await previewManager.launchFileInEmbeddedPreview(undefined, connection,
			vscode.Uri.joinPath(testWorkspaces[0].uri, "/index.html"));
		await previewManager.launchFileInEmbeddedPreview(undefined, connection,
			vscode.Uri.joinPath(testWorkspaces[0].uri, "/page.html"));

		assert(previewManager.currentPanel?.panel !== initialPanel); // Each open has its own panel.
        const newest = previewManager.currentPanel;
        initialPanel?.dispose();
        assert(previewManager.previewActive);
        assert.strictEqual(previewManager.currentPanel, newest);
		assert.ok(goToFile.callCount === 4);
		assert(previewManager.previewActive);

		assert.ok(goToFile.getCall(0).calledWith('', false));
		assert.ok(goToFile.getCall(1).calledWith('/index.html', false));
		assert.ok(goToFile.getCall(2).calledWith('/index.html', false));
		assert.ok(goToFile.getCall(3).calledWith('/page.html', false));
	});

    it("closing the server closes all of its tabs", () => {
        previewManager.closeConnection(connection);
        assert.strictEqual(previewManager.currentPanel, undefined);
        assert.strictEqual(previewManager.previewActive, false);
    });

    it("window identity messages do not reload a loaded preview", async () => {
        await previewManager.launchFileInEmbeddedPreview(undefined, connection, vscode.Uri.joinPath(testWorkspaces[0].uri, "/index.html"));
        const reload = sinon.spy(WebviewComm.prototype, 'reloadWebview');
        try {
            const preview = previewManager.currentPanel!;
            await (preview as any)._handleWebviewMessage({command:'get-window-id', id:'test-window'});
            await (preview as any)._handleWebviewMessage({command:'get-window-id', id:'test-window'});
            assert.equal(reload.callCount, 0);
        } finally { reload.restore(); }
    });

    it("connection notifications respect Never without resetting the page", async () => {
        (SettingUtil.GetConfig as sinon.SinonStub).returns(makeSetting({autoRefreshPreview: AutoRefreshPreview.never}));
        const reload = sinon.spy(WebviewComm.prototype, 'reloadWebview');
        try {
            await connection.connected();
            assert.equal(reload.callCount, 0);
        } finally {
            reload.restore();
            (SettingUtil.GetConfig as sinon.SinonStub).returns(makeSetting({}));
        }
    });

	it("previews in external preview (non-debug)", async () => {
		const openInBrowser = sinon.stub(ExternalBrowserUtils, 'openInBrowser');

		await previewManager.launchFileInExternalBrowser(false, connection,
			vscode.Uri.joinPath(testWorkspaces[0].uri, "/index.html"));

		assert.ok(openInBrowser.calledOnce);
		assert.ok(openInBrowser.getCall(0).calledWith(`http://${connection.host}:${connection.httpPort}/index.html`, CustomExternalBrowser.edge));
	});

	it("previews in external preview (debug)", async () => {
		const executeCommand = sinon.stub(vscode.commands, 'executeCommand');

		await previewManager.launchFileInExternalBrowser(true, connection,
			vscode.Uri.joinPath(testWorkspaces[0].uri, "/index.html"));

		assert.ok(executeCommand.calledOnce);
		assert.ok(executeCommand.getCall(0).calledWith('extension.js-debug.debugLink', `http://${connection.host}:${connection.httpPort}/index.html`));
	});
});