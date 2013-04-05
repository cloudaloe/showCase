//
// the real stuff
//

chart = new Object(); 		// container for chart properties
timeframe = new Object();	// container for time frame properties
//xAxisHeight=20;
//yAxisWidth=40;

function seriesReady()
{
	initTimeframe();
	initChart();
}

function initChart()
{
    //
    //  translate value pairs to screen coordinates
    //
    function calcPlot(layer, drawBox, data, style)
    {
        for (i=0; i<data.length-1; i++)
        {
            data[i].plotX = chartBox.widthScaler(data[i].x);
            data[i].plotY = chartBox.heightScaler(data[i].y);
            data[i+1].plotX = chartBox.widthScaler(data[i+1].x);
            data[i+1].plotY = chartBox.heightScaler(data[i+1].y);
        }
    }

    //
    // draw a serie
    //
    function plot(layer, drawBox, data, style)
    {
        var thickness = style == 'highlighted' ? 1.5 : 1;

        for (i=0; i<data.length-1; i++)
        {
            line(layer, data[i].plotX, data[i].plotY, data[i+1].plotX, data[i+1].plotY, thickness);
        }
    }

    function line(layer, x , y, toX, toY, thickness)
    {
        var line = new Kinetic.Line({
            points: [ x, y, toX, toY],
            stroke: "orange",
            strokeWidth: thickness,
            lineCap: "mitter",
            lineJoin: "mitter"
        });
        layer.add(line);
    }

    function draw(layer)
    {

        //
        //  plot each serie, and prepare it for event capture
        //
       for (serie=0; serie<series.numOf; serie++)
       {
           calcPlot(layer, chartBoxRect, series.series[serie].data);
           plot(layer, chartBoxRect, series.series[serie].data);
        }

        layer.draw();

        function drawAxes()
        {
            var xAxis = d3.svg.axis().scale(widthScaler).orient("bottom");
            chart.svgElem.append("g")
                .attr("class","Axis")
                .attr("transform", "translate(0," + (height) + ")")
                .call(xAxis);

            var yAxis = d3.svg.axis().scale(heightScaler).orient("right");
            chart.svgElem.append("g")
                .attr("class","Axis")
                .attr("transform", "translate(" + (width) + ",0)")
                .call(yAxis);

        }

        //drawAxes();
    }

	var chartArea = document.getElementById('chartContainer');
	var width = parseFloat(getComputedStyle(chartArea).width);
	var height = parseFloat(getComputedStyle(chartArea).height);

    chartBoxFactor =4/5;
     var chartBox = {
            width: width * chartBoxFactor,
            height: height * chartBoxFactor,
            x: width * (1-(chartBoxFactor))/2,
            y: height * (1-(chartBoxFactor))/2,
     };

    var chartBoxRect = new Kinetic.Rect($.extend(chartBox,{
        fill: "hsl(240, 20%, 95%)",
        stroke: "black",
        strokeWidth: 0.01
    }));

    //
    // just explicitly  calculate  dimensions
    // that could otherwise be spontaneously used inline
    //
    chartBox.startX = chartBox.x;
    chartBox.startY= chartBox.y;
    chartBox.endX = chartBox.startX+chartBox.width;
    chartBox.endY = chartBox.startY+chartBox.height;

    //
    //  construct scales that would be used for
    //  projecting data values to chart space pixels.
    //
    //  the arguments are the target pixel range
    //
    chartBox.widthScaler = d3.time.scale();
    chartBox.widthScaler.range([chartBox.startX, chartBox.endX]);
    chartBox.widthScaler.domain([timeframe.min, timeframe.max]);

    chartBox.heightScaler = d3.scale.linear();
    chartBox.heightScaler.range([chartBox.endY, chartBox.startY]);
    chartBox.heightScaler.domain([0, Math.max(series.series[0].max, series.series[1].max)]);

    var stage = new Kinetic.Stage({container: chartArea ,height: height, width: width});
    var layer = new Kinetic.Layer();

    var circle = new Kinetic.Circle({
        radius: 2,
        fill: "hsla(50, 50%, 50%, 1)",
        stroke: "hsla(50, 50%, 50%, 1)",
        strokeWidth: 0
    });

    chartBoxRect.on('mousemove', function() {
        //
        // find datum closest to mouse position, out of all series.
        // note that lines between datums do not count here,
        // only datums.
        //
        // for that datum, highlight it with a small bulky dot, and highlight its series
        //  by making it appear thicker.
        //

        layer.remove(circle);
        var pos = stage.getMousePosition();
        //console.log('x: ' + chartBox.widthScaler.invert(pos.x) + ', y: ' + chartBox.heightScaler.invert(pos.y));

         function dist(x0, y0, x1, y1)  { return Math.sqrt(Math.pow(Math.abs(x0-x1),2) + Math.pow(Math.abs(y0-y1),2)); };

        var minDistanceSerie = null;
        var minDistance = Infinity;
        var minDistanceElem = null;

        for (serie=0; serie<series.numOf; serie++)
        {
            for (elem=0; elem<series.series[serie].data.length; elem++)
            {
                    var distance = dist(series.series[serie].data[elem].plotX,  series.series[serie].data[elem].plotY,  pos.x, pos.y);
                    if (distance < minDistance)
                    {
                        minDistance =  distance;
                        minDistanceElem = elem;
                        minDistanceSerie = serie;
                    }
            }
        }
        //console.log( minDistance, minDistanceElem, minDistanceSerie, series.series[minDistanceSerie].data[minDistanceElem]);

        circle.setX(series.series[minDistanceSerie].data[minDistanceElem].plotX);
        circle.setY(series.series[minDistanceSerie].data[minDistanceElem].plotY);
        layer.add(circle);

        //plot(layer, chartBox, series.series[minDistanceSerie].data, 'highlighted');

        //
        // show datum details in a bottom box.
        // by adding it as html there
        //
        var dataDetail = '<div id=dataDetailInner>';
        dataDetail += '<p align=center style="margin-top:0em; margin-bottom:0em">' +  series.series[minDistanceSerie].data[minDistanceElem].x.toString() + '</p>';
        dataDetail += '<p align=center style="margin-top:0em; margin-bottom:0em">' + series.series[minDistanceSerie].data[minDistanceElem].y.toString() + '</p>';
        dataDetail += '</div>';
        document.getElementById('dataDetail').innerHTML = dataDetail;
       // center the text lines inside the containing box, just for now
        document.getElementById('dataDetailInner').style.paddingTop = ($('#dataDetail').height()-$('#dataDetailInner').height())/2 + 'px';

       layer.draw();
    });

   /*
    chartBoxRect.on("mouseover", function() {
        //chartRect.setFill("hsl(240,15%,93%)");
        this.setFill("black");
		 layer.draw();
        });

    chartBoxRect.on("mouseout", function() {
        this.setFill("hsl(240,20%,95%)");
        layer.draw();
    });
    */

    // add the shape to the layer
	layer.add(chartBoxRect);

	// add the layer to the stage
	stage.add(layer);
    draw(layer, chartBox);
    document.getElementById('dataDetail').innerHTML = '<p color=#fff; align=center>position over the chart for details here</p>';
}

	function initTimeframe()
{
	timeframe.min = Math.min(series.series[0].minDate, series.series[1].minDate);
	timeframe.max = Math.max(series.series[0].maxDate, series.series[1].maxDate);
	//console.log("timeframe:");
	//console.dir(timeframe);
}
