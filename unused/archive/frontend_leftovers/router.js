export class Router {
    constructor(routes) {
        this.routes = routes;
        this.appContainer = document.getElementById('app-content');
        this.currentView = null;
    }

    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute(); // Handle initial load
    }

    async handleRoute() {
        const hash = window.location.hash || '#dashboard';
        const route = this.routes[hash] || this.routes['#dashboard'];

        if (this.currentView && this.currentView.unmount) {
            this.currentView.unmount();
        }

        // Clear container
        this.appContainer.innerHTML = '';

        // Initialize new view
        this.currentView = new route.view();
        
        // Render template
        this.appContainer.innerHTML = await this.currentView.render();
        
        // Mount logic (event listeners, etc.)
        if (this.currentView.mount) {
            await this.currentView.mount();
        }

        // Update active nav state
        this.updateNav(hash);
    }

    updateNav(hash) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('bg-slate-100', 'text-indigo-700');
            link.classList.add('text-slate-600');
            if (link.getAttribute('href') === hash) {
                link.classList.add('bg-slate-100', 'text-indigo-700');
                link.classList.remove('text-slate-600');
            }
        });
    }
}
