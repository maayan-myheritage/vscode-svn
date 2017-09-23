import * as Path from 'path';
import * as vscode from 'vscode';
import { scm, Uri, EventEmitter, ProgressLocation, window, workspace, commands } from 'vscode';

import * as Utils from '../Utils';
import * as Display from '../Display';
import * as SvnService from './../SvnService';

import { Resource } from './Resource';
import { Status } from './Status';

function isResourceGroup(arg) {
    return arg.id !== undefined;
}



export class Model {

    get onDidChange() {
        return this._onDidChange.event;
    }

    dispose() {
        if (this._disposables) {
            this._disposables.forEach(d => d.dispose());
            this._disposables = [];
        }
    }

    get ResourceGroups() {
        const result = [];

        if (this._defaultGroup)
            result.push(this._defaultGroup);

        if (this._unversionedGroup)
            result.push(this._unversionedGroup);

        this._pendingGroups.forEach((value) => {
            result.push(value.group);
        });

        return result;
    }

    constructor() {

        this._disposables = [];
        this._onDidChange = new EventEmitter();
        this._sourceControl;
        this._infos = new Map();
        this._defaultGroup;
        this._unversionedGroup;
        this._pendingGroups = new Map();
    }

    async Sync() {
        const loggedin = await Utils.isLoggedIn();
        if (!loggedin) {
            return;
        }

        window.withProgress({
            location: ProgressLocation.SourceControl,
            title: 'Syncing...'
        }, () => this.syncUpdate());
    }

    async Refresh() {
        this.clean();
        const loggedin = await Utils.isLoggedIn();
        if (!loggedin) {
            return;
        }

        await window.withProgress({
            location: ProgressLocation.SourceControl,
            title: 'Updating info...'
        }, () => this.updateInfo());
        window.withProgress({
            location: ProgressLocation.SourceControl,
            title: 'Updating status...'
        }, () => this.updateStatus());
    }

    async SaveToChangelist(descStr, existingChangelist) {
        const args = `-o ${existingChangelist ? existingChangelist : ''}`;

        const spec = await Utils.getOutput('change', null, null, args);
        const changeFields = spec.trim().split(/\n\r?\n/);
        let newSpec = '';
        for (let field of changeFields) {
            if (field.startsWith('Description:')) {
                newSpec += 'Description:\n\t';
                newSpec += descStr.trim().split('\n').join('\n\t');
                newSpec += '\n\n';
            } else {
                newSpec += field;
                newSpec += '\n\n';
            }
        }

        let newChangelistNumber;
        try {
            const createdStr = await Utils.getOutput('change', null, null, '-i', null, newSpec);
            // Change #### created with ... 
            // newChangelistNumber = createdStr.match(/Change\s(\d+)\screated with/);
            Display.channel.append(createdStr);
            this.Refresh();
        } catch (err) {
            Display.showError(err.toString());
        }
    }

    async ProcessChangelist() {
        const input = scm.inputBox.value;
        scm.inputBox.value = '';
        let description = input;

        let existingChangelist = '';
        const matches = input.match(/^#(\d+)\r?\n([^]+)/);
        if (matches) {
            existingChangelist = matches[1];
            description = matches[2];
        }

        this.SaveToChangelist(description, existingChangelist);
    }

    async SubmitDefault() {
        const loggedin = await Utils.isLoggedIn();
        if (!loggedin) {
            return;
        }

        const noFiles = 'File(s) not opened on this client.';
        let fileListStr;
        try {
            fileListStr = await Utils.getOutput('opened', null, null, '-c default');
            if (fileListStr === noFiles) {
                Display.showError(noFiles);
                return;
            }
        } catch (err) {
            Display.showError(err.toString());
            return;
        }

        const fileList = fileListStr.split("\n").map(file => {
            const endOfFileStr = file.indexOf('#');
            return file.substring(0, endOfFileStr);
        });

        const descStr = await vscode.window.showInputBox({
            placeHolder: 'New changelist description',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Cannot set empty description';
                }
                return null;
            },
            ignoreFocusOut: true
        });

