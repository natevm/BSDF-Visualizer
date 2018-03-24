"use strict";

import {loadBRDF_disneyFormat, compile_and_link_shdr} from './gl-wrangling-funcs.js';
import {loadAnalytical_getUniforms} from './gl-wrangling-funcs.js';

//************************
//"Class" Model
//
// Using "Classless OOP":
// https://github.com/n8vm/BSDF-Visualizer/wiki/Classless-OOP-reference
//************************

//Currently there are no "constructor" arguments
//See BRDFViewport.js for an example of one with arguments
export default function Model(){
  //Declare our object's properties and methods below.
  //They are private by default, unless we put them
  //in the "frozen" object that gets returned at the end.
  let //TODO: change to "const"?
    viewers = [],
    registerViewer = function(new_viewer){
      viewers.push(new_viewer);
    },

    setTheta = function(newTheta){
      viewers.forEach(function(v) {
        if (v.getInputByModel() === true) {
          v.updateTheta(newTheta);
        }
      });
    },

    setPhi = function(newPhi){
      viewers.forEach(function(v) {
        if (v.getInputByModel() === true) {
          v.updatePhi(newPhi);
        }
      });
    },

    setCamRot = function(newCamRot){
      //console.log("Got camera rotation " + newCamRot);
      viewers.forEach(function(v) {
        if (v.getInputByModel() === true && "updateCamRot" in v) {
          v.updateCamRot(newCamRot);
        }
      });
    },

    loadAnalyticalBRDF = function(in_file){
      return loadAnalytical_getUniforms(in_file, viewers);
    };

  //NathanX: What exactly does "debounce" do? Do we need it?
  //debounce = function(func, wait, immediate) {
    //var timeout;
    //return function() {
      //var context = this, args = arguments;
      //var later = function() {
        //timeout = null;
        //if (!immediate) func.apply(context, args);
      //};
      //var callNow = immediate && !timeout;
      //clearTimeout(timeout);
      //timeout = setTimeout(later, wait);
      //if (callNow) func.apply(context, args);
    //};
  //};

  //************* Start "constructor" **************
  //Do stuff here...
  //************* End "constructor" **************

  //Put any methods / properties that we want to make pulic inside this object.
  return Object.freeze({
    registerViewer,
    setTheta,
    setPhi,
    setCamRot,
    loadAnalyticalBRDF,
  });
}
