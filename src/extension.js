import { workspace } from 'vscode';
import * as SvnCommands from './SvnCommands';
import * as Utils from './Utils';
import * as SvnService from './SvnService';
import * as Display from './Display';
import { SvnScmProvider } from './SvnScmProvider';
import { SvnContentProvider } from './SvnContentProvider';
import { FileSystemListener } from './FileSystemListener';

let isRegistered = false;

function activate(context) {
    if (isRegistered) {
        return;
    }

    isRegistered = true;

    const trailingSlash = /^(.*)(\/)$/;

    let config = {
        localDir: workspace.rootPath !== undefined ? workspace.rootPath : ''
    }

    if (config.localDir) {
        config.localDir = Utils.normalize(config.localDir);
        if (!trailingSlash.exec(config.localDir)) config.localDir += '/';
    }

    if (config.svnDir) {
        config.svnDir = Utils.normalize(config.svnDir);
        if (!trailingSlash.exec(config.svnDir)) config.svnDir += '/';
    }

    SvnService.setConfig(config);
    context.subscriptions.push(new SvnContentProvider());
    context.subscriptions.push(new FileSystemListener());
    context.subscriptions.push(new SvnScmProvider());

    SvnCommands.registerCommands();
    Display.initialize();
}

exports.activate = activate;