/*TODO:
  Make right click events invalid
  Make sure cropping smaller than the wrapper min width is possible
  Prevent polygons from being set if they're draw outside the canvas 
  Prevent multiple color adding
*/

var mainc=document.getElementById("maincanvas"),
    mctx=mainc.getContext("2d"),
    secc=document.getElementById("secondary"),
    sctx=secc.getContext("2d"),
    palette=document.getElementById("palette").getContext("2d"),
    cWrapper=document.getElementById("canvaswrapper"),
    zs=document.getElementById("zoomslider");
var drawing=false,
    drawObj,
    canvOffset,
    prevCoords,
    offset,
    boxOffs,
    colorArr=[0,0,0,255],
    backColorArr=[0,0,0,0],
    colMode=0,
    lWidth=15,
    eWidth=5,
    sWidth=5,
    activeWidth="lWidth",
    opacity=1,
    hist=[],
    histPointer=0,
    maxMem=50,
    startCoords,
    zoom=1,
    zoomLvls=[0.125,0.25,0.5,1,2,3,4,5,6,7,8],
    rulerIntervals=[1000,500,200,100,50,20,20,20,10,10,10],
    currCur=null,
    saveData={
      histIndex:-1,
      name:null
    };
var moveData,
    moveObj=null,
    started=false,
    blockAction=false,
    lastEvt,
    path=[],
    maxPath=0,
    fillTolerance=50,
    copyData,
    fontData={
      font:"Arial",
      size:16,
      style:"normal",
      weight:"normal"
    };

//LocalStorage data
var fileDict=JSON.parse(localStorage.getItem("paintfiles")) || [],
    rulers=!(localStorage.getItem("rulers")=="true"),
    files=[];

var drawData={
  free:{
    events:{
      down:freeLine,
      move:freeLine,
      up:setFree
    }
  },
  resize:{
    events:{
      move:resize,
      up:endResize
    }
  },
  fill:{
    events:{
      down:fill
    }
  },
  move:{
    events:{
      move:moveB,
      up:endMove
    }
  },
  text:{
    movable:true,
    events:{
      down:addScaleBox,
      onscaled:setTextBox,
      up:focusBox,
      finish:setText
    }
  },
  erase:{
    events:{
      down:erase,
      move:erase,
      up:saveHistory
    }
  },
  dropper:{
    events:{
      hover:dropMove,
      down:dropper
    }
  },
  select:{
    events:{
      down:addScaleBox,
      onscaled:cutSelection,
      finish:setSelection
    }
  },
  selectShape:{
    events:{
      down:startSelect,
      move:moveSelect,
      up:completeSelect,
      finish:setSelection
    }
  },
  crop:{
    events:{
      down:addScaleBox,
      finish:crop
    }
  },
  shape:{
    events:{
      down:startShape,
      move:updateShape,
      up:addBoundBox,
      boxmove:updateShape,
      boxresize:updateShape,
      finish:addShape
    },
    update:relayUpdateShape
  },
  path:{
    events:{
      down:startPath,
      move:drawMovePath,
      up:continuePath,
      finish:relaySetPath,
      boxmove:updateShape,
      boxresize:updateShape,
      pointmove:moveCoord
    },
    update:updatePath
  },
  movePoint:{
    events:{
      move:movePoint,
      up:dropPoint
    },
    update:relayUpdate
  },
  movePopup:{
    events:{
      move:movePopup,
      up:dropPopup
    }
  },
  genericCoords:{
    events:{
      move:setCoords,
      up:endCoords
    }
  }
};
var drawMode="free",
    oldMode,
    prevMode=drawMode,
    drawObj=drawData[drawMode];

var cols=["black","#7f7f7f","#880015","#ed1c24","#ff7f27","#fff200","#22b14c","#00a2e8","#3f48cc","#a349a4","white","#c3c3c3","#b97a57","#ffaec9","#ffc90e","#efe4b0","#b5e61d","#99d9ea","#7092be","#c8bfe7","transparent"];

var shapes=[
  ["circle"],   //The coordinate will be automatically added... It's not pretty, but it creates a near perfect circle.
  ["rectangle",[0,0],[1,0],[1,1],[0,1]],
  ["triangle",[0.5,0],[1,1],[0,1]],
  ["right triangle",[0,0],[1,1],[0,1]],
  ["rhombus",[0.5,0],[1,0.5],[0.5,1],[0,0.5]],
  ["pentagon",[0.5,0],[1,0.45],[0.8,1],[0.2,1],[0,0.45]],
  ["hexagon",[0.5,0],[1,0.25],[1,0.75],[0.5,1],[0,0.75],[0,0.25]],
  ["arrow left/right",[0.5,0],[1,0.5],[0.5,1],[0.5,0.7],[0,0.7],[0,0.3],[0.5,0.3]],
  ["arrow up/down",[0.3,0],[0.7,0],[0.7,0.5],[1,0.5],[0.5,1],[0,0.5],[0.3,0.5]],
  ["bubble",[0,0],[1,0],[1,0.7],[0.5,0.7],[0.1,1],[0.2,0.7],[0,0.7]],
  ["4-star",[0.5,0],[0.62,0.38],[1,0.5],[0.62,0.62],[0.5,1],[0.38,0.62],[0,0.5],[0.38,0.38]],
  ["5-star",[0.5,0],[0.62,0.4],[1,0.4],[0.7,0.6],[0.8,1],[0.5,0.75],[0.2,1],[0.3,0.6],[0,0.4],[0.38,0.4]],
  ["6-star",[0.5,0],[0.68,0.25],[1,0.25],[0.82,0.5],[1,0.75],[0.68,0.75],[0.5,1],[0.32,0.75],[0,0.75],[0.18,0.5],[0,0.25],[0.32,0.25]]
];
var shapeIndex=1,shape=shapes[shapeIndex],circlePoints=100;

cWrapper.addEventListener("mousedown",startPress);
document.body.addEventListener("mousemove",move);
document.body.addEventListener("mouseup",endPress);

cWrapper.addEventListener("touchstart",startPress);
document.body.addEventListener("touchmove",move,{passive:false});
document.body.addEventListener("touchend",endPress);
zs.addEventListener("input",scaleCanvas);

document.body.addEventListener("keydown",function(evt){
  var kc=evt.keyCode;
  switch (kc){
    case 90:
      if (evt.ctrlKey) moveBack();
      break;
    case 89:
      if (evt.ctrlKey) moveForward();
      break;
    case 27:
      if (closePopup()) break;
      cancelAction();
      break;
    case 46:
      if (closePopup()) break;
      if (drawMode=="select" || drawMode=="selectShape") saveHistory();
      cancelAction();
      break;
    case 65:
      if (evt.ctrlKey){
        //I have no idea why this timeout is necessary.
        setTimeout(selectAll,10);
        evt.preventDefault();
      }
    case 13:
      if (moveObj&&drawMode!="text"&&moveObj.finish) moveObj.finish();
    case 67:
      if (evt.ctrlKey) copy();
      break;
    case 86:
      if (evt.ctrlKey) paste();
      break;
    case 88:
      if (evt.ctrlKey&&copy()){
        cancelAction(copyData);
        saveHistory();
      }
      break;
    case 83:
      if (evt.ctrlKey){
        save();
        evt.preventDefault();
      }
      break;
    case 79:
      if (evt.ctrlKey){
        openOpen();
        evt.preventDefault();
      }
  }
  //Scale; may not work
  if (evt.ctrlKey){
    switch (evt.which){
      case 189:
        scale(-1);
        evt.preventDefault();
        break;
      case 187:
        scale(1);
        evt.preventDefault();
    }
  }
});

function copy(){
  var sc=document.getElementsByClassName("selcanvas")[0],
      rb=document.getElementsByClassName("resizebox")[1],
      sel=document.getElementsByClassName("tool selected")[0];
  if (sc){
    copyData={
      imgData:sc.getContext("2d").getImageData(0,0,sc.width,sc.height),
      x:rb.offsetLeft/zoom,
      y:rb.offsetTop/zoom,
      w:rb.offsetWidth/zoom,
      h:rb.offsetHeight/zoom,
      copyMode:"image",
      mode:drawMode,
      sel:sel
    }
    return true;
  }else if (maxPath==2&&path.length){
    copyData={
      path:clone(path),
      copyMode:"line",
      mode:drawMode
    };
    return true;
  }else if (moveObj){
    if (moveObj.type=="box"&&(drawMode=="path"||drawMode=="shape")){
      var pth=path.length?path:shape,
          box=getSize(pth);
      for (var i=0;i<pth.length;i++){
        pth[i][0]-=box[2];
        pth[i][1]-=box[3];
      }
      copyData={
        path:pth,
        x:rb.offsetLeft,
        y:rb.offsetTop,
        w:rb.offsetWidth,
        h:rb.offsetHeight,
        copyMode:"path",
        mode:drawMode,
        sel:sel
      }
      return true;
    }
  }
  return false;
}