        if (descStr === undefined || descStr.trim().length == 0) {
            // pressing enter with no other input will still submit the empty string
            Display.showError('Cannot set empty description');
            return;
        }

        const pick = await vscode.window.showQuickPick(["Commit", "Save Changelist", "Cancel"], { ignoreFocusOut: true });

        if (!pick || pick == "Cancel") {
            return;
        }

        if (pick === "Commit") {
            this.Submit(descStr);
            return;
        }

        this.SaveToChangelist(descStr);
    }


    async Submit(input) {
        const command = 'commit';
        let args = '';

        if (typeof input === 'string') {
            args = `-d "${input}"`;
        } else {
            const group = input;
            const id = group.id;
            if (id) {
                const chnum = id.substr(id.indexOf(':') + 1);
                if (id.startsWith('pending')) {
                    args = '-c ' + chnum;
                } else if (id.startsWith('shelved')) {
                    args = '-e ' + chnum;
                } else {
                    return;
                }
            } else {
                return;
            }
        }


        Utils.getOutput(command, null, null, args).then((output) => {
            Display.channel.append(output);
            Display.showMessage("Changelist commited");
            this.Refresh();
        }).catch((reason) => {
            Display.showError(reason.toString());
        });
    }

    async Revert(input) {
        const command = 'revert';
        let file = null;
        let args = null;
        let needRefresh = false;

        let message = "Are you sure you want to revert the changes ";
        if (input instanceof Resource) {
            file = Uri.file(input.uri.fsPath);
            message += "to file " + Path.basename(input.uri.fsPath) + "?";
        } else if (isResourceGroup(input)) {
            const id = input.id;
            if (id.startsWith('default')) {
                args = '-c default //...';
                message += "in the default changelist?";
            } else if (id.startsWith('pending')) {
                const chnum = id.substr(id.indexOf(':') + 1);
                args = '-c ' + chnum + ' //...';
                message += "in the changelist " + chnum + "?";
            } else {
                return;
            }
        } else {
            return;
        }

        const yes = "Revert Changes";
        const pick = await window.showWarningMessage(message, { modal: true }, yes);
        if (pick !== yes) {
            return;
        }

        await Utils.getOutput(command, file, null, args).then((output) => {
            Display.updateEditor();
            Display.channel.append(output);
            needRefresh = true;
        }).catch((reason) => {
            Display.showError(reason.toString());
        });

        // delete changelist after
        if (isResourceGroup(input)) {
            const command = 'change';
            const id = input.id;
            const chnum = id.substr(id.indexOf(':') + 1);
            if (id.startsWith('pending')) {
                args = '-d ' + chnum;

                await Utils.getOutput(command, null, null, args).then((output) => {
                    Display.updateEditor();
                    Display.channel.append(output);
                    needRefresh = true;
                }).catch((reason) => {
                    Display.showError(reason.toString());
                });
            }
        }

        if (needRefresh) {
            this.Refresh();
        }
    }

    async ShelveOrUnshelve(input) {
        const file = input.uri;

        if (input.status == Status.SHELVE) {
            let args = '-c ' + input.change + ' -s ' + input.change;
            const command = 'unshelve';
            await Utils.getOutput(command, file, null, args).then((output) => {
                let args = '-d -c ' + input.change;
                const command = 'shelve';
                Utils.getOutput('shelve', file, null, args).then((output) => {
                    Display.updateEditor();
                    Display.channel.append(output);

                    this.Refresh();
                }).catch((reason) => {
                    Display.showError(reason.toString());

                    this.Refresh();
                });
            }).catch((reason) => {
                Display.showError(reason.toString());
            });
        }
        else {
            let args = '-f -c ' + input.change;
            const command = 'shelve';
            await Utils.getOutput(command, file, null, args).then((output) => {
                this.Revert(input);
            }).catch((reason) => {
                Display.showError(reason.toString());
            });
        }
    }

    async ReopenFile(input) {
        const loggedin = await Utils.isLoggedIn();
        if (!loggedin) {
            return;
        }

        //TODO: remove the file current changelist
        let items = [];
        items.push({ id: 'default', label: this._defaultGroup.label, description: '' });
        this._pendingGroups.forEach((value, key) => {
            items.push({ id: key.toString(), label: '#' + key.toString(), description: value.description });
        });

        let _this = this;
        window.showQuickPick(items, { matchOnDescription: true, placeHolder: "Choose a changelist:" }).then(function (selection) {
            if (selection == undefined) {
                Display.showMessage("operation cancelled");
                return;
            }

            const file = Uri.file(input.uri.fsPath);
            const args = selection.id == 'default' ? '--remove' : selection.id;

            Utils.getOutput('changelist', file, null, args).then((output) => {
                Display.channel.append(output);
                _this.Refresh();
            }).catch((reason) => {
                Display.showError(reason.toString());
            });
        });

    }

    clean() {
        if (this._defaultGroup) {
            this._defaultGroup.dispose();
            this._defaultGroup = null;
        }

        if (this._unversionedGroup) {
            this._unversionedGroup.dispose();
            this._unversionedGroup = null;
        }

        this._pendingGroups.forEach((value) => value.group.dispose());
        this._pendingGroups.clear();

        this._onDidChange.fire();
    }

    async syncUpdate() {
        const config = SvnService.getConfig();
        const pathToSync = config.svnDir ? config.svnDir + '...' : null;

        await Utils.getOutput('update', pathToSync, null).then(output => {
            Display.channel.append(output);
            this.Refresh();
        }).catch(reason => {
            Display.showError(reason.toString());
        })
    }

    async updateInfo() {
        this._infos = await Utils.processInfo(await Utils.getOutput('info', null, null));
    }

    async updateStatus() {
        const loggedin = await Utils.isLoggedIn();
        if (!loggedin) {
            return;
        }

        this._defaultGroup = this._sourceControl.createResourceGroup('default', 'Default');        
        this._defaultGroup.resourceStates = [];

        this._unversionedGroup = this._sourceControl.createResourceGroup('unversioned', 'Unversioned Files');
        this._unversionedGroup.resourceStates = [];

        this._pendingGroups.clear();

        let output = await Utils.getOutput('status');
        let statusOutput = output.trim().split('\n');

        let currentGroup = this._defaultGroup;
        statusOutput.forEach((value) => {
            let changeListMatches = value.match(/--- Changelist '(.*?)':/);
            if (changeListMatches && changeListMatches.length > 1) {
                let changelistName = changeListMatches[1];
                if (!this._pendingGroups.has(changelistName)) {
                    const group = this._sourceControl.createResourceGroup('pending:' + changelistName, changelistName);
                    group.resourceStates = [];
                    this._pendingGroups.set(changelistName, { description: changelistName, group: group });
                    currentGroup = group;
                } else {
                    console.log('ERROR: pending changelist already exist: ' + changelistName);
                }
            } else {
                let fileChangesMatches = value.match(/([ ACDIMRX\?!~])\s*([^\n]*)/);
                if (fileChangesMatches && fileChangesMatches.length > 1) {
                    let uri = Uri.file(fileChangesMatches[2]),
                        status = fileChangesMatches[1]

                    const resource = new Resource(uri, status);

                    if (status == '?') {
                        this._unversionedGroup.resourceStates = this._unversionedGroup.resourceStates.concat([
                            resource
                        ]);
                    } else {
                        currentGroup.resourceStates = currentGroup.resourceStates.concat([
                            resource
                        ]);
                    }

                    
                    // currentGroup.resourceStates.push(resource);
                }
            }
        });

        this._onDidChange.fire();
    }
}