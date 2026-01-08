/* visuals.js */

// --- 1. Matter.js Setup (The Physics Engine) ---
const { Engine, Render, Runner, Bodies, Composite } = Matter;

let engine, render, runner, world; // Added world to global scope

function initPhysics() {        
    // Adjust the resting threshold to stop micro-vibrations
    // Default is 2; try increasing it slightly if they still giggle
    Matter.Resolver._restingThresh = 6; 
    
    //create the engine
    engine = Engine.create(); 
    
    //create world
    world = engine.world;
    
    //get the container & clear it out
    const container = document.getElementById('matter-container');
    container.innerHTML = ''; // Clear placeholder
    
    //create the render object specific to the container
    render = Render.create({
        element: container,
        engine: engine,
        options: {
            width: container.offsetWidth,
            height: 600,
            wireframes: false,
            background: '#f4f4f4' //Removes the blue/solid background
        }
    });
    
    
    // 1. Create Bucket (Static Rectangles)
    // Helper function to create a bucket
    const createBucket = (x, y, width, height, thickness, color) => {
        const bucketOptions = {
          isStatic: true          
          , render : {
            fillStyle: 'transparent' //make the inside clear
            , strokeStyle: color    //set the border color
            , lineWidth: thickness  //Thickness of the border
          }
        };
        const bottom = Bodies.rectangle(x, y + height/2, width, thickness, bucketOptions);
        const left = Bodies.rectangle(x - width/2, y, thickness, height, bucketOptions);
        const right = Bodies.rectangle(x + width/2, y, thickness, height, bucketOptions);
        return [bottom, left, right];
    };
    
    // Add two buckets side by side
    const bucket1 = createBucket(container.offsetWidth * 0.25
                                , 400
                                , container.offsetWidth * .4
                                , container.offsetHeight * .5
                                , 6
                                , '#303030');
    const bucket2 = createBucket(container.offsetWidth * 0.75
                                , 400
                                , container.offsetWidth * .4
                                , container.offsetHeight * .5
                                , 6
                                , '#969696');
    Composite.add(world, [...bucket1, ...bucket2]);

   

    // 3. Run the engine and renderer
    //const render = Render.create({ element: document.body, engine: engine });
    Render.run(render);
    Runner.run(Runner.create(), engine);
}

// --- Trigger the Ball Drop ---
function dropBalls() {
    if (!engine) initPhysics();

    const container = document.getElementById('matter-container');
    
    // Clear old balls if any
    const bodies = Composite.allBodies(engine.world);
    const ballsToRemove = bodies.filter(b => b.label === 'ball');
    Composite.remove(engine.world, ballsToRemove);

    let ballCount = 0;
    const maxBalls = 100;
    
    const intervalId = setInterval(() => {
      if (ballCount >= maxBalls) {
            clearInterval(intervalId);
            return; // Exit the interval
        }
      
        // 1. Generate random number
        //const rand = Math.random();  //to be adjusted to look at Monte Carlo simulation
        const runProb = simulationRuns[ballCount];
    
        // 2. Determine x position based on the .5 threshold
        const xPos = runProb <= 0.5 ? container.offsetWidth *.25 : container.offsetWidth * .75;
      
        // 3. Create and add the ball
        const radius = 8 + Math.random() * 8; // Randomize size for variety*/
        const ball = Bodies.circle(xPos, -20, radius, {
            restitution: 0.8    //bounciness
            , friction: 0.99     //stickyness
            , label: 'ball'     //needed for clearing out existing 
            , render: {
                fillStyle: runProb <= 0.5 ? teamA.primaryColor : teamB.primaryColor // Optional: color code by bucket
            }
        });
      
        Composite.add(world, ball);
        ballCount++;
    }, 30); //500ms delay
    
        
}