function paste(){
  if (copyData){
    drawMode=copyData.mode;
    drawObj=drawData[drawMode];
    var cm=copyData.copyMode;
    setTool(copyData.sel,drawMode);
    if (moveObj&&moveObj.finish) moveObj.finish();
    if (moveObj) moveObj.box.parentElement.removeChild(moveObj.box); 
    if (cm!=="line") var box=addResizeBox(copyData.x,copyData.y,copyData.w,copyData.h);
    if (cm=="image"){
      var canv=document.createElement("canvas");
      canv.className="selcanvas";
      canv.width=copyData.imgData.width;
      canv.height=copyData.imgData.height;
      canv.getContext("2d").putImageData(copyData.imgData,0,0);
      moveObj.canvas=canv;
      box.appendChild(canv);
      boxOffs={
        x:copyData.x,
        y:copyData.y
      };
    }else if (cm=="path"){
      startCoords={
        x:copyData.x,
        y:copyData.y
      };
      moveObj.flips={
        x:1,
        y:1
      }
      if (typeof copyData.path[0]=="object"){
        shape=["Irrelevant data"];
        for (var i=0;i<copyData.path.length;i++){
          shape.push([
            copyData.path[i][0]/copyData.w,
            copyData.path[i][1]/copyData.h
          ]);
        }
      }else{
        shape=copyData.path;
      }
      updateShape();
    }else if (cm=="line"){
      path=clone(copyData.path);
      addMovePoint(path[0][0],path[0][1],drawObj,{index:0});
      addMovePoint(path[1][0],path[1][1],drawObj,{index:1});
      updatePath();
    }
  }
  if (box) setSize(box,"objsize");
}

function selectAll(){
  drawMode="select";
  drawObj=drawData.select;
  setTool(null,drawMode);
  setCOffs();
  addResizeBox(0,0,mainc.width,mainc.height);
  cutSelection();
  setSelMode(drawMode);
  moveObj.onscaled=null;
}

document.getElementById("maincontent").addEventListener("click",function(evt){
  if (evt.target.id=="maincontent"&&moveObj&&!started){
    finishAction(evt);
  }
  started=false;
});

function init(){
  var resizeBoxes=document.getElementsByClassName("moverect");
  for (var i=0;i<resizeBoxes.length;i++){
    resizeBoxes[i].addEventListener("mousedown",resizeBox);
    resizeBoxes[i].addEventListener("touchstart",resizeBox);
  }
  var bw=document.getElementById("boxwrapper");
  for (var i=0;i<30;i++){
    var box=document.createElement("div");
    box.className="colorbox";
    if (cols[i]){
      box.setAttribute("data-color",cols[i]);
      palette.fillStyle=cols[i];
      palette.fillRect(i,0,1,1);
      box.color=[].slice.call(palette.getImageData(i,0,1,1).data);
    }
    box.addEventListener("click",function(evt){
      setColor(evt.target.color);
    });
    var innerBox=document.createElement("div");
    innerBox.className="innercol";
    innerBox.style.backgroundColor=cols[i] || "#eee";
    var raster=document.createElement("div");
    raster.className="raster";
    box.appendChild(raster);
    box.appendChild(innerBox);
    bw.appendChild(box);
  }
  var tools=document.querySelectorAll(".tool:not(.nofocus)");
  for (var i=0;i<tools.length;i++){
    tools[i].addEventListener("click",function(evt){
      cancelAction();
      var dM=evt.target.getAttribute("data-mode");
      if (dM!=drawMode) prevMode=drawMode;
      drawMode=dM;
      setTool(evt.target);
      if (evt.target.getAttribute("data-maxpath")) maxPath=parseInt(evt.target.getAttribute("data-maxpath"));
    });
  }
  
  //Add oval data
  for (var n=0;n<circlePoints;n++){
    var ang=Math.PI*2*(n/circlePoints);
    shapes[0].push([Math.cos(ang)/2+0.5,Math.sin(ang)/2+0.5]);
  }
  
  var sb=document.getElementById("shapebox");
  for (var i=0;i<shapes.length;i++){
    var box=document.createElement("div");
    box.className="tool";
    box.setAttribute("data-mode","shape");
    (function(index){
      box.addEventListener("click",function(evt){
        cancelAction();
        var dM=evt.target.getAttribute("data-mode");
        if (dM!=drawMode) prevMode=drawMode;
        drawMode=dM
        setTool(evt.target);
        shape=shapes[index];
      });
    })(i);
    var svg=document.createElementNS("http://www.w3.org/2000/svg","svg"),
        path=document.createElementNS("http://www.w3.org/2000/svg","path"),
        d="";
    svg.setAttribute("viewBox","-3 -3 16 16");
    var pth=shapes[i];
    box.title=pth[0];
    for (var n=1;n<pth.length;n++){
      d+=n==1?"M":"L";
      d+=pth[n][0]*10+" "+pth[n][1]*10;
    }
    path.setAttribute("d",d+"z");
    svg.appendChild(path);
    box.appendChild(svg);
    sb.appendChild(box);
  }
  
  var lw=document.getElementById("linewrapper"),
      lineWidths=[1,2,5,10,15,20,30,50];
  for (var i=0;i<lineWidths.length;i++){
    var ls=document.createElement("div");
    ls.className="linesetting";
    ls.setAttribute("data-linew",lineWidths[i]);
    ls.addEventListener("click",setLW);
    var line=document.createElement("div");
    line.className="line";
    line.style.height=lineWidths[i]+"px";
    ls.appendChild(line);
    lw.appendChild(ls);
  }
  
  document.getElementById("tolslider").addEventListener("input",updateTolerance);
  document.getElementById("canvaswrapperwrapper").onscroll=drawRulers;
  document.body.onresize=drawRulers;
  
  addPopupEvents();
  setTimeout(addFonts,1);
  toggleRulers();
}
  
function toggleRulers(){
  rulers=!rulers;
  if (rulers){
    document.body.classList.add("rulers");
    drawRulers();
  }else{
    document.body.classList.remove("rulers");
    document.getElementById("canvaswrapperwrapper").style="";
  }
  localStorage.setItem("rulers",rulers);
}

function drawRulers(){
  if (!rulers) return;
  var r1=document.getElementById("hor-ruler"),
      r2=document.getElementById("vert-ruler"),
      cww=document.getElementById("canvaswrapperwrapper"),
      mc=document.getElementById("maincontent"),
      interval=rulerIntervals[zs.value];
  cww.style.width=(mc.offsetWidth-20)+"px";
  cww.style.height=(mc.offsetHeight-20)+"px";
  r1.width=mc.offsetWidth;
  r2.height=mc.offsetHeight;
  
  drawRulerLines(r1.getContext("2d"),cww.scrollLeft,r1.width,0,interval);
  drawRulerLines(r2.getContext("2d"),cww.scrollTop,r2.height,1,interval);
}

function drawRulerLines(ctx,min,max,dir,interval){
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  ctx.strokeStyle="#ccc";
  ctx.fillStyle="#999";
  if (dir==1){
    ctx.rotate(-Math.PI/2);
    ctx.translate(-max,0);
  }
  var counter=0,
      step=interval*zoom,
      minVal=-min%step,
      notch=Math.floor(min/step);
  for (var i=minVal;i<max;i+=step/10){
    var coord=i+30;
    if (dir==1) coord=max-coord;
    if (counter%10==0){
      drawBigLine(ctx,coord,(notch++)*interval);
    }else{
      drawSmallLine(ctx,coord);
    }
    counter++;
  }
}

function drawBigLine(ctx,coord,content){
  ctx.beginPath();
  ctx.moveTo(coord,0);
  ctx.lineTo(coord,20);
  ctx.stroke();
  ctx.fillText(content,coord+5,10);
}

function drawSmallLine(ctx,coord){
  ctx.beginPath();
  ctx.moveTo(coord,15);
  ctx.lineTo(coord,20);
  ctx.stroke();
}

function addFonts(){
  var fonts=genFontList(),
      dropdown=document.getElementById("fontsel"),
      sizedrop=document.getElementById("fontsize"),
      sizes=[6,7,8,9,10,11,12,13,14,15,16,18,20,22,24,26,28,32,36,40,44,48,54,60,66,72,80,88,96];
  
  for (var i=0;i<fonts.length;i++){
    var option=document.createElement("option");
    option.value=fonts[i];
    option.style.fontFamily=fonts[i];
    option.innerHTML=fonts[i];
    dropdown.appendChild(option);
  }
  
  for (var i=0;i<sizes.length;i++){
    var option=document.createElement("option");
    option.value=sizes[i];
    option.innerHTML=sizes[i];
    sizedrop.appendChild(option);
  }
  
  dropdown.value=fontData.font;
  sizedrop.value=fontData.size;
  setFont();
}

document.getElementById("fontsel").addEventListener("change",function(evt){
  fontData.font=evt.target.value;
  setFont();
});

document.getElementById("fontsize").addEventListener("change",function(evt){
  fontData.size=parseInt(evt.target.value);
  setFont();
});

document.getElementById("fontstyle").addEventListener("change",function(evt){
  var fd=JSON.parse(evt.target.value);
  fontData.weight=fd[0];
  fontData.style=fd[1];
  setFont();
});

function setFont(){
  var fd=fontData,
      font=fd.style+" "+fd.weight+" "+fd.size+"px/1 "+fd.font;
  sctx.font=font;
  cWrapper.style.font=font;
  cWrapper.style.fontSize=fd.size*zoom+"px";
}

function setTool(elem,toolName,block){
  var sel=document.getElementsByClassName("tool selected")[0];
  if (sel) sel.classList.remove("selected");
  var selItem=(elem || document.querySelector(".tool[data-mode='"+toolName+"']") || document.querySelector(".tool[data-modeoptions*='|"+toolName+"|']"));
  selItem.classList.add("selected");
  var tool=toolName || drawMode;
  drawObj=drawData[tool];
  if (selItem.id=="selbtn"&&!block) setSelMode(tool);
  setExtras();
  setCursor(tool);
}

