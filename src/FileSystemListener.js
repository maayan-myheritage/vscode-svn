import {
    window,
    workspace,
    Disposable
} from 'vscode';

import * as micromatch from 'micromatch';
import * as parseignore from 'parse-gitignore';

import * as Display from './Display';
import * as SvnCommands from './SvnCommands';
import * as SvnService from './SvnService';
import { SvnScmProvider } from './SvnScmProvider';

export class FileSystemListener {
    constructor() {
        const subscriptions = [];
        window.onDidChangeActiveTextEditor(Display.updateEditor, this, subscriptions);

        this._disposable = null;
        this._watcher = null;
        this._svnignore = [];

        var config = workspace.getConfiguration('svn');

        if (config && SvnCommands.checkFolderOpened()) {

            this._watcher = workspace.createFileSystemWatcher('**/*');

            if (config['addOnFileCreate'] || config['deleteOnFileDelete']) {
                

                if (config['addOnFileCreate']) {
                    this._watcher.onDidCreate(this.onFileCreated, this, subscriptions);
                }

                if (config['deleteOnFileDelete']) {
                    this._watcher.onDidDelete(this.onFileDeleted, this, subscriptions);
                }

                
            }

            this._watcher.onDidChange(this.onFileChanged, this, subscriptions);
        }

        this._svnignore = [];

        // const svnIgnoreFileName = process.env.P4IGNORE ? process.env.P4IGNORE : '.svnignore';
        // workspace.findFiles(svnIgnoreFileName, null, 1).then((result) => {
        //     if (result && result.length > 0) {
        //         this._svnignore = parseignore(result[0].fsPath);
        //     }
        // });

        this._disposable = Disposable.from.apply(this, subscriptions);
    }

    dispose() {
        this._disposable.dispose();
    }

    onFileDeleted(uri) {
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

    onFileChanged(uri) {
        let docPath = uri.fsPath;

        SvnScmProvider.Refresh();
        return;


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

    onFileCreated(uri) {
        //Only try to add files open in the editor
        var editor = window.activeTextEditor;
        if (editor && editor.document && editor.document.uri.fsPath == uri.fsPath) {
            SvnCommands.add(uri.fsPath);
        }
    }

    fileInClientRoot(docPath) {
        return new Promise((resolve, reject) => {
            SvnService.getClientRoot().then((clientRoot) => {
                //Convert to lower and Strip newlines from paths
                clientRoot = clientRoot.toLowerCase().replace(/(\r\n|\n|\r)/gm, "");
                var filePath = docPath.toLowerCase().replace(/(\r\n|\n|\r)/gm, "");

                //Check if svn Client Root is in uri's path
                if (filePath.indexOf(clientRoot) !== -1) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            }).catch((err) => {
                reject(err);
            });
        });
    }

    fileIsOpened(filePath) {
        return new Promise((resolve, reject) => {
            //opened stdout is set if file open, stderr set if not opened
            SvnService.executeAsPromise('status', filePath).then((stdout) => {
                resolve(true);
            }).catch((stderr) => {
                resolve(false);
            });
        });
    }
}
