/*global define*/
define([], function () {

    function parseColor(color) {
        var rgba,
            opacity = 1;
        if (color.indexOf("rgba") === 0) {
            rgba = color.substring(5, color.length - 1)
                 .replace(/ /g, '')
                 .split(',');
            opacity = Number(rgba.pop());
            color = "rgb(" + rgba.join(",") + ")";
        }
        return {
            color: color,
            opacity: opacity
        };
    }

    return {
        parseColor: parseColor
    }

});