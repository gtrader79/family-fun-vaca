/* visuals.js 
    All Data pulling from App State (App.simulation (populated by engige.js and chart.js)) 
*/

// --- 1. Matter.js Setup (The Physics Engine) ---
const { Engine: MatterEngine, Render, Runner, Bodies, Composite } = Matter;
// Note: Renamed Engine to MatterEngine to avoid conflict with our 'Engine' object

let physicsEngine, render, runner, world;

function initPhysics() {        
    // Standard Matter.js boilerplate
    Matter.Resolver._restingThresh = 6; 
    
    physicsEngine = MatterEngine.create({
      enableSleeping: true 
    });
    
    world = physicsEngine.world;
    
    const container = document.getElementById('matter-container');
    if(!container) return; // Guard clause
    
    container.innerHTML = ''; 
    
    render = Render.create({
        element: container,
        engine: physicsEngine,
        options: {
            width: container.offsetWidth,
            height: 600,
            wireframes: false,
            background: 'transparent'
        }
    });

    // Create Pegs (Plinko board style)
    // ... (Your existing peg creation code goes here - removed for brevity but keep it!) ...
    createPegs(container.offsetWidth);

    Render.run(render);
    
    runner = Runner.create();
    Runner.run(runner, physicsEngine);
}


// --- 2. The Ball Drop Logic ---
function dropBalls() {
    // 1. Get Simulation Data from State
    const simRuns = App.simulation.runs;
    const teamA = App.data.teamA;
    const teamB = App.data.teamB;

    if (!simRuns || simRuns.length === 0) {
        console.warn("No simulation data found.");
        return;
    }

    // Clear old balls
    const allBodies = Composite.allBodies(world);
    const balls = allBodies.filter(b => b.label === 'ball');
    Composite.remove(world, balls);

    let ballCount = 0;
    const maxBalls = 400; // Cap for performance
    const container = document.getElementById('matter-container');

    // Create an interval to drop balls over time
    const intervalId = setInterval(() => {
        if (ballCount >= maxBalls) {
            clearInterval(intervalId);
            return;
        }
      
        // 2. Randomly sample from the simulation distribution
        // Use your Utils helper or standard random
        const randomIndex = Math.floor(Math.random() * simRuns.length);
        const runData = simRuns[randomIndex];
        
        // 3. Determine Winner of this specific run (Collapse Wave Function)
        const isTeamA = Math.random() < runData.teamA_Prob;

        // 4. Set Position & Color
        const xBase = isTeamA ? container.offsetWidth * 0.25 : container.offsetWidth * 0.75;
        const xPos = xBase + (Math.random() * 40 - 20);
      
        const radius = 5 + Math.random() * 5; 
        
        const ball = Bodies.circle(xPos, -30, radius, {
            restitution: 0.6,
            friction: 0.8,     
            label: 'ball',     
            render: {
                fillStyle: isTeamA ? teamA.primaryColor : teamB.primaryColor
            }
        });
        
        Composite.add(world, ball);
        ballCount++;
        
    }, 10); // Fast interval
}



// --- 2. Key Matchups Logic ---
function chartKeyMatchups() {
    //1. Get the data
    const labelsA= Object.keys(App.simulation.keyMatchup[0].averages)
    const valuesA= Object.values(App.simulation.keyMatchup[0].averages)
    const labelsB= Object.keys(App.simulation.keyMatchup[1].averages)
    const valuesB= Object.values(App.simulation.keyMatchup[1].averages)
    
    //2. Initialize Chart.js
    const newChart = document.getElementById('chart_key_matchups').getContext('2d');
    new Chart(newChart, {
      type: 'bar',
      data: {
        labels: labelsA,    
        datasets: [{
          label: 'Advantage Metrics',      
          data: valuesA,
          // Optional: Color positive/negative bars differently
          backgroundColor: valuesA.map(v => v >= 0 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)'),
          borderWidth: 1.5, 
          borderColor: 'rgba(50,50,50,.6)',
        }]
      },
      options: {
      indexAxis: 'y',
      scales: {
        x: { // Primary X-axis (Bottom)
          title: {
            display: true,
            text: 'Negative Advantage (Team B Wins the match up)',
            color: '#ff6384',
            font: { size: 14, weight: 'bold' }
          },
          // Ensure the axis is centered
          suggestedMin: -0.6,
          suggestedMax: 0.6,
        },
        x2: { // Secondary X-axis (Top)
          position: 'top',
          title: {
            display: true,
            text: 'Positive Advantage (Team A Wins matchups )',
            color: '#4bc0c0',
            font: { size: 14, weight: 'bold' }
          },
          // Mirror the primary axis settings
          suggestedMin: -0.6,
          suggestedMax: 0.6,
          ticks: { display: false }, // Hide the numbers on the top to keep it clean
          grid: { display: false }   // Hide extra grid lines
        },
        y: {
          beginAtZero: true
        }       
      },
        plugins: {
        legend: {
          display: false
        }
      }
    }
    });
}



