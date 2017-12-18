import {
    window,
    workspace,
    Disposable
} from 'vscode';

import { SvnSourceControl } from './SvnSourceControl'

import * as micromatch from 'micromatch';
import * as parseignore from 'parse-gitignore';

export class SvnFileSystemListener {
    /**
     * Creates an instance of SvnFileSystemListener.
     * @param {SvnSourceControl} svnSourceControl 
     * @memberof SvnFileSystemListener
     */
    constructor(svnSourceControl) {
        this.svnSourceControl = svnSourceControl;

        const disposables = [];
        window.onDidChangeActiveTextEditor(this._onActiveEditorChanged, this, disposables);

        this._disposable = null;
        this._watcher = null;
        this._svnignore = [];

        this._watcher = workspace.createFileSystemWatcher('**/*');
        this._watcher.onDidCreate(this.handleFileCreated, this, disposables);
        this._watcher.onDidDelete(this.handleFileDeleted, this, disposables);
        this._watcher.onDidChange(this.handleFileChanged, this, disposables);

        this._svnignore = [];

        // const svnIgnoreFileName = process.env.P4IGNORE ? process.env.P4IGNORE : '.svnignore';
        // workspace.findFiles(svnIgnoreFileName, null, 1).then((result) => {
        //     if (result && result.length > 0) {
        //         this._svnignore = parseignore(result[0].fsPath);
        //     }
        // });

        this._disposable = Disposable.from.apply(this, disposables);
    }

    _onActiveEditorChanged(e) {
        if (e) {
            // this.svnSourceControl.refreshView();
        }
    }

    handleFileDeleted(uri) {
        window.showInformationMessage(`Would you like to remove from SVN?`, {
            modal: true
        }, 'Yes').then(value => {
            if (value == 'Yes') {
                this.svnSourceControl.handleDeleteCommand([uri]);
            }
        })

        return;

        // let docPath = uri.fsPath;

        // const fileExcludes = Object.keys(workspace.getConfiguration('files').exclude);
        // const ignoredPatterns = this._svnignore.concat(fileExcludes);

        // const shouldIgnore = micromatch.any(docPath, ignoredPatterns, { dot: true });

        // // Only `svn delete` files that are not marked as ignored either in:
        // // .svnignore
        // // files.exclude setting
        // if (!shouldIgnore) {
        //     SvnCommands.svnDelete(docPath);
        // }
    }

    handleFileChanged(uri) {
        this.svnSourceControl.refreshView();
        return;

        let docPath = uri.fsPath;

        const fileExcludes = Object.keys(workspace.getConfiguration('files').exclude);
        const ignoredPatterns = this._svnignore.concat(fileExcludes);

        const shouldIgnore = micromatch.any(docPath, ignoredPatterns, { dot: true });

        // Only `svn delete` files that are not marked as ignored either in:
        // .svnignore
        // files.exclude setting
        if (!shouldIgnore) {
            SvnCommands.svnDelete(docPath);
        }
    }

    handleFileCreated(uri) {
        this.svnSourceControl.refreshView();
        return;

        //Only try to add files open in the editor
        var editor = window.activeTextEditor;
        if (editor && editor.document && editor.document.uri.fsPath == uri.fsPath) {
            function add() {
                this.svnScmCommands.add();
            }
            if (!workspace.getConfiguration('svn').get('addOnFileCreated')) {
                window.showInformationMessage(`Add ${uri.fsPath} to SVN?`, 'Always', 'Yes').then(response => {
                    switch (response) {
                        case 'Always':
                            workspace.getConfiguration('svn').update('addOnFileCreated', true);
                            add();
                            break;

                        case 'Yes':
                            add();
                            break;
                    }
                })
            } else {
                add();
            }
        }
    }

    dispose() {
        this._disposable.dispose();
    }
}
