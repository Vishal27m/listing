const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
require('dotenv').config();



const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to database');
  }
});


// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'www')));

// Endpoint to handle registration
app.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  db.query(
    'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
    [username, email, password],
    (err) => {
      if (err) {
        console.error('Error registering user:', err);
        res.status(500).send('Error registering user');
        return;
      }
      res.send('User registered successfully');
    }
  );
});

// Endpoint to handle login and generate JWT token
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.query(
    'SELECT * FROM users WHERE username = ? AND password = ?',
    [username, password],
    (err, results) => {
      if (err) {
        console.error('Error logging in:', err);
        res.status(500).send('Error logging in');
        return;
      }
      if (results.length > 0) {
        const user = results[0];

        res.json({ message: 'Login successful', token });
      } else {
        res.status(400).send('Invalid username or password');
      }
    }
  );
});



// Logout user
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});


app.post('/listin', (req, res) => {
  const { title, description, category, starting_bid, bid_owner, password, location } = req.body;

  // Validate required fields
  if (!title || !description || !category || !starting_bid || !bid_owner || !password || !location) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const query = `
    INSERT INTO listings (title, description, category, starting_bid, bid_owner, password, location, status, start_date) 
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW())
  `;

  db.query(query, [title, description, category, starting_bid, bid_owner, password, location], (err, results) => {
    if (err) {
      console.error('SQL Error:', err.sqlMessage || err);
      return res.status(500).json({ error: 'Failed to create listing', details: err.sqlMessage || err });
    } 
    res.json({ id: results.insertId, message: 'Listing created successfully' });
  });
});




// Fetch active listings
app.get('/api/listings', (req, res) => {
  const query = 'SELECT * FROM listings WHERE status = "active"';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching listings:', err);
      res.status(500).json({ error: 'Failed to fetch listings' });
      return;
    }
    res.json({ listings: results });
  });
});

// Fetch listings by category
app.get('/api/listings/:category', (req, res) => {
  const category = req.params.category;
  const query = 'SELECT * FROM listings WHERE category = ? AND status = "active"';
  db.query(query, [category], (err, results) => {
    if (err) {
      console.error('Error fetching category listings:', err);
      res.status(500).json({ error: 'Failed to fetch listings for category' });
      return;
    }
    res.json({ listings: results });
  });
});

// Place a bid with bidder name validation
app.post('/api/bid/:id', (req, res) => {
  const listingId = req.params.id;
  let { bidAmount, bidderName } = req.body;

  // Validate bidder's name (only letters & spaces allowed)
  const nameRegex = /^[A-Za-z\s]+$/;
  if (!bidderName || !nameRegex.test(bidderName.trim())) {
    return res.status(400).json({ error: 'Bidder name must contain only letters and spaces' });
  }

  if (!bidAmount || isNaN(bidAmount) || bidAmount <= 0) {
    return res.status(400).json({ error: 'Invalid bid amount' });
  }

  const querySelect = 'SELECT current_bid FROM listings WHERE id = ?';
  db.query(querySelect, [listingId], (err, results) => {
    if (err) {
      console.error('Error fetching current bid:', err);
      return res.status(500).json({ error: 'Failed to fetch current bid' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const currentBid = results[0].current_bid || 0;

    if (parseFloat(bidAmount) <= parseFloat(currentBid)) {
      return res.status(400).json({ error: `Bid must be higher than the current bid ($${currentBid})` });
    }

    const queryUpdate = 'UPDATE listings SET current_bid = ?, bidder_name = ? WHERE id = ?';
    db.query(queryUpdate, [bidAmount, bidderName.trim(), listingId], (err) => {
      if (err) {
        console.error('Error updating bid:', err);
        return res.status(500).json({ error: 'Failed to update bid' });
      }
      res.json({ success: true, message: 'Bid placed successfully', newBid: bidAmount, bidder: bidderName.trim() });
    });
  });
});


// Endpoint to close bidding
app.post('/api/close-bid/:listingId', (req, res) => {
  const { listingId } = req.params;
  const { bidOwnerName, password, currentBid, bidderName } = req.body;

  // Check the credentials in the database
  db.query(
    'SELECT * FROM listings WHERE id = ? AND bid_owner = ? AND password = ?',
    [listingId, bidOwnerName, password],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }

      if (results.length === 0) {
        return res.status(400).json({ error: 'Invalid credentials or listing owner' });
      }

      // Update the listing status to 'closed' and set the winner
      db.query(
        'UPDATE listings SET status = ?, bid_winner = ? WHERE id = ?',
        ['closed', bidderName, listingId],
        (err, results) => {
          if (err) {
            return res.status(500).json({ error: 'Error closing bid' });
          }

          res.status(200).json({ success: true, message: 'Bidding closed successfully' });
        }
      );
    }
  );
});

// Fetch closed listings by category
app.get('/api/listings/:category/closed', (req, res) => {
  const category = req.params.category;
  const query = 'SELECT * FROM listings WHERE category = ? AND status = "Closed"';
  
  db.query(query, [category], (err, results) => {
    if (err) {
      console.error('Error fetching closed category listings:', err);
      res.status(500).json({ error: 'Failed to fetch closed listings for category' });
      return;
    }
    res.json({ listings: results });
  });
});


app.use(express.json());

// Endpoint to validate bid_owner and password, and fetch the created listings
app.post("/api/dashboard-data", (req, res) => {
  const { bid_owner, password } = req.body;

  // Query to validate the user's credentials and get created listings
  const query = `
    SELECT * FROM listings
    WHERE bid_owner = ? AND password = ?
  `;
  db.query(query, [bid_owner, password], (err, results) => {
    if (err) {
      console.error("Error fetching listings: ", err);
      return res.status(500).json({ error: "Failed to fetch listings" });
    }

    if (results.length > 0) {
      // Query to fetch the listings created by the user (bid_owner matches)
      const listingsQuery = `
        SELECT id, title, status, current_bid FROM listings WHERE bid_owner = ?
      `;
      db.query(listingsQuery, [bid_owner], (err, createdListings) => {
        if (err) {
          console.error("Error fetching created listings: ", err);
          return res.status(500).json({ error: "Failed to fetch created listings" });
        }

        return res.json({
          success: true,
          createdListings: createdListings,
        });
      });
    } else {
      return res.json({ success: false, error: "Invalid bid owner or password" });
    }
  });
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
