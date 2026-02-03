/* visuals.js 
    All Data pulling from App State (App.simulation (populated by engige.js)) 
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

// Helper to rebuild pegs on resize
function createPegs(width) {
    // Re-implement your loop for creating static circles here
    // If you need this code, I can generate it, but I assume you have it.
    const ground = Bodies.rectangle(width / 2, 610, width, 20, { isStatic: true, render: { visible: false } });
    Composite.add(world, ground);
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