function setExtras(){
  var extras=document.getElementsByClassName("extra");
  for (var i=0;i<extras.length;i++) extras[i].classList.add("hidden");
  if (drawMode=="free"||drawMode=="path"||drawMode=="shape"||drawMode=="erase"){
    activeWidth=drawMode=="free"?"lWidth":(drawMode=="erase"?"eWidth":"sWidth"); 
    document.getElementById("linebox").classList.remove("hidden");
  }else if (drawMode=="fill"){
    document.getElementById("tolerance").classList.remove("hidden");
  }else if (drawMode=="text"){
    document.getElementById("fontsettings").classList.remove("hidden");
  }
}

function setColInput(elem,val){
  document.querySelector("#colorbar .bigbox.selected").classList.remove("selected");
  elem.classList.add("selected");
  colMode=val;
  setColSel(colMode==0?colorArr:backColorArr);
  setCursor();
}

function setColor(arr){
  var col=arrToCol(arr);
  if (colMode==0){
    colorArr=arr;
    opacity=colorArr[3]/255;
    cWrapper.style.color=col;
    document.getElementById("maincol").style.background=col;
  }else{
    backColorArr=arr;
    document.getElementById("secondcol").style.background=col;
  }
  setColSel(arr);
  setCursor();
  callUpdate();
}

function callUpdate(){
  //drawMode=="path" --> Won't break when updated without objMode.
  if (drawData[drawMode].update&&moveObj||drawMode=="path") drawData[drawMode].update();
}

function setColSel(arr){
  var rainbow=document.getElementById("rainbow");
  rainbow.style.opacity=arr[3]/255;
  document.getElementById("colsel").color=arr;
  arr=estimateCol(arr);
  rainbow.style.background=arrToCol(arr,true);
}

function switchColors(){
  var tmpCol=colorArr;
  colorArr=backColorArr;
  backColorArr=tmpCol;
  var colOrder=colMode==0?[backColorArr,colorArr]:[colorArr,backColorArr];
  colMode=colMode*-1+1;
  setColor(colOrder[0]);
  colMode=colMode*-1+1;
  setColor(colOrder[1]);
}

function setMainColorCanvas(){
  var col=arrToCol(colorArr);
  var colFull=arrToCol(colorArr,true);
  mctx.strokeStyle=col;
  mctx.fillStyle=col;
  sctx.strokeStyle=colFull;
  sctx.fillStyle=colFull;
}

function arrToCol(arr,noOpacity){
  if (noOpacity) return "rgb("+arr[0]+","+arr[1]+","+arr[2]+")";
  return "rgba("+arr[0]+","+arr[1]+","+arr[2]+","+arr[3]/255+")";
}

function setCOffs(){
  var bcr=mainc.getBoundingClientRect();
  canvOffset={
    x:bcr.left,
    y:bcr.top
  };
}

function startPress(evt){
  if (blockAction||evt.which&&evt.which!=1) return;
  started=false;
  setCOffs();
  
  setMainColorCanvas();
  if (evt.target.tagName=="CANVAS"&&moveObj){
    finishAction(evt);
  }
  drawObj=drawData[drawMode];
  drawing=true;
  prevCoords=null;
  
  var coords=getCoordsOffs(evt,true),
      x=coords[0],
      y=coords[1],
      x2=Math.round(x/zoom),
      y2=Math.round(y/zoom);
  
  document.body.setAttribute("data-action",drawMode);
  if (drawObj.events.down) drawObj.events.down(evt,x2,y2,x,y);
}

function move(evt){
  setCOffs();
  var coords=getCoordsOffs(evt,true),
      x=coords[0],
      y=coords[1],
      x2=Math.round(x/zoom),
      y2=Math.round(y/zoom);
  if (!blockAction){
    if (drawing){
      if (drawObj.events.move) drawObj.events.move(evt,x2,y2,x,y);
    }else if(drawObj.events.hover){
      drawObj.events.hover(evt,x2,y2,x,y);
    }
  }
  
  var coordDOM=document.getElementById("coords"),
      curWrapper=document.getElementById("cursors");
  coordDOM.innerHTML="";
  curWrapper.style.display="none";
  if (evt.target.classList.contains("resizebox")){
    coordDOM.innerHTML=x2+", "+y2+"px";
    curWrapper.style.display="block";
    if (currCur){
      if (currCur.id!="cur_erase"){
        currCur.style.left=x+"px";
        currCur.style.top=y+"px";
      }else{
        currCur.style.left=Math.floor(x2*zoom)+"px";
        currCur.style.top=Math.floor(y2*zoom)+"px";
      }
    }
  }
  
  //Move ruler cursors
  if (rulers){
    if (getParentById(evt.target,"maincontent")){
      document.getElementById("ruler-line-hor").style.left=(x+30)+"px";
      document.getElementById("ruler-line-vert").style.top=(y+30)+"px";
    }
  }
}

function getParentById(elem,id){
  while(true){
    if (!elem)
      return null;
    if (elem.id==id)
      return elem;
    elem=elem.parentElement;
  }
}

function endPress(evt){
  if (drawing&&!blockAction){
    var coords=getCoordsOffs(evt),
        x=coords[0],
        y=coords[1];
    console.log("depress");
    drawing=false;
    if (drawObj.events.up) drawObj.events.up(evt,x,y);
    document.body.removeAttribute("data-action");
  }
}

function saveHistory(){
  histPointer++;
  var imgData=mctx.getImageData(0,0,mainc.width,mainc.height);
  hist.splice(histPointer,hist.length-histPointer,imgData);
  if (hist.length>maxMem){
    hist.splice(0,1);
    histPointer--;
  }
  setSize(mainc,"canvsize");
  cancelAction();
}

function moveForward(){
  if (cancelAction()) return;
  histPointer++;
  if (histPointer==hist.length) histPointer--;
  reconstructHistory();
}

function moveBack(){
  if (cancelAction()) return;
  histPointer--;
  if (histPointer<0) histPointer=0;
  reconstructHistory();
}

function reconstructHistory(){
  var hItem=hist[histPointer];
  setCanvas(hItem.width,hItem.height);
  mctx.putImageData(hItem,0,0);
}

function setCanvas(w,h){
  mainc.width=w;
  mainc.height=h;
  secc.width=w;
  secc.height=h;
  cWrapper.style.width=w*zoom+"px";
  cWrapper.style.height=h*zoom+"px";
  mctx.clearRect(0,0,w,h);
  setSize(mainc,"canvsize");
} 

function setSize(elem,id){
  var bcr=elem.getBoundingClientRect();
  document.getElementById(id).innerHTML=Math.round(elem.width || bcr.width/zoom)+"px × "+Math.round(elem.height || bcr.height/zoom)+"px";
}

/*ACTUAL DRAWING*/

/*FREELINE DRAWING*/
function freeLine(evt){
  var coords=getCoordsOffs(evt),
      x=coords[0],
      y=coords[1];
  secc.style.opacity=opacity;
  var ctx=opacity==1?mctx:sctx;
  
  if (prevCoords){
    ctx.lineWidth=lWidth;
    ctx.beginPath();
    ctx.moveTo(prevCoords.x,prevCoords.y);
    ctx.lineTo(x,y);
    ctx.stroke();
  }
  drawCircle(ctx,x,y,lWidth);
  prevCoords={
    x:x,
    y:y
  };
}

function setFree(){
  if (opacity<1){
    mctx.globalAlpha=opacity;
    mctx.drawImage(secc,0,0);
    mctx.globalAlpha=1;
    sctx.clearRect(0,0,secc.width,secc.height);
    secc.style.opacity=1;
    console.log("GOT HERE!!!");
  }else{
    secc.style.opacity=1;
  }
  saveHistory();
}

/*RESIZE/MOVE*/
function moveBox(evt){
  var coords=getCoords(evt);
  var bcr=evt.target.getBoundingClientRect();
  oldMode=drawMode;
  drawMode="move";
  offset={
    x:coords[0]-bcr.left,
    y:coords[1]-bcr.top
  };
  moveData={
    box:evt.target
  }
  startPress(evt);
  evt.stopPropagation();
}

function moveB(evt,nx,ny,x,y){
  moveData.box.classList.add("moving");
  x=(x-offset.x)/zoom;
  y=(y-offset.y)/zoom;
  moveData.box.style.left=cWP(x);
  moveData.box.style.top=cHP(y);
  document.getElementById("boxcoords").innerHTML=Math.floor(x)+", "+Math.floor(y)+"px";
  if (moveObj&&moveObj.boxmove) moveObj.boxmove(evt);
}

function endMove(evt){
  moveData.box.classList.remove("moving");
  drawMode=oldMode;
}

function resizeBox(evt){
  oldMode=drawMode;
  drawMode="resize";
  var parent=evt.target.parentElement;
  moveData={
    box:parent,
    dir:evt.target.getAttribute("data-direction"),
    bcr:parent.getBoundingClientRect(),
    mode:parseInt(evt.target.getAttribute("data-pos")),
    backResize:parent.getAttribute("data-backresize")=="true"
  }
  startPress(evt);
  moveData.box.classList.add("resizing");
  evt.stopPropagation();
}

