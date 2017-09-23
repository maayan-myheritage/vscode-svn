import { workspace, Uri } from 'vscode';
import { DecorationProvider } from './DecorationProvider';
import path from 'path';
export class Resource {

    constructor(uri, status) {
        this.uri = createResourceUri(uri.fsPath);
        this.status = status;
    }

    get resourceUri() {
        return this.uri;
    }

    get command() {
        const command = workspace.getConfiguration('svn')
            .get('scmFileChanges') ?
            'svn.openResource' :
            'svn.openFile';

        return {
            title: 'Open',
            command,
            arguments: [this]
        };
    }

    get decorations() {
        return DecorationProvider.getDecorations(this.status);
    }
}

function createResourceUri(relativePath) {
    const absolutePath = path.join(workspace.rootPath, relativePath);
    return Uri.file(absolutePath);
  }