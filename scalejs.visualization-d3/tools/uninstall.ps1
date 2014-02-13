param($installPath, $toolsPath, $package, $project)

$project |
	Remove-Paths 'd3, d3.colorbrewer, fabric, scalejs.d3-fabric, scalejs.visualization-d3' |
	Remove-ScalejsExtension 'scalejs.visualization-d3' |
	Out-Null
