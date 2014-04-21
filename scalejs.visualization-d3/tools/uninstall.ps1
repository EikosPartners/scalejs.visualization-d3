param($installPath, $toolsPath, $package, $project)

$project |
	Remove-Paths 'd3, d3.colorbrewer, hammer, scalejs.visualization-d3' |
	Remove-ScalejsExtension 'scalejs.visualization-d3' |
	Out-Null
