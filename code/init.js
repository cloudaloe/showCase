//
// some page-level rendering functions
//

var clientCodeDebug = 'low'; 
var data;

function initializeBackground() {
	// benign page load transitions	
	d3.select("body").transition()
		.style("background-color", "#5a5c5e")
		.duration(1500).ease("cubic-in-out"); }

function animateChartContainer() {
// benign page load transitions
var chartSpace = d3.select("#chartContainer");
chartSpace.style("display", "inherit");
chartSpace.transition().style("margin-top", "2%").duration(1200).ease("cubic-in-out");
var questionContainer = d3.select("#questionContainer");
//questionContainer.style("display", "inherit");
//questionContainer.transition().style("margin-top", "1.4em").duration(500).ease("linear");

}

function hideQuestionBar() {
	d3.select("#questionContainer").style("display","none");
}
		