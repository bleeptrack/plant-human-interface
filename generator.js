//single line
class StabiCursor{
    constructor(p, pos) {
        this.points = p;
        this.length = 25;

        this.path = new Path({
	        //strokeColor: 'yellow',
	        strokeWidth: 10,
	        strokeCap: 'round',
        });
        this.path.remove();
        
        let start = pos;
        for (let i = 0; i < this.points; i++)
	        this.path.add(start.add( new Point(0, i * this.length)) );
    }
    
    movePath(pos) {
    	this.path.firstSegment.point = pos;
    	for (var i = 0; i < this.points - 1; i++) {
    		var segment = this.path.segments[i];
    		var nextSegment = segment.next;
    		var vector = segment.point.subtract( nextSegment.point );
    		vector.length = this.length;
    		nextSegment.point = segment.point.subtract( vector );

    	}
    	this.path.smooth({ type: 'continuous' });
    	return this.path.lastSegment.point;
    }
}

//flock of lines
class CursorFlock{
    constructor(pos){
        this.cursor = new StabiCursor(6, pos);
        this.cursorL = new StabiCursor(6, pos);
        this.cursorR = new StabiCursor(6, pos);
        
        this.strokes = new Group();
        this.strokes.addChild(new Path());
        this.strokes.addChild(new Path());
        this.strokes.addChild(new Path());
        for(let str of this.strokes.children){
            str.strokeWidth = Math.random()*pressure/5 + 2;
        }
        //this.strokes.strokeWidth = Math.random()*pressure/10 + 2; //standard: 2.5
        this.strokes.strokeColor = '#DDE2A4';
    }
    
    moveCursors(pos){
        this.cursor.movePath(pos);
    
        let ang = this.cursorL.path.getCurvatureAt(this.cursor.path.length/2) * 5000 + (humidity-40)*2;
        let angRev = this.cursorR.path.getCurvatureAt(this.cursor.path.length/2) * 5000 + (humidity-40)*2;
    
        this.cursorL.movePath( pos.add( this.cursor.path.getNormalAt(0).multiply( Math.abs(ang)/2.5 ) ) );
        this.cursorR.movePath( pos.add( this.cursor.path.getNormalAt(0).multiply( Math.abs(angRev)/-2.5 ) ) );
    
        this.strokes.children[0].add(this.cursorR.path.lastSegment.point);
        this.strokes.children[1].add(this.cursor.path.lastSegment.point);
        this.strokes.children[2].add(this.cursorL.path.lastSegment.point);
    }
    
    async fadeOut(){
        await this.strokes.tweenTo({ opacity: 0}, 10000);
        this.strokes.remove();
    }
}



let flocks;

let net;
let video;
paper.install(window);

//helping points for tracking and line drawing
let nose;
let leftEar;
let rightEar;
let leftSide;
let rightSide;
let midlane;
let midlaneRight;
let midlaneLeft;

let pressure = 30; //20-70  //line thickness
let temperature = 25; // 0-40  //background color
let humidity = 70;  // 40-70  //line distance
let timePercent;  //10-18 //grow direction

//CAUTION you might need to proxy this because of CORS error
const URL = 'https://datenhub.ulm.de/api/v1/datasets/lorapark_autarkes_hochbeet/resources/lorapark_autarkes_hochbeet'

let drawprocess = false;
let linePos = 0;
let bg;
let colorGrad;
window.onload = function() {


    paper.setup('myCanvas');
    
    bg = new Path.Rectangle(view.bounds);
    bg.fillColor = 'red';
    bg.scale(5);
    
    nose = new Path.Circle([0,0], 10);
    nose.fillColor = 'red';
    nose.remove();
    rightEar = new Path.Circle([0,0], 10);
    rightEar.fillColor = 'red';
    rightEar.remove();
    leftEar = new Path.Circle([0,0], 10);
    leftEar.fillColor = 'red';
    leftEar.remove();
    
    view.center = view.center.add(-300,-100);

    
    
    video = document.getElementById('video');
    if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(function(stream) {
                //video.src = window.URL.createObjectURL(stream);
                video.srcObject = stream;
                video.play();
            });
    }
    
    setupNet();

    getDataVSH();
    startTracking();
    
    setTimeout(start, 5000);
    
    view.onFrame = function(event){
        if(drawprocess){
            moveFlocks();
        }
    }

}

