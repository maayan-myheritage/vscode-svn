import {
    commands, workspace, window, Uri,
    ThemableDecorationAttachmentRenderOptions, DecorationInstanceRenderOptions, DecorationOptions,
    OverviewRulerLane, Disposable, ExtensionContext, Range,
    TextDocument, TextEditor, TextEditorSelectionChangeEvent
} from 'vscode';

import * as Path from 'path';
import * as fs from 'fs';

import * as SvnService from './SvnService';
import * as Display from './Display';
import * as Utils from './Utils';

export function registerCommands() {
    commands.registerCommand('svn.add', addOpenFile);
    commands.registerCommand('svn.revert', revert);
    commands.registerCommand('svn.diff', diff);
    commands.registerCommand('svn.diffRevision', diffRevision);
}

export function add(filePath, directoryOverride) {
    const args = '"' + Utils.expansePath(filePath) + '"';
    SvnService.execute("add", (err, stdout, stderr) => {
        SvnService.handleCommonServiceResponse(err, stdout, stderr);
        if (!err) {
            Display.showError("file opened for add");
        }
    }, args, directoryOverride);
}

function addOpenFile() {
    var editor = window.activeTextEditor;
    if (!checkFileSelected()) {
        return false;
    }

    var filePath = editor.document.uri.fsPath;
    if (checkFolderOpened()) {
        add(filePath);
    } else {
        add(filePath, Path.dirname(filePath));
    }
}

export function revert() {
    var editor = window.activeTextEditor;
    if (!checkFileSelected()) {
        return false;
    }

    //If folder not opened, overrided svn directory
    var filePath = editor.document.uri.fsPath;
    var directoryOverride = null;
    if (!checkFolderOpened()) {
        directoryOverride = Path.dirname(filePath);
    }

    const args = '"' + Utils.expansePath(filePath) + '"';
    SvnService.execute("revert", (err, stdout, stderr) => {
        SvnService.handleCommonServiceResponse(err, stdout, stderr);
        if (!err) {
            Display.showError("file reverted");
        }
    }, args, directoryOverride);
}

export function diff(revision) {
    var editor = window.activeTextEditor;
    if(!checkFileSelected()) {
        return false;
    }

    if(!checkFolderOpened()) {
        return false;
    }

    var doc = editor.document;

    if(!doc.isUntitled) {
        Utils.getFile('print', doc.uri.fsPath, revision).then((tmpFile) => {
            var tmpFileUri = Uri.file(tmpFile)
            var revisionLabel = isNaN(revision) ? 'Most Recent Revision' : `Revision #${revision}`;
            commands.executeCommand('vscode.diff', tmpFileUri, doc.uri, Path.basename(doc.uri.fsPath) + ' - Diff Against ' + revisionLabel);
        }, (err) => {
            Display.showError(err.toString());
        })
    }
}

export function diffRevision() {
    var editor = window.activeTextEditor;
    if (!checkFileSelected()) {
        return false;
    }

    if (!checkFolderOpened()) {
        return false;
    }

    var doc = editor.document;

    const args = '"' + Utils.expansePath(doc.uri.fsPath) + '"';
    SvnService.execute('log', (err, stdout, stderr) => {
        if (err) {
            Display.showError(err.message);
        } else if (stderr) {
            Display.showError(stderr.toString());
        } else {
            let revisionMatches = stdout.match(/-{3}\nr\d+.*\n\n.*/g),
                revisionsData = [];
            if (revisionMatches) {
                revisionMatches.forEach((revisionMatch) => {
                    let [, revisionNumber, comment] = revisionMatch.match(/r(\d+).*?\n\n(.*)/);
                    let label = `#${revisionNumber} ${comment}`;
                    revisionsData.push({ revisionNumber, comment, label })
                })
            }

            window.showQuickPick(revisionsData).then( revision => {
                diff(parseInt(revision.revisionNumber));
            })

        }
    }, args);

}

function checkFileSelected() {
    if (!window.activeTextEditor) {
        Display.showMessage("No file selected");
        return false;
    }

    return true;
}

export function checkFolderOpened() {
    if (workspace.rootPath == undefined) {
        Display.showMessage("No folder selected\n");
        return false;
    }

    return true;
}