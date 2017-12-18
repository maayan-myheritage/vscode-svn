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

    updatePath(paths) {
        paths = flattenPaths(paths);
        return this.svnCommandLineService.execute('update', `${paths}`);
    }

    updateChangelist(changelist) {
        return this.svnCommandLineService.execute('update', `--changelist ${changelist}`);
    }

    updateWorkingCopy() {
        return this.svnCommandLineService.execute('update');
    }

    commit(paths, message) {
        paths = flattenPaths(paths);
        return this.svnCommandLineService.execute('commit', `${paths} -m "${message}"`);
    }

    commitChangelist(changelist, message) {
        return this.svnCommandLineService.execute('commit', `--changelist "${changelist}" -m ${message}`);
    }

    addPath(paths) {
        paths = flattenPaths(paths);
        return this.svnCommandLineService.execute('add', `${paths}`)
    }

    deletePath(paths) {
        paths = flattenPaths(paths);
        return this.svnCommandLineService.execute('delete', `${paths}`)
    }

    revertPath(paths) {
        paths = flattenPaths(paths);
        return this.svnCommandLineService.execute('revert', `${paths} --depth infinity`);
    }

    revertChangelist(changelist) {
        return this.svnCommandLineService.execute('revert', `--recursive --changelist "${changelist}" .`);
    }

    revertWorkingCopy() {
        return this.svnCommandLineService.execute('revert', `. --depth infinity`)
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

    moveToChangelist(paths, changelist) {
        paths = flattenPaths(paths);
        return this.svnCommandLineService.execute('changelist', `${changelist} ${paths}`);
    }

    info() {
        return this.svnCommandLineService.execute('info');
    }

    status() {
        return this.svnCommandLineService.execute('status');
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

function flattenPaths(paths) {
    if (paths instanceof Array) {
        return paths.map(path => `"${path}"`).join(' ');
    }

    return paths;
}