function resize(evt){
  var coords=getCoords(evt),
      x=coords[0],
      y=coords[1];
  
  var rdm=moveData.mode;
  if (rdm>1&&rdm<7){
    if (moveData.dir.hasChar('w')&&rdm!=6) moveData.box.style.width=eWP(x-moveData.bcr.left);
    if (moveData.dir.hasChar('h')&&rdm!=2) moveData.box.style.height=eHP(y-moveData.bcr.top);
  }
  if (rdm<3||rdm>5){
    if (moveData.dir.hasChar('w')&&rdm!=2) moveData.box.style.width=eWP(moveData.bcr.width-(x-moveData.bcr.left));
    if (moveData.dir.hasChar('h')&&rdm!=6) moveData.box.style.height=eHP(moveData.bcr.height-(y-moveData.bcr.top));
    var bcr=moveData.box.getBoundingClientRect();
    var l=moveData.bcr.left+moveData.bcr.width-bcr.width-canvOffset.x,
        t=moveData.bcr.top+moveData.bcr.height-bcr.height-canvOffset.y;
    if (moveData.dir.hasChar('w')&&rdm!=2) moveData.box.style.left=eWP(l);
    if (moveData.dir.hasChar('h')&&rdm!=6) moveData.box.style.top=eHP(t);
    document.getElementById("boxcoords").innerHTML=Math.floor(l/zoom)+", "+Math.floor(t/zoom)+"px";
  }
  setSize(moveData.box,moveData.box.id=="resizemain"?"canvsize":"objsize");
  if (moveObj&&moveObj.boxresize) moveObj.boxresize(evt);
}

function endResize(evt){
  moveData.box.classList.remove("resizing","unbounded");
  if (moveObj&&moveObj.onscaled){   //Hmm... Check this.
    moveObj.onscaled(evt);
    moveObj.onscaled=undefined;
  }
  var bcr=moveData.box.getBoundingClientRect();
  drawMode=oldMode;
  if (moveData.box.id=="resizemain"){
    setCanvas(bcr.width/zoom,bcr.height/zoom);
    mctx.putImageData(hist[histPointer],0,0);
    moveData.box.removeAttribute("style");
    saveHistory();
    return;
  }
  if (drawData[drawMode].events.up) drawData[drawMode].events.up(evt);
}

function addScaleBox(evt){
  if (moveObj){
    finishAction(evt);
    return;
  }
  var coords=getCoordsOffs(evt);
  var box=addResizeBox(coords[0],coords[1],0,0);
  moveObj.onscaled=drawData[drawMode].events.onscaled;
  var event=new Event("mousedown");
  box.classList.add("unbounded");
  box.querySelector(".moverect[data-pos='4']").dispatchEvent(event);
}

function addResizeBox(x,y,w,h,html){
  var boxes=document.getElementsByClassName("resizebox");
  if (boxes.length==2) return boxes[1];
  var box=document.createElement("div");
  box.className="resizebox decorated";
  var dir=["wh","h","wh","w","wh","h","wh","w"];
  box.addEventListener("mousedown",moveBox);
  box.addEventListener("touchstart",moveBox);
  for (var i=0;i<8;i++){
    var rb=document.createElement("div");
    rb.className="moverect";
    rb.addEventListener("mousedown",resizeBox);
    rb.addEventListener("touchstart",resizeBox);
    rb.setAttribute("data-direction",dir[i]);
    rb.setAttribute("data-pos",i);
    box.appendChild(rb);
  }
  box.style.left=cWP(x);
  box.style.top=cHP(y);
  box.style.width=cWP(w);
  box.style.height=cHP(h);
  if (html) box.appendChild(html);
  cWrapper.appendChild(box);
  moveObj={
    type:"box",
    box:box,
    finish:drawObj.events.finish,
    boxmove:drawObj.events.boxmove,
    boxresize:drawObj.events.boxresize
  };
  document.getElementById("boxcoords").innerHTML=Math.floor(x)+", "+Math.floor(y)+"px";
  return box;
}

function cWP(val){
  return (val/mainc.width)*100+"%";
}

function cHP(val){
  return (val/mainc.height)*100+"%";
}

function eWP(val){
  return (val/mainc.getBoundingClientRect().width)*100+"%";
}

function eHP(val){
  return (val/mainc.getBoundingClientRect().height)*100+"%";
}

//FILL
//Fill algorithm courtesy of Will Thimbleby: http://will.thimbleby.net/scanline-flood-fill/
var imgData,replaceCol,width;

function fill(evt){
  var coords=getCoordsOffs(evt),
      x=coords[0],
      y=coords[1];
  
  var id=mctx.getImageData(0,0,mainc.width,mainc.height);
  imgData=id.data;
  width=mainc.width;
  replaceCol=mctx.getImageData(x,y,1,1).data;
  if (testFillable(x,y)) return;
  floodFillScanline(x,y,mainc.width,mainc.height);
  mctx.clearRect(0,0,mainc.width,mainc.height);
  mctx.putImageData(id,0,0);
  saveHistory();
}

function floodFillScanline(x, y, width, height) {
	// xMin, xMax, y, down[true] / up[false], extendLeft, extendRight
	var ranges = [[x, x, y, null, true, true]];
	paint(x, y);

	while(ranges.length) {
		var r = ranges.pop();
		var down = r[3] === true;
		var up = r[3] === false;
	
		// extendLeft
		var minX = r[0];
		var y = r[2];
		if(r[4]) {
			while(minX>0 && test(minX-1, y)) {
				minX--;
				paint(minX, y);
			}
		}
		var maxX = r[1];
		// extendRight
		if(r[5]) {
			while(maxX<width-1 && test(maxX+1, y)) {
				maxX++;
				paint(maxX, y);
			}
		}
    
    // extend range ignored from previous line
    r[0]--;
    r[1]++;
	
		function addNextLine(newY, isNext, downwards) {
			var rMinX = minX;
			var inRange = false;
			for(var x=minX; x<=maxX; x++) {
				// skip testing, if testing previous line within previous range
				var empty = (isNext || (x<r[0] || x>r[1])) && test(x, newY);
				if(!inRange && empty) {
					rMinX = x;
					inRange = true;
				}
				else if(inRange && !empty) {
					ranges.push([rMinX, x-1, newY, downwards, rMinX==minX, false]);
					inRange = false;
				}
				if(inRange) {
					paint(x, newY);
				}
				// skip
				if(!isNext && x==r[0]) {
					x = r[1];
				}
			}
			if(inRange) {
				ranges.push([rMinX, x-1, newY, downwards, rMinX==minX, true]);
			}
		}
	
		if(y<height)
			addNextLine(y+1, !up, true);
		if(y>0)
			addNextLine(y-1, !down, false);
	}
}

function test(x,y){
  var index=(y*width+x)*4;
  var isReplace=true;
  for (var i=0;i<4;i++){
    isReplace&=Math.abs(imgData[index+i]-replaceCol[i])<=fillTolerance;
  }
  return isReplace;
}

function testFillable(x,y){
  var index=(y*width+x)*4;
  for (var i=0;i<4;i++){
    if (imgData[index+i]!=colorArr[i]) return false;
  }
  return true;
}

function paint(x,y){
  var index=(y*width+x)*4;
  for (var i=0;i<4;i++){
    imgData[index+i]=colorArr[i];
  }
}

/*function floodFill(imgData,index,replace,col,indexMap){
  setCol(imgData.data,index,col);
  //mctx.putImageData(imgData,0,0);
  //setTimeout(function(){
    for (var i=0;i<4;i++){
      if (!isEqual(col,imgData.data,index+indexMap[i])&&isEqualTolerance(replace,imgData.data,index+indexMap[i],40)) floodFill(imgData,index+indexMap[i],replace,col,indexMap);
    }
  //},50);
}

function isEqual(arr,arr2,index){
  for (var i=0;i<4;i++){
    if (arr[i]!=arr2[index+i]) return false;
  }
  return true;
}

function isEqualTolerance(arr,arr2,index,tolerance){
  for (var i=0;i<4;i++){
    if (Math.abs(arr[i]-arr2[index+i])>tolerance) return false;
  }
  return true;
}

function setCol(imgData,index,col){
  for (var i=0;i<4;i++){
    imgData[index+i]=col[i];
  }
}*/

//TEXT
function setTextBox(evt){
  var ta=document.createElement("textarea");
  ta.spellcheck=false;
  setInactive(ta);
  var container=document.createElement("div");
  container.className="tawrapper";
  container.appendChild(ta);
  moveData.box.appendChild(container);
}

function focusBox(evt){
  if (!moveObj) return;
  var bcr=moveObj.box.getBoundingClientRect();
  moveObj.box.getElementsByTagName("textarea")[0].focus();
  if (bcr.width<=10&&bcr.height<=10){
    moveObj.box.style.width=cWP(fontData.size*5);
    moveObj.box.style.height=cHP(fontData.size+4);
    setSize(moveData.box,"objsize");
  }
}

function setText(evt){
  var bcr=moveObj.box.getBoundingClientRect();
  var content=moveObj.box.getElementsByTagName("textarea")[0].value;
  drawText(bcr.left-canvOffset.x,bcr.top-canvOffset.y,bcr.width,bcr.height,content,fontData.size);
  if (content.replace(/\s/g,"").length) saveHistory();
  else cancelAction();
}

