const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Book = require('./models/book');
const { spawn } = require('child_process');
const path = require('path');
const cron = require('node-cron');


require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI);

app.get('/api/books', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      minRating = 0,
      maxRating = 5,
      minPrice = 0,
      maxPrice = 1000,
      stock = 'all'
    } = req.query;

    let filter = {
      rating: { $gte: parseInt(minRating), $lte: parseInt(maxRating) },
      price: { $gte: parseFloat(minPrice), $lte: parseFloat(maxPrice) }
    };

    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    if (stock !== 'all') {
      filter.stock = stock === 'in-stock' ? 'In stock' : 'Out of stock';
    }

    const books = await Book.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ title: 1 });

    const total = await Book.countDocuments(filter);

    res.json({
      books,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalBooks: total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json(book);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/refresh', async (req, res) => {
  try {
    console.log('🔄 Refresh endpoint triggered - Starting scraper...');
    
    const scraperPath = path.join(__dirname, '../scraper/scraper.js');
    
    const scraperProcess = spawn('node', [scraperPath], {
      stdio: 'pipe'
    });

    scraperProcess.stdout.on('data', (data) => {
      console.log(`📊 Scraper: ${data}`);
    });

    scraperProcess.stderr.on('data', (data) => {
      console.error(` Scraper Error: ${data}`);
    });

    scraperProcess.on('close', (code) => {
      console.log(` Scraper process finished with code: ${code}`);
    });

    res.json({
      success: true,
      message: 'Data refresh initiated successfully',
      timestamp: new Date().toISOString(),
      status: 'Scraper started in background'
    });

  } catch (error) {
    console.error(' Error triggering scraper:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger data refresh',
      message: error.message
    });
  }
});


app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

cron.schedule('0 2 * * *', () => {
  console.log('🕐 Scheduled scraper execution started at:', new Date().toISOString());
  
  const scraperPath = path.join(__dirname, '../scraper/scraper.js');
  const scraperProcess = spawn('node', [scraperPath]);

  scraperProcess.stdout.on('data', (data) => {
    console.log(`📊 Scheduled Scraper: ${data}`);
  });

  scraperProcess.stderr.on('data', (data) => {
    console.error(` Scheduled Scraper Error: ${data}`);
  });

  scraperProcess.on('close', (code) => {
    console.log(` Scheduled scraper completed with code: ${code}`);
  });
}, {
  timezone: "Asia/Kolkata"  
});

console.log(' Cron job scheduled: Daily scraper at 2:00 AM IST');


app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
