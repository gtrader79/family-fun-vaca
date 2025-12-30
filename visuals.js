/* visuals.js */

// --- 1. Matter.js Setup (The Physics Engine) ---
const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Composite = Matter.Composite,
      Bodies = Matter.Bodies,
      Events = Matter.Events;

let engine, render, runner;
let ballInterval = null;

function initPhysics() {
    const container = document.getElementById('matter-container');
    container.innerHTML = ''; // Clear placeholder

    // Create Engine
    engine = Engine.create();
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create Renderer
    render = Render.create({
        element: container,
        engine: engine,
        options: {
            width: width,
            height: height,
            wireframes: false,
            background: '#000000'
        }
    });

    // --- Build the "Galton Board" Layout ---
    const wallOpts = { isStatic: true, render: { fillStyle: '#333' } };
    const pegOpts = { isStatic: true, render: { fillStyle: '#555' }, restitution: 0.5 };
    
    // 1. Walls
    const walls = [
        Bodies.rectangle(width / 2, height + 30, width, 60, wallOpts), // Floor
        Bodies.rectangle(-30, height / 2, 60, height, wallOpts),       // Left Wall
        Bodies.rectangle(width + 30, height / 2, 60, height, wallOpts),// Right Wall
        Bodies.rectangle(width / 2, height - 100, 10, 200, wallOpts)   // Central Bucket Divider
    ];

    // 2. The "V" Diverter at top
    const wedgeLeft = Bodies.rectangle(width / 2 - 40, 100, 100, 20, { 
        isStatic: true, angle: Math.PI / 4, render: { fillStyle: '#333' } 
    });
    const wedgeRight = Bodies.rectangle(width / 2 + 40, 100, 100, 20, { 
        isStatic: true, angle: -Math.PI / 4, render: { fillStyle: '#333' } 
    });

    // 3. Pegs (Randomized Galton Grid)
    const pegs = [];
    const rows = 6;
    const startY = 180;
    const spacingY = 50;
    
    for (let r = 0; r < rows; r++) {
        const count = r % 2 === 0 ? 8 : 7; // Stagger rows
        const spacingX = width / (count + 1);
        for (let c = 1; c <= count; c++) {
            const x = c * spacingX + (Math.random() * 10 - 5); // Add slight jitter
            const y = startY + r * spacingY;
            pegs.push(Bodies.circle(x, y, 4, pegOpts));
        }
    }

    Composite.add(engine.world, [...walls, wedgeLeft, wedgeRight, ...pegs]);

    // Run
    Render.run(render);
    runner = Runner.create();
    Runner.run(runner, engine);
}

// --- Trigger the Ball Drop ---
function dropBalls(winPctA, teamAColor, teamBColor) {
    if (!engine) initPhysics();
    
    // Clear old balls if any
    const bodies = Composite.allBodies(engine.world);
    const ballsToRemove = bodies.filter(b => b.label === 'ball');
    Composite.remove(engine.world, ballsToRemove);

    // We drop 50 balls total to represent the distribution
    const totalBalls = 50;
    const ballsForA = Math.round((winPctA / 100) * totalBalls);
    const ballsForB = totalBalls - ballsForA;

    let droppedA = 0;
    let droppedB = 0;
    let count = 0;

    if (ballInterval) clearInterval(ballInterval);

    ballInterval = setInterval(() => {
        if (count >= totalBalls) {
            clearInterval(ballInterval);
            return;
        }

        // Decide which team gets a ball this tick
        // We mix them up so it's not just AAA then BBB
        const isTeamA = (droppedA < ballsForA) && (Math.random() < (ballsForA / totalBalls) || droppedB >= ballsForB);

        if (isTeamA) {
            spawnBall(true, teamAColor);
            droppedA++;
        } else {
            spawnBall(false, teamBColor);
            droppedB++;
        }
        count++;
    }, 50); // Drop rapidly
}

function spawnBall(isTeamA, color) {
    const width = render.options.width;
    // Spawn Left of center for Team A, Right for Team B
    const xOffset = isTeamA ? -40 : 40; 
    // Add randomness so they don't stack perfectly
    const randomX = (Math.random() * 20) - 10; 
    
    const ball = Bodies.circle(width / 2 + xOffset + randomX, 50, 8, {
        restitution: 0.6, // Bounciness
        friction: 0.001,
        label: 'ball',
        render: { fillStyle: color }
    });

    Composite.add(engine.world, ball);
}


// --- 2. Chart.js Setup (The Histogram) ---
let outcomeChart = null;

function renderHistogram(margins, teamAId, teamBId, colorA, colorB) {
    const ctx = document.getElementById('histogramChart').getContext('2d');

    // Bin the data (Create buckets of 3 points)
    // Range from -50 (Blowout Team B) to +50 (Blowout Team A)
    const bins = {};
    for (let i = -60; i <= 60; i += 3) bins[i] = 0;

    margins.forEach(m => {
        // Round to nearest bin
        const binKey = Math.round(m / 3) * 3;
        if (bins[binKey] !== undefined) bins[binKey]++;
    });

    const labels = Object.keys(bins).map(k => parseInt(k));
    const dataValues = Object.values(bins);
    
    // Color the bars: Negative = Team B, Positive = Team A
    const bgColors = labels.map(val => val > 0 ? colorA : colorB);

    if (outcomeChart) outcomeChart.destroy();

    outcomeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Simulated Outcomes',
                data: dataValues,
                backgroundColor: bgColors,
                barPercentage: 1.0,
                categoryPercentage: 1.0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const val = items[0].label;
                            return val > 0 ? `${teamAId} wins by ~${val}` : `${teamBId} wins by ~${Math.abs(val)}`;
                        }
                    }
                }
            },
            scales: {
                y: { display: false }, // Hide y-axis for clean look
                x: { 
                    grid: { display: false },
                    ticks: {
                        callback: function(val, index) {
                            // Only show every 5th label to reduce clutter
                            const labelVal = this.getLabelForValue(val);
                            return labelVal % 15 === 0 ? labelVal : '';
                        }
                    }
                }
            }
        }
    });
}
