import BRDFViewport from "./BRDFViewport.js";
import ModelViewport from "./ModelViewport.js";
import GUI from "./GUI.js";
import Model from "./Model.js";

let brdfViewport;
let modelViewport;
let model;
let linked = true;

const render = function(time) {
  brdfViewport.render(time);
  modelViewport.render(time);
  requestAnimationFrame(render);
};

document.addEventListener('DOMContentLoaded', function () {
  //setupUI();
  //setupUICallbacks();

  $( "#link_button" ).on({
    click: function() {
      if(linked) {
        $(this).attr("src","img/unlink_small.png");
        linked = false;
        brdfViewport.resetView();
      } else {
        $(this).attr("src","img/link_small.png");
        linked = true;
        brdfViewport.recoverView();
      }
    },

    mouseover: function() {
      if(linked) {
        $(this).attr("src","img/link_hover_small.png");
      } else {
        $(this).attr("src","img/unlink_hover_small.png");
      }
    },

    mouseleave: function() {
      if(linked) {
        $(this).attr("src","img/link_small.png");
      } else {
        $(this).attr("src","img/unlink_small.png");
      }
    }
  });


  const shdrPath = "./Shaders/";
  model = Model();
  let canvas = document.getElementById('brdf-canvas');

  brdfViewport = BRDFViewport({canvasName: "brdf-canvas", shdrDir: shdrPath,
    width: canvas.clientWidth, height: canvas.clientHeight, inputByModel: false});
  modelViewport = ModelViewport({canvasName: "model-canvas", shdrDir: shdrPath,
    width: canvas.clientWidth, height: canvas.clientHeight, inputByModel: true});

  modelViewport.registerLinkedViewport(brdfViewport);

  model.registerViewer(brdfViewport);
  model.registerViewer(modelViewport);

  GUI(model); //construct a GUI.

  requestAnimationFrame(render);
});
