function addComment(){

let name=document.getElementById("name").value;
let message=document.getElementById("message").value;

if(name=="" || message==""){

alert("Please write name and comment");

return;

}

let commentBox=document.getElementById("comments");

let div=document.createElement("div");

div.className="comment";

div.innerHTML="<b>"+name+"</b><p>"+message+"</p>";

commentBox.appendChild(div);

document.getElementById("name").value="";
document.getElementById("message").value="";

}