function drawText(x,y,w,h,str,fontSize){
  setFont();
  w/=zoom;
  sctx.fillStyle=arrToCol(colorArr);
  var lines=[];
  var strings=str.split("\n");
  for (var i=0;i<strings.length;i++){
    var blocks=strings[i].split(" ");
    var line="";
    for (var n=0;n<blocks.length;n++){
      if (sctx.measureText(line+blocks[n]).width>w){
        if (line){
          lines.push(line);
          line="";
          n--;
        }else{
          var newLine=getFittedString(blocks[n],w);
          lines.push(newLine[0]);
          blocks[n]=newLine[1];
          n--;
        }
      }else{
        line+=(blocks[n]+" ");
      }
    }
    if (line) lines.push(line);
  }
  sctx.textBaseline="top";
  for (var i=0;i<lines.length;i++){
    sctx.fillText(lines[i],x/zoom,y/zoom+i*fontSize-2);
  }
  sctx.clearRect(0,(y+h)/zoom,secc.width,secc.height);
  mctx.drawImage(secc,0,0);
  sctx.clearRect(0,0,secc.width,secc.height);
}

function getFittedString(str,w){
  console.log(str);
  var line=str[0];
  for (var i=1;i<str.length;i++){
    if (sctx.measureText(line+str[i]).width>w) return [line,str.substr(i)];
    line+=str[i];
  }
}

//ERASE
function erase(evt,x,y){
  if (prevCoords){
    var abs=Math.hypot(x-prevCoords.x,y-prevCoords.y),
        dx=x-prevCoords.x,
        dy=y-prevCoords.y;
    
    for (var i=0;i<abs;i++){
      var perc=(i/abs);
      mctx.clearRect(x-dx*perc-Math.floor(eWidth/2),y-dy*perc-Math.floor(eWidth/2),eWidth,eWidth);
    }
  }else{
    mctx.clearRect(x-Math.floor(eWidth/2),y-Math.floor(eWidth/2),eWidth,eWidth);
  }
  
  prevCoords={
    x:x,
    y:y
  };
}

//DROPPER
function dropper(evt,nx,ny,x,y){
  setColor(mctx.getImageData(Math.floor(x/zoom),Math.floor(y/zoom),1,1).data);
  setTool(document.querySelector(".tool[data-mode='"+prevMode+"']"));
  drawMode=prevMode;
  setCursor();
  setExtras();
}

function dropMove(evt,nx,ny,x,y){
  document.getElementById("thiscol").setAttribute("stroke",arrToCol(mctx.getImageData(Math.floor(x/zoom),Math.floor(y/zoom),1,1).data));
}

//SELECTION
function cutSelection(){
  var bcr=moveObj.box.getBoundingClientRect();
  var x=(bcr.left-canvOffset.x)/zoom,
      y=(bcr.top-canvOffset.y)/zoom,
      w=bcr.width/zoom,
      h=bcr.height/zoom;
  
  var imgData=mctx.getImageData(x,y,w,h);
  moveObj.imgData=imgData;
  mctx.clearRect(x,y,w,h);
  var canv=document.createElement("canvas");
  canv.className="selcanvas";
  canv.width=w;
  canv.height=h;
  moveObj.canvas=canv;
  moveObj.box.appendChild(canv);
  canv.getContext("2d").putImageData(imgData,0,0);
  boxOffs={
    x:x,
    y:y
  };
}

function setSelection(evt){
  var bcr=moveObj.box.getBoundingClientRect();
  mctx.imageSmoothingEnabled=false;
  mctx.drawImage(moveObj.canvas,(bcr.left-canvOffset.x)/zoom,(bcr.top-canvOffset.y)/zoom,bcr.width/zoom,bcr.height/zoom);
  saveHistory();
}

//CROP
function crop(){
  var bcr=moveObj.box.getBoundingClientRect(),
      x=(bcr.left-canvOffset.x)/zoom,
      y=(bcr.top-canvOffset.y)/zoom,
      w=bcr.width/zoom,
      h=bcr.height/zoom;
  
  var imgData=mctx.getImageData(x,y,w,h);
  setCanvas(w,h);
  mctx.putImageData(imgData,0,0);
  saveHistory();
}

//SHAPE
function startShape(evt,x,y){
  if (moveObj){
    finishAction(evt);
    return;
  }
  
  startCoords={
    x:x,
    y:y
  }
}

function relayUpdateShape(){
  if (moveObj) updateShape();
}

function updateShape(evt,ctx){
  if (!startCoords) return;
  ctx=ctx&&ctx.canvas?ctx:sctx;
  if (!moveObj){
    var coords=getCoordsOffs(evt),
        x=coords[0],
        y=coords[1];
    var w=(x-startCoords.x)*zoom,
        h=(y-startCoords.y)*zoom,
        sx=(startCoords.x)*zoom,
        sy=(startCoords.y)*zoom;
    document.getElementById("objsize").innerHTML=Math.abs(w)+"px × "+Math.abs(h)+"px";
  }else{
    var bcr=moveObj.box.getBoundingClientRect();
    var x=(moveObj.flips.x==1?bcr.left:bcr.right)-canvOffset.x,
        y=(moveObj.flips.y==1?bcr.top:bcr.bottom)-canvOffset.y,
        w=bcr.width*moveObj.flips.x,
        h=bcr.height*moveObj.flips.y,
        sx=x,
        sy=y;
  }
  
  ctx.lineWidth=sWidth;
  if (ctx.canvas.id!="maincanvas") ctx.clearRect(0,0,secc.width,secc.height);
  
  var s=shape.slice(1);
  var ex=(sx+(s[0][0]+s[1][0])/2*w)/zoom,
      ey=(sy+(s[0][1]+s[1][1])/2*h)/zoom;
  
  ctx.strokeStyle=arrToCol(colorArr);
  ctx.fillStyle=arrToCol(backColorArr);
  
  ctx.beginPath();
  ctx.moveTo(ex,ey);
  for (var i=1;i<=s.length;i++){
    ctx.lineTo((sx+s[i%s.length][0]*w)/zoom,(sy+s[i%s.length][1]*h)/zoom);
  }
  ctx.lineTo(ex,ey);
  ctx.fill();
  ctx.stroke();
}

function addBoundBox(evt,x,y){
  if (!startCoords) return;
  var w=Math.abs(x-startCoords.x),
      h=Math.abs(y-startCoords.y);
  
  if (w<2&&h<2) return;
  
  if (!moveObj){
    addResizeBox(Math.min(x,startCoords.x),Math.min(y,startCoords.y),w,h);
    moveObj.flips={
      x:Math.sign(x-startCoords.x),
      y:Math.sign(y-startCoords.y)
    };
  }
  started=true;
}

function addShape(){
  updateShape(null,mctx);
  sctx.clearRect(0,0,secc.width,secc.height);
  startCoords=null;
  saveHistory();
}

//PATH
function startPath(evt){
  if (moveObj){
    finishAction(evt);
    return;
  }
  drawMovePath(evt);
  if (path.length>0) return;
  path.push(getCoordsOffs(evt));
}

function drawMovePath(evt){
  sctx.clearRect(0,0,secc.width,secc.height);
  drawPath(sctx,[getCoordsOffs(evt)]);
}

function drawPath(ctx,addPoint){
  var pathArr=(addPoint&&path.length<maxPath)?path.concat(addPoint):path;
  ctx.lineWidth=sWidth;
  
  if (pathArr.length==0) return;
  
  getSize(pathArr);
  
  ctx.strokeStyle=arrToCol(colorArr);
  ctx.fillStyle=arrToCol(backColorArr);
  
  ctx.beginPath();
  ctx.moveTo(pathArr[0][0],pathArr[0][1]);
  for (var i=1;i<pathArr.length;i++){
    ctx.lineTo(pathArr[i][0],pathArr[i][1]);
  }
  ctx.fill();
  ctx.stroke();
}

function continuePath(evt){
  if (path.length==0) return;
  if (path.length<maxPath){
    path.push(getCoordsOffs(evt));
  }
  
  if (maxPath>2){
    if (shouldClose(path)) pathToMoveBox(evt);
  }else{
    if (path[0][0]==path[1][0]&&path[0][1]==path[1][1]){
      document.getElementById("objsize").innerHTML="";
      document.getElementById("boxcoords").innerHTML="";
      moveObj=null;
      path=[];
      return;
    }
    addMovePoint(path[0][0],path[0][1],drawObj,{index:0});
    addMovePoint(path[1][0],path[1][1],drawObj,{index:1});
  }
}

function shouldClose(arr){
  var lastIndex=arr.length-1;
  if (Math.hypot(arr[0][0]-arr[lastIndex][0],arr[0][1]-arr[lastIndex][1])<5){
    arr[lastIndex]=[arr[0][0],arr[0][1]];
    return true;
  }
  //Pretty much the same thing, but detects double clicks to close paths.
  if (Math.hypot(arr[lastIndex-1][0]-arr[lastIndex][0],arr[lastIndex-1][1]-arr[lastIndex][1])<2){
    arr[lastIndex]=[arr[0][0],arr[0][1]];
    return true;
  }
  return false;
}

function getSize(arr){
  var minX=Infinity,minY=Infinity,maxX=0,maxY=0;
  for (var i=0;i<arr.length;i++){
    var x=arr[i][0],
        y=arr[i][1];
    if (x<minX) minX=x;
    if (x>maxX) maxX=x;
    if (y<minY) minY=y;
    if (y>maxY) maxY=y;
  }
  var w=maxX-minX,
      h=maxY-minY;
  if (w||h) document.getElementById("objsize").innerHTML=w+"px × "+h+"px";
  return [maxX-minX,maxY-minY,minX,minY];
}

