let model;
let selectedImage=null;
let chart;

async function loadModel(){

updateLoad(10,"Checking cache...");
await new Promise(r=>setTimeout(r,300));

updateLoad(40,"Loading MobileNet model...");

model=await mobilenet.load({version:1,alpha:0.25});

updateLoad(100,"Model ready!");

document.getElementById("load-card").style.display="none";

document.getElementById("pill-txt").innerText="ready";
document.getElementById("pill-dot").style.background="#22c55e";

}

function updateLoad(pct,msg){

document.getElementById("mn-fill").style.width=pct+"%";
document.getElementById("mn-pct").innerText=pct+"%";
document.getElementById("load-title").innerText=msg;

}

loadModel();


function onFileSelect(e){

const file=e.target.files[0];

if(!file)return;

const img=document.getElementById("preview-img");

img.src=URL.createObjectURL(file);

selectedImage=img;

document.getElementById("classify-btn").disabled=false;

}


async function classifyImage(){

if(!selectedImage)return;

document.getElementById("cls-txt").innerText="Analyzing...";

const predictions=await model.classify(selectedImage,5);

displayResults(predictions);

document.getElementById("cls-txt").innerText="🔍 Identify Object!";

}


function displayResults(pred){

document.getElementById("results-grid").style.display="grid";

let html="";

pred.forEach(p=>{
html+=`<div><b>${p.className}</b> ${(p.probability*100).toFixed(2)}%</div>`;
});

document.getElementById("id-body").innerHTML=html;

drawChart(pred);

}


function drawChart(pred){

const ctx=document.getElementById("upload-chart");

if(chart)chart.destroy();

chart=new Chart(ctx,{
type:"bar",
data:{
labels:pred.map(p=>p.className),
datasets:[{
label:"Confidence",
data:pred.map(p=>p.probability*100)
}]
},
options:{
responsive:true,
plugins:{legend:{display:false}}
}
});

}


function resetUpload(){

document.getElementById("file-input").value="";
document.getElementById("preview-img").src="";
document.getElementById("results-grid").style.display="none";
document.getElementById("classify-btn").disabled=true;

}


function toggleTheme(){

const html=document.documentElement;

html.dataset.theme=
html.dataset.theme==="light"?"dark":"light";

}