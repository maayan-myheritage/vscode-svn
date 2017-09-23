export function GetStatuses(statusText) {
    let result = [];
    if (!statusText) {
        return result;
    }

    const statusStrings = statusText.split(" = '';");
    for (let i = 0; i < statusStrings.length; i++) {
        switch (statusStrings[i].trim().toLowerCase()) {
            case "add": result.push(Status.ADD); break;
            case "archive": result.push(Status.ARCHIVE); break;
            case "branch": result.push(Status.BRANCH); break;
            case "delete": result.push(Status.DELETE); break;
            case "edit": result.push(Status.EDIT); break;
            case "integrate": result.push(Status.INTEGRATE); break;
            case "import": result.push(Status.IMPORT); break;
            case "lock": result.push(Status.LOCK); break;
            case "move/add": result.push(Status.MOVE_ADD); break;
            case "move/delete": result.push(Status.MOVE_DELETE); break;
            case "purge": result.push(Status.PURGE); break;
            case "shelve": result.push(Status.SHELVE); break;
            default:
                result.push(Status.UNKNOWN); break;
        }
    }

    return result;
}

export const Status = {
    ADD: 'ADD',
    ARCHIVE: 'ARCHIVE',
    BRANCH: 'BRANCH',
    DELETE: 'DELETE',
    INTEGRATE: ' INTEGRATE',
    IMPORT: 'IMPORT',
    LOCK: 'LOCK',
    MOVE_ADDADD: 'MOVE_ADD',
    MOVE_DELETE: 'MOVE_DELETE',
    PURGE: 'PURGE',
    SHELVE: 'SHELVE',
    UNKNOWN: 'UNKNOWN'
};

/*
' ' no modifications
      'A' Added
      'C' Conflicted
      'D' Deleted
      'I' Ignored
      'M' Modified
      'R' Replaced
      'X' an unversioned directory created by an externals definition
      '?' item is not under version control
      '!' item is missing (removed by non-svn command) or incomplete
      '~' versioned item obstructed by some item of a different kind
      */