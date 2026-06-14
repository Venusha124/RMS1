const API_URL = '/api';

const store = {
    data: {
        customers: [],
        eventRooms: [],
        reservations: [],
        inquiries: [],
        waitlist: [],
        maintenanceTasks: [],
        equipment: [],
        masterBookings: [],
        hotelRooms: [],
        hotelBookings: [],
        users: [],
        notifications: [],
        settings: { business_name: 'ASCENDIA', currency_symbol: 'Rs.' },
        currentUser: JSON.parse(localStorage.getItem('reservationUser')) || null
    },

    async fetchAPI(endpoint, options = {}) {
        const url = `${API_URL}${endpoint}`;
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (this.data.currentUser) {
            headers['x-user-id'] = this.data.currentUser.id;
            headers['x-user-role'] = this.data.currentUser.role;
        }
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response;
    },

    async init() {
        await this.refreshData();
        this.setupSocket();
        this.fetchNotifications();
    },

    setupSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io('http://localhost:302');
            this.socket.on('data_changed', async () => {
                const activeElement = document.activeElement;
                const activeId = activeElement ? activeElement.id : null;
                
                // Save form state safely
                const state = {};
                document.querySelectorAll('input, select, textarea').forEach(el => {
                    if (el.id) state[el.id] = el.value;
                });

                await this.refreshData();
                showToast('Data synced in real-time', 'info');

                // Re-render without breaking UI
                if (typeof navigate === 'function' && typeof currentRoute !== 'undefined') {
                    // Temporarily hide transition to avoid flickering if possible, or just call routes directly
                    const container = document.getElementById('app-view');
                    if (container && routes[currentRoute]) {
                        routes[currentRoute](container);
                        
                        // Restore form state safely
                        for (const [id, value] of Object.entries(state)) {
                            const el = document.getElementById(id);
                            if (el && el.value !== value) el.value = value;
                        }
                        
                        // Restore focus
                        if (activeId) {
                            const el = document.getElementById(activeId);
                            if (el) el.focus();
                        }
                    }
                }
            });
            this.socket.on('new_notification', (data) => {
                if (this.data.currentUser && this.data.currentUser.role === data.role) {
                    showToast(data.message, 'success');
                    this.fetchNotifications();
                }
            });
        }
    },

    async fetchNotifications() {
        if (!this.data.currentUser) return;
        const res = await this.fetchAPI('/notifications?role=' + this.data.currentUser.role);
        const data = await res.json();
        this.data.notifications = data.notifications || [];
        window.dispatchEvent(new CustomEvent('notifications_updated'));
    },

    async login(username, password) {
        try {
            const res = await this.fetchAPI('/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            this.data.currentUser = data.user;
            localStorage.setItem('reservationUser', JSON.stringify(data.user));
            window.dispatchEvent(new CustomEvent('auth_changed'));
            return { success: true };
        } catch (err) {
            return { success: false, error: "Invalid credentials or server error" };
        }
    },

    logout() {
        this.data.currentUser = null;
        localStorage.removeItem('reservationUser');
        window.dispatchEvent(new CustomEvent('auth_changed'));
    },

    async refreshData() {
        try {
            const [customers, eventRooms, reservations, inquiries, waitlist, maintenanceTasks, settings, equipment, masterBookings, hotelRooms, hotelBookings, users] = await Promise.all([
                this.fetchAPI('/customers').then(r => r.json()),
                this.fetchAPI('/event-rooms').then(r => r.json()),
                this.fetchAPI('/reservations').then(r => r.json()),
                this.fetchAPI('/inquiries').then(r => r.json()),
                this.fetchAPI('/waitlist').then(r => r.json()),
                this.fetchAPI('/maintenance-tasks').then(r => r.json()),
                this.fetchAPI('/settings').then(r => r.json()).catch(() => ({ business_name: 'ASCENDIA', currency_symbol: 'Rs.' })),
                this.fetchAPI('/equipment').then(r => r.json()).catch(() => []),
                this.fetchAPI('/master-bookings').then(r => r.json()).catch(() => []),
                this.fetchAPI('/hotel-rooms').then(r => r.json()).catch(() => []),
                this.fetchAPI('/hotel-reservations').then(r => r.json()).catch(() => []),
                this.fetchAPI('/users').then(r => r.json()).catch(() => [])
            ]);
            const sortDesc = (arr) => Array.isArray(arr) ? arr.sort((a, b) => (b.id || 0) - (a.id || 0)) : arr;
            this.data.customers        = sortDesc(customers);
            this.data.eventRooms       = eventRooms;
            this.data.reservations     = sortDesc(reservations);
            this.data.inquiries        = sortDesc(inquiries);
            this.data.waitlist         = sortDesc(waitlist);
            this.data.maintenanceTasks = sortDesc(maintenanceTasks);
            this.data.settings         = settings;
            this.data.equipment        = equipment;
            this.data.masterBookings   = sortDesc(masterBookings);
            this.data.hotelRooms       = hotelRooms;
            this.data.hotelBookings    = sortDesc(hotelBookings);
            this.data.users            = sortDesc(users);
            window.dispatchEvent(new CustomEvent('store_updated'));
        } catch (error) {
            console.error('Store refresh error:', error);
        }
    }
};
