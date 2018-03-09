"use strict";

//requires d3.js 

//************************
//"Class" ControlsManager
//
// Using "Classless OOP": 
// https://github.com/n8vm/BSDF-Visualizer/wiki/Classless-OOP-reference 
//************************

//Currently there are no "constructor" arguments
//See BRDFViewport.js for an example of one with arguments
export default function ControlsManager(){
  const starting_theta = 45;
  const starting_phi = 0;

  //Declare our object's properties and methods below.
  //They are private by default, unless we put them
  //in the "frozen" object that gets returned at the end.
  let
    viewers = [],
    registerViewer = function(new_viewer){
      viewers.push(new_viewer);
    },
    setupUI = function() {
      //FIXME: ControlsManager should be writing to its
      //own div, not to #brdf-menu
      let menu = d3.select("#brdf-menu");
      let thetaInput;
      let thetaOutput;
      let phiInput;
      let phiOutput;
      let camRotInput;

      //FIXME: this gets called before
      //setupUI() gets called in BRDFViewport. 
      //Necessary for now because both are writing 
      //to the same div. 
      menu.html("");

      /* Add incident theta slider */
      menu.append("input")
        .attr("id", "slider_incidentTheta")
        .attr("type", "range")
        .attr("min", 0)
        .attr("max", 90)
        .attr("step", 1)
        .attr("value", starting_theta);

      menu.append("output")
        .attr("id", "output_incidentTheta");

      /* Add incident phi slider */
      menu.append("input")
        .attr("id", "slider_incidentPhi")
        .attr("type", "range")
        .attr("min", -180)
        .attr("max", 180)
        .attr("step", 1)
        .attr("value", starting_phi);

      menu.append("output")
        .attr("id", "output_incidentPhi");
		
	  menu.append("input")
		.attr("id", "normalTheta")
		.attr("type", "hidden")
		.attr("value", 0);
		
	  menu.append("input")
		.attr("id", "normalPhi")
		.attr("type", "hidden")
		.attr("value", 0);

    },

    setupUICallbacks = function() {
      let output_incidentTheta = document.getElementById("output_incidentTheta");
      let output_incidentPhi = document.getElementById("output_incidentPhi");

      //Set initial values
      output_incidentTheta.innerHTML = starting_theta; 
      output_incidentPhi.innerHTML = starting_phi; 

	  //now this slider only controls light theta and phi
      document.getElementById("slider_incidentTheta").oninput = (event) => {
		let new_theta = event.target.value; 
        output_incidentTheta.innerHTML = new_theta;
		//console.log(new_theta - viewers[1].getNormalTheta());
		viewers[1].updateTheta(new_theta);
		viewers[0].updateTheta(viewers[1].getNormalTheta());
		viewers[0].updatePhi(viewers[1].getNormalPhi());
		//sorry to comment out this: we need different values for the two viewports
		//Any ideas of refactoring?  --Daqi
        // viewers.forEach(function(v) {
          // let new_theta = event.target.value;
          // output_incidentTheta.innerHTML = new_theta; 
          // v.updateTheta(new_theta);
        // });
      };

      document.getElementById("slider_incidentPhi").oninput = (event) => { 
		let new_phi = event.target.value;
		//console.log(new_phi - viewers[1].getNormalPhi());
        output_incidentPhi.innerHTML = new_phi; 
		viewers[1].updatePhi(new_phi);
		viewers[0].updateTheta(viewers[1].getNormalTheta());		
		viewers[0].updatePhi(viewers[1].getNormalPhi());
        // viewers.forEach(function(v) {
          // let new_phi = event.target.value;
          // output_incidentPhi.innerHTML = new_phi; 
          // v.updatePhi(new_phi);
        // });
      };
	  
      document.getElementById("normalTheta").onchange = (event) => {
		//console.log("detect!");
		let new_theta = event.target.value;
		//console.log(parseFloat(output_incidentTheta.innerHTML) - new_theta);
		viewers[0].updateTheta(new_theta);
      };

      document.getElementById("normalPhi").onchange = (event) => { 
		let new_phi = event.target.value;
		//console.log(parseFloat(output_incidentPhi.innerHTML) - new_phi);
		viewers[0].updatePhi(new_phi);
      };
	  	  
    };

  //************* Start "constructor" **************
  setupUI();
  setupUICallbacks();
  //************* End "constructor" **************

  //Put any methods / properties that we want to make pulic inside this object.
  return Object.freeze({
    registerViewer    
  });
}
