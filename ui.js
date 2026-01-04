document.addEventListener('DOMContentLoaded', () => {
    
    // --- Tabs Logic ---
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // --- Accordion Logic ---
    const accHeaders = document.querySelectorAll('.accordion-header');

    accHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            
            // Optional: Close others? For now, we allow multiple open
            item.classList.toggle('active');
        });
    });

    // --- Mobile Sidebar Logic ---
    const mobileBtn = document.getElementById('mobile-settings-btn');
    const closeSidebarBtn = document.getElementById('close-mobile-sidebar');
    const sidebar = document.getElementById('sidebar');

    if (mobileBtn) {
        mobileBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
        });
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    }

    // --- Placeholder Button Logic ---
    document.getElementById('run-sim-btn').addEventListener('click', () => {
        console.log("Run Simulation Triggered");
        // Phase 2 will hook this into the Math engine
    });

    // Bind the new Mobile FAB button
    const mobileRunBtn = document.getElementById('mobile-run-btn');
    if (mobileRunBtn) {
        mobileRunBtn.addEventListener('click', () => {
            // Trigger the exact same logic as the desktop button
            if (typeof runSimulationController === "function") {
                runSimulationController();
            }
        });
    }
    
    // OPTIONAL: If they DO use the desktop button while the sidebar is open on mobile, close the sidebar automatically
    document.getElementById('run-sim-btn').addEventListener('click', () => {
        // Check if we are on mobile (sidebar has 'open' class)
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
        
        // Existing logic trigger
        if (typeof runSimulationController === "function") {
            runSimulationController();
        }
    });



});
