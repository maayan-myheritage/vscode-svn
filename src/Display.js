import {
    window,
    StatusBarAlignment,
    workspace
} from 'vscode';

import * as Path from 'path';

import * as SvnService from './SvnService';
import * as Utils from './Utils';

var _statusBarItem

export var channel = window.createOutputChannel('SVN Log');

export function initialize() {
    _statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, Number.MIN_VALUE);
    _statusBarItem.command = 'svn.menuFunctions';

    updateEditor();
}

export function updateEditor() {
    var editor = window.activeTextEditor;
    if (!editor) {
        _statusBarItem.hide();
        return;
    }

    var doc = editor.document;

    //If no folder is open, override the perforce directory to the files
    var directoryOverride = null;
    if (workspace.rootPath === undefined) {
        directoryOverride = Path.dirname(doc.uri.fsPath);
    }

    if (!doc.isUntitled) {
        const args = '"' + Utils.expansePath(doc.uri.fsPath) + '"';
        SvnService.execute("status", function (err, stdout, stderr) {
            if (err) {
                // file not under client root
                _statusBarItem.text = 'SVN: $(circle-slash)';
                _statusBarItem.tooltip = stderr.toString();
            }
            else if (stderr) {
                // file not opened on client
                _statusBarItem.text = 'SVN: $(file-text)';
                _statusBarItem.tooltip = stderr.toString();
            } else if (stdout) {
                // file opened in add or edit
                _statusBarItem.text = 'SVN: $(check)';
                _statusBarItem.tooltip = stdout.toString();
            }
        }, args, directoryOverride);
        _statusBarItem.show();
    } else {
        _statusBarItem.hide();
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