function pathToMoveBox(evt){
  if (moveObj) return;
  var data=getSize(path);
  console.log(data);
  shape=["Irrelevant data"];
  for (var i=0;i<path.length;i++){
    shape.push([
      (path[i][0]-data[2])/data[0],
      (path[i][1]-data[3])/data[1]
    ]);
  }
  startCoords=true;
  addResizeBox(data[2],data[3],data[0],data[1]);
  moveObj.flips={
    x:1,
    y:1
  };
  updateShape();
}

function updatePath(){
  console.log("GOT HERE!");
  if (moveObj&&moveObj.type=="box"){
    updateShape();
  }else{
    sctx.clearRect(0,0,secc.width,secc.height);
    drawPath(sctx);
  }
}

function moveCoord(evt,data){
  path[data.index]=getCoordsOffs(evt);
  sctx.clearRect(0,0,secc.width,secc.height);
  drawPath(sctx);
}

function relaySetPath(){
  if (moveObj.type=="box") addShape();
  else setPath();
}

function setPath(){
  drawPath(mctx);
  sctx.clearRect(0,0,secc.width,secc.height);
  path=[];
  drawMode="path";
  saveHistory();
}

//MOVE POINT
function addMovePoint(x,y,mode,data){
  var point=document.createElement("div");
  point.className="moverect freemove";
  point.style.left=cWP(x);
  point.style.top=cHP(y);
  point.addEventListener("mousedown",selectPoint);
  point.addEventListener("touchstart",selectPoint);
  cWrapper.appendChild(point);
  if (!moveObj||moveObj.type=="box"){   //moveObj.type=="box" should NEVER be true.
    moveObj={
      type:"point",
      modeData:mode,
      dom:point,
      currentData:data,
      data:{},
      pointmove:drawObj.events.pointmove,
      finish:drawObj.events.finish
    };
  }
  var id="point_"+Object.keys(moveObj.data).length
  moveObj.data[id]=data;
  point.id=id;
}

function selectPoint(evt){
  oldMode=drawMode;
  moveObj.dom=evt.target;
  moveObj.currentData=moveObj.data[evt.target.id];
  drawMode="movePoint";
}

function movePoint(evt,x,y){
  moveObj.dom.style.left=cWP(x);
  moveObj.dom.style.top=cHP(y);
  if (moveObj.pointmove) moveObj.pointmove(evt,moveObj.currentData);
}

function dropPoint(evt){
  console.log("GOT HERE TOO!");
  drawMode=oldMode;
}

function relayUpdate(){
  if (moveObj.modeData.update) moveObj.modeData.update();
}

//-------------------------------------------------------------------------------

function drawCircle(ctx,x,y,d){
  ctx.beginPath();
  ctx.arc(x,y,d/2,0,Math.PI*2);
  ctx.fill();
}

Math.hypot=function(a,b){
  return Math.sqrt(a*a+b*b);
};

String.prototype.hasChar=function(chr){
  for (var i=0;i<this.length;i++){
    if (this[i]==chr) return true;
  }
  return false;
};

function getCoords(evt){
  return[Math.floor((evt.touches || [evt])[0].clientX),Math.floor((evt.touches || [evt])[0].clientY)];
}

function getCoordsOffs(evt,noZoom,inverse){
  if (evt.type=="touchend") return getCoords(lastEvt);
  var z=noZoom?1:(inverse?1/zoom:zoom);
  lastEvt=evt;
  return[Math.floor(((evt.touches || [evt])[0].clientX-canvOffset.x)/z),Math.floor(((evt.touches || [evt])[0].clientY-canvOffset.y)/z)];
}

function setInactive(elem){
  elem.addEventListener("mousedown",doNothing);
  elem.addEventListener("touchstart",doNothing);
}

function doNothing(evt){
  evt.stopPropagation();
}

function finishAction(evt){
  moveObj.finish(evt);
}

function cancelAction(copyData){
  closePopup();
  if (moveObj){
    if (moveObj.type=="box") moveObj.box.parentElement.removeChild(moveObj.box);
    else{
      var boxes=[].slice.call(document.getElementsByClassName("moverect freemove"));
      boxes.forEach(function(box){
        box.parentElement.removeChild(box);
      });
    }
    document.getElementById("objsize").innerHTML="";
    document.getElementById("boxcoords").innerHTML="";
    moveObj=null;
    if (!copyData||copyData.copyMode!="image") reconstructHistory();
    path=[];
    return true;
  }else if(drawMode=="path"){
    sctx.clearRect(0,0,secc.width,secc.height);
    reconstructHistory();
    path=[];
  }
  return false;
}

var selectCoords=[];
function startSelect(evt){
  if (moveObj){
    finishAction(evt);
    return;
  }
  selectCoords.push(getCoordsOffs(evt));
  getSize(selectCoords);
}

function moveSelect(evt){
  if (!selectCoords.length) return;
  selectCoords.push(getCoordsOffs(evt));
  getSize(selectCoords);
  sctx.clearRect(0,0,secc.width,secc.height);
  sctx.beginPath();
  sctx.moveTo(selectCoords[0][0],selectCoords[0][1]);
  for (var i=1;i<selectCoords.length;i++){
    sctx.lineTo(selectCoords[i][0],selectCoords[i][1]);
  }
  sctx.lineWidth=1;
  sctx.strokeStyle="white";
  sctx.stroke();
  sctx.strokeStyle="blue";
  sctx.setLineDash([4]);
  sctx.stroke();
  sctx.setLineDash([]);
}

function completeSelect(){
  if (!selectCoords.length) return;
  sctx.clearRect(0,0,secc.width,secc.height);
  sctx.fillStyle="white";
  sctx.beginPath();
  sctx.moveTo(selectCoords[0][0],selectCoords[0][1]);
  for (var i=1;i<selectCoords.length;i++){
    sctx.lineTo(selectCoords[i][0],selectCoords[i][1]);
  }
  sctx.fill();
  var box=getSize(selectCoords);
  if (!box[0]||!box[1]){
    selectCoords=[];
    return;
  }
  addResizeBox(box[2],box[3],box[0],box[1]);
  var canv=document.createElement("canvas");
  canv.className="selcanvas";
  canv.width=box[0];
  canv.height=box[1];
  moveObj.canvas=canv;
  moveObj.box.appendChild(canv);
  var id=mctx.createImageData(box[0],box[1]),
      id2=mctx.getImageData(0,0,mainc.width,mainc.height),
      id3=sctx.getImageData(0,0,mainc.width,mainc.height);
  
  sctx.clearRect(0,0,mainc.width,mainc.height);
  
  for (var h=0;h<box[1];h++){
    for (var w=0;w<box[0];w++){
      var i=(h*box[0]+w)*4,
          i2=((box[3]+h)*mainc.width+box[2]+w)*4;
      if (id3.data[i2]){
        for (var n=0;n<4;n++){
          id.data[i+n]=id2.data[i2+n]
        }
        id2.data[i2+3]=0;
      }
    }
  }
  mctx.clearRect(0,0,mainc.width,mainc.height);
  mctx.putImageData(id2,0,0);
  canv.getContext("2d").putImageData(id,0,0);
  selectCoords=[];
}

//FLIP
function flip(mode,data){
  if (mode=="rot"){
    sctx.drawImage(mainc,0,0);
    mctx.clearRect(0,0,mainc.width,mainc.height);
    if (Math.abs(data)==90){
      var tmpVal=mainc.width;
      mainc.width=mainc.height;
      mainc.height=tmpVal;
    }
    mctx.translate(mainc.width/2,mainc.height/2);
    mctx.rotate(data*Math.PI/180);
    if (data==180) mctx.translate(-mainc.width/2,-mainc.height/2);
    else mctx.translate(-mainc.height/2,-mainc.width/2);
    mctx.drawImage(secc,0,0);
    mctx.setTransform(1,0,0,1,0,0);
    secc.width=mainc.width;
    secc.height=mainc.height;
    sctx.clearRect(0,0,mainc.width,mainc.height);
    cWrapper.style.width=mainc.width*zoom+"px";
    cWrapper.style.height=mainc.height*zoom+"px";
  }else{
    sctx.drawImage(mainc,0,0);
    mctx.clearRect(0,0,mainc.width,mainc.height);
    mctx.setTransform(data[0]?-data[0]:1,0,0,data[1]?-data[1]:1,0,0);
    mctx.translate(-mainc.width*data[0],-mainc.height*data[1]);
    mctx.drawImage(secc,0,0);
    mctx.setTransform(1,0,0,1,0,0);
    sctx.clearRect(0,0,mainc.width,mainc.height);
  }
  saveHistory();
}

function scaleCanvas(){
  zoom=zoomLvls[parseInt(zs.value)];
  document.getElementById("zoomperc").innerHTML=zoom*100+"%";
  cWrapper.style.width=mainc.width*zoom+"px";
  cWrapper.style.height=mainc.height*zoom+"px";
  setCursor();
  setFont();
  drawRulers();
}

function scale(dir){
  zs.value=parseInt(zs.value)+dir;
  scaleCanvas();
}


//-----------------------------POPUPS-----------------------------

var popupDOM=null,
    valDOM=document.getElementsByClassName("rgbaval"),
    coordData,
    colorVals=[[255,0,0],[255,255,0],[0,255,0],[0,255,255],[0,0,255],[255,0,255],[255,0,0]];

function addPopupEvents(){
  var headers=document.getElementsByClassName("popupheader");
  for (var i=0;i<headers.length;i++){
    headers[i].addEventListener("mousedown",pickupPopup);
    headers[i].addEventListener("touchstart",pickupPopup);
  }
  setupColorPicker();
  coordData={
    shadebox:{
      x:255,
      y:0
    },
    hue:{
      y:0
    },
    transparency:{
      y:255
    }
  };
  updateCursors();
}

