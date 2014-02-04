param($installPath, $toolsPath, $package, $project)

$project |
	Add-Paths "{
		'scalejs.visualization-d3' : 'Scripts/scalejs.visualization-d3-$($package.Version)',
		'd3' : 'Scripts/d3.v3',
		'd3.colorbrewer' : 'Scripts/d3.colorbrewer'
	}" |
	Add-ScalejsExtension 'scalejs.visualization-d3' |
	Out-Null