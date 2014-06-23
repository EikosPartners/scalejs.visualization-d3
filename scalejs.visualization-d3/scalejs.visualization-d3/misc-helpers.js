/*global define*/
define([

], function () {
    "use strict";

    // Attempts to find a node when given a path
    // 1. If the Path is found, it returns the node
    // 2. If the Path does not exist, it returns undefined
    // 3. If the Path has a length of 0, it returns the root node
    // 4. If the Path is not an array, it returns undefined
    function getNode(path, root) {
        var curNode = root;
        if (path instanceof Array) {
            for (var i = 0; i < path.length; i += 1) {
                if (curNode.childrenReference[path[i]] === undefined) {
                    return;
                }
                curNode = curNode.childrenReference[path[i]];
            }
            return curNode;
        }
        return;
    }

    return {
        getNode: getNode
    };
});