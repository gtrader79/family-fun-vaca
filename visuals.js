/* visuals.js */

// --- 1. Matter.js Setup (The Physics Engine) ---
//renaming Engine since I am aleady using Engine in engine.js
const { Engine: Matter_Engine, Render, Runner, Bodies, Composite } = Matter;

let engine, render, runner, world; // Added world to global scope

//Random numbers for the Ball Drop so we don't show 1 to n sequentially
function getUniqueRandomNumbers(count, min, max) {
  const uniqueNumbers = new Set();
  
  while (uniqueNumbers.size < count) {
    // Math.random range inclusive: (max - min + 1) + min
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    uniqueNumbers.add(num);
  }
  
  // Convert Set back to an Array
  return Array.from(uniqueNumbers);
}


function initPhysics() {        
    // Adjust the resting threshold to stop micro-vibrations
    // Default is 2; try increasing it slightly if they still giggle
    Matter.Resolver._restingThresh = 6; 
    
    //create the engine -- note using Matter_Engine
    engine = Matter_Engine.create({
      enableSleeping: true // Add this line
    });
    
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
                                , 8
                                , '#515151');
    const bucket2 = createBucket(container.offsetWidth * 0.75
                                , 400
                                , container.offsetWidth * .4
                                , container.offsetHeight * .5
                                , 8
                                , '#515151');
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
    
    // Clear old balls
    const bodies = Composite.allBodies(engine.world);
    const ballsToRemove = bodies.filter(b => b.label === 'ball');
    Composite.remove(engine.world, ballsToRemove);

    let ballCount = 0;    
    const maxBalls = 600; // 600 is usually plenty for visual density without lag

    const simRuns = App.simulation.runs;
    const simRunMaxRun = Math.max(...simRuns.map(a=>a.labelOrder));
    const simRunFinal = simRuns.filter(a => a.labelOrder === simRunMaxRun);
    
    // 1. Shuffling: Ensure we pick random runs, not just the sorted first 1000
    // Simple helper to get random index
    const getRandomIndex = () => Math.floor(Math.random() * simRunFinal.length);
    
    const intervalId = setInterval(() => {
        if (ballCount >= maxBalls) {
            clearInterval(intervalId);
            return;
        }
      
        // 2. Grab a RANDOM simulation run, not sequential
        const runIndex = getRandomIndex();
        const runProb = simRunFinal[runIndex].winProb_A;
        
        // 3. COLLAPSE THE WAVE FUNCTION
        // Instead of checking if (runProb > 0.5), we roll the dice against the probability.
        // This ensures a 70% win prob results in ~70% of balls for Team A.
        const isTeamA = Math.random() < runProb;

        // 4. Set Position & Color based on the dice roll result
        // If isTeamA is true, drop on left (0.25). Else right (0.75).
        // Added some x-jitter (Math.random() * 40 - 20) so they don't stack in a perfect vertical line
        const xBase = isTeamA ? container.offsetWidth * 0.25 : container.offsetWidth * 0.75;
        const xPos = xBase + (Math.random() * 40 - 20);
      
        const radius = 5 + Math.random() * 5; 
        
        const ball = Bodies.circle(xPos, -30, radius, {
            restitution: 0.6,
            friction: 0.8,     
            label: 'ball',     
            render: {
                // Use the result of our dice roll for the color
                fillStyle: isTeamA ? App.data.teamA.primaryColor : App.data.teamB.primaryColor
            }
        });
      
        Composite.add(engine.world, ball);
        ballCount++;
    }, 10); // Faster drop rate (10ms) for smoother filling
}



// --- 2. Key Matchups Logic ---
function chartKeyMatchups(offTeam, defTeam, chtID) {
    //1. Get the data
    const labels = Object.keys(App.simulation.keyMatchup.find(obj=>obj.team_label === offTeam).averages);
    const values = Object.values(App.simulation.keyMatchup.find(obj=>obj.team_label === offTeam).averages);    
    
    //2. Check for existing chart and destroy it
    const canvas = document.getElementById(chtID);
    const existingChart = Chart.getChart(canvas); 
    if (existingChart) {
        existingChart.destroy();
    }
    
    //3. Initialize Chart.js
    const ctx = canvas.getContext('2d');
        
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,    
        datasets: [{
          label: 'Advantage Metrics',      
          data: values,
          // Optional: Color positive/negative bars differently
          backgroundColor: values.map(v => v >= 0 ? App.data[offTeam].primaryColor : App.data[defTeam].primaryColor),
          borderWidth: 1.5, 
          borderColor: 'rgba(50,50,50,.6)',
        }]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          scales: {
            x: { // Primary X-axis (Bottom)
              title: {
                display: true,
                text: `Negative Advantage (${App.data[defTeam].teamName} Wins the match up)`,
                color: App.data[defTeam].primaryColor,
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
                text: `Positive Advantage (${App.data[offTeam].teamName} Wins matchups)`,
                color: App.data[offTeam].primaryColor,
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



