param($installPath, $toolsPath, $package, $project)

$project |
	Remove-Paths 'd3, d3.colorbrewer, fabric, hammer, scalejs.d3-fabric, scalejs.visualization-d3, tweenLite' |
	Remove-Shims 'fabric, tweenLite' |
	Remove-ScalejsExtension 'scalejs.visualization-d3' |
	Out-Null
