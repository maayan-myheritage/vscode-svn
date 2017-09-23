import {
    window,
    StatusBarAlignment,
    workspace
} from 'vscode';

import * as Path from 'path';

import * as SvnService from './SvnService';
import * as Utils from './Utils';

let statusBarItem;

export let channel = window.createOutputChannel('SVN Log');

export function initialize() {
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, Number.MIN_VALUE);
    statusBarItem.command = 'svn.menuFunctions';

    updateEditor();
}

export function updateEditor() {
    var editor = window.activeTextEditor;
    if (!editor) {
        statusBarItem.hide();
        return;
    }

    var doc = editor.document;

    var directoryOverride = null;
    if (workspace.rootPath === undefined) {
        directoryOverride = Path.dirname(doc.uri.fsPath);
    }

    if (!doc.isUntitled) {
        const args = '"' + Utils.expansePath(doc.uri.fsPath) + '"';
        SvnService.execute("status", function (err, stdout, stderr) {
            if (err) {
                // file not under client root
                statusBarItem.text = 'SVN: $(circle-slash)';
                statusBarItem.tooltip = stderr.toString();
            }
            else if (stderr) {
                // file not opened on client
                statusBarItem.text = 'SVN: $(file-text)';
                statusBarItem.tooltip = stderr.toString();
            } else if (stdout) {
                // file opened in add or edit
                statusBarItem.text = 'SVN: $(check)';
                statusBarItem.tooltip = stdout.toString();
            }
        }, args, directoryOverride);
        statusBarItem.show();
    } else {
        statusBarItem.hide();
    }
}

export function showMessage(message) {
    window.setStatusBarMessage("SVN: " + message, 3000);
    channel.append(message);
}

export function showError(error) {
    window.setStatusBarMessage("SVN: " + error, 3000);
    channel.appendLine(`ERROR: ${JSON.stringify(error)}`);
}
