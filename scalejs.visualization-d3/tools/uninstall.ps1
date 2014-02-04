param($installPath, $toolsPath, $package, $project)

$project |
	Remove-Paths 'scalejs.visualization-d3, d3, d3.colorbrewer' |
	Remove-ScalejsExtension 'scalejs.visualization-d3' |
	Out-Null