function startTracking(){
    
    if(flocks){
        for(let flock of flocks){
            flock.fadeOut();
        }
    }
    
    leftSide = new Path([0,0], [0,0], [0,0], [0,0], [0,0], [0,0]);
    leftSide.strokeColor = 'white';
    leftSide.strokeWidth = 5;
    leftSide.opacity = 0.3;
    
    rightSide = new Path([0,0], [0,0], [0,0], [0,0], [0,0], [0,0]);
    rightSide.strokeColor = 'white';
    rightSide.strokeWidth = 5;
    rightSide.opacity = 0.3;
    
    midlane = new Path([0,0], [0,0], [0,0], [0,0], [0,0]);
    midlane.strokeColor = 'white';
    midlane.strokeWidth = 5;
    midlane.opacity = 0.3;
    
    midlaneRight = new Path([0,0], [0,0], [0,0], [0,0], [0,0]);
    midlaneRight.strokeColor = 'white';
    midlaneRight.strokeWidth = 5;
    midlaneRight.opacity = 0.3;
    
    midlaneLeft = new Path([0,0], [0,0], [0,0], [0,0], [0,0]);
    midlaneLeft.strokeColor = 'white';
    midlaneLeft.strokeWidth = 5;
    midlaneLeft.opacity = 0.3;
    
    midlaneLeft.tweenTo({ opacity: 1}, 1000);
    midlaneRight.tweenTo({ opacity: 1}, 1000);
    leftSide.tweenTo({ opacity: 1}, 1000);
    rightSide.tweenTo({ opacity: 1}, 1000);
    midlane.tweenTo({ opacity: 1}, 1000);
    
    getPose();
}

function init() {
    drawprocess = true;
    flocks = [
        new CursorFlock(leftSide.segments[0].point),
        new CursorFlock(midlaneLeft.segments[0].point),
        new CursorFlock(midlane.segments[0].point),
        new CursorFlock(midlaneRight.segments[0].point),
        new CursorFlock(rightSide.segments[0].point)
    ];
}

function moveFlocks(){
    if(linePos < midlane.length){
        flocks[2].moveCursors(midlane.getPointAt(linePos));
    }
    if(linePos < midlaneLeft.length){
        flocks[1].moveCursors(midlaneLeft.getPointAt(linePos));
    }
    if(linePos < midlaneRight.length){
        flocks[3].moveCursors(midlaneRight.getPointAt(linePos));
    }
    if(linePos < leftSide.length){
        flocks[0].moveCursors(leftSide.getPointAt(linePos));
    }
    if(linePos < rightSide.length){
        flocks[4].moveCursors(rightSide.getPointAt(linePos));
    }
    
    if(linePos >= rightSide.length && linePos >= leftSide.length && linePos >= midlane.length && linePos >= midlaneLeft.length && linePos >= midlaneRight.length){
        drawprocess = false;
        linePos = 0;
        console.log("END");
        startTracking();
        setTimeout(start, 5000);
    }else{
        linePos += 10;        
    }
    
}

//new iteration
async function start(){
    console.log("START");

    midlaneLeft.tweenTo({ opacity: 0}, 1000);
    midlaneRight.tweenTo({ opacity: 0}, 1000);
    leftSide.tweenTo({ opacity: 0}, 1000);
    rightSide.tweenTo({ opacity: 0}, 1000);
    await midlane.tweenTo({ opacity: 0}, 1000);
    
    midlane.remove();
    midlaneLeft.remove();
    midlaneRight.remove();
    leftSide.remove();
    rightSide.remove();
    
    if(midlane.length > 0){
        appendLane(midlane, true);
        appendLane(midlaneLeft, true);
        appendLane(midlaneRight, true);
        appendLane(leftSide, false);
        appendLane(rightSide, false);
    }
    
    init();
    drawprocess = true;
}

//add swirls to the line
function appendLane(lane, center){
    let direction;
    let line;
    if(center){
        line = new Path(lane.lastSegment.point, new Point( view.bounds.topLeft.x + view.bounds.width * timePercent, view.bounds.topLeft.y ) );
    }else{
        direction = lane.lastSegment.point.subtract(lane.segments[lane.segments.length-2].point).normalize().multiply(800);
        line = new Path(lane.lastSegment.point, lane.lastSegment.point.add(direction) );
    }
    
    for(let i = 300; i<line.length-100; i+= Math.random()*200+100){
        let offs = Math.random()*400-200;

        if(Math.random()*3  < 1 ){
            lane.add( line.getPointAt(i+70).add( line.getNormalAt(i+70).multiply(offs) ) );
            lane.add( line.getPointAt(i).add( line.getNormalAt(i).multiply(offs*3) ) );
            lane.add( line.getPointAt(i-70).add( line.getNormalAt(i-70).multiply(offs) ) );
        }else{
            lane.add( line.getPointAt(i).add(line.getNormalAt(i).multiply(offs) ) );
        }
    }
    lane.add(line.lastSegment.point);
    lane.smooth({ type: 'continuous' });
    line.remove();
    
}


