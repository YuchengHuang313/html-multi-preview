const path = require('node:path');
const {runTests} = require('@vscode/test-electron');
runTests({version:'1.109.0', extensionDevelopmentPath:path.resolve(__dirname,'..'), extensionTestsPath:path.join(__dirname,'test.cjs'), launchArgs:[path.join(__dirname,'fixture'),'--remote-debugging-port=9333','--disable-extensions','--no-sandbox','--disable-gpu','--skip-welcome','--skip-release-notes','--disable-workspace-trust']}).catch(e=>{console.error(e);process.exit(1)});
