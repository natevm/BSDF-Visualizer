"use strict";

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
    thetaEnvelope, 
    phiEnvelope,
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
      thetaEnvelope = addEnvelopeControl(menu, "Theta", "slider_incidentTheta", 0, 90, starting_theta);

      // menu.append("output")
      //   .attr("id", "output_incidentTheta");

      phiEnvelope = addEnvelopeControl(menu, "Phi", "slider_incidentPhi", -180, 180, starting_phi);

      // menu.append("output")
      //   .attr("id", "output_incidentPhi");

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
      let control = menu.append("div")
        .attr("class", "fl-studio-envelope__control");

      let knob = control.append("div")
        .attr("class", "knob-input fl-studio-envelope__knob envelope-knob " + name);

      let visual = knob.append("svg")
        .attr("class", "knob-input__visual")
        .attr("viewBox", "0 0 40 40");

      let focus_indicator = visual.append("circle")
        .attr("class", "focus-indicator")
        .attr("cx", 20).attr("cy", 20).attr("r", 18)
        .attr("fill", "#4eccff")
        .attr("filter", "url(#glow)");

      let indicator_ring_bg = visual.append("circle")
        .attr("class", "indicator-ring-bg")
        .attr("cx", 20).attr("cy", 20).attr("r", 18)
        .attr("fill", "#353b3f").attr("stroke", "#23292d");

      let indicator_ring = visual.append("path")
        .attr("class", "indicator-ring")
        .attr("d", "M20,20Z")
        .attr("fill", "#4eccff");

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
        .attr("fill", "#4eccff");

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
      let output_incidentTheta = document.getElementById("output_incidentTheta");
      let output_incidentPhi = document.getElementById("output_incidentPhi");

      //Set initial values
      //output_incidentTheta.innerHTML = starting_theta; 
      //output_incidentPhi.innerHTML = starting_phi; 

      thetaEnvelope.addEventListener('change', (event) => {
        viewers.forEach(function(v) {
          let new_theta = thetaEnvelope.value;
          //output_incidentTheta.innerHTML = Math.round(new_theta); 
          v.updateTheta(new_theta);
        });
      });

      phiEnvelope.addEventListener('change', (event) => {
        viewers.forEach(function(v) {
          let new_phi = phiEnvelope.value;
          //output_incidentPhi.innerHTML = Math.round(new_phi); 
          v.updatePhi(new_phi);
	});
      });
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
