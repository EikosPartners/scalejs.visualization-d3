param($installPath, $toolsPath, $package, $project)

$project |
	Add-Paths "{
		'd3' : 'Scripts/d3.v3',
		'd3.colorbrewer' : 'Scripts/d3.colorbrewer',
		'fabric' : 'Scripts/fabric-1.4.0',
		'hammer' : 'Scripts/hammer',
		'scalejs.d3-fabric' : 'Scripts/scalejs.d3-fabric',
		'scalejs.visualization-d3' : 'Scripts/scalejs.visualization-d3-$($package.Version)'
	}" |
	Add-ScalejsExtension 'scalejs.visualization-d3' |
	Out-Null