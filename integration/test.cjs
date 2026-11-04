const vscode = require('vscode');
const assert = require('node:assert/strict');
const pause = ms => new Promise(r => setTimeout(r, ms));
const tabs = () => vscode.window.tabGroups.all.flatMap(g => g.tabs).filter(t => t.input instanceof vscode.TabInputWebview);
exports.run = async () => {
  await vscode.window.tabGroups.close(vscode.window.tabGroups.all.flatMap(g => g.tabs));
  const root = vscode.workspace.workspaceFolders[0].uri;
  await vscode.workspace.getConfiguration('htmlMultiPreview').update('portNumber', 43120, vscode.ConfigurationTarget.Workspace);
  await vscode.workspace.getConfiguration('htmlMultiPreview').update('autoRefreshPreview', 'Never', vscode.ConfigurationTarget.Workspace);
  await vscode.extensions.getExtension('yhuang546.html-multi-preview').activate();
  await vscode.workspace.getConfiguration('workbench').update('editorAssociations', {'*.html':'htmlMultiPreview.rendered'}, vscode.ConfigurationTarget.Workspace);
  for (const name of ['a.html', 'b.html']) {
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.joinPath(root,name), {preview:false});
  }
  const customTabs = () => vscode.window.tabGroups.all.flatMap(g=>g.tabs).filter(t=>t.input instanceof vscode.TabInputCustom && t.input.viewType==='htmlMultiPreview.rendered');
  for (let i=0;i<100 && customTabs().length!==2;i++) await pause(100);
  assert.equal(customTabs().length,2,'default HTML open creates two rendered editors');
  await vscode.commands.executeCommand('vscode.open',vscode.Uri.joinPath(root,'a.html'),{preview:false});
  assert.equal(customTabs().length,2,'same resource reuses custom editor');
  await vscode.commands.executeCommand('htmlMultiPreview.showNewPreview',vscode.Uri.joinPath(root,'a.html'));
  await pause(100);
  assert.equal(tabs().length,0,'Render command reuses the custom editor');
  assert.equal(customTabs().length,2);
  await vscode.commands.executeCommand('vscode.openWith',vscode.Uri.joinPath(root,'a.html'),'default');
  assert.equal(vscode.window.activeTextEditor.document.languageId,'html','source editor remains accessible');
  await vscode.window.tabGroups.close(vscode.window.tabGroups.all.flatMap(g=>g.tabs));

  await vscode.window.showTextDocument(vscode.Uri.joinPath(root, 'a.html'));
  const sourceColumn = vscode.window.tabGroups.activeTabGroup.viewColumn;
  const groupCount = vscode.window.tabGroups.all.length;
  for (const name of ['a.html', 'b.html', 'a.html']) {
    await vscode.commands.executeCommand('htmlMultiPreview.start.internalPreview.atFile', vscode.Uri.joinPath(root, name));
  }
  for (let i=0; i<100 && tabs().length!==3; i++) await pause(100);
  assert.equal(vscode.window.tabGroups.all.length, groupCount, 'opening previews creates no split');
  assert.ok(vscode.window.tabGroups.all.find(g => g.viewColumn === sourceColumn).tabs.filter(t => t.input instanceof vscode.TabInputWebview).length === 3, 'previews open alongside source in active group');
  assert.equal(tabs().length, 3, 'each invocation including same file opens a tab');
  assert.equal(vscode.window.tabGroups.all.filter(g => g.tabs.some(t => t.input instanceof vscode.TabInputWebview)).length, 1, 'previews share one group');
  for (let i=0; i<100 && !tabs().some(t => t.label.includes('Preview A')); i++) await pause(100);
  assert.ok(tabs().some(t => t.label.includes('Preview A')), 'iframe JavaScript reports the loaded document title');
  // The server may select another port while earlier preview connections drain.
  async function previewOrigin() {
    const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
    const target = targets.find(t => t.type === 'iframe' && /^http:\/\/127\.0\.0\.1:\d+\/a\.html/.test(t.url));
    assert.ok(target, 'loaded preview iframe exposes the actual HTTP origin');
    return new URL(target.url).origin;
  }
  let origin = await previewOrigin();
  for (const [path, content] of [['a.html','PREVIEW_A'], ['b.html','PREVIEW_B'], ['style.css','teal'], ['app.js','dataset.loaded']]) {
    const response = await fetch(origin + '/' + path);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes(content));
  }
  await vscode.window.tabGroups.close(tabs()[0]);
  await pause(200);
  assert.equal(tabs().length, 2, 'closing one preview preserves others');
  assert.equal((await fetch(origin + '/b.html')).status, 200);
  await vscode.window.tabGroups.close(tabs());
  await vscode.commands.executeCommand('htmlMultiPreview.start.internalPreview.atFile',vscode.Uri.joinPath(root,'a.html'));
  await pause(1500);
  origin = await previewOrigin();
  await require('./image-copy.cjs').run(origin);
  await vscode.window.tabGroups.close(tabs());
  const fs = require('node:fs/promises');
  const generated = vscode.Uri.joinPath(root, 'generated-report-check.html');
  const staged = generated.fsPath + '.writing';
  try {
    await fs.writeFile(generated.fsPath, '<html><body>Extracted: 99</body></html>', {flag:'wx'});
    const document = await vscode.workspace.openTextDocument(generated);
    assert.equal(document.isDirty, false);
    await vscode.commands.executeCommand('vscode.open', generated, {preview:false});
    await pause(1000);
    const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
    const target = targets.find(t => t.type === 'iframe' && t.url.includes('/generated-report-check.html'));
    assert.ok(target, 'generated report preview is loaded');
    origin = new URL(target.url).origin;
    for (const count of [211, 212]) {
      await fs.writeFile(staged, `<html><body>Extracted: ${count}</body></html>`);
      await fs.rename(staged, generated.fsPath);
      const body = await (await fetch(origin + '/generated-report-check.html')).text();
      assert.ok(body.includes(`Extracted: ${count}`), 'preview follows each external atomic publication');
    }
    console.log('GENERATED REPORT PASS: open clean document follows external disk publications.');
  } finally {
    await vscode.window.tabGroups.close(customTabs().filter(t => t.input.uri.toString() === generated.toString()));
    await fs.rm(generated.fsPath, {force:true});
    await fs.rm(staged, {force:true});
  }
  console.log('INTEGRATION PASS: three independent tabs, repeat file, HTTP HTML/CSS/JS, close isolation.');
};
