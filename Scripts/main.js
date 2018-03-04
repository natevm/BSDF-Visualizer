"use strict";

import BRDFViewport from "./BRDFViewport.js";
import ModelViewport from "./ModelViewport.js";
import ControlsManager from "./ControlsManager.js";

//Wrap everything in a function so that we do not pollute
//the global namespace.
(function () { 
  var brdfViewport;
  var modelViewport;
  var ctrlManager;

  var render = function(time) {
    brdfViewport.render(time);
    modelViewport.render(time);
    requestAnimationFrame(render);
  };

  document.addEventListener('DOMContentLoaded', function () {
    ctrlManager = ControlsManager();
    brdfViewport = BRDFViewport({canvasName: "brdf-canvas", width: 512, height: 512});
    modelViewport = ModelViewport({canvasName: "model-canvas", width: 512, height: 512});

    ctrlManager.addViewer(brdfViewport);
    ctrlManager.addViewer(modelViewport);

    requestAnimationFrame(render);
  });
}());
