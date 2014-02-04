/*global define*/
define([
    'knockout',
    'd3',
    'd3.colorbrewer'
], function (
    ko,
    d3,
    colorbrewer
) {
    "use strict";
    var //imports
        unwrap = ko.utils.unwrapObservable,
        isObservable = ko.isObservable;

    function init(
        element,
        valueAccessor
    ) {
        var //Treemap variables
            svgElement = element,
            treemap = valueAccessor(),
            json,
            dataSource,
            levelsSource,
            levels,
            childrenPath,
            areaPath,
            colorPath,
            colorPalette,
            colorScale,
            selectedItemPath,
            selectedItemPathObservable,
            w = parseInt(d3.select(svgElement).style("width"), 10),
            h = parseInt(d3.select(svgElement).style("height"), 10),
            x = d3.scale.linear().range([0, w]),
            y = d3.scale.linear().range([0, h]),
            root,
            nodeSelected,
            treemapLayout,
            svgArea,
            domData;

        // Loop through levels to determine parameters:
        function createLevelParameters(lvlsParam) {
            // Set colorPalette parameters:
            colorScale = d3.scale.linear();
            switch (Object.prototype.toString.call(unwrap(colorPalette))) {
            case '[object Array]':
                //colorPalette is an array:
                colorScale.range(unwrap(colorPalette));
                break;
            case '[object String]':
                // Check if colorPalette is a predefined colorbrewer array:
                if (colorbrewer[unwrap(colorPalette)] !== undefined) {
                    // Use specified colorbrewer palette:
                    colorScale.range(colorbrewer[unwrap(colorPalette)][3]);
                    break;
                }
                // Use default palette:
                colorScale.range(colorbrewer.PuBu[3]);
                break;
            default:
                // Use default palette:
                colorScale.range(colorbrewer.PuBu[3]);
                break;
            }

            // Clear levels:
            levels = [];

            // Unwrap levels:
            var lvls = unwrap(lvlsParam),
                i;

            // Loop through all levels and parse the parameters:
            for (i = 0; i < lvls.length; i += 1) {
                if (typeof lvls[i] === 'string') {
                    levels[i] = {   // Level just defines the childrenPath, use global parameters for the rest:
                        childrenPath: unwrap(lvls[i]),
                        areaPath: unwrap(areaPath),
                        colorPath: unwrap(colorPath),
                        colorPalette: unwrap(colorPalette),
                        colorScale: colorScale
                    };
                } else {
                    // Level has parameters:
                    levels[i] = {   // Use global parameters for parameters not defined:
                        childrenPath: unwrap(lvls[i].childrenPath || childrenPath),
                        areaPath: unwrap(lvls[i].areaPath || areaPath),
                        colorPath: unwrap(lvls[i].colorPath || colorPath)
                    };
                    if (lvls[i].colorPalette === undefined) {
                        // Use global colorScale and Palette for this Level:
                        levels[i].colorPalette = colorPalette;
                        levels[i].colorScale = colorScale;
                    } else {
                        // Create colorScale and Palette for this Level:
                        levels[i].colorPalette = unwrap(lvls[i].colorPalette);
                        levels[i].colorScale = d3.scale.linear();
                        switch (Object.prototype.toString.call(levels[i].colorPalette)) {
                        case '[object Array]':
                            //colorPalette is an array:
                            levels[i].colorScale.range(levels[i].colorPalette);
                            break;
                        case '[object String]':
                            // Check if colorPalette is a predefined colorbrewer array:
                            if (colorbrewer[levels[i].colorPalette] !== undefined) {
                                // Use specified colorbrewer palette:
                                levels[i].colorScale.range(colorbrewer[levels[i].colorPalette][3]);
                                break;
                            }
                            // Use default palette:
                            levels[i].colorPalette = colorPalette;
                            levels[i].colorScale = colorScale;
                            break;
                        default:
                            // Use default palette:
                            levels[i].colorPalette = colorPalette;
                            levels[i].colorScale = colorScale;
                            break;
                        }
                    }
                }
            }
        }
        // Recursively traverse json, and build it for rendering:
        function createTreemapJson(dat, lvls) {
            var node = unwrap(dat);
            if (lvls.length === 0) {
                return {    // Out of defined levels, so use global parameters for node:
                    name: unwrap(node.name) || '',
                    size: unwrap(node[unwrap(areaPath)] || 1),
                    color: unwrap(node[unwrap(colorPath)] || 0)
                };
            }
            if (node[lvls[0].childrenPath] === undefined) {
                return {    // Use current level parameters for node:
                    name: unwrap(node.name) || '',
                    size: unwrap(node[lvls[0].areaPath] || 1),
                    color: unwrap(node[lvls[0].colorPath] || 0)
                };
            }
            // Node has children, so set them up first:
            return unwrap(node[lvls[0].childrenPath]).reduce(function (acc, level, index) {
                // 
                var stepSize;
                node = createTreemapJson(level, lvls.slice(1)); // Get basic node-specific properties
                node.parent = acc;  // Set node's parent
                node.index = index; // Set node's index to match the index it appears in the original dataset.
                acc.size += node.size;  // Update the parent's overall size.

                // Update min and max size values:
                acc.color = unwrap(node[lvls[0].colorPath] || 0);
                if (acc.children.length === 0) {
                    // Insure min and max values are different if there is only one child:
                    acc.minSize = node.size;
                    acc.maxSize = node.size + 1;
                    acc.minColor = node.color;
                    acc.maxColor = node.color + 1;
                } else {
                    acc.minSize = Math.min(acc.minSize, node.size);
                    acc.maxSize = Math.max(acc.maxSize, node.size);
                    acc.minColor = Math.min(acc.minColor, node.color);
                    acc.maxColor = Math.max(acc.maxColor, node.color);
                }

                // Set parent node's colorScale range (Palette):
                if (lvls.length === 1) {    // Set to global Palette:
                    acc.colorScale.range(colorScale.range());
                } else { // Set to node's Level color Palette:
                    acc.colorScale.range(lvls[1].colorScale.range());
                }
                // Set domain of color values:
                stepSize = (acc.maxColor - acc.minColor) / Math.max(acc.colorScale.range().length - 1, 1);
                acc.colorScale.domain(d3.range(acc.minColor, acc.maxColor + stepSize, stepSize));

                // Add node to parent's children and childrenReference arrays:
                acc.children[index] = node;
                // d3 reorganizes the children later in the code, so the following array is used to preserve children order for indexing:
                acc.childrenReference[index] = node;
                return acc;
            }, {    // Set default properties of node with children:
                name: node.name || '',
                children: [],
                childrenReference: [],
                size: 0,
                color: 0,
                colorScale: d3.scale.linear(),
                minSize: 0,
                maxSize: 1,
                minColor: 0,
                maxColor: 1
            });
        }
        json = ko.computed(function () {
            dataSource = treemap.data || { name: "Empty" };
            levelsSource = treemap.levels || [{ }];
            childrenPath = treemap.childrenPath || 'children';
            areaPath = treemap.areaPath || 'area';
            colorPath = treemap.colorPath || 'color';
            colorPalette = treemap.colorPalette || 'PuBu';
            createLevelParameters(levelsSource);
            root = createTreemapJson(dataSource, levels);
            return root;
        });
        selectedItemPathObservable = ko.computed(function () {
            selectedItemPath = treemap.selectedItemPath || ko.observable([]);
            return unwrap(selectedItemPath);
        });

        // Zoom animation:
        function zoom(d) {
            if (svgArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            // Set zoom domain to d's area:
            var kx = w / d.dx, ky = h / d.dy, t;
            x.domain([d.x, d.x + d.dx]);
            y.domain([d.y, d.y + d.dy]);

            // Animate treemap nodes:
            t = svgArea.selectAll("g.cell").transition()
                .duration(d3.event ? (d3.event.altKey ? 7500 : 1000) : 1000)
                .attr("transform", function (d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });

            t.select("rect")
                .attr("width", function (d) { return Math.max(kx * d.dx - 1, 0); })
                .attr("height", function (d) { return Math.max(ky * d.dy - 1, 0); });

            t.select("text")
                .attr("x", function (d) { return kx * d.dx / 2; })
                .attr("y", function (d) { return ky * d.dy / 2; })
                .style("opacity", function (d) { return kx * d.dx > d.w ? 1 : 0; });

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }
        // Zoom after click, and set the path:
        function selectZoom(d) {
            var path = [],
                dTmp,
                oldSelected = nodeSelected;

            if (d === oldSelected) {    // Reset path since item was already selected.
                d = root;
            }

            nodeSelected = dTmp = d;
            // Check if selectedItemPath is an observable:
            if (isObservable(selectedItemPath)) {   // Path is an observable, so set path to the selected item:
                while (dTmp.parent !== undefined) {
                    path.unshift(dTmp.index);
                    dTmp = dTmp.parent;
                }
                selectedItemPath(path);
            } else {    // Path is not an observable, so no need to push an update to it.
                zoom(d.parent || d);
            }

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }
        // Subscribe to selectedItemPath changes from outside of the extension (and then zoom):
        selectedItemPathObservable.subscribe(function (path) {
            var d = json(), i;
            if (Object.prototype.toString.call(path) === '[object Array]') {
                for (i = 0; i < path.length; i += 1) {
                    if (d.childrenReference === undefined) {
                        d = json(); // Path doesn't exist, so reset path.
                        break;
                    }
                    if (d.childrenReference[path[i]] === undefined) {
                        d = json(); // Path doesn't exist, so reset path.
                        break;
                    }
                    d = d.childrenReference[path[i]];
                }
            }
            // Verify d exists:
            if (d) {
                nodeSelected = d;       // Set nodeSelected to d
                zoom(d.parent || d);    // Animate zoom affect to d's parent
            }
        });

        function treemapRender() {
            // Define temp vars:
            var celSel, cell, nodes;

            // Get treemap data:
            root = json();

            // Get domData from element (used to see if treemap was setup before):
            domData = ko.utils.domData.get(svgElement, 'selection');

            if (domData === undefined) {    // This is a new treemap:
                // Set selected node to the root of the treemap:
                nodeSelected = root;

                // Setup treemap and SVG:
                treemapLayout = d3.layout.treemap()
                                .round(false)
                                .size([w, h])
                                .sticky(false)
                                .mode('squarify')
                                .value(function (d) { return d.size; })
                                .children(function (d) { return d.children; });
                svgArea = d3.select(svgElement)
                          .style('overflow', 'hidden')
                          .append("g")
                            .attr("transform", "translate(.5,.5)");

                // Filter out nodes with children:
                nodes = treemapLayout.nodes(root)
                        .filter(function (d) { return !d.children; });

                // Set default selected item (do this after the data is set, and before modifying attributes):
                if (isObservable(selectedItemPath)) {
                    selectedItemPath([]);
                }

                // Join data with selection:
                celSel = svgArea.selectAll("g")
                        .data(nodes, function (d) { return d.name; });

                // Add nodes to SVG:
                cell = celSel.enter().append("svg:g")
                        .attr("class", "cell")
                        .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
                        .on("click", selectZoom);

                // Add rectangle to each node:
                cell.append("svg:rect")
                    .attr("width", function (d) { return Math.max(d.dx - 1, 0); })
                    .attr("height", function (d) { return Math.max(d.dy - 1, 0); })
                    .style("fill", function (d) { return (d.parent ? d.parent.colorScale(d.color) : colorScale(d.color)); });

                // Add title to each node:
                cell.append("svg:text")
                    .attr("x", function (d) { return d.dx / 2; })
                    .attr("y", function (d) { return d.dy / 2; })
                    .attr("dy", ".35em")
                    .attr("text-anchor", "middle")
                    .text(function (d) { return d.name; })
                    .style("opacity", function (d) { d.w = this.getComputedTextLength(); return d.dx > d.w ? 1 : 0; });

                // Set domData for SVG:
                ko.utils.domData.set(svgElement, 'selection', { });
            } else {    // This is a treemap being updated:
                // Set selected node to the root of the treemap:
                nodeSelected = root;

                // Filter out nodes with children:
                nodes = treemapLayout.nodes(root)
                        .filter(function (d) { return !d.children; });

                // Set default selected item (do this after the data is set, and before modifying attributes):
                if (isObservable(selectedItemPath)) {
                    selectedItemPath([]);
                }

                // Select all nodes in SVG, and apply data:
                celSel = svgArea.selectAll("g")
                        .data(nodes, function (d) { return d.name; });

                // Update nodes on SVG:
                cell = celSel.transition()
                    .duration(1000)
                    .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });

                // Update rectangles on SVG:
                cell.select("rect")
                    .attr("width", function (d) { return Math.max(d.dx - 1, 0); })
                    .attr("height", function (d) { return Math.max(d.dy - 1, 0); })
                    .style("fill", function (d) { return (d.parent ? d.parent.colorScale(d.color) : colorScale(d.color)); });

                // Update titles on SVG:
                cell.select("text")
                    .attr("x", function (d) { return d.dx / 2; })
                    .attr("y", function (d) { return d.dy / 2; })
                    .text(function (d) { return d.name; })
                    .style("opacity", function (d) { d.w = this.getComputedTextLength(); return d.dx > d.w ? 1 : 0; });


                // Add new nodes to SVG:
                cell = celSel.enter().append("svg:g")
                        .attr("class", "cell")
                        .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
                        .on("click", selectZoom);

                // Add rectangle to each new node on SVG:
                cell.append("svg:rect")
                    .attr("width", function (d) { return Math.max(d.dx - 1, 0); })
                    .attr("height", function (d) { return Math.max(d.dy - 1, 0); })
                    .style("fill", function (d) { return (d.parent ? d.parent.colorScale(d.color) : colorScale(d.color)); });

                // Add title to each new node on SVG:
                cell.append("svg:text")
                    .attr("x", function (d) { return d.dx / 2; })
                    .attr("y", function (d) { return d.dy / 2; })
                    .attr("dy", ".35em")
                    .attr("text-anchor", "middle")
                    .text(function (d) { return d.name; })
                    .style("opacity", function (d) { d.w = this.getComputedTextLength(); return d.dx > d.w ? 1 : 0; });

                // Remove nodes from SVG:
                cell = celSel.exit().remove();

                // Set domData for SVG:
                ko.utils.domData.set(svgElement, 'selection', { });
            }
        }
        // Subscribe to treemap data changes:
        json.subscribe(function () {
            treemapRender();    // Re-render on change
        });
        treemapRender();
    }

    // Return treemap object:
    return {
        init: init
    };
});