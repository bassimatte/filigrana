// Camera coordinates are CSS pixels; drawing coordinates stay independent of the screen.
export class DrawingView {
  constructor(){this.width=1;this.height=1;this.drawingWidth=1;this.drawingHeight=1;this.zoom=1;this.panX=0;this.panY=0;}
  get scale(){return Math.min(Math.max(1,this.width-48)/this.drawingWidth,Math.max(1,this.height-48)/this.drawingHeight)*this.zoom;}
  get x(){return (this.width-this.drawingWidth*this.scale)/2+this.panX;}
  get y(){return (this.height-this.drawingHeight*this.scale)/2+this.panY;}
  setDrawing(width,height){this.drawingWidth=width;this.drawingHeight=height;this.zoom=1;this.panX=0;this.panY=0;}
  resize(width,height){
    if(width===this.width&&height===this.height)return;
    const center=this.toDrawing(this.width/2,this.height/2);
    this.width=width;this.height=height;
    if(this.zoom===1){this.panX=0;this.panY=0;return;}
    this.panX=(this.drawingWidth/2-center.x)*this.scale;
    this.panY=(this.drawingHeight/2-center.y)*this.scale;
  }
  toDrawing(x,y){return{x:(x-this.x)/this.scale,y:(y-this.y)/this.scale};}
  toScreen(x,y){return{x:x*this.scale+this.x,y:y*this.scale+this.y};}
  zoomAt(next,x=this.width/2,y=this.height/2){
    const anchor=this.toDrawing(x,y);this.zoom=Math.max(1,Math.min(6,next));
    if(this.zoom===1){this.panX=0;this.panY=0;return;}
    const screen=this.toScreen(anchor.x,anchor.y);this.panX+=x-screen.x;this.panY+=y-screen.y;
  }
  panBy(x,y){this.panX+=x;this.panY+=y;}
}
