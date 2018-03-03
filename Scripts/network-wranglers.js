export function loadTextFile(path){
    //Code snippet from https://stackoverflow.com/a/196510 
    var client = new XMLHttpRequest();
    client.open('GET', path);
    client.onreadystatechange = function() {
      if(client.readyState == 4)
        alert(client.responseText);
    };
    client.send();
}
