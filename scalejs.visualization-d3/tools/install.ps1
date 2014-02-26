param($installPath, $toolsPath, $package, $project)

$project |
	Add-Paths "{
		'd3' : 'Scripts/d3.v3',
		'd3.colorbrewer' : 'Scripts/d3.colorbrewer',
		'fabric' : 'Scripts/fabric-1.4.4',
		'scalejs.d3-fabric' : 'Scripts/scalejs.d3-fabric',
		'scalejs.visualization-d3' : 'Scripts/scalejs.visualization-d3-$($package.Version)',
        'tweenLite' : 'Scripts/TweenLite-1.11.4'
	}" |
	Add-Shims "{
		'fabric': {
            exports: 'fabric'
        },
        'tweenLite': {
            exports: 'TweenLite'
        }
	}" |
	Add-ScalejsExtension 'scalejs.visualization-d3' |
	Out-Null