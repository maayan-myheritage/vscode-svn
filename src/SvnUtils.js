export const DEFAULT_RESOURCE_GROUP = 'default';
export const UNVERSIONED_RESOURCE_GROUP = 'unversioned';

export class SvnUtils {
    static parseFilesOutput(output) {
        let statusOutput = output.trim().split('\n'),
            files = [];
    
        let currentGroup = DEFAULT_RESOURCE_GROUP;
        statusOutput.forEach((value) => {
            let changeListMatches = value.match(/--- Changelist '(.*?)':/);
            if (changeListMatches && changeListMatches.length > 1) {
                let changelistName = changeListMatches[1];
                currentGroup = changelistName;
            } else {
                let matches = value.match(/([ ACDIMRX\?!~])\s*([^\n]*)/);
                if (matches && matches.length > 1) {
                    let [, status, file] = matches,
                        group = status === '?' ? UNVERSIONED_RESOURCE_GROUP : currentGroup;
    
                    files.push({ file, status, group })
                }
            }
        });
    
        return files;
    }
}