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
        var //Sunburst variables
            svgElement = element,
            sunburst = valueAccessor(),
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
            rootScale = d3.scale.linear(),
            svgWidth = parseInt(d3.select(svgElement).style("width"), 10),
            svgHeight = parseInt(d3.select(svgElement).style("height"), 10),
            radius = Math.min(svgWidth, svgHeight) / 2,
            x = d3.scale.linear().range([0, 2 * Math.PI]),  //d3.scale.linear().range([0, w]),
            y = d3.scale.sqrt().range([0, radius]),//d3.scale.linear().range([0, h]),
            root,
            celSel,
            nodeSelected,
            sunburstLayout,
            arc,
            svgArea,
            domData;

        // Loop through levels to determine parameters:
        function createLevelParameters(lvlsParam)
        {
            // Set colorPalette parameters:
            colorScale = d3.scale.linear();
            switch (Object.prototype.toString.call(unwrap(colorPalette)))
            {
                case '[object Array]':
                    //colorPalette is an array:
                    colorScale.range(unwrap(colorPalette));
                    break;
                case '[object String]':
                    // Check if colorPalette is a predefined colorbrewer array:
                    if (colorbrewer[unwrap(colorPalette)] !== undefined)
                    {
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
            if (typeof lvls !== 'array' || lvls.length === 0)
            {
                levels[0] = {   // Use global parameters for the level:
                    childrenPath: unwrap(childrenPath),
                    areaPath: unwrap(areaPath),
                    colorPath: unwrap(colorPath),
                    colorPalette: unwrap(colorPalette),
                    colorScale: colorScale
                };
            }
            for (i = 0; i < lvls.length; i += 1)
            {
                if (typeof lvls[i] === 'string')
                {
                    levels[i] = {   // Level just defines the childrenPath, use global parameters for the rest:
                        childrenPath: unwrap(lvls[i]),
                        areaPath: unwrap(areaPath),
                        colorPath: unwrap(colorPath),
                        colorPalette: unwrap(colorPalette),
                        colorScale: colorScale
                    };
                } else
                {
                    // Level has parameters:
                    levels[i] = {   // Use global parameters for parameters not defined:
                        childrenPath: unwrap(lvls[i].childrenPath || childrenPath),
                        areaPath: unwrap(lvls[i].areaPath || areaPath),
                        colorPath: unwrap(lvls[i].colorPath || colorPath)
                    };
                    if (lvls[i].colorPalette === undefined)
                    {
                        // Use global colorScale and Palette for this Level:
                        levels[i].colorPalette = colorPalette;
                        levels[i].colorScale = colorScale;
                    } else
                    {
                        // Create colorScale and Palette for this Level:
                        levels[i].colorPalette = unwrap(lvls[i].colorPalette);
                        levels[i].colorScale = d3.scale.linear();
                        switch (Object.prototype.toString.call(levels[i].colorPalette))
                        {
                            case '[object Array]':
                                //colorPalette is an array:
                                levels[i].colorScale.range(levels[i].colorPalette);
                                break;
                            case '[object String]':
                                // Check if colorPalette is a predefined colorbrewer array:
                                if (colorbrewer[levels[i].colorPalette] !== undefined)
                                {
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
        // Recursively traverse json data, and build it for rendering:
        function createNodeJson(dat, lvls, ind)
        {
            var node = unwrap(dat), newNode, childNode, i, children, stepSize;

            if (lvls.length === 0)
            {    // Out of defined levels, so use global parameters for node:
                return {
                    name: unwrap(node.name || ''),
                    size: unwrap(node[unwrap(areaPath)] || 1),
                    color: unwrap(node[unwrap(colorPath)] || 0)
                };
            }

            if (node[lvls[ind].childrenPath] === undefined)
            {   // Use current level parameters for node:
                return {
                    name: unwrap(node.name || ''),
                    size: unwrap(node[lvls[ind].areaPath] || 1),
                    color: unwrap(node[lvls[ind].colorPath] || 0)
                };
            }

            // Set default properties of node with children:
            newNode = {
                name: unwrap(node.name || ''),
                children: [],
                childrenReference: [],
                size: unwrap(node[lvls[ind].areaPath] || 1),
                color: unwrap(node[lvls[ind].colorPath] || 0),
                colorScale: d3.scale.linear(),
                minSize: 0,
                maxSize: 1,
                minColor: 0,
                maxColor: 1
            };

            // Node has children, so set them up first:
            children = unwrap(node[lvls[ind].childrenPath]);
            for (i = 0; i < children.length; i += 1)
            {
                childNode = createNodeJson(children[i], lvls, ind + 1);    // Get basic node-specific properties
                childNode.parent = newNode;  // Set node's parent
                childNode.index = i; // Set node's index to match the index it appears in the original dataset.

                // Update the parent's overall size:
                if (node[lvls[ind].areaPath] === undefined)
                {
                    newNode.size += childNode.size; // If parent has no size, default to adding child colors.
                }

                // Update the parent's overall color:
                if (node[lvls[ind].colorPath] === undefined)
                {
                    newNode.color += childNode.color;   // If parent has no color, default to adding child colors.
                }

                // Update min and max properties:
                if (i)
                {
                    // Update min and max values: 
                    newNode.minSize = Math.min(newNode.minSize, childNode.size);
                    newNode.maxSize = Math.max(newNode.maxSize, childNode.size);
                    newNode.minColor = Math.min(newNode.minColor, childNode.color);
                    newNode.maxColor = Math.max(newNode.maxColor, childNode.color);
                } else
                {
                    // Insure min and max values are different if there is only one child:
                    newNode.minSize = childNode.size;
                    newNode.maxSize = childNode.size + 1;
                    newNode.minColor = childNode.color;
                    newNode.maxColor = childNode.color + 1;
                }

                // Add node to parent's children and childrenReference arrays:
                newNode.children[i] = childNode;
                // d3 reorganizes the children later in the code, so the following array is used to preserve children order for indexing:
                newNode.childrenReference[i] = childNode;
            }

            // Set parent node's colorScale range (Palette):
            if (lvls.length < ind + 1)
            {    // Set to global Palette:
                newNode.colorScale.range(colorScale.range());
            } else
            {    // Set to node's Level color Palette:
                newNode.colorScale.range(lvls[ind + 1].colorScale.range());
            }
            // Set domain of color values:
            stepSize = (newNode.maxColor - newNode.minColor) / Math.max(newNode.colorScale.range().length - 1, 1);
            newNode.colorScale.domain(d3.range(newNode.minColor, newNode.maxColor + stepSize, stepSize));

            return newNode;
        }
        json = ko.computed(function ()
        {
            // Get parameters (or defaults values):
            dataSource = sunburst.data || { name: "Empty" };
            levelsSource = sunburst.levels || [{}];
            childrenPath = sunburst.childrenPath || 'children';
            areaPath = sunburst.areaPath || 'area';
            colorPath = sunburst.colorPath || 'color';
            colorPalette = sunburst.colorPalette || 'PuBu';

            // 
            createLevelParameters(levelsSource);
            root = createNodeJson(dataSource, levels, 0);
            // Setup colorscale for the root:
            rootScale = d3.scale.linear()
                        .range(levels[0].colorScale.range());
            var stepSize = 2 / Math.max(rootScale.range().length - 1, 1);
            rootScale.domain(d3.range(root.color - 1, root.color + stepSize + 1, stepSize));

            // Return the new json data:
            return root;
        });
        selectedItemPathObservable = ko.computed(function ()
        {
            selectedItemPath = sunburst.selectedItemPath || ko.observable([]);
            return unwrap(selectedItemPath);
        });

        // Interpolate scales:
        function arcTween(d)
        {
            var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
                yd = d3.interpolate(y.domain(), [d.y, 1]),
                yr = d3.interpolate(y.range(), [d.y ? 20 : 0, radius]);
            return function (d, i)
            {
                return i
                    ? function () { return arc(d); }
                    : function (t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); return arc(d); };
            };
        }

        // Zoom after click:
        function zoom(d)
        {
            if (svgArea === undefined)
            {
                return; // Catch for if sunburst hasn't been setup.
            }

            // Animate sunburst nodes:
            svgArea.selectAll("path").transition()
                .duration(1000)
                .attrTween("d", arcTween(d));

            // Prevent event from firing more than once:
            if (d3.event)
            {
                d3.event.stopPropagation();
            }
        }
        // Zoom after click, and set the path:
        function selectZoom(d)
        {
            var path = [],
                dTmp,
                oldSelected = nodeSelected;

            if (d === oldSelected)
            {    // Reset path since item was already selected.
                d = root;
            }

            nodeSelected = dTmp = d;
            // Check if selectedItemPath is an observable:
            if (isObservable(selectedItemPath))
            {   // Path is an observable, so set path to the selected item:
                while (dTmp.parent !== undefined)
                {
                    path.unshift(dTmp.index);
                    dTmp = dTmp.parent;
                }
                selectedItemPath(path);
            } else
            {    // Path is not an observable, so no need to push an update to it.
                zoom(d.parent || d);
            }

            // Prevent event from firing more than once:
            if (d3.event)
            {
                d3.event.stopPropagation();
            }
        }
        // Subscribe to selectedItemPath changes from outside of the extension (and then zoom):
        selectedItemPathObservable.subscribe(function (path)
        {
            var rootTmp = json(), d = rootTmp, i;
            if (Object.prototype.toString.call(path) === '[object Array]')
            {
                for (i = 0; i < path.length; i += 1)
                {
                    if (d.childrenReference === undefined)
                    {
                        d = rootTmp; // Path doesn't exist, so reset path.
                        break;
                    }
                    if (d.childrenReference[path[i]] === undefined)
                    {
                        d = rootTmp; // Path doesn't exist, so reset path.
                        break;
                    }
                    d = d.childrenReference[path[i]];
                }
            }
            // Verify d exists:
            if (d)
            {
                nodeSelected = d;       // Set nodeSelected to d
                zoom(d.parent || d);    // Animate zoom affect to d's parent
            }
        });

        function sunburstRender() {
            // Define temp vars:
            var cell, nodes;

            // Get sunburst data:
            root = json();

            // Get domData from element (used to see if sunburst was setup before):
            domData = ko.utils.domData.get(svgElement, 'selection');

            if (domData === undefined) {    // This is a new sunburst:
                // Set selected node to the root of the sunburst:
                nodeSelected = root;

                // Setup sunburst and SVG:
                sunburstLayout = d3.layout.partition()
                                .value(function (d) { return d.size; })
                                .children(function (d) { return d.children; });
                svgArea = d3.select(svgElement)
                          .style('overflow', 'hidden')
                          .append("g")
                            .attr("transform", "translate(" + svgWidth / 2 + "," + (svgHeight / 2 + 10) + ")");

                // Setup arc function:
                arc = d3.svg.arc()
                        .startAngle(function (d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
                        .endAngle(function (d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
                        .innerRadius(function (d) { return Math.max(0, y(d.y)); })
                        .outerRadius(function (d) { return Math.max(0, y(d.y + d.dy)); });

                // Filter out nodes with children:
                nodes = sunburstLayout.nodes(root);
                        //.filter(function (d) { return !d.children; });

                // Set default selected item (do this after the data is set, and before modifying attributes):
                if (isObservable(selectedItemPath)) {
                    selectedItemPath([]);
                }

                // Join data with selection:
                celSel = svgArea.selectAll("path")
                        .data(nodes, function (d) { return d.name; });

                // Add nodes to SVG:
                cell = celSel.enter().append("path")
                        .attr("d", arc)
                        .style("fill", function (d) { return (d.parent ? d.parent.colorScale(d.color) : rootScale(d.color)); }) //colorScale(d.color)
                        .attr("text", function (d) { return d.name; })
                        .attr("ptext", function (d) { return d.parent ? d.parent.name : "none123"; })
                        .on("click", selectZoom);

                // Set domData for SVG:
                ko.utils.domData.set(svgElement, 'selection', { });
            } else {    // This is a sunburst being updated:
                // Set selected node to the root of the treemap:
                nodeSelected = root;

                // Filter out nodes with children:
                nodes = sunburstLayout.nodes(root);
                        //.filter(function (d) { return !d.children; });

                // Set default selected item (do this after the data is set, and before modifying attributes):
                if (isObservable(selectedItemPath)) {
                    selectedItemPath([]);
                }

                // Select all nodes in SVG, and apply data:
                celSel = svgArea.selectAll("path")
                        .data(nodes, function (d) { return d.name; });

                // Update nodes on SVG:
                cell = celSel.transition()
                    .duration(1000)
                    .attr("d", arc)
                    .style("fill", function (d) { return (d.parent ? d.parent.colorScale(d.color) : rootScale(d.color)); }) //colorScale(d.color)

                // Add new nodes to SVG:
                cell = celSel.enter().append("path")
                        .attr("d", arc)
                        .style("fill", function (d) { return (d.parent ? d.parent.colorScale(d.color) : rootScale(d.color)); }) //colorScale(d.color)
                        .on("click", selectZoom);

                // Remove nodes from SVG:
                cell = celSel.exit().remove();

                // Set domData for SVG:
                ko.utils.domData.set(svgElement, 'selection', { });
            }
        }
        // Subscribe to sunburst data changes:
        json.subscribe(function () {
            sunburstRender();    // Re-render on change
        });
        sunburstRender();
    }

    // Return sunburst object:
    return {
        init: init
    };
});