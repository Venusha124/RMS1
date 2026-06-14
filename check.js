const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
    <div id="content"></div>
    <div id="chk_items_body"></div>
</body>
</html>
`, { runScripts: "dangerously", url: "http://localhost/" });

const window = dom.window;
global.window = window;
global.document = window.document;
global.$ = (id) => document.getElementById(id);
global.store = {
    data: {
        reservations: [{id: 1, status: 'Confirmed'}],
        eventRooms: [{id: 1, name: 'Room 1', price_per_day: 100, capacity: 50}],
        inquiries: [{ref_no: 'INQ-001', customer_name: 'Test'}],
        waitlist: []
    }
};
global.sym = () => 'Rs.';
global.formatCurrency = (v) => 'Rs.' + v;
global.formatDate = (v) => v;
global.statusBadge = (v) => v;
global.reservationTable = (res, opts) => '';

// Load app.js (mocking fetch and other things to avoid errors)
const appJsCode = fs.readFileSync('reservation-app/assets/js/app.js', 'utf8');

try {
    window.eval(appJsCode);
    console.log("Loaded app.js successfully");
    
    // Attempt to run renderBooking
    const c = document.getElementById('content');
    window.renderBooking(c);
    console.log("renderBooking ran successfully! Output length:", c.innerHTML.length);
} catch (e) {
    console.error("ERROR running app.js or renderBooking:");
    console.error(e.stack);
}