async function setupNet(){

    net = await posenet.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        inputResolution: { width: 640, height: 480 },
        multiplier: 0.75
    });
    
    getPose();
}

async function getPose(){
        const poses = await net.estimateMultiplePoses(video, {
            flipHorizontal: true,
            maxDetections: 1,
            scoreThreshold: 0.5,
            nmsRadius: 20
        });
    
        if(poses[0]){
            nose.position = poses[0].keypoints[0].position;
            leftEar.position = poses[0].keypoints[3].position;
            rightEar.position = poses[0].keypoints[4].position;
            
            leftSide.segments[0].point = poses[0].keypoints[15].position; //leftAnkle;
            leftSide.segments[1].point = poses[0].keypoints[13].position; //leftKnee;
            leftSide.segments[2].point = poses[0].keypoints[11].position; //leftHip;
            leftSide.segments[3].point = poses[0].keypoints[5].position; //leftShoulder;
            leftSide.segments[4].point = poses[0].keypoints[7].position; //leftElbow;
            leftSide.segments[5].point = poses[0].keypoints[9].position; //leftWrist;
            
            rightSide.segments[0].point = poses[0].keypoints[16].position; //leftAnkle;
            rightSide.segments[1].point = poses[0].keypoints[14].position; //leftKnee;
            rightSide.segments[2].point = poses[0].keypoints[12].position; //leftHip;
            rightSide.segments[3].point = poses[0].keypoints[6].position; //leftShoulder;
            rightSide.segments[4].point = poses[0].keypoints[8].position; //leftElbow;
            rightSide.segments[5].point = poses[0].keypoints[10].position; //leftWrist;
            
            for(let i = 0; i<4; i++){
                midlane.segments[i].point = leftSide.segments[i].point.add(rightSide.segments[i].point.subtract(leftSide.segments[i].point).divide(2));
                midlaneLeft.segments[i].point = leftSide.segments[i].point.add(rightSide.segments[i].point.subtract(leftSide.segments[i].point).multiply(0.25));
                midlaneRight.segments[i].point = leftSide.segments[i].point.add(rightSide.segments[i].point.subtract(leftSide.segments[i].point).multiply(0.75));
            }
            
            midlane.segments[4].point = nose.position;
            midlaneRight.segments[4].point = rightEar.position;
            midlaneLeft.segments[4].point = leftEar.position;
        }
        
    if(!drawprocess){
        requestAnimationFrame(getPose);
    }
   
}

//get sensor data
function getDataVSH(){
    fetch(URL, { method: 'GET'})
        .then(response => response.json())
        .then(data => {
            if(data){
                let newData = data.records[0];
                
                setHumidity(newData.humidity);
                setTemperature(newData.temperature);
                setTime();
                setPressure(newData.tensio_pressure);
            }
        });
    setTimeout(getDataVSH, 10 * 60 * 60);
}

function setTime(){
    let current = new Date();
    let h = current.getHours();
    let m = current.getMinutes();
    
    console.log(h, m);
    let maxTime = 6*60;
    
    let time = h-10 + m;
    
    if(h>16){
        time = maxTime;
    }
    if(h<10){
        time = 0;
    }
    
    timePercent = time/maxTime;
    console.log(timePercent);
}

function setPressure(p){
    pressure = p;
    console.log("pressure", pressure);
}

function setTemperature(t){
    let green = new Color('#476144');
    let blue = new Color('#292287');
    let red = new Color("#872222");
    
    temperature = t;
    if(temperature < 0){
        temperature = 0;
    }
    if(temperature > 40){
        temperature = 40;
    }
    
    let c;
    if(temperature < 35){
        let dist = green.subtract(blue).divide(35);
        c = blue.add( dist.multiply(temperature) );
    }else{
        let dist = red.subtract(green).divide(5);
        c = green.add( dist.multiply(temperature - 35) );
    }
    
    bg.tweenTo({
        fillColor: c
    }, 500);
    
    console.log("temperature", temperature);
}

function setHumidity(h){
    humidity = h;
    if(humidity < 40){
        humidity = 40;
    }
    if(humidity > 70){
        humidity = 70;
    }
    
    console.log("humidity", humidity);
}





