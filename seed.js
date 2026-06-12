const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'pos_data.db');
const db = new sqlite3.Database(dbPath);

const run = (query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

async function seed() {
    try {
        console.log("Starting DB Seed...");

        // 1. Customers
        console.log("Seeding Customers...");
        await run(`INSERT INTO customers (name, phone, email) VALUES ('Saman Perera', '0771234567', 'saman@example.com')`);
        await run(`INSERT INTO customers (name, phone, email) VALUES ('Kamal Silva', '0719876543', 'kamal@example.com')`);
        await run(`INSERT INTO customers (name, phone, email) VALUES ('Nimal Fernando', '0723456789', 'nimal@example.com')`);
        const customerIdSaman = 1;

        // 2. Event Rooms
        console.log("Seeding Event Rooms...");
        await run(`INSERT INTO event_rooms (name, capacity, price_per_day, type, status) VALUES ('Grand Ballroom', 500, 150000, 'Hall', 'Available')`);
        await run(`INSERT INTO event_rooms (name, capacity, price_per_day, type, status) VALUES ('Orchid Room', 100, 50000, 'Meeting Room', 'Available')`);
        const roomIdBallroom = 1;

        // 3. Inquiries
        console.log("Seeding Inquiries...");
        await run(`INSERT INTO inquiries (ref_no, customer_name, customer_phone, event_type, status, source) VALUES ('INQ-001', 'Sunil Perera', '0771112223', 'Wedding', 'New', 'Website')`);
        await run(`INSERT INTO inquiries (ref_no, customer_name, customer_phone, event_type, status, source) VALUES ('INQ-002', 'Mahela Jay', '0714445556', 'Corporate Meeting', 'In Progress', 'Phone')`);

        // 4. Reservations
        console.log("Seeding Reservations...");
        // Res 1: Pending
        await run(`INSERT INTO reservations (event_name, customer_name, customer_phone, room_id, date_start, date_end, num_guests, status, total_price, booking_no) 
                   VALUES ('Birthday Bash', 'Saman Perera', '0771234567', 2, '2026-06-15T18:00:00Z', '2026-06-15T23:00:00Z', 50, 'Pending', 50000, 'BKG-0001')`);
        
        // Res 2: Confirmed (Will attach POS order)
        await run(`INSERT INTO reservations (event_name, customer_name, customer_phone, room_id, date_start, date_end, num_guests, status, total_price, booking_no) 
                   VALUES ('Annual General Meeting', 'Kamal Silva', '0719876543', 1, '2026-06-20T09:00:00Z', '2026-06-20T17:00:00Z', 200, 'Confirmed', 150000, 'BKG-0002')`);
        
        // Res 3: Completed (Will attach POS order and show up in Payments tab)
        await run(`INSERT INTO reservations (event_name, customer_name, customer_phone, room_id, date_start, date_end, num_guests, status, total_price, booking_no) 
                   VALUES ('Family Get-together', 'Nimal Fernando', '0723456789', 2, '2026-06-10T10:00:00Z', '2026-06-10T15:00:00Z', 30, 'Completed', 50000, 'BKG-0003')`);

        const res2Id = 2; // Confirmed
        const res3Id = 3; // Completed

        // 5. Waitlist
        console.log("Seeding Waitlist...");
        await run(`INSERT INTO waitlist (room_id, customer_name, customer_phone, date_start, date_end, num_guests, event_name)
                   VALUES (1, 'Ravi Kumar', '0751231234', '2026-06-20T09:00:00Z', '2026-06-20T17:00:00Z', 150, 'Product Launch')`);

        // 6. POS Orders for Reservations
        console.log("Seeding POS Orders...");
        
        // Order for Res 2 (Confirmed)
        const orderId1 = 'ORD-8888';
        await run(`INSERT INTO orders (id, total, date, status, order_type, payment_method, customer_id, reservation_id) 
                   VALUES (?, ?, ?, 'Completed', 'Dine In', 'Room', ?, ?)`, 
                   [orderId1, 1600, new Date().toISOString(), 2, res2Id]);
        
        // Order Items for Res 2
        await run(`INSERT INTO order_items (order_id, dish_id, qty, price_at_time) VALUES (?, 7, 2, 800)`, [orderId1]); // Assuming dish_id 7 exists (Kottu?)

        // Order for Res 3 (Completed)
        const orderId2 = 'ORD-9999';
        await run(`INSERT INTO orders (id, total, date, status, order_type, payment_method, customer_id, reservation_id) 
                   VALUES (?, ?, ?, 'Completed', 'Dine In', 'Room', ?, ?)`, 
                   [orderId2, 2700, new Date(Date.now() - 86400000).toISOString(), 3, res3Id]);
                   
        // Order Items for Res 3
        await run(`INSERT INTO order_items (order_id, dish_id, qty, price_at_time) VALUES (?, 10, 3, 900)`, [orderId2]); // Assuming dish_id 10 exists
        
        console.log("✅ Database Seeding Complete!");
        
    } catch (err) {
        console.error("Seeding Error:", err);
    } finally {
        db.close();
    }
}

seed();
