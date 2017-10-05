import { workspace } from 'vscode';
import { SvnCommandLineService } from './SvnCommandLineService';

export class SvnTextContentProvider {

    /**
     * Creates an instance of SvnContentProvider.
     * @param {SvnCommandLineService} svnCmd 
     * @memberof SvnContentProvider
     */
    constructor(svnCmd) {
        this.svnCmd = svnCmd;
        this.disposables = [];
    }

    init() {
        this.disposables.push(
            workspace.registerTextDocumentContentProvider('svn', this)
        );
    }

    provideTextDocumentContent(uri) {
        let args = uri.fsPath;

        if (uri.fragment) {
            args += ` -r ${uri.fragment}`;
        }

        return this.svnCmd.execute('cat', args).catch(error => '');
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}