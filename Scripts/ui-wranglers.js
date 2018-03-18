import KnobInput from "./KnobInput.js";

export function addEnvelopeControl(menu, name, rangeId, minimum, maximum, initial_value) {

  let getSupportedPropertyName = function(properties) {
    for (var i = 0; i < properties.length; i++)
      if (typeof document.body.style[properties[i]] !== 'undefined')
        return properties[i];
      return null;
  };

  let getTransformProperty = function() {
    return getSupportedPropertyName([
      'transform', 'msTransform', 'webkitTransform', 'mozTransform', 'oTransform'
      ]);
  };

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
}
