import { workspace, Uri } from 'vscode';
import path from 'path';

export class Resource {

    constructor(relativePath, status, decorations) {
        this.uri = Uri.file(path.join(workspace.rootPath, relativePath));
        this.status = status;
        this.decorations = decorations;
    }

    get resourceUri() {
        return this.uri;
    }

    get command() {
        return {
            title: 'Open',
            command: 'svn.openChanges',
            arguments: [this]
        };
    }
}