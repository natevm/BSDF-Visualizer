"use strict";

//Assumes that map is an ES6 Map or WeakMap.
//Alternate insertion function such that we have a hashmap WITH CHAINING.
export function map_insert_chain(map, key, val){
  if ( map.has(key) ){
    map.get(key).push(val);
  } else {
    map.set(key, [val]);
  }
}