function pickupPopup(evt){
  if (!evt.target.classList.contains("popupheader")) return;
  oldMode=drawMode;
  drawMode="movePopup";
  drawObj=drawData.movePopup;
  var coords=getCoords(evt),
      x=coords[0],
      y=coords[1]
  var bcr=evt.target.getBoundingClientRect();
  offset={
    x:x-bcr.left,
    y:y-bcr.top
  };
  moveDOM=evt.target.parentElement;
  drawing=true;
}

function movePopup(evt){
  var coords=getCoords(evt);
  moveDOM.style.left=(coords[0]-offset.x)+"px";
  moveDOM.style.top=(coords[1]-offset.y)+"px";
}

function dropPopup(){
  drawMode=oldMode;
}

function openPopup(id){
  document.getElementById("popupwrapper").style.display="block";
  var popup=document.getElementById(id);
  popup.style.display="block";
  var bcr=popup.getBoundingClientRect();
  popup.style.left=(window.innerWidth-bcr.width)/2+"px";
  popup.style.top=(window.innerHeight-bcr.height)/2+"px";
  popup.classList.add("open");
  return popup;
}

function closePopup(){
  var popups=document.getElementsByClassName("popup open");
  var ret=popups.length>0;
  for (var i=0;i<popups.length;i++){
    (function(elem){
      elem.classList.remove("open");
      setTimeout(function(){
        elem.classList.add("close");
        setTimeout(function(){
          elem.classList.remove("close");
          elem.style.display="none";
          document.getElementById("popupwrapper").style.display="none";
        },200);
      },1);
    })(popups[i]);
  }
  return ret;
}

function setupColorPicker(){
  var shade=document.getElementById("shadebox");
  shade.addEventListener("mousedown",startCoords);
  shade.addEventListener("touchmove",startCoords);
  var hue=document.getElementById("hue");
  hue.addEventListener("mousedown",startCoords);
  hue.addEventListener("touchmove",startCoords);
  var transparency=document.getElementById("transparency");
  transparency.addEventListener("mousedown",startCoords);
  transparency.addEventListener("touchmove",startCoords);
  for (var i=0;i<4;i++){
    valDOM[i].addEventListener("input",updatePicker);
  }
  document.getElementById("hexout").addEventListener("input",setHex);
}

