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
        var curNode = root,
            i;
        if (path instanceof Array) {
            for (i = 0; i < path.length; i += 1) {
                if (curNode.childrenReference[path[i]] === undefined) {
                    return;
                }
                curNode = curNode.childrenReference[path[i]];
            }
            return curNode;
        }
        return;
    }

    function getDistanceToTreePath(node, treePath) {
        var distance = 0;
        while (treePath.indexOf(node) < 0) {
            distance += 1;
            node = node.parent;
        }
        return distance;
    }

    // Creates an array of nodes up to but not including root
    function getNodeTreePath(node) {
        var path = [];
        while (node.parent !== undefined) {
            path.push(node);
            node = node.parent;
        }
        path.push(node);
        return path;
    }

    // Creates an array of nodes from node to root
    function createNodePath(node) {
        var path = [],
            tmpNode = node;
        // Set selectedItemPath:
        while (tmpNode.parent !== undefined) {
            path.unshift(tmpNode.index);
            tmpNode = tmpNode.parent;
        }
        return path;
    }

    return {
        getNode: getNode,
        getDistanceToTreePath: getDistanceToTreePath,
        getNodeTreePath: getNodeTreePath,
        createNodePath: createNodePath
    };
});