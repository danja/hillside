// from https://openprocessing.org/@garabatospr/2969284

let colors = ["#2c2060", "#4bd3e5", "#fffbe6", "#ffd919", "#ff4f19"];

let myScale = 2.5;

// number of drawing agents 

var nAgents = 500;

let agent = [];

let padding = 0;

function setup() {
	createCanvas(1000, 1000, WEBGL);
	colorMode(HSB, 360, 100, 100, 100);
	rectMode(CENTER);

	for (let i = 0; i < nAgents; i++) {
		if (random(0, 1) > 0.5) {
			agent.push(new Agent(width * 1 / 2 + randomGaussian() * width / 2 - width / 2, height * 1 / 2 - height / 2, -1));
		} else {
			agent.push(new Agent(width * 2 / 2 + randomGaussian() * width / 2 - width / 2, height * 1 / 2 - height / 2, 1));
		}

	}

	fill(0);
	rect(0, 0, 1000, 1000);

}

function draw() {

	ambientLight(60);
	directionalLight(255, 255, 255, -0.4, -0.6, -10);
	directionalLight(80, 80, 80, 0.6, 0.2, -1);

	specularMaterial(150);
	shininess(100);

	for (let i = 0; i < agent.length; i++) {
		agent[i].update();
	}

}

// paintining agent 

class Agent {
	constructor(x, y, direction) {

		this.p = createVector(x, y);
		this.p0 = createVector(x, y);
		this.direction = direction;
		this.pOld = createVector(this.p.x, this.p.y);
		this.step = 1;
		this.color = generateColor(10);
		this.strokeWidth = random([5, 10]);
	}

	update() {

		//if (frameCount > 500) 
		{
			this.p.x += this.direction * vector_field(this.p.x, this.p.y).x * this.step;
			this.p.y += this.direction * vector_field(this.p.x, this.p.y).y * this.step;
		}

		ambientMaterial(this.color);
		noStroke();
		fill(this.color);

		push();
		translate(this.p.x, this.p.y);
		sphere(this.strokeWidth);
		pop();

		if (this.p.y < -height / 2) {
			this.p.y = random([-20, 20]);
			this.p.x = randomGaussian() * width / 2;
			this.strokeWidth = random([1, 2, 10]);
			this.direction *= -1;
		}

		if (this.p.y > height / 2) {
			this.p.x = randomGaussian() * width / 2;
			this.p.y = random([-20, 20]);
			this.strokeWidth = random([1, 2, 10]);
			this.direction *= -1;
		}


	}

}

// vector field function 
// the painting agents follow the flow defined 
// by this function 

function vector_field(x, y) {

	x = map(x, -width / 2, width / 2, -myScale, myScale);
	y = map(y, -height / 2, height / 2, -myScale, myScale);

	let k1 = 5;
	let k2 = 3;

	let u = sin(k1 * y) + sin(k2 * x);
	let v = sin(k2 * x) - cos(k1 * x);

	if (v <= 0) {
		v = -v;
	}

	return createVector(u, v);
}

function generateColor(scale) {
	let myColor = color(random(colors));
	//myColor.setAlpha(random(0,100))
	return myColor;
}