function setHex(){
  var inp=this.value.replace(/#/g,"");
  if (inp.length==3||inp.length==6){
    var nInp="";
    if (inp.length==3){
      for (var i=0;i<3;i++) nInp+=inp[i]+inp[i];
      inp=nInp;
    }
    var col=getColArr();
    for (var i=0;i<3;i++){
      var val=parseInt(inp.substr(i*2,2),16) || 0;
      col[i]=Math.max(Math.min(val,255),0);
    }
    backtrackCursors(col);
    updateRGBA(col);
  }
}

function updateHex(){
  var col=getColArr();
  var out="#";
  for (var i=0;i<3;i++){
    var hex=col[i].toString(16);
    if (hex.length==1) hex="0"+hex;
    out+=hex;
  }
  document.getElementById("hexout").value=out;
}

function updateRGBA(col){
  for (var i=0;i<4;i++){
    valDOM[i].value=col[i];
  }
}

function getColArr(){
  var col=[];
  for (var i=0;i<4;i++){
    var val=valDOM[i].value;
    val=Math.max(Math.min(parseInt(val),255),0);
    col.push(val || 0);
  }
  return col;
}

function updatePicker(evt){
  setTimeout(function(){
    backtrackCursors(getColArr());
    updateHex();
  },1);
}

function backtrackCursors(col){
  var pCol=estimateCol(col),
      outlier=-1,
      maxCount=0;
  for (var i=0;i<3;i++){
    if (pCol[i]!=0&&pCol[i]!=255) outlier=i;
    if (pCol[i]==255) maxCount++;
  }
  outlier=pCol[outlier] || (maxCount==1?0:255);
  
  var index=0;
  main:
  for (var i=0;i<colorVals.length-1;i++){
    for (var n=0;n<3;n++){
      var min=Math.min(colorVals[i][n],colorVals[i+1][n]),
          max=Math.max(colorVals[i][n],colorVals[i+1][n]);
      
      if (pCol[n]<min||pCol[n]>max) continue main;
    }
    index=i;
    break;
  }
  var offs=index%2==0?outlier:255-outlier;
  coordData.hue.y=255/6*(index+offs/255);
  coordData.transparency.y=col[3];
  //Horrible brute force. Takes 5ms
  var coords=getApproxCoords(pCol,col);
  coordData.shadebox={
    x:coords[0],
    y:coords[1]
  };
  updateCursors(true);
}

//Figure out a neat way to calculate this.
function getApproxCoords(col,target){
  var min=Infinity,minArr=[];
  for (var w=0;w<256;w++){
    var perc=1-w/255;
    var r=Math.floor(col[0]+(255-col[0])*perc),
        g=Math.floor(col[1]+(255-col[1])*perc),
        b=Math.floor(col[2]+(255-col[2])*perc);
    for (var h=0;h<255;h++){
      var p=1-h/255;
      var sim=getSimilarity([r*p,g*p,b*p],target);
      if (sim<min){
        min=sim;
        minArr=[w,h];
      }
    }
  }
  return minArr;
}

function getSimilarity(col,target){
  var out=0;
  for (var i=0;i<3;i++){
    out+=Math.abs(target[i]-Math.floor(col[i]));
  }
  return out;
}

function startCoords(evt){
  var id=evt.target.id;
  coordData.id=id;
  coordData.dom=evt.target;
  evt.target.style.cursor="none";
  if (!coordData[id]) coordData[id]={};
  oldMode=drawMode;
  drawMode="genericCoords";
  drawObj=drawData.genericCoords;
  drawing=true;
  setCoords(evt);
}

function setCoords(evt){
  var bcr=coordData.dom.getBoundingClientRect();
  var coords=getCoords(evt);
  coordData[coordData.id]={
    x:Math.max(Math.min(coords[0]-bcr.left,255),0),
    y:Math.max(Math.min(coords[1]-bcr.top,255),0)
  };
  updateCursors();
  updateHex();
}

function updateCursors(noUpdate,noUpdateHex){
  var sc=document.getElementById("shadecursor");
  var sco=coordData.shadebox;
  sc.style.stroke=(sco.x<75&&sco.y<75||coordData.transparency.y<128)?"black":"white";
  sc.style.left=sco.x+"px";
  sc.style.top=sco.y+"px";
  var hc=document.getElementById("huecur");
  hc.style.top=coordData.hue.y+"px";
  var tc=document.getElementById("transcur");
  tc.style.top=coordData.transparency.y+"px";
  document.getElementById("shadebox").style.opacity=coordData.transparency.y/255;
  var col=calcColor(coordData.hue.y,sco.x,sco.y,coordData.transparency.y);
  document.getElementById("colresult").style.background=arrToCol(col);
  if (!noUpdate) updateRGBA(col);
}

function calcColor(hue,x,y,opacity){
  var si=Math.floor((hue/255)*6)%6,
      perc=(hue/255)%(1/6)*6;
  var cols=[
    Math.floor(colorVals[si][0]+(colorVals[si+1][0]-colorVals[si][0])*perc),
    Math.floor(colorVals[si][1]+(colorVals[si+1][1]-colorVals[si][1])*perc),
    Math.floor(colorVals[si][2]+(colorVals[si+1][2]-colorVals[si][2])*perc)
  ];
  document.getElementById("shadebox").style.background=arrToCol(cols,true);
  var white=1-x/255,
      black=1-y/255;
  var col2=[
    Math.floor((cols[0]+(255-cols[0])*white)*black),
    Math.floor((cols[1]+(255-cols[1])*white)*black),
    Math.floor((cols[2]+(255-cols[2])*white)*black),
    opacity
  ];
  //console.log(col2+" - "+estimateCol(col2)+" - "+cols);
  return col2;
}

//Now, this is a very interesting function.
//Yes, it's mostly trial and error programming at work...
//But somehow it's almost never off by more than 10
//in any of the RGB channels.
function estimateCol(arr){
  var arr2=arr.slice(0,3);
  var max=Math.max.apply(this,arr2),
      min=Math.min.apply(this,arr2);
  arr2=arr2.map(function(e){
    return Math.round((e-min)*(255/(max-min)));
  });
  if (isNaN(arr2[0])) arr2=[255,0,0];
  return arr2;
}

function endCoords(evt){
  drawMode=oldMode;
  coordData.dom.style.removeProperty("cursor");
}

function addCol(){
  var elem=document.querySelector(".colorbox:not([data-color])");
  var colArr=getColArr(),
      col=arrToCol(colArr);
  if (!elem){
    var box=document.getElementsByClassName("colorbox")[20];
    box.parentElement.appendChild(box);
    elem=box;
  }
  elem.setAttribute("data-color",col);
  elem.children[1].style.background=col;
  elem.color=colArr;
  elem.click();
  closePopup();
}

function openColorSelector(){
  openPopup("colorselector");
  var col=document.getElementById("colsel").color;
  backtrackCursors(col);
  updateCursors();
  updateRGBA(col);
  updateHex();
}

function openLineSettings(){
  var lw=document.getElementById("linewrapper");
  var sel=lw.getElementsByClassName("selected")[0];
  if (sel) sel.classList.remove("selected");
  lw.querySelector(".linesetting[data-linew='"+window[activeWidth]+"']").classList.add("selected");
  openPopup("linesettings");
}

function setLW(){
  window[activeWidth]=parseInt(this.getAttribute("data-linew"));
  closePopup();
  callUpdate();
  setCursor();
}

function openTolerance(){
  document.getElementById("tolslider").value=fillTolerance;
  updateTolerance();
  openPopup("tolerancesettings");
}

function updateTolerance(){
  var val=parseInt(document.getElementById("tolslider").value);
  document.getElementById("tolright").style.background=arrToCol([val+102,val+102,255],true);
  document.getElementById("tolout").innerHTML=val;
}

function setTolerance(){
  fillTolerance=parseInt(document.getElementById("tolslider").value);
  document.getElementById("triright").setAttribute("fill",arrToCol([fillTolerance+102,fillTolerance+102,255],true));
  closePopup();
}

function openSizeOptions(){
  openPopup("sizesettings");
  setSizeBox();
}
      
function setSizeBox(evt,noUpdate){
  var perc=document.getElementById("perc").checked,
      sync=document.getElementById("preserve").checked;
  var sh=document.getElementById("scalehor"),
      sv=document.getElementById("scalevert");
  if (!evt||evt.target.type=="radio"){
    sh.value=perc?100:mainc.width;
    sv.value=perc?100:mainc.height;
  }
  if (sync) sv.value=perc?sh.value:Math.round((mainc.height/mainc.width)*sh.value);
}

document.getElementById("perc").addEventListener("change",setSizeBox);
document.getElementById("pix").addEventListener("change",setSizeBox);
document.getElementById("scalehor").addEventListener("input",setSizeBox);
document.getElementById("scalevert").addEventListener("input",setSizeBox);
document.getElementById("preserve").addEventListener("change",setSizeBox);

function confirmSize(){
  var perc=document.getElementById("perc").checked,
      shv=document.getElementById("scalehor").value,
      svv=document.getElementById("scalevert").value;
  
  if (perc){
    shv=Math.round(mainc.width*(shv/100));
    svv=Math.round(mainc.height*(svv/100));
  }
  
  var diffSize=shv!=mainc.width||svv!=mainc.height;
  
  if (shv>0&&svv>0&&diffSize){
    sctx.drawImage(mainc,0,0);
    mainc.width=shv;
    mainc.height=svv;
    mctx.drawImage(secc,0,0,shv,svv);
    secc.width=shv;
    secc.height=svv;
    var cw=cWrapper;
    cw.style.width=shv*zoom+"px";
    cw.style.height=svv*zoom+"px";
    saveHistory();
    closePopup();
  }else if (!diffSize) closePopup();
}

//-----------------------------DROPDOWNS-----------------------------

function openDropdown(elem,evt,id){
  var bcr=elem.getBoundingClientRect();
  var dropdown=document.getElementById(id);
  evt.stopPropagation();
  if (closeDropdowns()==dropdown) return;
  dropdown.classList.remove("hidden");
  dropdown.classList.add("visible");
  dropdown.style.top=Math.floor(bcr.top+bcr.height)+"px";
  dropdown.style.left=Math.floor(bcr.left)+"px";
}

function closeDropdowns(){
  var dropdown=document.getElementsByClassName("dropdown visible")[0];
  if (dropdown){
    dropdown.classList.remove("visible");
    dropdown.classList.add("hidden");
  }
  return dropdown;
}

document.body.addEventListener("click",closeDropdowns);
setInactive(document.getElementById("selselect"));

function setSelMode(mode){
  document.getElementById("selsvg").innerHTML=document.querySelector(".dropdownitem[data-modename='"+mode+"']").getElementsByTagName("svg")[0].innerHTML;
  var sb=document.getElementById("selbtn");
  setTool(sb,mode,true);
  drawMode=mode;
  sb.setAttribute("data-mode",mode);
  setExtras();
}


//-----------------------------SAVE/OPEN-----------------------------

function save(){
  if (!saveData.name) openSaveAs();
  else {
    var d=new Date();
    localStorage.setItem(saveData.name,JSON.stringify({
      data:mainc.toDataURL(),
      saved:d.getTime()+d.getTimezoneOffset()*60000,
      thumb:createThumb()
    }));
  }
}

function createThumb(){
  var max=Math.max(mainc.width,mainc.height),
      scale=150/max;
  if (scale>1) return mainc.toDataURL();
  var c=document.createElement("canvas"),
      ctx=c.getContext("2d"),
      w=Math.floor(mainc.width*scale),
      h=Math.floor(mainc.height*scale);
  c.width=w;
  c.height=h;
  ctx.drawImage(mainc,0,0,w,h);
  return c.toDataURL();
}

function openSaveAs(){
  var popup=openPopup("saveopen"),
      btns=popup.getElementsByTagName("button");
  popup.getElementsByClassName("popuptitle")[0].innerHTML="Save as";
  btns[0].style.display=null;
  btns[1].style.display="none";
  updateFileSelection(document.getElementById("fws"));
}

function pushSave(elem){
  var name=elem.getElementsByTagName("input")[0].value;
  if (name.replace(/\s/g).length==0) return showError(elem,"Error: invalid name");
  if (fileDict.includes(name)) return showError(elem,"Error: name already in use");
  saveData.name=name;
  fileDict.push(name);
  localStorage.setItem("paintfiles",JSON.stringify(fileDict));
  save();
  closePopup();
}

function openOpen(){
  var popup=openPopup("saveopen"),
      btns=popup.getElementsByTagName("button");
  popup.getElementsByClassName("popuptitle")[0].innerHTML="Open";
  btns[0].style.display="none";
  btns[1].style.display=null;
  updateFileSelection(document.getElementById("fws"));
}

function openFile(elem){
  var name=elem.getElementsByTagName("input")[0].value;
  if (!fileDict.includes(name)) return showError(elem,"Error: invalid name");
  var data=JSON.parse(localStorage.getItem(name)),
      img=new Image();
  img.src=data.data;
  img.onload=function(){
    zs.value=3;
    scaleCanvas();
    setCanvas(img.width,img.height);
    mctx.drawImage(img,0,0);
    hist=[mctx.createImageData(600,400)];
    histPointer=0;
    saveHistory();
  }
  closePopup();
}

function showError(elem,msg){
  
}

function updateFileSelection(elem){
  var fw=document.getElementById("filewrapper");
  if (elem) elem.appendChild(fw);
  if (!fileDict.length){
    fw.innerHTML="<span class='nofiles'>No files available.</span>";
    return;
  }
  if (fw.children.length==fileDict.length) return;
  var toAdd=fileDict.slice(fw.children.length).sort(),
      p=0;
  fileDict.sort();
  for (var i=0;i<fileDict.length;i++){
    if (fileDict[i]==toAdd[p]){
      fw.insertBefore(addFile(fileDict[i]),fw.children[i+1]);
      p++;
    }
  }
}

function addFile(name){
  var file=document.createElement("div");
  file.className="file";
  file.setAttribute("data-name",name)
  var ft=document.createElement("div");
  ft.className="filethumb";
  var c=document.createElement("canvas");
  c.className="raster";
  var title=document.createElement("span");
  title.className="title";
  
  var data=JSON.parse(localStorage.getItem(name)),
      img=new Image();
  img.src=data.thumb;
  img.onload=function(){
    c.width=img.width;
    c.height=img.height;
    c.getContext("2d").drawImage(img,0,0);
    var ratio=c.width/c.height;
    if (ratio>1) c.style.height=100/ratio+"%";
    else c.style.width=100*ratio+"%";
  }
  ft.appendChild(c);
  file.appendChild(ft);
  title.innerHTML=name;
  file.appendChild(title);
  return file;
}

//--------------------------------CURSORS--------------------------------

function setCursor(tool,hide){
  tool=tool || drawMode;
  var wrapper=document.getElementById("cursors"),
      cursors=wrapper.children,
      cursor=document.getElementById("cur_"+tool);
  for (var i=0;i<cursors.length;i++){
    cursors[i].style.display="none";
  }
  currCur=null;
  cWrapper.style.cursor="default";
  if (cursor){
    cursor.style.display="block";
    currCur=cursor;
    switch (tool){
      case "dropper":
        document.getElementById("nowcol").setAttribute("stroke",arrToCol(colMode?backColorArr:colorArr));
        cWrapper.style.cursor="none";
        break;
      case "free":
        resizeCursor(cursor,lWidth);
        cWrapper.style.cursor="none";
        break;
      case "erase":
        resizeCursor(cursor,eWidth);
        cWrapper.style.cursor="none";
        break;
    }
  }
  if (hide) wrapper.style.display="none";
}

function resizeCursor(cur,size){
  var s=Math.round(size*zoom*1.2);
  cur.style.width=s+"px";
  cur.style.height=s+"px";
  cur.style.margin=(-Math.round(Math.floor(size/2)*zoom*1.2))+"px";
  cur.setAttribute("stroke-width",12/s);
}

function clone(arr){
  var out=[];
  for (var i in arr){
    out.push(Array.isArray(arr[i])?clone(arr[i]):arr[i]);
  }
  return out;
}

//This is the end.
hist.push(mctx.createImageData(mainc.width,mainc.height));
setSize(mainc,"canvsize");
init();
setColor(colorArr);
setCursor(null,true);