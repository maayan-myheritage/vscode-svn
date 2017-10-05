import { Uri } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SvnCommandLineService } from './SvnCommandLineService';

export class SvnScmCommands {
    /**
     * Creates an instance of SvnScmCommands.
     * @param {SvnCommandLineService} svnCommandLineService
     * @memberof SvnScmCommands
     */
    constructor(svnCommandLineService) {
        this.svnCommandLineService = svnCommandLineService;
    }

    updatePath(path) {
        return this.svnCommandLineService.execute('update', `${path}`);
    }

    updateChangelist(changelist) {
        return this.svnCommandLineService.execute('update', `--changelist ${changelist}`);
    }

    updateWorkingCopy() {
        return this.svnCommandLineService.execute('update');
    }

    commit(path, message) {
        return this.svnCommandLineService.execute('commit', `${path} -m "${message}"`);
    }

    commitChangelist(changelist, message) {
        return this.svnCommandLineService.execute('commit', `--changelist "${changelist}" -m ${message}`);
    }

    addPath(path) {
        return this.svnCommandLineService.execute('add', `"${path}"`)
    }

    revertPath(path) {
        if (fs.lstatSync(path).isDirectory()) {
            return this.svnCommandLineService.execute('revert', `"${path}" --depth infinity`);
        } else {
            return this.svnCommandLineService.execute('revert', `"${path}"`);
        }
    }

    revertChangelist(changelist) {
        return this.svnCommandLineService.execute('revert', `--recursive --changelist "${changelist}" .`);
    }

    deleteChangelist(changelist) {
        return this.svnCommandLineService.execute('changelist', `--remove --recursive --changelist "${changelist}" .`);
    }

    getPathRevisions(path) {
        return new Promise((resolve, reject) => {
            this.svnCommandLineService.execute('log', `"${path}"`)
                .then((output) => {
                    let revisionMatches = output.match(/-{3}\nr\d+.*\n\n.*/g),
                        revisionsData = [];
                    if (revisionMatches) {
                        revisionMatches.forEach((revisionMatch) => {
                            let [, revisionNumber, comment] = revisionMatch.match(/r(\d+).*?\n\n(.*)/),
                                label = `#${revisionNumber} ${comment}`;
                            revisionsData.push({ revisionNumber, comment, label })
                        })
                    }

                    resolve(revisionsData);
                })
                .catch(error => reject(error));
        })
    }

    moveToChangelist(path, changelist) {
        return this.svnCommandLineService.execute('changelist', `${changelist} "${path}"`);
    }

    info() {
        return this.svnCommandLineService.execute('info');
    }

    getRepositoryName() {
        return new Promise((resolve, reject) => {
            this.svnCommandLineService.execute('info')
            .then(output => {
                let matches = /Repository Root: ([^\n]+)/g.exec(output);
                if (matches.length > 1) {
                    resolve(matches[1].split('/').pop());
                } else {
                    reject()
                }
            })
            .catch(error => reject(error))
        })
    }

    getFileOutput(filePath, revision) {
        let svnCommandLineService = this.svnCommandLineService;
        return new Promise((resolve, reject) => {
            let tmpFilePath = require("tmp").tmpNameSync({ postfix: path.extname(filePath) });

            let args = `"${filePath}"`;

            if (revision == 'HEAD' || Number.isInteger(revision)) {
                args += ` -r ${revision}`;
            }

            // forward all output to the file
            args += ' > "' + tmpFilePath + '"';

            return svnCommandLineService.execute('cat', args)
                .then(() => {
                    resolve(Uri.file(tmpFilePath));
                })
                .catch((error) => {
                    reject(error);
                })
        })
    }
}