"use strict";

//Read lines from Disney *.brdf files.
//Ignores comments.
export function getNextLine_brdfFile(it){
  let currLine = it.next().value;
  let hashLoc;

  if (currLine === undefined) {
    throw "End of file reached prematurely!";
  }

  hashLoc = currLine.search("#");
  if (hashLoc !== -1) { //remove comments
    return currLine.slice(0,hashLoc);
  } else {
    return currLine;
  }
}
