"use strict";

import {loadBRDF_disneyFormat} from './gl-wrangling-funcs.js';
import KnobInput from "./KnobInput.js";

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
	incidentThetaEnvelope, 
	incidentPhiEnvelope,
	normalThetaEnvelope,
	normalPhiEnvelope,
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

		menu.html("");

		let fileChooser = menu.append("div")
		.attr("id", "file-chooser")
		.style("display", "flex");


		menu.append("br");

		fileChooser.html("");
		fileChooser.append("input")
		.attr("id", "file_chooser")
		.attr("type","file");

		let sliderDiv = menu.append("div");
		sliderDiv.style("display", "flex")
		.style("width", "100%");

		/* Add incident theta slider */
		incidentThetaEnvelope = addEnvelopeControl(sliderDiv, "θ", "slider_incidentTheta", 0, 90, starting_theta);

		/* Add incident phi slider */
		incidentPhiEnvelope = addEnvelopeControl(sliderDiv, "φ", "slider_incidentPhi", -180, 180, starting_phi);
		
		/* Add normal theta slider */
		normalThetaEnvelope = addEnvelopeControl(sliderDiv, "Norm θ", "normalTheta", 0, 360, 0);

		/* Add normal phi slider */
		normalPhiEnvelope = addEnvelopeControl(sliderDiv, "Norm φ", "normalPhi", 0, 360, 0);

		menu.append("input")
		.attr("id", "linkedCamRot")
		.attr("type", "hidden")
		.attr("value", 0);

		/* add camRot slider */
		d3.select("#brdf-header").html("");
		d3.select("#brdf-header").append("input")
		.attr("id", "slider_camRot")
		.attr("class", "niceSlider")
		.attr("type", "range")
		.attr("min", -180)
		.attr("max", 180)
		.attr("step", 1)
		.attr("value", 0);
	},

	loadBrdfFile = function(fileList){
		let reader = new FileReader();

		reader.onload = function() {
			//FIXME: duplicate definition of shdrDir
			let loadBRDFPromise = loadBRDF_disneyFormat({brdfFileStr: reader.result,
				shdrDir: "./Shaders/", templatePath: "lobe_template.vert",
				vertPath: "lobe.vert", fragPath: "phong.frag", templateType: "vert"});

			loadBRDFPromise.then(value => {
				console.log("Loading .brdf done!");
				console.log(value); 
			}, err => { 
				throw "BRDF load error: " + err;
			});

			//TODO: Finish implementing this.
			//viewers.forEach(function(v) {
				//if( "loadBRDF_disneyFormat" in v ){
				////v.add_uniforms_func( <insert params here> )
				//}
			//});
		};

		//onload will be invoked when this is done
		reader.readAsText(fileList[0]);
	},

	getSupportedPropertyName = function(properties) {
		for (var i = 0; i < properties.length; i++)
			if (typeof document.body.style[properties[i]] !== 'undefined')
				return properties[i];
			return null;
	},

	getTransformProperty = function() {
		return getSupportedPropertyName([
			'transform', 'msTransform', 'webkitTransform', 'mozTransform', 'oTransform'
			]);
	},

	debounce = function(func, wait, immediate) {
		var timeout;
		return function() {
			var context = this, args = arguments;
			var later = function() {
				timeout = null;
				if (!immediate) func.apply(context, args);
			};
			var callNow = immediate && !timeout;
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
			if (callNow) func.apply(context, args);
		};
	},

	addEnvelopeControl = function(menu, name, rangeId, minimum, maximum, initial_value) {
		let scale = 1.0;

		let control = menu.append("div")
		.attr("class", "fl-studio-envelope__control");

		let knob = control.append("div")
		.attr("class", "knob-input fl-studio-envelope__knob envelope-knob " + name);

		let visual = knob.append("svg")
		.attr("class", "knob-input__visual")
		.attr("viewBox", "0 0 " + 40 * (1.0/scale) + " " + 40 * (1.0/scale) );

		let focus_indicator = visual.append("circle")
		.attr("class", "focus-indicator")
		.attr("cx", 20).attr("cy", 20).attr("r", 18)
		.attr("fill", "#ffffff")
		.attr("filter", "url(#glow)");

		let indicator_ring_bg = visual.append("circle")
		.attr("class", "indicator-ring-bg")
		.attr("cx", 20).attr("cy", 20).attr("r", 18)
		.attr("fill", "#353b3f").attr("stroke", "#23292d");

		let indicator_ring = visual.append("path")
		.attr("class", "indicator-ring")
		.attr("d", "M20,20Z")
		.attr("fill", "#ffffff");

		let dial = visual.append("g").attr("class", "dial");

		dial.append("circle")
		.attr("cx", 20).attr("cy", 20)
		.attr("r", 16).attr("fill", "url(#grad-dial-soft-shadow)");

		dial.append("ellipse")
		.attr("cx", 20).attr("cy", 22).attr("rx", 14).attr("ry", 14.5)
		.attr("fill", "#242a2e").attr("opacity", 0.15);

		dial.append("circle")
		.attr("cx", 20).attr("cy", 20).attr("r", 14)
		.attr("fill", "url(#grad-dial-base)")
		.attr("stroke", "#242a2e")
		.attr("stroke-width", 1.5);

		dial.append("circle")
		.attr("cx", 20).attr("cy", 20).attr("r", 13)
		.attr("fill", "transparent")
		.attr("stroke", "url(#grad-dial-highlight)")
		.attr("stroke-width", 1.5);

		// let dial_highlight = dial.append("circle")
		//   .attr("class", "dial-highlight")
		//   .attr("cx", 20).attr("cy", 20).attr("r", 14)
		//   .attr("fill", "#ffffff");

		let indicator_dot = dial.append("circle")
		.attr("class", "indicator-dot")
		.attr("cx", 20).attr("cy", 30).attr("r", 1.5)
		.attr("fill", "#ffffff");

		let label = control.append("div")
		.attr("class", "fl-studio-envelope__label")
		.text(name);

		let transformProp = getTransformProperty();

		return new KnobInput(knob.node(), rangeId, {
			visualContext: function() {
				this.indicatorRing = this.element.querySelector('.indicator-ring');
				var ringStyle = getComputedStyle(this.element.querySelector('.indicator-ring-bg'));
				this.r = parseFloat(ringStyle.r) - (parseFloat(ringStyle.strokeWidth) / 2);
				this.indicatorDot = this.element.querySelector('.indicator-dot');
				this.indicatorDot.style[`${transformProp}Origin`] = '20px 20px';
			},
			updateVisuals: function(norm) {
				var theta = Math.PI*2*norm + 0.5*Math.PI;
				var endX = this.r*Math.cos(theta) + 20;
				var endY = this.r*Math.sin(theta) + 20;
				// using 2 arcs rather than flags since one arc collapses if it gets near 360deg
				this.indicatorRing.setAttribute('d',`M20,20l0,${this.r}${norm> 0.5?`A${this.r},${this.r},0,0,1,20,${20-this.r}`:''}A-${this.r},${this.r},0,0,1,${endX},${endY}Z`);
				this.indicatorDot.style[transformProp] = `rotate(${360*norm}deg)`;
			},
			min: minimum,
			max: maximum,
			initial: initial_value,
		});
	},

	setupUICallbacks = function() {
		//Set initial values
		//now this slider only controls light theta and phi
		incidentThetaEnvelope.addEventListener('change', (event) => {
			viewers.forEach(function(v) {
				let new_theta = incidentThetaEnvelope.value;
				//output_incidentTheta.innerHTML = Math.round(new_theta); 
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
			});
		});

		incidentPhiEnvelope.addEventListener('change', (event) => {
			let new_phi = incidentPhiEnvelope.value;
			//console.log(new_phi - viewers[1].getNormalPhi());
			//output_incidentPhi.innerHTML = new_phi; 
			viewers[1].updatePhi(new_phi);
			viewers[0].updateTheta(viewers[1].getNormalTheta());		
			viewers[0].updatePhi(viewers[1].getNormalPhi());
			// viewers.forEach(function(v) {
				// let new_phi = event.target.value;
				// output_incidentPhi.innerHTML = new_phi; 
				// v.updatePhi(new_phi);
			// });
		});

		normalThetaEnvelope.addEventListener('change', (event) => {
			let new_theta = normalThetaEnvelope.value;
			viewers[0].updateTheta(new_theta);
		});

		normalPhiEnvelope.addEventListener('change', (event) => {
			let new_phi = normalPhiEnvelope.value;
			viewers[0].updatePhi(new_phi);
		});

		document.getElementById("linkedCamRot").onchange = (event) => {
			viewers[0].updateLinkedCamRot(viewers[1].getLinkedCamRotMatrix());
		};

		document.getElementById("slider_camRot").oninput = (event) => {
			viewers.forEach(function(v) {
				let new_camRot = event.target.value;
				if( "updateCamRot" in v ){
					v.updateCamRot(new_camRot);
				}
			});
		};

		//File input snippet from:
		//https://developer.mozilla.org/en-US/docs/Web/API/File/Using_files_from_web_applications
		document.getElementById("file_chooser").addEventListener("change",
			//in the below function, "this" appears to be bound to some object
			//that addEventListener bind the function to.
			function(){
				loadBrdfFile(this.files);
			}, false);	  	  
	};


	//TODO: should the "controller" really be processing the BRDF file?
	//This sounds more like the job of the "model".
	//Because this is still a small project we probably don't need a separate
	//"model" and "controller"...


	//************* Start "constructor" **************
	setupUI();
	setupUICallbacks();
	//************* End "constructor" **************

	//Put any methods / properties that we want to make pulic inside this object.
	return Object.freeze({
		registerViewer
	});
}
