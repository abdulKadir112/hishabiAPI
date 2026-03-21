const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();

// CORS setup
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'), false);
    }
  },
});

// MongoDB
const uri = process.env.MONGODB_URI || "mongodb+srv://ifter:ifter2026@ifter1.e6wwged.mongodb.net/ifterDB?retryWrites=true&w=majority";
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;

  const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
  });

  await client.connect();
  cachedDb = client.db('ifterDB');
  return cachedDb;
}

// Routes
app.get('/', (req, res) => res.send('Server is running'));

app.post(
  '/hishab',
  upload.fields([
    { name: 'donorImage', maxCount: 1 },
    { name: 'receiverImage', maxCount: 1 }
  ]),
  async (req, res) => {
    console.log('POST /hishab received');
    console.log('Body:', req.body);
    console.log('Files keys:', req.files ? Object.keys(req.files) : 'No files');

    try {
      const db = await connectToDatabase();
      const body = req.body || {};

      // Safe parsing
      const amount = Number(body.amount) || 0;
      if (amount <= 0) {
        return res.status(400).json({ success: false, error: 'Valid amount required' });
      }

      const newTransaction = {
        type: body.type || 'donation',
        amount: amount,
        note: (body.note || body.reason || body.description || '').trim(),
        date: body.date || new Date().toISOString().split('T')[0],

        donorName: (body.donorName || '').trim(),
        donorPhone: (body.donorPhone || '').trim(),
        donorAddress: (body.donorAddress || '').trim(),
        donorImage: null, // placeholder - later add real upload

        receiverName: (body.receiverName || '').trim(),
        receiverPhone: (body.receiverPhone || '').trim(),
        receiverAddress: (body.receiverAddress || '').trim(),
        receiverImage: null,

        createdAt: new Date(),
      };

      console.log('newTransaction ready:', newTransaction);

      const result = await db.collection('hishab').insertOne(newTransaction);

      res.status(201).json({
        success: true,
        insertedId: result.insertedId.toString(),
        message: 'Transaction added successfully'
      });
    } catch (err) {
      console.error('POST /hishab ERROR:', err.message);
      console.error('Full error:', err.stack);
      res.status(500).json({ 
        success: false, 
        error: err.message || 'Server error during insertion' 
      });
    }
  }
);

// GET all
app.get('/hishab', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const transactions = await db.collection('hishab')
      .find({})
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    let totalDonation = 0;
    let totalExpense = 0;

    const processed = transactions.map(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'donation') totalDonation += amt;
      if (t.type === 'expense') totalExpense += amt;

      return {
        ...t,
        _id: t._id.toString(),
        amount: amt,
        note: t.note || '',
      };
    });

    res.json({
      transactions: processed,
      totalDonation,
      totalExpense,
      netBalance: totalDonation - totalExpense
    });
  } catch (err) {
    console.error('GET /hishab error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE
app.delete('/hishab/:id', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection('hishab').deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}