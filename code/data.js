//
// data loading
// and transforming
//

series = new Object();
series.series = new Array();
series.numOf = 0;

function csvLoad(fileRelPath) {
	// this function is no good for real-world interactions, as the callback can't
	// be dynamically told where to put the loaded data(maybe a javascript closure would allow?!),
	// and also because it can't use https only http.
	d3.csv(fileRelPath, function(csvData) 
	{
		if (csvData) 
		{
			data = csvData;
			if (clientCodeDebug == 'high') {
				console.dir(data); }
			else;
			console.log('data cube loaded from file  ' + fileRelPath + ':');
			console.dir(data);
			csvLoaded();
		}
		else 
			alert("failed loading data file " + fileRelPath);
	}); }

function csvLoaded() {

    //
    // Extract single series from given cube.
    // @ slice out one series, into an array of x and y values
    // @ compute min and max of date and values
    //
    // Need to add error cases handling
    //
    function extractSerieFromCube(cube, x, y)
	{
		if (!cube.length)
			console.log('empty series passed as argument');
		else
		{
			var parseTime = d3.time.format("%d/%m/%Y %H:%M").parse;	// format specifiers as per http://tinyurl.com/cmakk7e	
			serie = new Object();			
			serie.data = new Array();			
			
			serie.data[0] = new Object();
			serie.data[0].x = parseTime(cube[0][x]);			
			serie.data[0].y = parseFloat(cube[0][y]);
			
			serie.minDate = serie.maxDate = serie.data[0].x;
			serie.min = serie.max = serie.data[0].y;
			
			for (i=1; i<cube.length; i++)
			{			
				serie.data[i] = new Object();		
				serie.data[i].x = parseTime(cube[i][x]);
				serie.data[i].y = parseFloat(cube[i][y]);
				
				serie.minDate = Math.min(serie.minDate, serie.data[i].x);			
				serie.maxDate = Math.max(serie.maxDate, serie.data[i].x);			
				serie.min = Math.min(serie.min, serie.data[i].y);
				serie.max = Math.max(serie.max, serie.data[i].y);				
			}
		}
        series.numOf += 1;
        serie.name = y;

		console.log('extracted serie [' + y + '] from cube' + ':');
		console.dir(serie);	
		return serie;
	}
	
	series.series[0] = extractSerieFromCube(data, 'Time', 'Data Size');
    series.series[1] = extractSerieFromCube(data, 'Time', 'Index Size');

    // for (elem=0; elem<series.series[serie].data.length-1; elem++) {}

	seriesReady();
}