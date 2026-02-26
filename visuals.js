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

   
    //Add labels to the bucket
    Matter.Events.on(render, 'afterRender', () => {
        const context = render.context; // Access the canvas drawing context
        context.font = "bold 24px Arial";
        context.fillStyle = "#515151";
        context.textAlign = "center";
    
        // Position labels relative to the bucket coordinates you already defined
        const labelY = 400 - (container.offsetHeight * 0.25) - 80; // Slightly above the bucket top

        const tA_Name = (App.data.teamA.teamName) ? App.data.teamA.teamName : 'Team A';
        const tB_Name = (App.data.teamB.teamName) ? App.data.teamB.teamName : 'Team B';
        
        context.fillText(tA_Name, container.offsetWidth * 0.25, labelY);
        context.fillText(tB_Name, container.offsetWidth * 0.75, labelY);
    });
    
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
      
        // 1. Grab a RANDOM simulation run, not sequential
        const runIndex = getRandomIndex();
        const runProb = simRunFinal[runIndex].winProb_A;

        //2. Get Team Colors.  If the colors are too close (more than 85% overlap) then use secondary color for team B.  If Secondary is black use Third color
            const teamA_Color = App.data.teamA.primaryColor;
            const teamB_Color = (colorSimularity(App.data.teamA.primaryColor, App.data.teamB.primaryColor) < 85) 
                                ? App.data.teamB.primaryColor : (App.data.teamB.secondaryColor == '#000000') ? App.data.teamB.thirdColor : App.data.teamB.secondaryColor;
        
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
                fillStyle: isTeamA ? teamA_Color : teamB_Color
            }
        });
      
        Composite.add(engine.world, ball);
        ballCount++;
    }, 10); // Faster drop rate (10ms) for smoother filling
}



// --- 2. Key Matchups Logic ---
function chartKeyMatchups(offTeam, defTeam, chtID) {
    //1. Get the data
    const obj = App.simulation.keyMatchup.find(obj=>obj.team_label === offTeam).averages;
    const sortedObj = Object.fromEntries(
        Object.entries(obj).sort(([,a], [,b]) => b - a)
        );
    
    const labels = Object.keys(sortedObj);
    const values = Object.values(sortedObj);    

    //2. Get Team Colors.  If the colors are too close (more than 85% overlap) then use secondary color for team B.  If Secondary is black use Third color
    const offColor = App.data[offTeam].primaryColor;
    const defColor = (colorSimularity(App.data[offTeam].primaryColor, App.data[defTeam].primaryColor) < 85) 
                        ? App.data[defTeam].primaryColor : (App.data[defTeam].secondaryColor == '#000000') ? App.data[defTeam].thirdColor : App.data[defTeam].secondaryColor;
    
    //3. Check for existing chart and destroy it
    const canvas = document.getElementById(chtID);
    const existingChart = Chart.getChart(canvas); 
    if (existingChart) {
        existingChart.destroy();
    }
    
    //4. Initialize Chart.js
    const ctx = canvas.getContext('2d');
        
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,    
        datasets: [{
          label: 'Advantage Metrics',      
          data: values,
          // Optional: Color positive/negative bars differently
          backgroundColor: values.map(v => v >= 0 ? offColor : defColor),
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
                text: `${App.data[defTeam].teamName} Defense Wins the match up`,
                color: defColor,
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
                text: `Positive Advantage (${App.data[offTeam].teamName} Offense Wins matchups)`,
                color: offColor,
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



//3. Win % by Simulation Type
function chartWinPercent(chtID) {
    //1. Get the Data
    const obj = App.simulation.summary;
    const labels = obj.map(a=>a.runLabel);
    const values = obj.map(a=>a.p50);

    //2. Get Team Colors.  If the colors are too close (more than 85% overlap) then use secondary color for team B.  If Secondary is black use Third color
    const teamA_Color = App.data.teamA.primaryColor;
    const teamB_Color = (colorSimularity(App.data.teamA.primaryColor, App.data.teamB.primaryColor) < 85) 
                        ? App.data.teamB.primaryColor : (App.data.teamB.secondaryColor == '#000000') ? App.data.teamB.thirdColor : App.data.teamB.secondaryColor;
    
    //3. Check for existing chart and destroy it
    const canvas = document.getElementById('chart_win_percent');
    const existingChart = Chart.getChart(canvas); 
    if (existingChart) {
        existingChart.destroy();
    }
    
    //4. Initialize Chart.js
    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: App.data.teamA.teamName,
                    data: values,
                    backgroundColor: teamA_Color,
                    borderWidth: 1.5, 
                    borderColor: 'rgba(50,50,50,.6)',
                    stack: 'Stack 0',
                },
                {   label: App.data.teamB.teamName,
                    data: values.map(a=>1-a),
                    backgroundColor: teamB_Color,
                    borderWidth: 1.5, 
                    borderColor: 'rgba(50,50,50,.6)',
                    stack: 'Stack 0',
                }
            ]
        },
        options:{
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {position: 'top'},
                title: {
                    display: true,
                    text: 'Win % by Simulation Type'
                },
                tickFormat: {
                    style: 'percent',
                }
            }
        }
      
    });
    

    
}






//Helper Functions
function colorSimularity(color1, color2){
    //convert HEX to RGB
    const hexToRGB = hex => hex.replace('#', '').match(/.{1,2}/g).map(c=>parseInt(c,16));
    const [r1, g1, b1] = hexToRGB(color1);
    const [r2, g2, b2] = hexToRGB(color2);

    //apply Euclidean distance formula
    const distance = Math.sqrt(
        Math.pow(r2 - r1, 2) + 
        Math.pow(g2 - g1, 2) + 
        Math.pow(b2 - b1, 2)
    );

    //Max distance is 441.67 (sqrt of 255^2 + 255^2 + 255^2)
    //return a simularity score between 0% - 100%
    const maxDistance = 441.67;
    return (1-(distance / maxDistance)) * 100;
    
}
